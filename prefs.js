import Gio from 'gi://Gio';
import Gtk from 'gi://Gtk?version=4.0';
import Adw from 'gi://Adw?version=1';
import Gdk from 'gi://Gdk?version=4.0';
import { ExtensionPreferences } from 'resource:///org/gnome/Shell/Extensions/js/extensions/prefs.js';

export default class AIAssistantPreferences extends ExtensionPreferences {
    fillPreferencesWindow(window) {
        window._settings = this.getSettings();
        const defaultInstruction = window._settings.get_string('custom-instruction');
        const normalizePresets = () => {
            let presets = [];
            try {
                const parsed = JSON.parse(window._settings.get_string('presets-json'));
                if (Array.isArray(parsed))
                    presets = parsed;
            } catch (e) {}

            presets = presets
                .filter(p => p && typeof p === 'object')
                .map((p, index) => ({
                    name: typeof p.name === 'string' && p.name.trim() ? p.name : `Preset ${index + 1}`,
                    instruction: typeof p.instruction === 'string' ? p.instruction : '',
                }));

            if (presets.length === 0) {
                presets = [{
                    name: 'Default',
                    instruction: defaultInstruction,
                }];
            }

            const activeIndex = window._settings.get_int('active-preset-index');
            const clamped = Math.max(0, Math.min(activeIndex, presets.length - 1));
            if (clamped !== activeIndex)
                window._settings.set_int('active-preset-index', clamped);
            window._settings.set_string('presets-json', JSON.stringify(presets));
            return presets;
        };

        // ─── Presets Group ─────────────────────────────────────────────────────────
        const page = new Adw.PreferencesPage();
        
        const presetsGroup = new Adw.PreferencesGroup({ 
            title: 'Presets',
            description: 'Manage your AI prompt presets. The active preset (marked with a star ★) is used by the global keyboard shortcut.'
        });
        page.add(presetsGroup);

        const presetsList = new Gtk.ListBox({
            selection_mode: Gtk.SelectionMode.NONE,
            css_classes: ['boxed-list'],
        });
        presetsGroup.add(presetsList);

        const refreshPresets = () => {
            let child = presetsList.get_first_child();
            while (child) {
                presetsList.remove(child);
                child = presetsList.get_first_child();
            }

            let presets = normalizePresets();

            presets.forEach((preset, index) => {
                const expRow = new Adw.ExpanderRow({
                    title: preset.name || `Preset ${index + 1}`,
                    subtitle: (preset.instruction || '').substring(0, 50) + '...',
                });

                const nameRow = new Adw.EntryRow({
                    title: 'Name',
                    text: preset.name,
                });
                nameRow.connect('changed', () => {
                    presets[index].name = nameRow.text;
                    window._settings.set_string('presets-json', JSON.stringify(presets));
                    expRow.title = nameRow.text;
                });

                const instBuffer = new Gtk.TextBuffer({ text: preset.instruction });
                const instView = new Gtk.TextView({
                    buffer: instBuffer,
                    wrap_mode: Gtk.WrapMode.WORD_CHAR,
                    left_margin: 10,
                    right_margin: 10,
                    top_margin: 10,
                    bottom_margin: 10,
                    height_request: 100,
                });
                
                const instScroll = new Gtk.ScrolledWindow({
                    propagate_natural_height: true,
                    min_content_height: 100,
                });
                instScroll.set_child(instView);

                const instFrame = new Gtk.Frame({
                    margin_top: 10,
                    margin_bottom: 10,
                    margin_start: 10,
                    margin_end: 10,
                });
                instFrame.set_child(instScroll);

                instBuffer.connect('changed', () => {
                    const start = instBuffer.get_start_iter();
                    const end = instBuffer.get_end_iter();
                    const text = instBuffer.get_text(start, end, false);
                    presets[index].instruction = text;
                    window._settings.set_string('presets-json', JSON.stringify(presets));
                    expRow.subtitle = text.substring(0, 50) + '...';
                });

                const instRow = new Adw.ActionRow({
                    title: 'System Instruction',
                    subtitle: 'Multi-line prompt for the AI',
                });

                const activeIndex = window._settings.get_int('active-preset-index');
                const isActive = index === activeIndex;

                const activeBtn = new Gtk.Button({
                    icon_name: isActive ? 'emblem-favorite-symbolic' : 'star-new-symbolic',
                    valign: Gtk.Align.CENTER,
                    css_classes: isActive ? ['flat', 'suggested-action'] : ['flat'],
                    tooltip_text: isActive ? 'Currently Active' : 'Set as Active',
                });
                activeBtn.connect('clicked', () => {
                    window._settings.set_int('active-preset-index', index);
                    refreshPresets();
                });

                const deleteBtn = new Gtk.Button({
                    icon_name: 'user-trash-symbolic',
                    valign: Gtk.Align.CENTER,
                    css_classes: ['destructive-action', 'flat'],
                    tooltip_text: 'Delete Preset',
                });
                deleteBtn.connect('clicked', () => {
                    presets.splice(index, 1);
                    if (presets.length === 0) {
                        presets = [{
                            name: 'Default',
                            instruction: defaultInstruction,
                        }];
                    }
                    const currentActive = window._settings.get_int('active-preset-index');
                    const nextActive = Math.max(0, Math.min(currentActive, presets.length - 1));
                    window._settings.set_int('active-preset-index', nextActive);
                    window._settings.set_string('presets-json', JSON.stringify(presets));
                    refreshPresets();
                });

                expRow.add_row(nameRow);
                expRow.add_row(instRow);
                expRow.add_row(instFrame);
                expRow.add_suffix(activeBtn);
                expRow.add_suffix(deleteBtn);
                presetsList.append(expRow);
            });

            const addRow = new Adw.ActionRow({
                title: 'Add New Preset',
                activatable: true,
            });
            const addBtn = new Gtk.Button({
                icon_name: 'list-add-symbolic',
                valign: Gtk.Align.CENTER,
                css_classes: ['flat'],
            });
            addRow.add_suffix(addBtn);
            addBtn.connect('clicked', () => {
                presets.push({ name: 'New Preset', instruction: 'New instruction...' });
                window._settings.set_string('presets-json', JSON.stringify(presets));
                refreshPresets();
            });
            presetsList.append(addRow);
        };

        refreshPresets();

        // ─── API Configuration Group ───────────────────────────────────────────────

        const apiGroup = new Adw.PreferencesGroup({ title: 'API Configuration' });
        page.add(apiGroup);

        const providers = ['openai', 'openrouter', 'ollama', 'custom'];
        const providerStrings = Gtk.StringList.new(providers);
        const providerRow = new Adw.ComboRow({
            title: 'Provider',
            model: providerStrings,
        });
        const currentProvider = window._settings.get_string('api-provider');
        providerRow.selected = Math.max(0, providers.indexOf(currentProvider));

        const apiKeyRow = new Adw.PasswordEntryRow({ title: 'API Key', show_apply_button: true });
        window._settings.bind('api-key', apiKeyRow, 'text', Gio.SettingsBindFlags.DEFAULT);

        const baseUrlRow = new Adw.EntryRow({ title: 'Base URL', show_apply_button: true });
        window._settings.bind('api-base-url', baseUrlRow, 'text', Gio.SettingsBindFlags.DEFAULT);

        const modelRow = new Adw.EntryRow({ title: 'Model', show_apply_button: true });
        window._settings.bind('api-model', modelRow, 'text', Gio.SettingsBindFlags.DEFAULT);

        const headersRow = new Adw.EntryRow({ title: 'Extra Headers (JSON)', show_apply_button: true });
        window._settings.bind('api-extra-headers', headersRow, 'text', Gio.SettingsBindFlags.DEFAULT);
        const validateHeadersJson = () => {
            const raw = headersRow.text.trim();
            if (!raw) {
                headersRow.remove_css_class('error');
                headersRow.tooltip_text = null;
                return;
            }

            try {
                const parsed = JSON.parse(raw);
                if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed))
                    throw new Error('Expected a JSON object of header key/value pairs');
                headersRow.remove_css_class('error');
                headersRow.tooltip_text = null;
            } catch (e) {
                headersRow.add_css_class('error');
                headersRow.tooltip_text = `Invalid JSON: ${e.message}`;
            }
        };
        headersRow.connect('notify::text', validateHeadersJson);
        validateHeadersJson();

        providerRow.connect('notify::selected-item', () => {
            const selectedStr = providers[providerRow.selected];
            window._settings.set_string('api-provider', selectedStr);
            if (selectedStr === 'openai') {
                window._settings.set_string('api-model', 'gpt-4o-mini');
                window._settings.set_string('api-base-url', 'https://api.openai.com/v1');
                window._settings.set_string('api-extra-headers', '');
            } else if (selectedStr === 'openrouter') {
                window._settings.set_string('api-model', 'openai/gpt-4o-mini');
                window._settings.set_string('api-base-url', 'https://openrouter.ai/api/v1');
                window._settings.set_string('api-extra-headers', JSON.stringify({
                    "HTTP-Referer": "https://github.com/nichsedge/ai-assistant-gnome-extension",
                    "X-OpenRouter-Title": "GNOME AI Assistant"
                }));
            } else if (selectedStr === 'ollama') {
                window._settings.set_string('api-model', 'llama3.2:3b');
                window._settings.set_string('api-base-url', 'http://localhost:11434/v1');
                window._settings.set_string('api-extra-headers', '');
            }
        });

        apiGroup.add(providerRow);
        apiGroup.add(apiKeyRow);
        apiGroup.add(baseUrlRow);
        apiGroup.add(modelRow);
        apiGroup.add(headersRow);

        // ─── Behaviour Group ───────────────────────────────────────────────────────
        const behaviourGroup = new Adw.PreferencesGroup({ title: 'Behaviour' });
        page.add(behaviourGroup);

        const resultWindowRow = new Adw.SwitchRow({
            title: 'Show Result Window',
            subtitle: 'Show a popup with the response. If off, result is copied directly to clipboard.',
        });
        window._settings.bind('show-result-window', resultWindowRow, 'active', Gio.SettingsBindFlags.DEFAULT);
        behaviourGroup.add(resultWindowRow);

        const customInstBuffer = new Gtk.TextBuffer({ text: window._settings.get_string('custom-instruction') });
        const customInstView = new Gtk.TextView({
            buffer: customInstBuffer,
            wrap_mode: Gtk.WrapMode.WORD_CHAR,
            left_margin: 10,
            right_margin: 10,
            top_margin: 10,
            bottom_margin: 10,
            height_request: 100,
        });
        const customInstScroll = new Gtk.ScrolledWindow({ propagate_natural_height: true, min_content_height: 100 });
        customInstScroll.set_child(customInstView);
        const customInstFrame = new Gtk.Frame({ margin_top: 10, margin_bottom: 10 });
        customInstFrame.set_child(customInstScroll);

        customInstBuffer.connect('changed', () => {
            const start = customInstBuffer.get_start_iter();
            const end = customInstBuffer.get_end_iter();
            window._settings.set_string('custom-instruction', customInstBuffer.get_text(start, end, false));
        });

        const customInstRow = new Adw.ActionRow({ title: 'Default Instruction', subtitle: 'Used when no preset matches' });
        behaviourGroup.add(customInstRow);
        behaviourGroup.add(customInstFrame);

        const blockedWordsRow = new Adw.EntryRow({ title: 'Blocked Words', show_apply_button: true });
        window._settings.bind('blocked-words', blockedWordsRow, 'text', Gio.SettingsBindFlags.DEFAULT);
        behaviourGroup.add(blockedWordsRow);

        const primarySelectionRow = new Adw.SwitchRow({ title: 'Use Primary Selection' });
        window._settings.bind('use-primary-selection', primarySelectionRow, 'active', Gio.SettingsBindFlags.DEFAULT);
        behaviourGroup.add(primarySelectionRow);

        // ─── Advanced Group ────────────────────────────────────────────────────────
        const advancedGroup = new Adw.PreferencesGroup({ title: 'Advanced' });
        page.add(advancedGroup);

        const temperatureRow = new Adw.SpinRow({
            title: 'Temperature',
            adjustment: new Gtk.Adjustment({ lower: 0.0, upper: 2.0, step_increment: 0.05, value: window._settings.get_double('temperature') }),
            digits: 2,
        });
        window._settings.bind('temperature', temperatureRow, 'value', Gio.SettingsBindFlags.DEFAULT);
        advancedGroup.add(temperatureRow);

        const maxTokensRow = new Adw.SpinRow({
            title: 'Max Tokens',
            adjustment: new Gtk.Adjustment({ lower: 0, upper: 32768, step_increment: 64, value: window._settings.get_int('max-tokens') }),
            digits: 0,
        });
        window._settings.bind('max-tokens', maxTokensRow, 'value', Gio.SettingsBindFlags.DEFAULT);
        advancedGroup.add(maxTokensRow);

        const timeoutRow = new Adw.SpinRow({
            title: 'Request Timeout',
            adjustment: new Gtk.Adjustment({ lower: 5, upper: 120, step_increment: 5, value: window._settings.get_int('request-timeout') }),
            digits: 0,
        });
        window._settings.bind('request-timeout', timeoutRow, 'value', Gio.SettingsBindFlags.DEFAULT);
        advancedGroup.add(timeoutRow);

        // ─── Shortcut Group ────────────────────────────────────────────────────────
        const shortcutGroup = new Adw.PreferencesGroup({ title: 'Keyboard Shortcut' });
        page.add(shortcutGroup);
        const shortcutRow = new Adw.ActionRow({ title: 'Global Shortcut', activatable: true });
        const shortcutLabel = new Gtk.ShortcutLabel({ accelerator: window._settings.get_strv('shortcut')[0] || '', valign: Gtk.Align.CENTER });
        shortcutRow.add_suffix(shortcutLabel);
        const clearButton = new Gtk.Button({ icon_name: 'edit-clear-symbolic', valign: Gtk.Align.CENTER, css_classes: ['flat'] });
        shortcutRow.add_suffix(clearButton);
        clearButton.connect('clicked', () => { window._settings.set_strv('shortcut', ['']); shortcutLabel.accelerator = ''; });
        const keyController = new Gtk.EventControllerKey();
        shortcutRow.add_controller(keyController);
        keyController.connect('key-pressed', (c, k, kc, s) => {
            const relevantMods = s & (Gdk.ModifierType.SHIFT_MASK | Gdk.ModifierType.CONTROL_MASK | Gdk.ModifierType.ALT_MASK | Gdk.ModifierType.SUPER_MASK);
            if (k === Gdk.KEY_Escape) { window._settings.set_strv('shortcut', ['']); shortcutLabel.accelerator = ''; return Gdk.EVENT_STOP; }
            const accel = Gtk.accelerator_name_with_keycode(Gdk.Display.get_default(), k, kc, relevantMods);
            if (accel) { window._settings.set_strv('shortcut', [accel]); shortcutLabel.accelerator = accel; }
            return Gdk.EVENT_STOP;
        });
        shortcutGroup.add(shortcutRow);

        window.add(page);
    }
}
