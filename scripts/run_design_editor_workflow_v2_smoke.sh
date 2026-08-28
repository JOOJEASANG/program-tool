#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PORT="${DESIGN_EDITOR_WORKFLOW_V2_SMOKE_PORT:-4198}"
OUT_DIR="${DESIGN_EDITOR_BROWSER_SMOKE_OUT:-$ROOT_DIR/browser-smoke-artifacts}"
DOM_OUT="$OUT_DIR/design-editor-workflow-v2-smoke-dom.html"
SERVER_LOG="$OUT_DIR/design-editor-workflow-v2-smoke-server.log"
PROFILE_DIR="$(mktemp -d)"
mkdir -p "$OUT_DIR"

find_browser(){ for candidate in google-chrome google-chrome-stable chromium chromium-browser; do if command -v "$candidate" >/dev/null 2>&1; then command -v "$candidate"; return 0; fi; done; return 1; }
BROWSER="$(find_browser || true)"
if [[ -z "$BROWSER" ]]; then echo "Headless Chrome/Chromium executable not found for design workflow v2 smoke." >&2; rm -rf "$PROFILE_DIR"; exit 1; fi

python3 -m http.server "$PORT" --bind 127.0.0.1 --directory "$ROOT_DIR" >"$SERVER_LOG" 2>&1 &
SERVER_PID=$!
cleanup(){ kill "$SERVER_PID" >/dev/null 2>&1 || true; wait "$SERVER_PID" >/dev/null 2>&1 || true; rm -rf "$PROFILE_DIR"; }
trap cleanup EXIT

URL="http://127.0.0.1:$PORT/tests/browser/design-editor-workflow-v2-smoke.html"
for _ in $(seq 1 50); do
  if python3 - "$URL" <<'PY' >/dev/null 2>&1
import sys, urllib.request
with urllib.request.urlopen(sys.argv[1], timeout=1) as response:
    raise SystemExit(0 if response.status == 200 else 1)
PY
  then break; fi
  sleep 0.1
done

"$BROWSER" --headless=new --disable-gpu --no-sandbox --disable-dev-shm-usage --disable-background-networking --user-data-dir="$PROFILE_DIR" --virtual-time-budget=10000 --dump-dom "$URL" >"$DOM_OUT"

grep -q 'data-design-workflow-v2-smoke="pass"' "$DOM_OUT" || { cat "$DOM_OUT" >&2; exit 1; }
grep -q 'data-final-check-clicked="true"' "$DOM_OUT" || { cat "$DOM_OUT" >&2; exit 1; }
grep -q 'data-diagnostics-clicked="true"' "$DOM_OUT" || { cat "$DOM_OUT" >&2; exit 1; }
grep -q 'PASS: design workflow v2, output dock, final print check and diagnostics integration' "$DOM_OUT" || { cat "$DOM_OUT" >&2; exit 1; }

echo "Design editor workflow v2 browser smoke passed using $BROWSER"
