#!/usr/bin/env bash
# Tab Radar Native Host Installer (macOS / Linux)
# Installs the tiny helper that lets Tab Radar read your Chrome profile names
# so it can list and switch between them.
#
# Zero questions asked: the script finds its OWN location and auto-detects the
# Tab Radar extension ID by scanning your Chrome profiles (works for both
# unpacked/dev and Web Store installs). Just run it and restart Chrome.
set -e

HOST_NAME="com.tabpilot.profiles"
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
HOST_SCRIPT="$SCRIPT_DIR/tabpilot_profiles.py"

echo ""
echo "  Tab Radar Native Host Installer"
echo "  ==============================="
echo ""

# 1. Make the Python helper executable
chmod +x "$HOST_SCRIPT"

# 2. Pick a python3 to run the detection (the helper itself needs python3 too)
PY="$(command -v python3 || true)"
if [ -z "$PY" ]; then
  echo "  ERROR: python3 not found on PATH. Install Python 3, then re-run."
  exit 1
fi

# 3. Native-messaging-host dirs per browser (only those present get a manifest)
case "$OSTYPE" in
  darwin*)
    SUPPORT="$HOME/Library/Application Support"
    NM_DIRS=(
      "$SUPPORT/Google/Chrome/NativeMessagingHosts"
      "$SUPPORT/Google/Chrome Beta/NativeMessagingHosts"
      "$SUPPORT/Google/Chrome Canary/NativeMessagingHosts"
      "$SUPPORT/Chromium/NativeMessagingHosts"
      "$SUPPORT/BraveSoftware/Brave-Browser/NativeMessagingHosts"
      "$SUPPORT/Microsoft Edge/NativeMessagingHosts"
    )
    ;;
  linux*)
    NM_DIRS=(
      "$HOME/.config/google-chrome/NativeMessagingHosts"
      "$HOME/.config/google-chrome-beta/NativeMessagingHosts"
      "$HOME/.config/chromium/NativeMessagingHosts"
      "$HOME/.config/BraveSoftware/Brave-Browser/NativeMessagingHosts"
      "$HOME/.config/microsoft-edge/NativeMessagingHosts"
    )
    ;;
  *)
    echo "  ERROR: Unsupported OS. This installer supports macOS and Linux."
    exit 1
    ;;
esac

# 4. Extension ID: prefer one passed as an argument (the Profiles panel builds a
#    command with chrome.runtime.id baked in — works on every OS / Chrome variant,
#    no profile scanning needed). Otherwise auto-detect by scanning profiles.
EXT_IDS="${1:-}"
if [ -n "$EXT_IDS" ]; then
  echo "  Using extension ID provided: $EXT_IDS"
else
echo "  Looking for the Tab Radar extension in your browsers..."
EXT_IDS="$("$PY" - <<'PYEOF'
import json, os, glob
home = os.path.expanduser("~")
roots = [
    f"{home}/Library/Application Support/Google/Chrome",
    f"{home}/Library/Application Support/Google/Chrome Beta",
    f"{home}/Library/Application Support/Google/Chrome Canary",
    f"{home}/Library/Application Support/Chromium",
    f"{home}/Library/Application Support/BraveSoftware/Brave-Browser",
    f"{home}/Library/Application Support/Microsoft Edge",
    f"{home}/.config/google-chrome",
    f"{home}/.config/google-chrome-beta",
    f"{home}/.config/chromium",
    f"{home}/.config/BraveSoftware/Brave-Browser",
    f"{home}/.config/microsoft-edge",
]
def looks_like(n): return bool(n) and "pilot" in n.lower() and "tab" in n.lower()
found = set()
for root in roots:
    if not os.path.isdir(root):
        continue
    # packed installs: <profile>/Extensions/<id>/<ver>/manifest.json
    for man in glob.glob(f"{root}/*/Extensions/*/*/manifest.json"):
        try:
            if looks_like(json.load(open(man)).get("name", "")):
                found.add(man.split("/Extensions/")[1].split("/")[0])
        except Exception:
            pass
    # unpacked/dev installs: recorded in Preferences -> extensions.settings
    for pref in glob.glob(f"{root}/*/Preferences") + glob.glob(f"{root}/*/Secure Preferences"):
        try:
            settings = json.load(open(pref)).get("extensions", {}).get("settings", {})
            for ext_id, meta in settings.items():
                name = (meta.get("manifest", {}) or {}).get("name", "")
                path = meta.get("path", "")
                if looks_like(name) or "chrome-pilot" in path.lower() or "tabpilot" in path.lower():
                    found.add(ext_id)
        except Exception:
            pass
print(" ".join(sorted(found)))
PYEOF
)"
fi

# 5. Fall back to a manual prompt ONLY if auto-detect found nothing
if [ -z "$EXT_IDS" ]; then
  echo "  Couldn't auto-detect Tab Radar (is it loaded in Chrome?)."
  echo "  Open chrome://extensions, enable Developer mode, copy the Tab Radar ID,"
  read -p "  and paste it here: " EXT_IDS
  if [ -z "$EXT_IDS" ]; then
    echo "  ERROR: No extension ID. Re-run after loading the extension."
    exit 1
  fi
else
  echo "  Found: $EXT_IDS"
fi

# 6. Build the allowed_origins array from all detected IDs
ORIGINS=""
for id in $EXT_IDS; do
  ORIGINS="$ORIGINS    \"chrome-extension://$id/\",
"
done
ORIGINS="$(printf "%s" "$ORIGINS" | sed '$ s/,$//')"

# 7. Write the manifest into every browser that's installed
WROTE=0
for NM_DIR in "${NM_DIRS[@]}"; do
  PARENT="$(dirname "$NM_DIR")"
  [ -d "$PARENT" ] || continue          # browser not installed -> skip
  mkdir -p "$NM_DIR"
  cat > "$NM_DIR/$HOST_NAME.json" <<EOF
{
  "name": "$HOST_NAME",
  "description": "Tab Radar Chrome Profile Manager",
  "path": "$HOST_SCRIPT",
  "type": "stdio",
  "allowed_origins": [
$ORIGINS
  ]
}
EOF
  echo "  Installed -> $NM_DIR/$HOST_NAME.json"
  WROTE=$((WROTE + 1))
done

if [ "$WROTE" -eq 0 ]; then
  echo "  ERROR: No Chromium-family browser found to install into."
  exit 1
fi

echo ""
echo "  DONE. Next: quit Chrome completely (Cmd+Q) and reopen it,"
echo "  then open the Tab Radar Profiles panel."
echo ""
