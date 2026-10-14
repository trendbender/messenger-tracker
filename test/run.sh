#!/usr/bin/env bash
# Runs test/index.html and test/check.html?mt_debug=1 in headless Chrome and prints the results. Exit code 1 on any failure.
set -euo pipefail
DIR="$(cd "$(dirname "$0")" && pwd)"
CHROME="${CHROME:-$(command -v google-chrome || command -v chromium || echo '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome')}"
PROFILE="$(mktemp -d)"
run() {
  "$CHROME" --headless=new --disable-gpu --user-data-dir="$PROFILE" --virtual-time-budget=3000 \
    --dump-dom "file://$DIR/$1" 2>/dev/null | sed -n '/<pre id="out">/,/<\/pre>/p' | sed 's/<[^>]*>//g; s/&gt;/>/g; s/&lt;/</g'
}
OUT="$(run index.html)"
CHECK="$(run 'check.html?mt_debug=1')"
CHECK_RU="$(run 'check.html?mt_debug=1&mt_lang=ru')"
rm -rf "$PROFILE"
echo "$OUT"; echo "-- check mode (en) --"; echo "$CHECK"; echo "-- check mode (ru) --"; echo "$CHECK_RU"
for r in "$OUT" "$CHECK" "$CHECK_RU"; do echo "$r" | grep -q ' 0 failed' || exit 1; done
