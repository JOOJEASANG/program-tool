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

reset_profile(){ rm -rf "$PROFILE_DIR"; PROFILE_DIR="$(mktemp -d)"; }

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
  local page="$1" out="$2" marker="$3"
  local url="http://127.0.0.1:$PORT/tests/browser/$page"
  wait_for_url "$url"
  "$BROWSER" --headless=new --disable-gpu --no-sandbox --disable-dev-shm-usage --disable-background-networking --user-data-dir="$PROFILE_DIR" --virtual-time-budget=10000 --dump-dom "$url" >"$out"
  grep -q 'data-shell-smoke="pass"' "$out" || { cat "$out" >&2; exit 1; }
  grep -q 'data-shell-header-removed="true"' "$out" || { cat "$out" >&2; exit 1; }
  grep -q 'data-shell-actions-preserved="true"' "$out" || { cat "$out" >&2; exit 1; }
  grep -q "$marker" "$out" || { cat "$out" >&2; exit 1; }
}

run_product_case(){
  local page="$1" out="$2" attr="$3" marker="$4"
  local url="http://127.0.0.1:$PORT/tests/browser/$page"
  wait_for_url "$url"
  "$BROWSER" --headless=new --disable-gpu --no-sandbox --disable-dev-shm-usage --disable-background-networking --user-data-dir="$PROFILE_DIR" --virtual-time-budget=12000 --dump-dom "$url" >"$out"
  grep -q "$attr" "$out" || { cat "$out" >&2; exit 1; }
  grep -q "$marker" "$out" || { cat "$out" >&2; exit 1; }
}

run_case "pdf-editor-shell-smoke.html" "$OUT_DIR/pdf-editor-shell-smoke-dom.html" 'PASS: PDF sidebar remains visible after delayed common/runtime initialization'
reset_profile
run_case "pdf-utility-shell-smoke.html" "$OUT_DIR/pdf-utility-shell-smoke-dom.html" 'PASS: PDF utility fixed header removed and account actions preserved in content'
reset_profile
run_product_case "pdf-utility-quick-actions-smoke.html" "$OUT_DIR/pdf-utility-quick-actions-smoke-dom.html" 'data-pdf-quick-actions-smoke="pass"' 'PASS: PDF utility quick actions preserve canonical branding and run extract/blank-page tools'
reset_profile
run_product_case "pdf-preflight-output-tool-dock-smoke.html" "$OUT_DIR/pdf-preflight-output-tool-dock-smoke-dom.html" 'data-pdf-output-tool-dock-smoke="pass"' 'PASS: PDF tool dialogs render inside the right progress/result panel'
reset_profile
run_product_case "pdf-utility-background-margin-smoke.html" "$OUT_DIR/pdf-utility-background-margin-smoke-dom.html" 'data-pdf-background-margin-smoke="pass"' 'PASS: background cleanup margin removal follows PDF Utility selected file and stays out of compression'
reset_profile
run_product_case "pdf-print-output-stage1-smoke.html" "$OUT_DIR/pdf-print-output-stage1-smoke-dom.html" 'data-print-output-smoke="pass"' 'PASS: print-output branding applied without removing PDF editor controls'
reset_profile
run_product_case "pdf-security-storage-policy-smoke.html" "$OUT_DIR/pdf-security-storage-policy-smoke-dom.html" 'data-pdf-security-storage-smoke="pass"' 'PASS: PDF encrypt/decrypt uses Storage above 20MB with a 200MB file ceiling'
reset_profile
run_product_case "pdf-editor-workflow-v2-smoke.html" "$OUT_DIR/pdf-editor-workflow-v2-smoke-dom.html" 'data-workflow-v2-smoke="pass"' 'PASS: PDF editor page list collapses while the remaining recovery sidebar controls stay visible'
reset_profile
run_product_case "pdf-divider-modal-layout-smoke.html" "$OUT_DIR/pdf-divider-modal-layout-smoke-dom.html" 'data-divider-modal-smoke="pass"' 'PASS: divider modal survives delayed studio load, opens on click and keeps actions in the narrow left panel'
reset_profile
run_product_case "pdf-fast-insert-actions-smoke.html" "$OUT_DIR/pdf-fast-insert-actions-smoke-dom.html" 'data-pdf-fast-insert-smoke="pass"' 'PASS: large PDF optimized preview keeps blank-page and divider insertion actions'
reset_profile
run_product_case "pdf-preview-insert-persistence-smoke.html" "$OUT_DIR/pdf-preview-insert-persistence-smoke-dom.html" 'data-pdf-preview-insert-persistence-smoke="pass"' 'PASS: multi-file preview rerenders keep blank-page and divider insertion controls at every row boundary'
reset_profile
run_product_case "pdf-output-save-actions-smoke.html" "$OUT_DIR/pdf-output-save-actions-smoke-dom.html" 'data-pdf-output-save-smoke="pass"' 'PASS: direct PDF save and print preflight save remain actionable after preview state recovery'
reset_profile
run_product_case "pdf-page-list-quick-add-smoke.html" "$OUT_DIR/pdf-page-list-quick-add-smoke-dom.html" 'data-pdf-page-list-quick-add-smoke="pass"' 'PASS: page list keeps sticky PDF append action and removes legacy jump panel from view'

bash "$ROOT_DIR/scripts/run_pdf_print_workflow_focus_smoke.sh"
echo "PDF program unified shell, utility quick actions, output-panel tool docking, background margin removal, storage security, page-list collapse, divider-modal, persistent insert, output-save, fast-insert, page-list quick-add and product-focus browser smokes passed using $BROWSER"
