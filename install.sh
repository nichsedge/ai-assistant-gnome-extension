#!/bin/bash

# Get the UUID from metadata.json
UUID=$(grep -Po '(?<="uuid": ")[^"]*' metadata.json)
EXTENSION_PATH="$HOME/.local/share/gnome-shell/extensions/$UUID"

echo "Installing extension: $UUID"

# Create the directory if it doesn't exist
mkdir -p "$HOME/.local/share/gnome-shell/extensions"

# Remove existing symlink or directory if it exists
if [ -L "$EXTENSION_PATH" ] || [ -e "$EXTENSION_PATH" ]; then
    echo "Removing existing installation at $EXTENSION_PATH"
    rm -rf "$EXTENSION_PATH"
fi

# Create the symlink
echo "Creating symlink..."
ln -s "$(pwd)" "$EXTENSION_PATH"

# Compile schemas
echo "Compiling schemas..."
glib-compile-schemas "$(pwd)/schemas/"

echo ""
echo "Done! Extension symlinked to: $EXTENSION_PATH"
echo "To apply changes:"
echo "1. Restart GNOME Shell (Alt+F2, then type 'r' and Enter in X11, or Logout/Login in Wayland)."
echo "2. Enable the extension using 'Extensions' app or: gnome-extensions enable $UUID"
