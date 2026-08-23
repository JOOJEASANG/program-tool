#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PORT="${DESIGN_EDITOR_COVER_SMOKE_PORT:-4176}"
OUT_DIR="${DESIGN_EDITOR_BROWSER_SMOKE_OUT:-$ROOT_DIR/browser-smoke-artifacts}"
DOM_OUT="$OUT_DIR/design-editor-cover-smoke-dom.html"
SERVER_LOG="$OUT_DIR/design-editor-cover-smoke-server.log"
PROFILE_DIR="$(mktemp -d)"
mkdir -p "$OUT_DIR"

find_browser(){ for candidate in google-chrome google-chrome-stable chromium chromium-browser; do if command -v "$candidate" >/dev/null 2>&1; then command -v "$candidate"; return 0; fi; done; return 1; }
BROWSER="$(find_browser || true)"
if [[ -z "$BROWSER" ]]; then echo "Headless Chrome/Chromium executable not found for cover smoke." >&2; rm -rf "$PROFILE_DIR"; exit 1; fi

python3 -m http.server "$PORT" --bind 127.0.0.1 --directory "$ROOT_DIR" >"$SERVER_LOG" 2>&1 &
SERVER_PID=$!
cleanup(){ kill "$SERVER_PID" >/dev/null 2>&1 || true; wait "$SERVER_PID" >/dev/null 2>&1 || true; rm -rf "$PROFILE_DIR"; }
trap cleanup EXIT
URL="http://127.0.0.1:$PORT/tests/browser/design-editor-cover-smoke.html"
for _ in $(seq 1 50); do
  if python3 - "$URL" <<'PY' >/dev/null 2>&1
import sys, urllib.request
with urllib.request.urlopen(sys.argv[1], timeout=1) as response:
    raise SystemExit(0 if response.status == 200 else 1)
PY
  then break; fi
  sleep 0.1
done

"$BROWSER" --headless=new --disable-gpu --no-sandbox --disable-dev-shm-usage --disable-background-networking --user-data-dir="$PROFILE_DIR" --virtual-time-budget=30000 --dump-dom "$URL" >"$DOM_OUT"

if ! grep -q 'data-cover-smoke-status="pass"' "$DOM_OUT"; then echo "Design editor cover browser smoke failed." >&2; cat "$DOM_OUT" >&2; echo "----- HTTP server log -----" >&2; cat "$SERVER_LOG" >&2; exit 1; fi
if ! grep -q 'PASS: unified cover settings, spine direction, safety and real render preserve common-editor content' "$DOM_OUT"; then echo "Cover browser smoke completion marker is missing." >&2; cat "$DOM_OUT" >&2; exit 1; fi
for marker in 'data-cover-width="430.5"' 'data-cover-height="297"' 'data-cover-spine="10.5"' 'data-cover-folds="210,220.5"' 'data-cover-runtime="31"' 'data-cover-page-count="200"' 'data-cover-element-preserved="true"' 'data-cover-draft-scope="cover-a4.210x297"' 'data-cover-spine-titles="1"' 'data-cover-spine-direction="bottomToTop"' 'data-cover-spine-ink="true"'; do
  if ! grep -q "$marker" "$DOM_OUT"; then echo "Cover browser smoke marker missing: $marker" >&2; cat "$DOM_OUT" >&2; exit 1; fi
done

echo "Design editor unified cover settings and spine tools browser smoke passed using $BROWSER"
