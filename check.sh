#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$ROOT_DIR"

need_cmd() {
    if ! command -v "$1" >/dev/null 2>&1; then
        echo "Missing required command: $1"
        echo "Install with: sudo apt-get update && sudo apt-get install -y $2"
        exit 1
    fi
}

need_cmd jq jq
need_cmd glib-compile-schemas libglib2.0-bin

echo "[1/4] Validate metadata.json keys"
jq -e '.uuid and .name and .description and .["settings-schema"] and .["shell-version"]' metadata.json >/dev/null
jq -e '.["shell-version"] | type == "array" and length > 0' metadata.json >/dev/null

echo "[2/4] Validate README shell versions match metadata.json"
shell_versions="$(jq -r '.["shell-version"] | join(", ")' metadata.json)"
grep -F "GNOME Shell versions ${shell_versions}." README.md >/dev/null

echo "[3/4] Compile GSettings schema (strict)"
glib-compile-schemas --strict schemas/

echo "[4/4] Optional: shellcheck install.sh"
if command -v shellcheck >/dev/null 2>&1; then
    shellcheck install.sh
else
    echo "shellcheck not installed; skipping."
    echo "Optional install: sudo apt-get update && sudo apt-get install -y shellcheck"
fi

echo "All checks passed."
