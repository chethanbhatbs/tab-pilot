#!/usr/bin/env bash
# Double-click me (macOS) to remove the Tab Radar helper. Runs uninstall.sh.
DIR="$(cd "$(dirname "$0")" && pwd)"
bash "$DIR/uninstall.sh"
echo ""
read -n 1 -s -r -p "  Press any key to close this window..."
echo ""
