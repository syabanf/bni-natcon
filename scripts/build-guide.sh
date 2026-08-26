#!/usr/bin/env bash
# Render the attendee guide to PDF.
#
#   scripts/build-guide.sh
#
# The source is docs/panduan/panduan-peserta.html — edit that, not the PDF.
# It carries the brand images inline as data URIs so the file is one thing you
# can hand to anybody, and headless Chrome does the printing because it is the
# same engine the guide was designed in.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
SRC="$ROOT/docs/panduan/panduan-peserta.html"
OUT="$ROOT/docs/panduan/panduan-peserta.pdf"
CHROME="${CHROME:-/Applications/Google Chrome.app/Contents/MacOS/Google Chrome}"

[ -x "$CHROME" ] || { echo "Chrome not found — set CHROME=/path/to/chrome" >&2; exit 1; }

"$CHROME" --headless --disable-gpu --no-pdf-header-footer \
  --print-to-pdf="$OUT" "file://$SRC" 2>/dev/null

echo "$(basename "$OUT") — $(du -h "$OUT" | cut -f1)"
