import { Extension } from 'resource:///org/gnome/shell/extensions/extension.js';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import * as PanelMenu from 'resource:///org/gnome/shell/ui/panelMenu.js';
import St from 'gi://St';
import Soup from 'gi://Soup?version=3.0';
import Gio from 'gi://Gio';
import GLib from 'gi://GLib';
import Meta from 'gi://Meta';
import Shell from 'gi://Shell';
import Clutter from 'gi://Clutter';
import GObject from 'gi://GObject';
import * as PopupMenu from 'resource:///org/gnome/shell/ui/popupMenu.js';
import * as ModalDialog from 'resource:///org/gnome/shell/ui/modalDialog.js';

const ResultDialog = GObject.registerClass(
class ResultDialog extends ModalDialog.ModalDialog {
    _init(text, callback, retryCallback = null) {
        super._init();
        this._destroyed = false;
        this.connect('destroy', () => { this._destroyed = true; });

        this._callback = callback;
        this._retryCallback = retryCallback;

        const content = new St.BoxLayout({
            vertical: true,
            style_class: 'ai-assistant-dialog-content',
        });

        const title = new St.Label({
            text: 'AI Assistant Result',
            style_class: 'ai-assistant-dialog-title',
        });
        content.add_child(title);

        const scrollView = new St.ScrollView({
            style_class: 'ai-assistant-dialog-scroll',
            hscrollbar_policy: St.PolicyType.NEVER,
            vscrollbar_policy: St.PolicyType.AUTOMATIC,
            overlay_scrollbars: true,
            height: 400,
            width: 600,
        });
        content.add_child(scrollView);

        this._label = new St.Label({
            text: text,
            style_class: 'ai-assistant-dialog-text',
        });
        this._label.clutter_text.line_wrap = true;
        this._label.clutter_text.selectable = true;
        scrollView.add_child(this._label);

        this.contentLayout.add_child(content);

        const buttons = [
            {
                label: 'Copy & Close',
                action: () => {
                    this._callback(this._label.text);
                    this.close();
                },
                key: Clutter.KEY_Return,
            },
            {
                label: 'Copy',
                action: () => {
                    this._callback(this._label.text);
                }
            }
        ];

        if (this._retryCallback) {
            buttons.push({
                label: 'Regenerate',
                action: () => {
                    this._retryCallback();
                },
                key: Clutter.KEY_r,
            });
        }

        buttons.push({
            label: 'Close',
            action: () => this.close(),
            key: Clutter.KEY_Escape,
        });

        this.setButtons(buttons);
    }

    updateText(text) {
        if (this._destroyed || !this._label) return;
        this._label.text = text;
    }
});

export default class AIAssistantExtension extends Extension {
    enable() {
        this._settings = this.getSettings();
        this._settingsSignals = [];
        this._activeRequest = null;
        this._indicator = new PanelMenu.Button(0.0, this.metadata.name, false);
        this._icon = new St.Icon({
            icon_name: 'accessories-text-editor-symbolic',
            style_class: 'system-status-icon',
        });
        this._indicator.add_child(this._icon);
        this._indicator.connect('button-press-event', (actor, event) => {
            if (event.get_button() === Clutter.BUTTON_PRIMARY) {
                this._processClipboard();
                return Clutter.EVENT_STOP;
            }
            return Clutter.EVENT_PROPAGATE;
        });

        this._buildMenu();
        this._settingsSignals.push(this._settings.connect('changed::presets-json', () => this._buildMenu()));
        this._settingsSignals.push(this._settings.connect('changed::active-preset-index', () => this._buildMenu()));

        Main.panel.addToStatusArea(this.uuid, this._indicator);

        Main.wm.addKeybinding(
            'shortcut',
            this._settings,
            Meta.KeyBindingFlags.NONE,
            Shell.ActionMode.NORMAL | Shell.ActionMode.MESSAGE_TRAY,
            () => this._processClipboard()
        );

        this._httpSession = new Soup.Session();
        this._httpSession.timeout = this._settings.get_int('request-timeout');
        this._settingsSignals.push(this._settings.connect('changed::request-timeout', () => {
            if (this._httpSession)
                this._httpSession.timeout = this._settings.get_int('request-timeout');
        }));
    }

    disable() {
        this._cancelActiveRequest();
        if (this._settings && this._settingsSignals)
            this._settingsSignals.forEach(id => this._settings.disconnect(id));
        if (this._indicator) {
            this._indicator.destroy();
            this._indicator = null;
        }
        Main.wm.removeKeybinding('shortcut');
        this._settingsSignals = null;
        this._settings = null;
        this._httpSession = null;
    }

