#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PORT="${MODULAR_APP_SMOKE_PORT:-4198}"
OUT_DIR="${MODULAR_APP_SMOKE_OUT:-$ROOT_DIR/browser-smoke-artifacts}"
SERVER_LOG="$OUT_DIR/modular-app-shell-smoke-server.log"
PROFILE_DIR="$(mktemp -d)"
mkdir -p "$OUT_DIR"

find_browser(){ for candidate in google-chrome google-chrome-stable chromium chromium-browser; do if command -v "$candidate" >/dev/null 2>&1; then command -v "$candidate"; return 0; fi; done; return 1; }
BROWSER="$(find_browser || true)"
if [[ -z "$BROWSER" ]]; then echo "Headless Chrome/Chromium executable not found for modular app smoke." >&2; rm -rf "$PROFILE_DIR"; exit 1; fi

python3 -m http.server "$PORT" --bind 127.0.0.1 --directory "$ROOT_DIR" >"$SERVER_LOG" 2>&1 &
SERVER_PID=$!
cleanup(){ kill "$SERVER_PID" >/dev/null 2>&1 || true; wait "$SERVER_PID" >/dev/null 2>&1 || true; rm -rf "$PROFILE_DIR"; }
trap cleanup EXIT

wait_for_server(){
  for _ in $(seq 1 50); do
    if python3 - "$PORT" <<'PY' >/dev/null 2>&1
import sys, urllib.request
with urllib.request.urlopen(f"http://127.0.0.1:{sys.argv[1]}/tests/browser/modular-app-shell-smoke.html?app=pdf-layout", timeout=1) as response:
    raise SystemExit(0 if response.status == 200 else 1)
PY
    then return 0; fi
    sleep 0.1
  done
  return 1
}

run_browser_case(){
  local url="$1" out="$2" marker="$3"
  rm -rf "$PROFILE_DIR"; PROFILE_DIR="$(mktemp -d)"
  "$BROWSER" --headless=new --disable-gpu --no-sandbox --disable-dev-shm-usage --disable-background-networking --user-data-dir="$PROFILE_DIR" --virtual-time-budget=5000 --dump-dom "$url" >"$out"
  grep -q "$marker" "$out" || { cat "$out" >&2; exit 1; }
}

wait_for_server
for app in pdf-layout booklet; do
  out="$OUT_DIR/modular-app-${app}-smoke-dom.html"
  url="http://127.0.0.1:$PORT/tests/browser/modular-app-shell-smoke.html?app=$app"
  run_browser_case "$url" "$out" 'data-modular-shell-smoke="pass"'
  grep -q "data-modular-shell-app=\"$app\"" "$out" || { cat "$out" >&2; exit 1; }
  grep -q "data-modular-shell-theme=\"$app\"" "$out" || { cat "$out" >&2; exit 1; }
  grep -q 'data-modular-shell-access-race="pass"' "$out" || { cat "$out" >&2; exit 1; }
  grep -q 'data-modular-shell-parallel-preload="pass"' "$out" || { cat "$out" >&2; exit 1; }
  grep -q 'data-modular-shell-quick="0"' "$out" || { cat "$out" >&2; exit 1; }
done

for app in layout booklet; do
  out="$OUT_DIR/standalone-pdf-${app}-boundary-smoke-dom.html"
  url="http://127.0.0.1:$PORT/tests/browser/standalone-boundary-ui-smoke.html?kind=pdf&app=$app"
  run_browser_case "$url" "$out" 'data-standalone-boundary-smoke="pass"'
  grep -q "data-boundary-app=\"$app\"" "$out" || { cat "$out" >&2; exit 1; }
done

echo "Modular app browser smoke passed for current PDF layout/booklet shell and boundary UI using $BROWSER"
