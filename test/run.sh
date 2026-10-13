#!/usr/bin/env bash
# Runs test/index.html in headless Chrome and prints the results. Exit code 1 on any failure.
set -euo pipefail
DIR="$(cd "$(dirname "$0")" && pwd)"
CHROME="${CHROME:-$(command -v google-chrome || command -v chromium || echo '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome')}"
PROFILE="$(mktemp -d)"
OUT="$("$CHROME" --headless=new --disable-gpu --user-data-dir="$PROFILE" --virtual-time-budget=2000 \
  --dump-dom "file://$DIR/index.html" 2>/dev/null | sed -n '/<pre id="out">/,/<\/pre>/p' | sed 's/<[^>]*>//g; s/&gt;/>/g; s/&lt;/</g')"
rm -rf "$PROFILE"
echo "$OUT"
echo "$OUT" | grep -q ' 0 failed' || exit 1
