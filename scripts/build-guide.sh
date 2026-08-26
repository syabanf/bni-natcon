#!/usr/bin/env bash
# Render the Natcon guides — the combined editions plus the per-audience
# splits, all with running footers.
#
#   npm i puppeteer-core   # once, anywhere on PATH of `node`
#   scripts/build-guide.sh
#
# docs/panduan/panduan-natcon.html is the master; guide-natcon-en.html its
# English twin. scripts/split-guide.py carves the attendee and crew editions
# out of the master, so edit the master, not the splits.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
D="$ROOT/docs/panduan"
python3 "$ROOT/scripts/split-guide.py" "$D/panduan-natcon.html" "$D/"
node "$ROOT/scripts/render-guide.mjs" "$D/panduan-natcon.html" "$D/panduan-natcon.pdf"
node "$ROOT/scripts/render-guide.mjs" "$D/guide-natcon-en.html" "$D/guide-natcon-en.pdf" "App Guide" "Page" "of"
node "$ROOT/scripts/render-guide.mjs" "$D/panduan-peserta.html" "$D/panduan-peserta.pdf" "Panduan Peserta"
node "$ROOT/scripts/render-guide.mjs" "$D/panduan-panitia.html" "$D/panduan-panitia.pdf" "Panduan Panitia & Kru"
