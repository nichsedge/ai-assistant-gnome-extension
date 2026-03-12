# AI Text Assistant - GNOME Shell Extension

A customizable GNOME Shell extension that processes clipboard text using AI (OpenAI, Ollama, etc.). Instantly fix grammar, apply custom instructions, and block specific words using a simple global shortcut to seamlessly boost writing productivity.

## Features

- **Clipboard Processing**: Select text, copy it to your clipboard, and trigger the extension to automatically process the text with AI.
- **Multiple AI Providers**: Supports OpenAI out of the box, as well as local AI models via Ollama.
- **Custom Instructions**: Define exactly how you want the AI to process your text (e.g., "Fix grammar", "Translate to English", "Summarize").
- **Word Blocking**: Specify a list of words that the AI is forbidden strictly from using in its response.
- **Global Shortcut**: Process text quickly without leaving your current application by using a configurable keyboard shortcut.
- **Top Bar Indicator**: Easy access to the extension's status and manual trigger through the GNOME top panel.

## Installation

### Prerequisites
- GNOME Shell version 45, 46, or 47.
- An API Key from OpenAI, OR a running local instance of [Ollama](https://ollama.ai/).

### Manual Installation

1. Clone this repository:
   ```bash
   git clone https://github.com/nichsedge/ai-assistant-gnome-extension.git
   ```
2. Move the extension folder to your local GNOME extensions directory. The folder name must match the extension's UUID (`ai-assistant@al-projects.gnome.org`):
   ```bash
   mv ai-assistant-gnome-extension ~/.local/share/gnome-shell/extensions/ai-assistant@al-projects.gnome.org
   ```
3. Restart GNOME Shell (Press `Alt+F2`, type `r`, and press `Enter`. On Wayland, you may need to log out and log back in).
4. Enable the extension using the [Extension Manager](https://flathub.org/apps/com.mattjakeman.ExtensionManager) or the built-in Extensions app.

## Usage

1. **Configure**: Open the extension's Preferences to set your API Provider, API Key, Model, Custom Instructions, and Blocked Words.
2. **Copy Text**: Highlight any text and copy it to your clipboard (`Ctrl+C`).
3. **Trigger AI**: 
   - Press the global shortcut (configure in Settings -> Keyboard -> Custom Shortcuts, or within the extension preferences depending on your setup).
   - Alternatively, click the Text Editor icon in your GNOME top panel.
4. **Paste**: The extension will notify you when processing is complete. Paste (`Ctrl+V`) the AI-improved text!

## Support & Contributing

If you encounter any issues or have feature requests, please open an issue on the GitHub repository. Contributions are always welcome!
