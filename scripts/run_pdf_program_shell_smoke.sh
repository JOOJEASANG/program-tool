#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PORT="${PDF_PROGRAM_SHELL_SMOKE_PORT:-4196}"
OUT_DIR="${PDF_PROGRAM_SHELL_SMOKE_OUT:-$ROOT_DIR/browser-smoke-artifacts}"
SERVER_LOG="$OUT_DIR/pdf-program-shell-smoke-server.log"
PROFILE_DIR="$(mktemp -d)"
mkdir -p "$OUT_DIR"

find_browser(){ for candidate in google-chrome google-chrome-stable chromium chromium-browser; do if command -v "$candidate" >/dev/null 2>&1; then command -v "$candidate"; return 0; fi; done; return 1; }
BROWSER="$(find_browser || true)"
if [[ -z "$BROWSER" ]]; then echo "Headless Chrome/Chromium executable not found for PDF program shell smoke." >&2; rm -rf "$PROFILE_DIR"; exit 1; fi

python3 -m http.server "$PORT" --bind 127.0.0.1 --directory "$ROOT_DIR" >"$SERVER_LOG" 2>&1 &
SERVER_PID=$!
cleanup(){ kill "$SERVER_PID" >/dev/null 2>&1 || true; wait "$SERVER_PID" >/dev/null 2>&1 || true; rm -rf "$PROFILE_DIR"; }
trap cleanup EXIT

run_case(){
  local page="$1" out="$2" marker="$3"
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
  "$BROWSER" --headless=new --disable-gpu --no-sandbox --disable-dev-shm-usage --disable-background-networking --user-data-dir="$PROFILE_DIR" --virtual-time-budget=10000 --dump-dom "$url" >"$out"
  grep -q 'data-shell-smoke="pass"' "$out" || { cat "$out" >&2; exit 1; }
  grep -q 'data-shell-header-removed="true"' "$out" || { cat "$out" >&2; exit 1; }
  grep -q 'data-shell-actions-preserved="true"' "$out" || { cat "$out" >&2; exit 1; }
  grep -q "$marker" "$out" || { cat "$out" >&2; exit 1; }
}

run_case "pdf-editor-shell-smoke.html" "$OUT_DIR/pdf-editor-shell-smoke-dom.html" 'PASS: PDF editor fixed header removed and actions preserved in workspace'
rm -rf "$PROFILE_DIR"; PROFILE_DIR="$(mktemp -d)"
run_case "pdf-utility-shell-smoke.html" "$OUT_DIR/pdf-utility-shell-smoke-dom.html" 'PASS: PDF utility fixed header removed and account actions preserved in content'

echo "PDF program unified shell browser smoke passed using $BROWSER"
