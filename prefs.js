import Gio from 'gi://Gio';
import Gtk from 'gi://Gtk?version=4.0';
import Adw from 'gi://Adw?version=1';
import { ExtensionPreferences } from 'resource:///org/gnome/Shell/Extensions/js/extensions/prefs.js';

export default class AIAssistantPreferences extends ExtensionPreferences {
    fillPreferencesWindow(window) {
        window._settings = this.getSettings();

        const page = new Adw.PreferencesPage();
        const group = new Adw.PreferencesGroup({
            title: 'AI Assistant Configuration',
        });
        page.add(group);

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

        // API Contexts
        const baseUrlRow = new Adw.EntryRow({
            title: 'Base URL',
            show_apply_button: true,
        });
        window._settings.bind('api-base-url', baseUrlRow, 'text', Gio.SettingsBindFlags.DEFAULT);

        const modelRow = new Adw.EntryRow({
            title: 'Model',
            show_apply_button: true,
        });
        window._settings.bind('api-model', modelRow, 'text', Gio.SettingsBindFlags.DEFAULT);

        const headersRow = new Adw.EntryRow({
            title: 'Extra Headers (JSON)',
            show_apply_button: true,
        });
        window._settings.bind('api-extra-headers', headersRow, 'text', Gio.SettingsBindFlags.DEFAULT);

        // Notify When Provider Changes
        providerRow.connect('notify::selected-item', () => {
            const selectedStr = providers[providerRow.selected];
            window._settings.set_string('api-provider', selectedStr);

            if (selectedStr === 'openai') {
                window._settings.set_string('api-model', 'gpt-3.5-turbo');
                window._settings.set_string('api-base-url', 'https://api.openai.com/v1');
                window._settings.set_string('api-extra-headers', '');
            } else if (selectedStr === 'openrouter') {
                window._settings.set_string('api-model', 'openai/gpt-oss-20b:free');
                window._settings.set_string('api-base-url', 'https://openrouter.ai/api/v1');
                window._settings.set_string('api-extra-headers', JSON.stringify({
                    "HTTP-Referer": "https://github.com/al/ai-assistant",
                    "X-Title": "GNOME AI Assistant"
                }));
            } else if (selectedStr === 'ollama') {
                window._settings.set_string('api-model', 'llama3.2:3b');
                window._settings.set_string('api-base-url', 'http://localhost:11434/v1');
                window._settings.set_string('api-extra-headers', '');
            }
        });

        group.add(providerRow);
        group.add(apiKeyRow);
        group.add(baseUrlRow);
        group.add(modelRow);
        group.add(headersRow);

        // Custom Instruction
        const instructionRow = new Adw.EntryRow({
            title: 'Custom Instruction',
            show_apply_button: true,
        });
        window._settings.bind(
            'custom-instruction',
            instructionRow,
            'text',
            Gio.SettingsBindFlags.DEFAULT
        );
        group.add(instructionRow);

        // Blocked Words
        const blockedWordsRow = new Adw.EntryRow({
            title: 'Blocked Words (comma separated)',
            show_apply_button: true,
        });
        window._settings.bind(
            'blocked-words',
            blockedWordsRow,
            'text',
            Gio.SettingsBindFlags.DEFAULT
        );
        group.add(blockedWordsRow);

        // Shortcut
        const shortcutRow = new Adw.EntryRow({
            title: 'Global Shortcut',
            show_apply_button: true,
        });
        // Handle shortcut serialization
        const currentShortcut = window._settings.get_strv('shortcut')[0] || '';
        shortcutRow.text = currentShortcut;
        shortcutRow.connect('apply', () => {
            window._settings.set_strv('shortcut', [shortcutRow.text]);
        });
        group.add(shortcutRow);

        window.add(page);
    }
}
