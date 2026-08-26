#!/usr/bin/env bash
# Render the Natcon guides — all four apps in one PDF, in both languages.
#
#   npm i puppeteer-core   # once, anywhere on PATH of `node`
#   scripts/build-guide.sh
#
# The sources are docs/panduan/panduan-natcon.html (Indonesian) and
# docs/panduan/guide-natcon-en.html (English) — edit those, not the PDFs.
# Each carries the brand marks and every screenshot inline as data URIs.
# Rendering goes through puppeteer (scripts/render-guide.mjs) because the
# Chrome CLI cannot print a custom footer with page numbers.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
node "$ROOT/scripts/render-guide.mjs" \
  "$ROOT/docs/panduan/panduan-natcon.html" \
  "$ROOT/docs/panduan/panduan-natcon.pdf"
node "$ROOT/scripts/render-guide.mjs" \
  "$ROOT/docs/panduan/guide-natcon-en.html" \
  "$ROOT/docs/panduan/guide-natcon-en.pdf" \
  "App Guide" "Page" "of"
