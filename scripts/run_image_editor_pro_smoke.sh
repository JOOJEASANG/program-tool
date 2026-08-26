#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PORT="${IMAGE_EDITOR_PRO_SMOKE_PORT:-4187}"
OUT_DIR="${IMAGE_EDITOR_BROWSER_SMOKE_OUT:-$ROOT_DIR/browser-smoke-artifacts}"
DOM_OUT="$OUT_DIR/image-editor-pro-smoke-dom.html"
SERVER_LOG="$OUT_DIR/image-editor-pro-smoke-server.log"
PROFILE_DIR="$(mktemp -d)"
mkdir -p "$OUT_DIR"

find_browser(){ for candidate in google-chrome google-chrome-stable chromium chromium-browser; do if command -v "$candidate" >/dev/null 2>&1; then command -v "$candidate"; return 0; fi; done; return 1; }
BROWSER="$(find_browser || true)"
if [[ -z "$BROWSER" ]]; then echo "Headless Chrome/Chromium executable not found for image pro smoke." >&2; rm -rf "$PROFILE_DIR"; exit 1; fi

python3 -m http.server "$PORT" --bind 127.0.0.1 --directory "$ROOT_DIR" >"$SERVER_LOG" 2>&1 &
SERVER_PID=$!
cleanup(){ kill "$SERVER_PID" >/dev/null 2>&1 || true; wait "$SERVER_PID" >/dev/null 2>&1 || true; rm -rf "$PROFILE_DIR"; }
trap cleanup EXIT
URL="http://127.0.0.1:$PORT/tests/browser/image-editor-pro-smoke.html"
for _ in $(seq 1 50); do
  if python3 - "$URL" <<'PY' >/dev/null 2>&1
import sys, urllib.request
with urllib.request.urlopen(sys.argv[1], timeout=1) as response:
    raise SystemExit(0 if response.status == 200 else 1)
PY
  then break; fi
  sleep 0.1
done

"$BROWSER" --headless=new --disable-gpu --no-sandbox --disable-dev-shm-usage --disable-background-networking --user-data-dir="$PROFILE_DIR" --virtual-time-budget=22000 --dump-dom "$URL" >"$DOM_OUT"

if ! grep -q 'data-image-pro-smoke="pass"' "$DOM_OUT"; then echo "Image editor pro browser smoke failed." >&2; cat "$DOM_OUT" >&2; echo "----- HTTP server log -----" >&2; cat "$SERVER_LOG" >&2; exit 1; fi
if ! grep -q 'PASS: resize presets, adjustment compare, transparent trim, zoom and export estimate' "$DOM_OUT"; then echo "Image editor pro completion marker missing." >&2; cat "$DOM_OUT" >&2; exit 1; fi
for marker in 'data-pro-trim="140x80"' 'data-pro-zoom="150%"' 'data-pro-stage="image-editor-pro-stage2-single-flight"'; do
  if ! grep -q "$marker" "$DOM_OUT"; then echo "Image editor pro marker missing: $marker" >&2; cat "$DOM_OUT" >&2; exit 1; fi
done

echo "Image editor pro browser smoke passed using $BROWSER"
bash "$ROOT_DIR/scripts/run_image_editor_layout_smoke.sh"
