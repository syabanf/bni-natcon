#!/usr/bin/env bash
# Render the Natcon guide — all four apps in one PDF, with a running footer.
#
#   npm i puppeteer-core   # once, anywhere on PATH of `node`
#   scripts/build-guide.sh
#
# The source is docs/panduan/panduan-natcon.html — edit that, not the PDF. It
# carries the brand marks and every screenshot inline as data URIs. Rendering
# goes through puppeteer (scripts/render-guide.mjs) because the Chrome CLI
# cannot print a custom footer with page numbers.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
node "$ROOT/scripts/render-guide.mjs" \
  "$ROOT/docs/panduan/panduan-natcon.html" \
  "$ROOT/docs/panduan/panduan-natcon.pdf"
