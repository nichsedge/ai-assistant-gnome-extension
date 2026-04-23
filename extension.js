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

export default class AIAssistantExtension extends Extension {
    enable() {
        this._settings = this.getSettings();
        
        // Setup top panel indicator
        this._indicator = new PanelMenu.Button(0.0, this.metadata.name, false);
        let icon = new St.Icon({
            icon_name: 'accessories-text-editor-symbolic',
            style_class: 'system-status-icon',
        });
        this._indicator.add_child(icon);
        this._indicator.connect('button-press-event', (actor, event) => {
            if (event.get_button() === Clutter.BUTTON_PRIMARY) {
                this._processClipboard();
                return Clutter.EVENT_STOP;
            }
            return Clutter.EVENT_PROPAGATE;
        });
        Main.panel.addToStatusArea(this.uuid, this._indicator);

        // Setup global shortcut
        Main.wm.addKeybinding(
            'shortcut',
            this._settings,
            Meta.KeyBindingFlags.NONE,
            Shell.ActionMode.NORMAL | Shell.ActionMode.MESSAGE_TRAY,
            () => this._processClipboard()
        );

        this._httpSession = new Soup.Session();
        this._httpSession.timeout = this._settings.get_int('request-timeout');
    }

    disable() {
        if (this._indicator) {
            this._indicator.destroy();
            this._indicator = null;
        }

        Main.wm.removeKeybinding('shortcut');
        this._settings = null;
        this._httpSession = null;
    }

    _processClipboard() {
        // Read text from clipboard
        const clipboard = St.Clipboard.get_default();
        clipboard.get_text(St.ClipboardType.CLIPBOARD, (clipboard, text) => {
            if (!text || text.trim() === '') {
                Main.notify('AI Assistant', 'No text found in clipboard. Please copy some text first.');
                return;
            }

            this._callOpenAI(text);
        });
    }

    async _callOpenAI(text) {
        let apiKey = this._settings.get_string('api-key');
        const apiProvider = this._settings.get_string('api-provider');
        
        if (!apiKey && apiProvider !== 'ollama') {
            Main.notify('AI Assistant Error', `API Key is missing for ${apiProvider}. Please set it in preferences.`);
            return;
        }

        const baseUrl = this._settings.get_string('api-base-url') || 'https://api.openai.com/v1';
        let customUrl = baseUrl;
        if (!customUrl.endsWith('/chat/completions')) {
            if (customUrl.endsWith('/')) {
                customUrl += 'chat/completions';
            } else {
                customUrl += '/chat/completions';
            }
        }

        const model = this._settings.get_string('api-model') || 'gpt-4o-mini';
        const customInstruction = this._settings.get_string('custom-instruction') || 'Fix grammar.';
        const blockedWordsStr = this._settings.get_string('blocked-words') || '';
        const blockedWords = blockedWordsStr.split(',').map(w => w.trim()).filter(w => w);
        const temperature = this._settings.get_double('temperature');
        const maxTokens = this._settings.get_int('max-tokens');

        let systemPrompt = customInstruction;
        if (blockedWords.length > 0) {
            systemPrompt += `\n\nCRITICAL RULE: Do NOT use the following words under any circumstances: ${blockedWords.join(', ')}`;
        }

        Main.notify('AI Assistant', 'Processing text...');

        const requestBody = {
            model: model,
            messages: [
                { role: 'system', content: systemPrompt },
                { role: 'user', content: text }
            ],
            temperature: temperature,
            max_tokens: maxTokens > 0 ? maxTokens : undefined,
        };

        const message = Soup.Message.new('POST', customUrl);
        if (apiProvider !== 'ollama' || apiKey) {
            message.request_headers.append('Authorization', `Bearer ${apiKey}`);
        }
        message.request_headers.append('Content-Type', 'application/json');

        const extraHeadersStr = this._settings.get_string('api-extra-headers');
        if (extraHeadersStr) {
            try {
                const extraHeaders = JSON.parse(extraHeadersStr);
                for (let key in extraHeaders) {
                    message.request_headers.append(key, extraHeaders[key]);
                }
            } catch (e) {
                console.error("AI Assistant: Failed to parse extra headers", e);
            }
        }
        
        const encoder = new TextEncoder();
        const bytes = new GLib.Bytes(encoder.encode(JSON.stringify(requestBody)));
        message.set_request_body_from_bytes('application/json', bytes);

        try {
            const bytesReceived = await this._httpSession.send_and_read_async(message, GLib.PRIORITY_DEFAULT, null);
            const decoder = new TextDecoder('utf-8');
            const responseStr = decoder.decode(bytesReceived.get_data());
            
            if (message.status_code === 200) {
                const responseData = JSON.parse(responseStr);
                const resultText = responseData?.choices?.[0]?.message?.content;

                if (!resultText) {
                    Main.notify('AI Assistant Error', 'Unexpected response format from API.');
                    console.error('AIAssistant: Unexpected response:', responseStr);
                    return;
                }

                // Write back to clipboard
                const clipboard = St.Clipboard.get_default();
                clipboard.set_text(St.ClipboardType.CLIPBOARD, resultText);
                
                Main.notify('AI Assistant', 'Done! Text copied to clipboard. (Ctrl+V to paste)');
            } else {
                Main.notify('AI Assistant Error', `API Error: ${message.status_code}`);
                console.error(`AIAssistant HTTP Error: ${responseStr}`);
            }
        } catch (e) {
            Main.notify('AI Assistant Error', `Failed to connect: ${e.message}`);
            console.error(e);
        }
    }
}
