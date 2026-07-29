#!/usr/bin/env bash
# Double-click me in Finder. macOS opens Terminal and runs the installer —
# no typing, no dragging. (This just runs install.sh from this same folder,
# which auto-detects everything.)
DIR="$(cd "$(dirname "$0")" && pwd)"
bash "$DIR/install.sh"
echo ""
echo "  ------------------------------------------------"
echo "  Setup finished. Quit Chrome (Cmd+Q), reopen it,"
echo "  then open Tab Radar and click Connect."
echo "  ------------------------------------------------"
echo ""
read -n 1 -s -r -p "  Press any key to close this window..."
echo ""
