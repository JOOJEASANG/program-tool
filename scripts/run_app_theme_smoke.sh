#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PORT="${APP_THEME_SMOKE_PORT:-4191}"
OUT_DIR="${APP_THEME_SMOKE_OUT:-$ROOT_DIR/browser-smoke-artifacts}"
DOM_OUT="$OUT_DIR/app-theme-smoke-dom.html"
LAYOUT_DOM_OUT="$OUT_DIR/image-editor-layout-smoke-dom.html"
SERVER_LOG="$OUT_DIR/app-theme-smoke-server.log"
PROFILE_DIR="$(mktemp -d)"
LAYOUT_PROFILE_DIR="$(mktemp -d)"
mkdir -p "$OUT_DIR"

find_browser(){ for candidate in google-chrome google-chrome-stable chromium chromium-browser; do if command -v "$candidate" >/dev/null 2>&1; then command -v "$candidate"; return 0; fi; done; return 1; }
BROWSER="$(find_browser || true)"
if [[ -z "$BROWSER" ]]; then echo "Headless Chrome/Chromium executable not found for theme smoke." >&2; rm -rf "$PROFILE_DIR" "$LAYOUT_PROFILE_DIR"; exit 1; fi

python3 -m http.server "$PORT" --bind 127.0.0.1 --directory "$ROOT_DIR" >"$SERVER_LOG" 2>&1 &
SERVER_PID=$!
cleanup(){ kill "$SERVER_PID" >/dev/null 2>&1 || true; wait "$SERVER_PID" >/dev/null 2>&1 || true; rm -rf "$PROFILE_DIR" "$LAYOUT_PROFILE_DIR"; }
trap cleanup EXIT
URL="http://127.0.0.1:$PORT/tests/browser/app-theme-smoke.html"
for _ in $(seq 1 50); do
  if python3 - "$URL" <<'PY' >/dev/null 2>&1
import sys, urllib.request
with urllib.request.urlopen(sys.argv[1], timeout=1) as response:
    raise SystemExit(0 if response.status == 200 else 1)
PY
  then break; fi
  sleep 0.1
done

"$BROWSER" --headless=new --disable-gpu --no-sandbox --disable-dev-shm-usage --disable-background-networking --user-data-dir="$PROFILE_DIR" --virtual-time-budget=12000 --dump-dom "$URL" >"$DOM_OUT"

if ! grep -q 'data-theme-smoke="pass"' "$DOM_OUT"; then echo "Program Studio theme browser smoke failed." >&2; cat "$DOM_OUT" >&2; echo "----- HTTP server log -----" >&2; cat "$SERVER_LOG" >&2; exit 1; fi
if ! grep -q 'PASS: shared light/dark toggle, persistence and white print surface' "$DOM_OUT"; then echo "Program Studio theme completion marker missing." >&2; cat "$DOM_OUT" >&2; exit 1; fi

LAYOUT_URL="http://127.0.0.1:$PORT/tests/browser/image-editor-layout-smoke.html"
"$BROWSER" --headless=new --disable-gpu --no-sandbox --disable-dev-shm-usage --disable-background-networking --user-data-dir="$LAYOUT_PROFILE_DIR" --virtual-time-budget=5000 --dump-dom "$LAYOUT_URL" >"$LAYOUT_DOM_OUT"
if ! grep -q 'data-image-layout-smoke="pass"' "$LAYOUT_DOM_OUT"; then echo "Image editor layout browser smoke failed." >&2; cat "$LAYOUT_DOM_OUT" >&2; exit 1; fi
if ! grep -q 'PASS: PDF-style layout, bright preview surface and correct hidden canvas state' "$LAYOUT_DOM_OUT"; then echo "Image editor layout completion marker missing." >&2; cat "$LAYOUT_DOM_OUT" >&2; exit 1; fi

echo "Program Studio theme and image editor layout browser smokes passed using $BROWSER"
