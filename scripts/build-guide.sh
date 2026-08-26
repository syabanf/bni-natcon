#!/usr/bin/env bash
# Render the Natcon guide — all four apps in one PDF.
#
#   scripts/build-guide.sh
#
# The source is docs/panduan/panduan-natcon.html — edit that, not the PDF. It
# carries the brand marks and every screenshot inline as data URIs, so the
# file is one thing you can hand to anybody. The screenshots themselves were
# taken against the local Docker stack with a throwaway sample attendee
# ("Contoh Peserta"), deleted afterwards — no real member appears in print.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
SRC="$ROOT/docs/panduan/panduan-natcon.html"
OUT="$ROOT/docs/panduan/panduan-natcon.pdf"
CHROME="${CHROME:-/Applications/Google Chrome.app/Contents/MacOS/Google Chrome}"

[ -x "$CHROME" ] || { echo "Chrome not found — set CHROME=/path/to/chrome" >&2; exit 1; }

"$CHROME" --headless --disable-gpu --no-pdf-header-footer \
  --print-to-pdf="$OUT" "file://$SRC" 2>/dev/null

echo "$(basename "$OUT") — $(du -h "$OUT" | cut -f1)"
