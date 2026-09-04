#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PORT="${PHASE7_SMOKE_PORT:-4195}"
OUT_DIR="${PHASE7_BROWSER_SMOKE_OUT:-$ROOT_DIR/browser-smoke-artifacts}"
SERVER_LOG="$OUT_DIR/phase7-smoke-server.log"
PROFILE_DIR="$(mktemp -d)"
mkdir -p "$OUT_DIR"

find_browser(){ for candidate in google-chrome google-chrome-stable chromium chromium-browser; do if command -v "$candidate" >/dev/null 2>&1; then command -v "$candidate"; return 0; fi; done; return 1; }
BROWSER="$(find_browser || true)"
if [[ -z "$BROWSER" ]]; then echo "Headless Chrome/Chromium executable not found for Phase 7 smoke." >&2; rm -rf "$PROFILE_DIR"; exit 1; fi

python3 -m http.server "$PORT" --bind 127.0.0.1 --directory "$ROOT_DIR" >"$SERVER_LOG" 2>&1 &
SERVER_PID=$!
cleanup(){ kill "$SERVER_PID" >/dev/null 2>&1 || true; wait "$SERVER_PID" >/dev/null 2>&1 || true; rm -rf "$PROFILE_DIR"; }
trap cleanup EXIT

run_page(){
  local page="$1" label="$2" out="$OUT_DIR/$3"
  local url="http://127.0.0.1:$PORT/tests/browser/$page"
  for _ in $(seq 1 50); do
    if python3 - "$url" <<'PY' >/dev/null 2>&1
import sys, urllib.request
with urllib.request.urlopen(sys.argv[1], timeout=1) as response:
    raise SystemExit(0 if response.status == 200 else 1)
PY
    then break; fi
    sleep 0.1
  done
  "$BROWSER" --headless=new --disable-gpu --no-sandbox --disable-dev-shm-usage --disable-background-networking --user-data-dir="$PROFILE_DIR" --window-size=1280,800 --virtual-time-budget=5000 --dump-dom "$url" >"$out"
  if ! grep -q 'data-phase7-smoke="pass"' "$out"; then
    echo "$label failed." >&2
    cat "$out" >&2
    echo "----- HTTP server log -----" >&2
    cat "$SERVER_LOG" >&2
    exit 1
  fi
  echo "$label passed using $BROWSER"
}

run_page "public-boot-guard-v4-smoke.html" "Public boot guard Phase 7 smoke" "public-boot-guard-v4-smoke-dom.html"
run_page "runtime-public-first-paint-v4-smoke.html" "Runtime public first-paint Phase 7 smoke" "runtime-public-first-paint-v4-smoke-dom.html"
run_page "protected-preflight-boot-nonblocking-smoke.html" "Protected preflight nonblocking boot smoke" "protected-preflight-boot-nonblocking-smoke-dom.html"
run_page "pdf-utility-cost-guard-stability-smoke.html" "PDF utility cost guard stability smoke" "pdf-utility-cost-guard-stability-smoke-dom.html"
