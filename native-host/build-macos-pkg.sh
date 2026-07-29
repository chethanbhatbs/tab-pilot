#!/usr/bin/env bash
# Builds a double-click macOS installer (.pkg) for the Tab Radar native host.
# The installer needs NO terminal and NO extension-ID pasting from the user:
# its postinstall auto-detects the Tab Radar extension across all Chrome
# profiles (packed AND unpacked), then writes the native-messaging manifest.
#
#   bash build-macos-pkg.sh           -> dist/TabPilot-Profiles.pkg  (unsigned)
#   DEV_ID="Developer ID Installer: Name (TEAMID)" bash build-macos-pkg.sh
#                                     -> signed .pkg (no Gatekeeper warning)
set -euo pipefail

HERE="$(cd "$(dirname "$0")" && pwd)"
HOST_NAME="com.tabpilot.profiles"
IDENT="com.tabpilot.profiles.installer"
VERSION="1.0.0"
BUILD="$HERE/.pkgbuild"
PAYLOAD="$BUILD/payload"
SCRIPTS="$BUILD/scripts"
OUT="$HERE/dist/TabPilot-Profiles.pkg"

export COPYFILE_DISABLE=1   # keep ._AppleDouble junk out of the payload

rm -rf "$BUILD"
mkdir -p "$PAYLOAD/Library/Application Support/TabPilot" "$SCRIPTS" "$HERE/dist"

# --- payload: the helper itself ---
cp "$HERE/tabpilot_profiles.py" "$PAYLOAD/Library/Application Support/TabPilot/tabpilot_profiles.py"
chmod 755 "$PAYLOAD/Library/Application Support/TabPilot/tabpilot_profiles.py"

# --- postinstall: detect ID(s) + write manifest for the logged-in user ---
cat > "$SCRIPTS/postinstall" <<'POST'
#!/bin/bash
set -e
HOST_NAME="com.tabpilot.profiles"
APP_DIR="/Library/Application Support/TabPilot"
HOST_PY="$APP_DIR/tabpilot_profiles.py"

# Who actually installed this (postinstall runs as root)
USER_NAME="$(/usr/bin/stat -f%Su /dev/console)"
USER_HOME="$(/usr/bin/dscl . -read /Users/"$USER_NAME" NFSHomeDirectory | /usr/bin/awk '{print $2}')"

# Most stable python for a GUI-launched Chrome to exec
if [ -x /usr/bin/python3 ]; then PY=/usr/bin/python3
elif [ -x /opt/homebrew/bin/python3 ]; then PY=/opt/homebrew/bin/python3
elif [ -x /usr/local/bin/python3 ]; then PY=/usr/local/bin/python3
else PY=/usr/bin/python3; fi

# Wrapper so Chrome doesn't depend on PATH resolution
WRAP="$APP_DIR/run_host.sh"
cat > "$WRAP" <<EOF
#!/bin/bash
exec "$PY" "$HOST_PY" "\$@"
EOF
chmod 755 "$WRAP" "$HOST_PY"

# Auto-detect Tab Radar extension IDs (packed + unpacked) across all profiles
IDS="$("$PY" - "$USER_HOME" <<'PYEOF'
import json, os, sys, glob
home = sys.argv[1]
roots = [
    f"{home}/Library/Application Support/Google/Chrome",
    f"{home}/Library/Application Support/Google/Chrome Beta",
    f"{home}/Library/Application Support/Google/Chrome Canary",
    f"{home}/Library/Application Support/Chromium",
    f"{home}/Library/Application Support/BraveSoftware/Brave-Browser",
    f"{home}/Library/Application Support/Microsoft Edge",
]
found = set()
def looks_like(name):
    return name and "pilot" in name.lower() and "tab" in name.lower()
for root in roots:
    if not os.path.isdir(root):
        continue
    # packed installs: <profile>/Extensions/<id>/<ver>/manifest.json
    for man in glob.glob(f"{root}/*/Extensions/*/*/manifest.json"):
        try:
            with open(man) as f:
                name = json.load(f).get("name", "")
            if looks_like(name):
                found.add(man.split("/Extensions/")[1].split("/")[0])
        except Exception:
            pass
    # unpacked/dev installs: recorded in Preferences -> extensions.settings
    for pref in glob.glob(f"{root}/*/Preferences") + glob.glob(f"{root}/*/Secure Preferences"):
        try:
            with open(pref) as f:
                settings = json.load(f).get("extensions", {}).get("settings", {})
            for ext_id, meta in settings.items():
                name = (meta.get("manifest", {}) or {}).get("name", "")
                path = meta.get("path", "")
                if looks_like(name) or "chrome-pilot" in path.lower() or "tabpilot" in path.lower():
                    found.add(ext_id)
        except Exception:
            pass
# fallback to the known dev id if nothing detected
if not found:
    found.add("oajhjafjjmlkbooankdflknepcbdbehm")
print(" ".join(sorted(found)))
PYEOF
)"

# Build allowed_origins JSON array
ORIGINS=""
for id in $IDS; do
  ORIGINS="$ORIGINS    \"chrome-extension://$id/\",\n"
done
ORIGINS="$(printf "%b" "$ORIGINS" | /usr/bin/sed '$ s/,$//')"

# Write the manifest into every Chromium-family NativeMessagingHosts dir present
write_manifest () {
  local dir="$1"
  /bin/mkdir -p "$dir"
  cat > "$dir/$HOST_NAME.json" <<EOF
{
  "name": "$HOST_NAME",
  "description": "Tab Radar Chrome Profile Manager",
  "path": "$WRAP",
  "type": "stdio",
  "allowed_origins": [
$ORIGINS
  ]
}
EOF
  /usr/sbin/chown -R "$USER_NAME" "$dir/$HOST_NAME.json"
}

for base in \
  "$USER_HOME/Library/Application Support/Google/Chrome" \
  "$USER_HOME/Library/Application Support/Google/Chrome Beta" \
  "$USER_HOME/Library/Application Support/Google/Chrome Canary" \
  "$USER_HOME/Library/Application Support/Chromium" \
  "$USER_HOME/Library/Application Support/BraveSoftware/Brave-Browser" \
  "$USER_HOME/Library/Application Support/Microsoft Edge" ; do
  if [ -d "$base" ]; then
    write_manifest "$base/NativeMessagingHosts"
  fi
done

exit 0
POST
chmod 755 "$SCRIPTS/postinstall"

# --- build the package ---
PKG_ARGS=(--root "$PAYLOAD" --scripts "$SCRIPTS" --identifier "$IDENT" \
          --version "$VERSION" --install-location /)
if [ -n "${DEV_ID:-}" ]; then
  PKG_ARGS+=(--sign "$DEV_ID")
fi
/usr/bin/pkgbuild "${PKG_ARGS[@]}" "$OUT"

echo ""
echo "Built: $OUT"
[ -n "${DEV_ID:-}" ] && echo "Signed with: $DEV_ID" || echo "UNSIGNED (first open: right-click the .pkg -> Open)."
