#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PORT="${PHASE8_SMOKE_PORT:-4196}"
OUT_DIR="${PHASE8_BROWSER_SMOKE_OUT:-$ROOT_DIR/browser-smoke-artifacts}"
SERVER_LOG="$OUT_DIR/phase8-smoke-server.log"
PROFILE_DIR="$(mktemp -d)"
mkdir -p "$OUT_DIR"

find_browser(){ for candidate in google-chrome google-chrome-stable chromium chromium-browser; do if command -v "$candidate" >/dev/null 2>&1; then command -v "$candidate"; return 0; fi; done; return 1; }
BROWSER="$(find_browser || true)"
if [[ -z "$BROWSER" ]]; then echo "Headless Chrome/Chromium executable not found for Phase 8 smoke." >&2; rm -rf "$PROFILE_DIR"; exit 1; fi

python3 -m http.server "$PORT" --bind 127.0.0.1 --directory "$ROOT_DIR" >"$SERVER_LOG" 2>&1 &
SERVER_PID=$!
cleanup(){ kill "$SERVER_PID" >/dev/null 2>&1 || true; wait "$SERVER_PID" >/dev/null 2>&1 || true; rm -rf "$PROFILE_DIR"; }
trap cleanup EXIT

wait_for_url(){
  local url="$1"
  for _ in $(seq 1 50); do
    if python3 - "$url" <<'PY' >/dev/null 2>&1
import sys, urllib.request
with urllib.request.urlopen(sys.argv[1], timeout=1) as response:
    raise SystemExit(0 if response.status == 200 else 1)
PY
    then return 0; fi
    sleep 0.1
  done
  return 1
}

run_case(){
  local url="$1" out="$2" marker="$3" label="$4"
  wait_for_url "$url"
  rm -rf "$PROFILE_DIR"; PROFILE_DIR="$(mktemp -d)"
  "$BROWSER" --headless=new --disable-gpu --no-sandbox --disable-dev-shm-usage --disable-background-networking --user-data-dir="$PROFILE_DIR" --window-size=1280,800 --virtual-time-budget=5000 --dump-dom "$url" >"$out"
  if ! grep -q "$marker" "$out"; then
    echo "$label failed." >&2
    cat "$out" >&2
    echo "----- HTTP server log -----" >&2
    cat "$SERVER_LOG" >&2
    exit 1
  fi
}

URL="http://127.0.0.1:$PORT/tests/browser/runtime-asset-budget-v5-smoke.html"
OUT="$OUT_DIR/runtime-asset-budget-v5-smoke-dom.html"
run_case "$URL" "$OUT" 'data-phase8-smoke="pass"' 'Runtime asset Phase 8 smoke'

LOCAL_URL="http://127.0.0.1:$PORT/tests/browser/pdf-local-processing-smoke.html"
LOCAL_OUT="$OUT_DIR/pdf-local-processing-smoke-dom.html"
run_case "$LOCAL_URL" "$LOCAL_OUT" 'data-pdf-local-processing-smoke="pass"' 'PDF local-processing browser smoke'

echo "Runtime asset + PDF local-processing Phase 8 smoke passed using $BROWSER"
