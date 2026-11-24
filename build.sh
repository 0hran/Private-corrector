#!/usr/bin/env bash
# Builds the Firefox and Chrome versions of Private Corrector into dist/:
#   dist/firefox/  and  dist/private-corrector-firefox.zip
#   dist/chrome/   and  dist/private-corrector-chrome.zip
# Files are overwritten, nothing is deleted: if you remove a file from extension/,
# delete the dist/ folder yourself before building.
set -euo pipefail
cd "$(dirname "$0")"
mkdir -p dist/firefox dist/chrome

# Firefox: the extension folder as is.
cp -R extension/. dist/firefox/

# Chrome: the same code, plus the service worker entry point, the offscreen clipboard
# page, and a Chrome manifest generated from the Firefox one.
cp -R extension/. dist/chrome/
cp chrome/sw.js chrome/offscreen.html chrome/offscreen.js dist/chrome/
python3 - <<'PY'
import json
ff = json.load(open("extension/manifest.json"))
chrome = {
    "manifest_version": 3,
    "name": ff["name"],
    "version": ff["version"],
    "description": ff["description"],
    "minimum_chrome_version": "127",
    "icons": ff["icons"],
    "permissions": ["contextMenus" if p == "menus" else p for p in ff["permissions"]] + ["offscreen"],
    "host_permissions": ff["host_permissions"],
    "background": {"service_worker": "sw.js"},
    "action": ff["action"],
    "options_ui": ff["options_ui"],
    "commands": ff["commands"],
}
with open("dist/chrome/manifest.json", "w") as f:
    json.dump(chrome, f, indent=2, ensure_ascii=False)
    f.write("\n")
PY

# -FS keeps each zip in sync with its folder.
(cd dist/firefox && zip -qr -FS ../private-corrector-firefox.zip . -x '.*')
(cd dist/chrome && zip -qr -FS ../private-corrector-chrome.zip . -x '.*')
echo "Built dist/private-corrector-firefox.zip and dist/private-corrector-chrome.zip"
