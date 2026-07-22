#!/usr/bin/env bash
# =============================================================================
# Tab Radar Extension Builder
# Run from anywhere: bash build-extension.sh
# Builds the React app and packages it into extension/tabpilot/sidepanel.
# =============================================================================
set -euo pipefail

# Resolve the repo root from this script's location (portable — no hardcoded /app).
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
FRONTEND="$ROOT/frontend"
EXT_SIDEPANEL="$ROOT/extension/tabpilot/sidepanel"

# Pick a package manager: prefer yarn when a yarn.lock exists, else npm.
if command -v yarn >/dev/null 2>&1 && [ -f "$FRONTEND/yarn.lock" ]; then
  RUN="yarn"
elif command -v npm >/dev/null 2>&1; then
  RUN="npm run"
else
  echo "ERROR: need either yarn or npm on PATH." >&2
  exit 1
fi

echo "==> Building React app for Chrome Extension (using: $RUN)..."
cd "$FRONTEND"
PUBLIC_URL="." GENERATE_SOURCEMAP=false $RUN build

echo "==> Packaging extension..."
JS_FILE=$(basename "$(ls -t "$FRONTEND"/build/static/js/main.*.js | head -1)")
CSS_FILE=$(basename "$(ls -t "$FRONTEND"/build/static/css/main.*.css | head -1)")
echo "    JS:  $JS_FILE"
echo "    CSS: $CSS_FILE"

rm -rf "$EXT_SIDEPANEL/static" "$EXT_SIDEPANEL/asset-manifest.json" "$EXT_SIDEPANEL/index.html"
mkdir -p "$EXT_SIDEPANEL"
cp -r "$FRONTEND/build/static" "$EXT_SIDEPANEL/static"
cp "$FRONTEND/build/asset-manifest.json" "$EXT_SIDEPANEL/asset-manifest.json"

cat > "$EXT_SIDEPANEL/index.html" << HTMLEOF
<!doctype html>
<html lang="en" class="dark">
<head>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1"/>
  <title>Tab Radar</title>
  <link href="./static/css/${CSS_FILE}" rel="stylesheet"/>
</head>
<body>
  <div id="root"></div>
  <script defer src="./static/js/${JS_FILE}"></script>
</body>
</html>
HTMLEOF

echo ""
echo "==> Done! Extension is in $ROOT/extension/tabpilot/"
echo ""
echo "  To install / update:"
echo "  1. chrome://extensions/ -> Developer mode ON -> Load unpacked (first time)"
echo "  2. After rebuilds, click the reload icon on the Tab Radar card"
echo "  3. Reopen the side panel to pick up the new build"
echo ""
