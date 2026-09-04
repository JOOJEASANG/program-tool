#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PORT="${PHASE5_SMOKE_PORT:-4193}"
OUT_DIR="${PHASE5_BROWSER_SMOKE_OUT:-$ROOT_DIR/browser-smoke-artifacts}"
SERVER_LOG="$OUT_DIR/phase5-smoke-server.log"
PROFILE_DIR="$(mktemp -d)"
mkdir -p "$OUT_DIR"

find_browser(){ for candidate in google-chrome google-chrome-stable chromium chromium-browser; do if command -v "$candidate" >/dev/null 2>&1; then command -v "$candidate"; return 0; fi; done; return 1; }
BROWSER="$(find_browser || true)"
if [[ -z "$BROWSER" ]]; then echo "Headless Chrome/Chromium executable not found for Phase 5 smoke." >&2; rm -rf "$PROFILE_DIR"; exit 1; fi

python3 -m http.server "$PORT" --bind 127.0.0.1 --directory "$ROOT_DIR" >"$SERVER_LOG" 2>&1 &
SERVER_PID=$!
cleanup(){ kill "$SERVER_PID" >/dev/null 2>&1 || true; wait "$SERVER_PID" >/dev/null 2>&1 || true; rm -rf "$PROFILE_DIR"; }
trap cleanup EXIT

run_page(){
  local page="$1" marker="$2" label="$3" out="$OUT_DIR/$4"
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
  "$BROWSER" --headless=new --disable-gpu --no-sandbox --disable-dev-shm-usage --disable-background-networking --user-data-dir="$PROFILE_DIR" --virtual-time-budget=8000 --dump-dom "$url" >"$out"
  if ! grep -q "$marker" "$out"; then
    echo "$label failed." >&2
    cat "$out" >&2
    echo "----- HTTP server log -----" >&2
    cat "$SERVER_LOG" >&2
    exit 1
  fi
  echo "$label passed using $BROWSER"
}

run_page "home-current-shell-smoke.html" 'data-home-current-smoke="pass"' "Current home shell browser smoke" "home-current-shell-smoke-dom.html"
run_page "admin-workflow-v2-smoke.html" 'data-admin-v2-smoke="pass"' "Admin workflow v2 browser smoke" "admin-workflow-v2-smoke-dom.html"
run_page "pdf-preflight-workflow-v2-smoke.html" 'data-preflight-v2-smoke="pass"' "PDF preflight workflow v2 browser smoke" "pdf-preflight-workflow-v2-smoke-dom.html"
run_page "print-checker-smoke.html" 'data-print-checker-smoke="pass"' "Print checker real PDF browser smoke" "print-checker-smoke-dom.html"
run_page "pdf-suite-hub-smoke.html" 'data-pdf-suite-smoke="pass"' "PDF suite hub browser smoke" "pdf-suite-hub-smoke-dom.html"
run_page "pdf-suite-advanced-smoke.html" 'data-pdf-suite-advanced-smoke="pass"' "PDF suite advanced browser smoke" "pdf-suite-advanced-smoke-dom.html"
run_page "pdf-suite-ocr-smoke.html" 'data-pdf-suite-ocr-smoke="pass"' "PDF suite OCR browser smoke" "pdf-suite-ocr-smoke-dom.html"
