import Gio from 'gi://Gio';
import Gtk from 'gi://Gtk?version=4.0';
import Adw from 'gi://Adw?version=1';
import Gdk from 'gi://Gdk?version=4.0';
import { ExtensionPreferences } from 'resource:///org/gnome/Shell/Extensions/js/extensions/prefs.js';

export default class AIAssistantPreferences extends ExtensionPreferences {
    fillPreferencesWindow(window) {
        window._settings = this.getSettings();

        // ─── API Configuration Group ───────────────────────────────────────────────
        const page = new Adw.PreferencesPage();

        const apiGroup = new Adw.PreferencesGroup({ title: 'API Configuration' });
        page.add(apiGroup);

        // Provider
        const providers = ['openai', 'openrouter', 'ollama', 'custom'];
        const providerStrings = Gtk.StringList.new(providers);
        const providerRow = new Adw.ComboRow({
            title: 'Provider',
            model: providerStrings,
        });

        const currentProvider = window._settings.get_string('api-provider');
        providerRow.selected = Math.max(0, providers.indexOf(currentProvider));

        // API Key
        const apiKeyRow = new Adw.PasswordEntryRow({
            title: 'API Key',
            show_apply_button: true,
        });
        window._settings.bind('api-key', apiKeyRow, 'text', Gio.SettingsBindFlags.DEFAULT);

        // Base URL
        const baseUrlRow = new Adw.EntryRow({
            title: 'Base URL',
            show_apply_button: true,
        });
        window._settings.bind('api-base-url', baseUrlRow, 'text', Gio.SettingsBindFlags.DEFAULT);

        // Model
        const modelRow = new Adw.EntryRow({
            title: 'Model',
            show_apply_button: true,
        });
        window._settings.bind('api-model', modelRow, 'text', Gio.SettingsBindFlags.DEFAULT);

        // Extra Headers
        const headersRow = new Adw.EntryRow({
            title: 'Extra Headers (JSON)',
            show_apply_button: true,
        });
        window._settings.bind('api-extra-headers', headersRow, 'text', Gio.SettingsBindFlags.DEFAULT);

        // When provider changes, auto-fill sensible defaults
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
                    "X-Title": "GNOME AI Assistant"
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

        // Custom Instruction
        const instructionRow = new Adw.EntryRow({
            title: 'Custom Instruction',
            show_apply_button: true,
        });
        window._settings.bind('custom-instruction', instructionRow, 'text', Gio.SettingsBindFlags.DEFAULT);
        behaviourGroup.add(instructionRow);

        // Blocked Words
        const blockedWordsRow = new Adw.EntryRow({
            title: 'Blocked Words (comma-separated)',
            show_apply_button: true,
        });
        window._settings.bind('blocked-words', blockedWordsRow, 'text', Gio.SettingsBindFlags.DEFAULT);
        behaviourGroup.add(blockedWordsRow);

        // ─── Advanced Group ────────────────────────────────────────────────────────
        const advancedGroup = new Adw.PreferencesGroup({ title: 'Advanced' });
        page.add(advancedGroup);

        // Temperature
        const temperatureRow = new Adw.SpinRow({
            title: 'Temperature',
            subtitle: 'Controls randomness (0.0 = deterministic, 2.0 = very creative)',
            adjustment: new Gtk.Adjustment({
                lower: 0.0,
                upper: 2.0,
                step_increment: 0.05,
                page_increment: 0.1,
                value: window._settings.get_double('temperature'),
            }),
            digits: 2,
        });
        window._settings.bind('temperature', temperatureRow, 'value', Gio.SettingsBindFlags.DEFAULT);
        advancedGroup.add(temperatureRow);

        // Max Tokens
        const maxTokensRow = new Adw.SpinRow({
            title: 'Max Tokens',
            subtitle: 'Maximum response length (0 = model default)',
            adjustment: new Gtk.Adjustment({
                lower: 0,
                upper: 32768,
                step_increment: 64,
                page_increment: 512,
                value: window._settings.get_int('max-tokens'),
            }),
            digits: 0,
        });
        window._settings.bind('max-tokens', maxTokensRow, 'value', Gio.SettingsBindFlags.DEFAULT);
        advancedGroup.add(maxTokensRow);

        // Request Timeout
        const timeoutRow = new Adw.SpinRow({
            title: 'Request Timeout (seconds)',
            subtitle: 'Increase for slow models or long inputs',
            adjustment: new Gtk.Adjustment({
                lower: 5,
                upper: 120,
                step_increment: 5,
                page_increment: 15,
                value: window._settings.get_int('request-timeout'),
            }),
            digits: 0,
        });
        window._settings.bind('request-timeout', timeoutRow, 'value', Gio.SettingsBindFlags.DEFAULT);
        advancedGroup.add(timeoutRow);

        // ─── Shortcut Group ────────────────────────────────────────────────────────
        const shortcutGroup = new Adw.PreferencesGroup({ title: 'Keyboard Shortcut' });
        page.add(shortcutGroup);

        const shortcutRow = new Adw.ActionRow({
            title: 'Global Shortcut',
            subtitle: 'Click the button and press a key combination',
            activatable: true,
        });

        const currentShortcut = window._settings.get_strv('shortcut')[0] || '';
        const shortcutLabel = new Gtk.ShortcutLabel({
            accelerator: currentShortcut,
            disabled_text: 'Not set',
            valign: Gtk.Align.CENTER,
        });
        shortcutRow.add_suffix(shortcutLabel);

        // Key capture via EventControllerKey
        const clearButton = new Gtk.Button({
            icon_name: 'edit-clear-symbolic',
            valign: Gtk.Align.CENTER,
            css_classes: ['flat'],
            tooltip_text: 'Clear shortcut',
        });
        shortcutRow.add_suffix(clearButton);

        clearButton.connect('clicked', () => {
            window._settings.set_strv('shortcut', ['']);
            shortcutLabel.accelerator = '';
        });

        const keyController = new Gtk.EventControllerKey();
        shortcutRow.add_controller(keyController);

        keyController.connect('key-pressed', (controller, keyval, keycode, state) => {
            // Ignore modifier-only keypresses
            const modifierMask = Gdk.ModifierType.SHIFT_MASK |
                                 Gdk.ModifierType.CONTROL_MASK |
                                 Gdk.ModifierType.ALT_MASK |
                                 Gdk.ModifierType.SUPER_MASK;

            const relevantMods = state & modifierMask;

            // Escape clears the shortcut
            if (keyval === Gdk.KEY_Escape) {
                window._settings.set_strv('shortcut', ['']);
                shortcutLabel.accelerator = '';
                return Gdk.EVENT_STOP;
            }

            const accel = Gtk.accelerator_name_with_keycode(null, keyval, keycode,  relevantMods);
            if (accel) {
                window._settings.set_strv('shortcut', [accel]);
                shortcutLabel.accelerator = accel;
            }

            return Gdk.EVENT_STOP;
        });

        shortcutGroup.add(shortcutRow);

        window.add(page);
    }
}