    _buildMenu() {
        this._indicator.menu.removeAll();
        const presets = this._getPresets();
        const activeIndex = this._settings.get_int('active-preset-index');

        presets.forEach((preset, index) => {
            const isActive = index === activeIndex;
            const item = new PopupMenu.PopupImageMenuItem(
                preset.name, 
                isActive ? 'emblem-favorite-symbolic' : 'star-new-symbolic'
            );
            item.connect('activate', () => {
                this._processClipboard(preset);
            });
            if (isActive) item.setOrnament(PopupMenu.Ornament.CHECK);
            this._indicator.menu.addMenuItem(item);
        });

        this._indicator.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());
        this._indicator.menu.addAction('Preferences...', () => this.openPreferences());
    }

    _getPresets() {
        try {
            const presets = JSON.parse(this._settings.get_string('presets-json'));
            if (Array.isArray(presets)) {
                const normalized = presets
                    .filter(p => p && typeof p === 'object')
                    .map((p, index) => ({
                        name: typeof p.name === 'string' && p.name.trim() ? p.name : `Preset ${index + 1}`,
                        instruction: typeof p.instruction === 'string' ? p.instruction : '',
                    }));
                if (normalized.length > 0)
                    return normalized;
            }
        } catch (e) {}
        return [{ name: 'Default', instruction: this._settings.get_string('custom-instruction') }];
    }

    _normalizePresetState() {
        const presets = this._getPresets();
        const activeIndex = this._settings.get_int('active-preset-index');
        const clampedActiveIndex = Math.max(0, Math.min(activeIndex, presets.length - 1));
        if (activeIndex !== clampedActiveIndex)
            this._settings.set_int('active-preset-index', clampedActiveIndex);
        this._settings.set_string('presets-json', JSON.stringify(presets));
        return { presets, activeIndex: clampedActiveIndex };
    }

    _cancelActiveRequest() {
        if (!this._activeRequest)
            return;
        this._activeRequest.cancelled = true;
        if (this._activeRequest.cancellable)
            this._activeRequest.cancellable.cancel();
        this._activeRequest = null;
        this._resetUI();
    }

    _processClipboard(specificPreset = null) {
        const usePrimary = this._settings.get_boolean('use-primary-selection');
        const clipboard = St.Clipboard.get_default();
        if (usePrimary) {
            clipboard.get_text(St.ClipboardType.PRIMARY, (cb, text) => {
                if (text && text.trim() !== '') this._callOpenAI(text, specificPreset);
                else this._readStandardClipboard(specificPreset);
            });
        } else {
            this._readStandardClipboard(specificPreset);
        }
    }

    _readStandardClipboard(specificPreset = null) {
        const clipboard = St.Clipboard.get_default();
        clipboard.get_text(St.ClipboardType.CLIPBOARD, (cb, text) => {
            if (!text || text.trim() === '') {
                Main.notify('AI Assistant', 'No text found in selection or clipboard.');
                return;
            }
            this._callOpenAI(text, specificPreset);
        });
    }

    async _callOpenAI(text, specificPreset = null) {
        let dialog;
        try {
            this._cancelActiveRequest();
            const cancellable = new Gio.Cancellable();
            const requestState = { cancellable, cancelled: false };
            this._activeRequest = requestState;

            const apiKey = this._settings.get_string('api-key');
            const apiProvider = this._settings.get_string('api-provider');
            if (!apiKey && apiProvider !== 'ollama') {
                Main.notify('AI Assistant Error', `API Key is missing for ${apiProvider}.`);
                this._activeRequest = null;
                return;
            }

            let customUrl = this._settings.get_string('api-base-url') || 'https://api.openai.com/v1';
            if (!customUrl.endsWith('/chat/completions')) {
                customUrl += customUrl.endsWith('/') ? 'chat/completions' : '/chat/completions';
            }

            const model = this._settings.get_string('api-model') || 'gpt-4o-mini';
            const { presets, activeIndex } = this._normalizePresetState();
            const instruction = specificPreset ? specificPreset.instruction : (presets[activeIndex]?.instruction || this._settings.get_string('custom-instruction'));

            const blockedWordsStr = this._settings.get_string('blocked-words') || '';
            const blockedWords = blockedWordsStr.split(',').map(w => w.trim()).filter(w => w);
            let systemPrompt = instruction;
            if (blockedWords.length > 0) {
                systemPrompt += `\n\nCRITICAL RULE: Do NOT use the following words: ${blockedWords.join(', ')}`;
            }

            this._icon.icon_name = 'view-refresh-symbolic';
            this._indicator.add_style_class_name('busy');
            
            const showDialog = this._settings.get_boolean('show-result-window');
            if (showDialog) {
                dialog = new ResultDialog(text, (result) => {
                    const clipboard = St.Clipboard.get_default();
                    clipboard.set_text(St.ClipboardType.CLIPBOARD, result);
                }, () => this._callOpenAI(text, specificPreset));
                dialog.open();
                dialog.updateText('Thinking...');
            } else {
                Main.notify('AI Assistant', 'Processing request...');
            }

            const requestBody = {
                model: model,
                messages: [{ role: 'system', content: systemPrompt }, { role: 'user', content: text }],
                temperature: this._settings.get_double('temperature'),
                max_tokens: this._settings.get_int('max-tokens') || undefined,
                stream: true
            };

            const message = Soup.Message.new('POST', customUrl);
            if (apiProvider !== 'ollama' || apiKey) message.request_headers.append('Authorization', `Bearer ${apiKey}`);
            message.request_headers.append('Content-Type', 'application/json');

            const extraHeadersStr = this._settings.get_string('api-extra-headers');
            if (extraHeadersStr) {
                try {
                    const extraHeaders = JSON.parse(extraHeadersStr);
                    for (const [k, v] of Object.entries(extraHeaders)) message.request_headers.append(k, v);
                } catch (e) {}
            }
            if (apiProvider === 'openrouter') {
                message.request_headers.append('HTTP-Referer', 'https://github.com/nichsedge/ai-assistant-gnome-extension');
                message.request_headers.append('X-OpenRouter-Title', 'GNOME AI Assistant');
            }

            const bytes = new GLib.Bytes(new TextEncoder().encode(JSON.stringify(requestBody)));
            message.set_request_body_from_bytes('application/json', bytes);

            const inputStream = await new Promise((resolve, reject) => {
                this._httpSession.send_async(message, GLib.PRIORITY_DEFAULT, cancellable, (s, res) => {
                    try { resolve(s.send_finish(res)); } catch (e) { reject(e); }
                });
            });
            if (requestState.cancelled || this._activeRequest !== requestState)
                return;

            if (message.status_code !== 200) {
                const errBytes = message.response_body.flatten().get_data();
                const errText = `Error ${message.status_code}: ${new TextDecoder().decode(errBytes)}`;
                if (dialog) dialog.updateText(errText);
                else Main.notify('AI Assistant Error', errText);
                this._resetUI();
                return;
            }

            let fullText = '';
            const decoder = new TextDecoder('utf-8');
            const dataInputStream = new Gio.DataInputStream({ base_stream: inputStream });

            while (!dialog || !dialog._destroyed) {
                const [line, len] = await new Promise((resolve, reject) => {
                    dataInputStream.read_line_async(GLib.PRIORITY_DEFAULT, cancellable, (s, res) => {
                        try { resolve(s.read_line_finish(res)); } catch (e) { reject(e); }
                    });
                });
                if (line === null) break;

                const lineStr = decoder.decode(line).trim();
                if (lineStr.startsWith('data: ')) {
                    const data = lineStr.slice(6);
                    if (data === '[DONE]') break;
                    try {
                        const json = JSON.parse(data);
                        const content = json.choices?.[0]?.delta?.content || '';
                        fullText += content;
                        if (dialog) dialog.updateText(fullText);
                    } catch (e) {}
                }
            }
            if (requestState.cancelled || this._activeRequest !== requestState)
                return;
            this._resetUI();
            this._activeRequest = null;
            if (fullText) {
                const clipboard = St.Clipboard.get_default();
                clipboard.set_text(St.ClipboardType.CLIPBOARD, fullText);
                if (!dialog) Main.notify('AI Assistant', 'Result copied to clipboard!');
            } else if (!dialog || !dialog._destroyed) {
                const emptyMsg = 'Received empty response from API.';
                if (dialog) dialog.updateText(emptyMsg);
                else Main.notify('AI Assistant Error', emptyMsg);
            }
        } catch (e) {
            if (e instanceof GLib.Error && e.matches(Gio.IOErrorEnum, Gio.IOErrorEnum.CANCELLED))
                return;
            if (this._activeRequest && this._activeRequest.cancelled) {
                this._activeRequest = null;
                return;
            }
            this._activeRequest = null;
            this._resetUI();
            if (dialog && !dialog._destroyed) dialog.updateText(`Error: ${e.message}`);
            else Main.notify('AI Assistant Error', e.message);
        }
    }

    _resetUI() {
        this._icon.icon_name = 'accessories-text-editor-symbolic';
        this._indicator.remove_style_class_name('busy');
    }
}
