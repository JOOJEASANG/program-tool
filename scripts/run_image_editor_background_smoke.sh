#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PORT="${IMAGE_EDITOR_BACKGROUND_SMOKE_PORT:-4185}"
OUT_DIR="${IMAGE_EDITOR_BROWSER_SMOKE_OUT:-$ROOT_DIR/browser-smoke-artifacts}"
DOM_OUT="$OUT_DIR/image-editor-background-smoke-dom.html"
SERVER_LOG="$OUT_DIR/image-editor-background-smoke-server.log"
PROFILE_DIR="$(mktemp -d)"
mkdir -p "$OUT_DIR"

find_browser(){ for candidate in google-chrome google-chrome-stable chromium chromium-browser; do if command -v "$candidate" >/dev/null 2>&1; then command -v "$candidate"; return 0; fi; done; return 1; }
BROWSER="$(find_browser || true)"
if [[ -z "$BROWSER" ]]; then echo "Headless Chrome/Chromium executable not found for image background smoke." >&2; rm -rf "$PROFILE_DIR"; exit 1; fi

python3 -m http.server "$PORT" --bind 127.0.0.1 --directory "$ROOT_DIR" >"$SERVER_LOG" 2>&1 &
SERVER_PID=$!
cleanup(){ kill "$SERVER_PID" >/dev/null 2>&1 || true; wait "$SERVER_PID" >/dev/null 2>&1 || true; rm -rf "$PROFILE_DIR"; }
trap cleanup EXIT
URL="http://127.0.0.1:$PORT/tests/browser/image-editor-background-smoke.html"
for _ in $(seq 1 50); do
  if python3 - "$URL" <<'PY' >/dev/null 2>&1
import sys, urllib.request
with urllib.request.urlopen(sys.argv[1], timeout=1) as response:
    raise SystemExit(0 if response.status == 200 else 1)
PY
  then break; fi
  sleep 0.1
done

"$BROWSER" --headless=new --disable-gpu --no-sandbox --disable-dev-shm-usage --disable-background-networking --user-data-dir="$PROFILE_DIR" --virtual-time-budget=20000 --dump-dom "$URL" >"$DOM_OUT"

if ! grep -q 'data-image-background-smoke="pass"' "$DOM_OUT"; then echo "Image editor background browser smoke failed." >&2; cat "$DOM_OUT" >&2; echo "----- HTTP server log -----" >&2; cat "$SERVER_LOG" >&2; exit 1; fi
if ! grep -q 'PASS: corner sampling, single-color removal, transparent PNG, white JPEG flatten and undo' "$DOM_OUT"; then echo "Image background smoke completion marker missing." >&2; cat "$DOM_OUT" >&2; exit 1; fi
for marker in 'data-background-removed="true"' 'data-background-corner-alpha="0"' 'data-background-subject-alpha="255"' 'data-background-jpeg-white="true"' 'data-background-undo="true"' 'data-background-stage="image-editor-core-stage2-background"'; do
  if ! grep -q "$marker" "$DOM_OUT"; then echo "Image background smoke marker missing: $marker" >&2; cat "$DOM_OUT" >&2; exit 1; fi
done

echo "Image editor background removal browser smoke passed using $BROWSER"
