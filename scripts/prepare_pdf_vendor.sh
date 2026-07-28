#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
TMP_DIR="$(mktemp -d)"
trap 'rm -rf "$TMP_DIR"' EXIT

npm install \
  --prefix "$TMP_DIR" \
  --ignore-scripts \
  --no-audit \
  --no-fund \
  --silent \
  pdfjs-dist@3.11.174 \
  jspdf@2.5.1

mkdir -p "$ROOT/vendor"
cp "$TMP_DIR/node_modules/pdfjs-dist/build/pdf.min.js" "$ROOT/vendor/pdf.min.js"
cp "$TMP_DIR/node_modules/pdfjs-dist/build/pdf.worker.min.js" "$ROOT/vendor/pdf.worker.min.js"
cp "$TMP_DIR/node_modules/jspdf/dist/jspdf.umd.min.js" "$ROOT/vendor/jspdf.umd.min.js"

for file in \
  "$ROOT/vendor/pdf.min.js" \
  "$ROOT/vendor/pdf.worker.min.js" \
  "$ROOT/vendor/jspdf.umd.min.js"; do
  test -s "$file"
done

printf 'Prepared local PDF runtime assets:\n'
wc -c \
  "$ROOT/vendor/pdf.min.js" \
  "$ROOT/vendor/pdf.worker.min.js" \
  "$ROOT/vendor/jspdf.umd.min.js"
