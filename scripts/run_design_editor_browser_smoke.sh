#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PORT="${DESIGN_EDITOR_BROWSER_SMOKE_PORT:-4173}"
OUT_DIR="${DESIGN_EDITOR_BROWSER_SMOKE_OUT:-$ROOT_DIR/browser-smoke-artifacts}"
DOM_OUT="$OUT_DIR/design-editor-smoke-dom.html"
SERVER_LOG="$OUT_DIR/design-editor-smoke-server.log"
mkdir -p "$OUT_DIR"

find_browser() {
  for candidate in google-chrome google-chrome-stable chromium chromium-browser; do
    if command -v "$candidate" >/dev/null 2>&1; then
      command -v "$candidate"
      return 0
    fi
  done
  return 1
}

BROWSER="$(find_browser || true)"
if [[ -z "$BROWSER" ]]; then
  echo "Headless Chrome/Chromium executable not found." >&2
  exit 1
fi

python3 -m http.server "$PORT" --bind 127.0.0.1 --directory "$ROOT_DIR" >"$SERVER_LOG" 2>&1 &
SERVER_PID=$!
cleanup() {
  kill "$SERVER_PID" >/dev/null 2>&1 || true
  wait "$SERVER_PID" >/dev/null 2>&1 || true
}
trap cleanup EXIT

URL="http://127.0.0.1:$PORT/tests/browser/design-editor-smoke.html"
for _ in $(seq 1 50); do
  if python3 - "$URL" <<'PY' >/dev/null 2>&1
import sys
import urllib.request
with urllib.request.urlopen(sys.argv[1], timeout=1) as response:
    if response.status != 200:
        raise SystemExit(1)
PY
  then
    break
  fi
  sleep 0.1
done

"$BROWSER" \
  --headless=new \
  --disable-gpu \
  --no-sandbox \
  --disable-dev-shm-usage \
  --disable-background-networking \
  --virtual-time-budget=18000 \
  --dump-dom \
  "$URL" >"$DOM_OUT"

if ! grep -q 'data-smoke-status="pass"' "$DOM_OUT"; then
  echo "Design editor browser smoke failed." >&2
  echo "----- Browser DOM -----" >&2
  cat "$DOM_OUT" >&2
  echo "----- HTTP server log -----" >&2
  cat "$SERVER_LOG" >&2
  exit 1
fi

if ! grep -q 'PASS: core edit, two-surface flow, real 300DPI render, fail-closed verification, full runtime manifest' "$DOM_OUT"; then
  echo "Browser smoke completion marker is missing." >&2
  cat "$DOM_OUT" >&2
  exit 1
fi

if ! grep -q 'data-rendered-width="2551"' "$DOM_OUT" || ! grep -q 'data-rendered-height="3579"' "$DOM_OUT"; then
  echo "Real 300DPI render dimensions were not recorded." >&2
  cat "$DOM_OUT" >&2
  exit 1
fi

echo "Design editor browser smoke passed using $BROWSER"
