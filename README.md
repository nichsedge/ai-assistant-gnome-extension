# AI Text Assistant - GNOME Shell Extension

A customizable GNOME Shell extension that processes clipboard text using AI (OpenAI, Ollama, etc.). Instantly fix grammar, apply custom instructions, and block specific words using a simple global shortcut to seamlessly boost writing productivity.

## Features

- **Streaming Responses**: See AI results in real-time as they are generated.
- **Premium Result Viewer**: A dedicated window to review, edit, and copy AI results before using them.
- **Multi-preset Management**: Create and switch between multiple system prompts for different tasks.
- **Multi-line Prompt Editing**: Write complex, multi-line instructions for the AI in a user-friendly interface.
- **Word Blocking**: Specify a list of words that the AI is forbidden strictly from using in its response.
- **Multiple AI Providers**: Supports OpenAI, OpenRouter, and local models via Ollama.
- **Global Shortcut**: Process text quickly without leaving your current application.

## Installation

### Prerequisites
- GNOME Shell versions 45, 46, 47, 50.
- One of:
  - OpenAI API key
  - OpenRouter API key
  - Local [Ollama](https://ollama.ai/) server
  - Custom OpenAI-compatible endpoint

### Manual Installation

1. Clone this repository:
   ```bash
   git clone https://github.com/nichsedge/ai-assistant-gnome-extension.git
   ```
2. Run the provided install script:
   ```bash
   ./install.sh
   ```
3. Restart GNOME Shell (Press `Alt+F2`, type `r`, and press `Enter`. On Wayland, log out and log back in).
4. Enable the extension using the [Extension Manager](https://flathub.org/apps/com.mattjakeman.ExtensionManager) or the built-in Extensions app.

## Usage

1. **Configure**: Open the extension's Preferences to set your API Provider, API Key, Model, and manage your Presets.
2. **Select Text**: Highlight any text and copy it to your clipboard (`Ctrl+C`).
3. **Trigger AI**: Press the global shortcut (default: `<Super><Shift>g`) or click the icon in your GNOME top panel.
4. **Review & Copy**: A dialog will appear with the AI's response. Click **Copy & Close** to put the result in your clipboard!

## Provider Setup Notes

- **OpenAI**
  - Base URL: `https://api.openai.com/v1`
  - API key required.
- **OpenRouter**
  - Base URL: `https://openrouter.ai/api/v1`
  - API key required.
  - The extension automatically adds OpenRouter headers (`HTTP-Referer`, `X-OpenRouter-Title`) only for this provider.
- **Ollama**
  - Base URL: `http://localhost:11434/v1`
  - API key not required.
- **Custom**
  - Use an OpenAI-compatible `/chat/completions` endpoint.
  - Optional extra headers can be set in Preferences as JSON (must be a JSON object).

## Support & Contributing

If you encounter any issues or have feature requests, please open an issue on the GitHub repository. Contributions are always welcome!
