#!/usr/bin/env bash
# Render the Natcon guides — combined editions plus the per-audience splits,
# in both languages, all with running footers.
#
#   npm i puppeteer-core   # once, anywhere on PATH of `node`
#   scripts/build-guide.sh
#
# docs/panduan/panduan-natcon.html is the master; guide-natcon-en.html its
# English twin. scripts/split-guide.py carves the attendee and crew editions
# out of each master — edit the masters, never the splits.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
D="$ROOT/docs/panduan"
python3 "$ROOT/scripts/split-guide.py" "$D/panduan-natcon.html" "$D/" id
python3 "$ROOT/scripts/split-guide.py" "$D/guide-natcon-en.html" "$D/" en
node "$ROOT/scripts/render-guide.mjs" "$D/panduan-natcon.html" "$D/panduan-natcon.pdf"
node "$ROOT/scripts/render-guide.mjs" "$D/guide-natcon-en.html" "$D/guide-natcon-en.pdf" "App Guide" "Page" "of"
node "$ROOT/scripts/render-guide.mjs" "$D/panduan-peserta.html" "$D/panduan-peserta.pdf" "Panduan Peserta"
node "$ROOT/scripts/render-guide.mjs" "$D/panduan-panitia.html" "$D/panduan-panitia.pdf" "Panduan Panitia & Kru"
node "$ROOT/scripts/render-guide.mjs" "$D/guide-attendee-en.html" "$D/guide-attendee-en.pdf" "Attendee Guide" "Page" "of"
node "$ROOT/scripts/render-guide.mjs" "$D/guide-crew-en.html" "$D/guide-crew-en.pdf" "Crew & Committee Guide" "Page" "of"
