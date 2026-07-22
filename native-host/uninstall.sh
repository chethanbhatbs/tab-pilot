#!/usr/bin/env bash
# Tab Radar Native Host Uninstaller (macOS / Linux)
# Revokes profile switching by removing the native-messaging-host manifest from
# every Chromium-family browser. Self-locating — run it from anywhere.
set -e

HOST_NAME="com.tabpilot.profiles"

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
      "$HOME/.var/app/com.google.Chrome/config/google-chrome/NativeMessagingHosts"
      "$HOME/.var/app/org.chromium.Chromium/config/chromium/NativeMessagingHosts"
      "$HOME/snap/chromium/common/chromium/NativeMessagingHosts"
    )
    ;;
  *)
    echo "  ERROR: Unsupported OS. Supports macOS and Linux."
    exit 1
    ;;
esac

echo ""
echo "  Tab Radar Native Host Uninstaller"
echo "  ================================="
echo ""

REMOVED=0
for NM_DIR in "${NM_DIRS[@]}"; do
  if [ -f "$NM_DIR/$HOST_NAME.json" ]; then
    rm -f "$NM_DIR/$HOST_NAME.json"
    echo "  Removed -> $NM_DIR/$HOST_NAME.json"
    REMOVED=$((REMOVED + 1))
  fi
done

echo ""
if [ "$REMOVED" -eq 0 ]; then
  echo "  Nothing to remove — the helper wasn't installed."
else
  echo "  DONE — removed from $REMOVED location(s)."
  echo "  Quit Chrome (Cmd+Q) and reopen it to finish revoking."
fi
echo ""
