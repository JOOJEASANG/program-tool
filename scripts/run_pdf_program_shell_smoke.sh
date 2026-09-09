#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PORT="${PDF_PROGRAM_SHELL_SMOKE_PORT:-4196}"
OUT_DIR="${PDF_PROGRAM_SHELL_SMOKE_OUT:-$ROOT_DIR/browser-smoke-artifacts}"
SERVER_LOG="$OUT_DIR/pdf-program-shell-smoke-server.log"
PROFILE_DIR="$(mktemp -d)"
BROWSER_TIMEOUT_SECONDS="${PDF_PROGRAM_SHELL_BROWSER_TIMEOUT:-30}"
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

browser_dump_once(){
  local url="$1" out="$2" virtual_budget="$3"
  timeout --signal=TERM --kill-after=3s "${BROWSER_TIMEOUT_SECONDS}s" \
    "$BROWSER" \
    --headless=new \
    --disable-gpu \
    --no-sandbox \
    --disable-dev-shm-usage \
    --disable-background-networking \
    --disable-component-update \
    --disable-default-apps \
    --disable-sync \
    --no-first-run \
    --user-data-dir="$PROFILE_DIR" \
    --virtual-time-budget="$virtual_budget" \
    --dump-dom "$url" >"$out"
}

browser_dump(){
  local page="$1" url="$2" out="$3" virtual_budget="$4" rc=0
  echo "PDF browser smoke: $page"
  if browser_dump_once "$url" "$out" "$virtual_budget"; then
    return 0
  else
    rc=$?
  fi
  echo "WARN: Chrome did not finish $page (exit=$rc); retrying once with a fresh profile." >&2
  reset_profile
  if browser_dump_once "$url" "$out" "$virtual_budget"; then
    return 0
  else
    rc=$?
  fi
  echo "ERROR: Chrome could not finish $page after retry (exit=$rc)." >&2
  return "$rc"
}

run_case(){
  local page="$1" out="$2" marker="$3"
  local url="http://127.0.0.1:$PORT/tests/browser/$page"
  wait_for_url "$url"
  browser_dump "$page" "$url" "$out" 10000
  grep -q 'data-shell-smoke="pass"' "$out" || { cat "$out" >&2; exit 1; }
  grep -q 'data-shell-header-removed="true"' "$out" || { cat "$out" >&2; exit 1; }
  grep -q 'data-shell-actions-preserved="true"' "$out" || { cat "$out" >&2; exit 1; }
  grep -q "$marker" "$out" || { cat "$out" >&2; exit 1; }
}

run_product_case(){
  local page="$1" out="$2" attr="$3" marker="$4"
  local url="http://127.0.0.1:$PORT/tests/browser/$page"
  wait_for_url "$url"
  browser_dump "$page" "$url" "$out" 12000
  grep -q "$attr" "$out" || { cat "$out" >&2; exit 1; }
  grep -q "$marker" "$out" || { cat "$out" >&2; exit 1; }
}

run_case "pdf-editor-shell-smoke.html" "$OUT_DIR/pdf-editor-shell-smoke-dom.html" 'PASS: PDF sidebar remains visible after delayed common/runtime initialization'
reset_profile
run_case "pdf-utility-shell-smoke.html" "$OUT_DIR/pdf-utility-shell-smoke-dom.html" 'PASS: PDF utility fixed header removed and account actions preserved in content'
reset_profile
run_product_case "pdf-utility-direct-tools-smoke.html" "$OUT_DIR/pdf-utility-direct-tools-smoke-dom.html" 'data-pdf-utility-direct-tools-smoke="pass"' 'PASS: PDF Utility menu opens exact workflows directly without a legacy intermediate page'
reset_profile
run_product_case "pdf-utility-quick-actions-smoke.html" "$OUT_DIR/pdf-utility-quick-actions-smoke-dom.html" 'data-pdf-quick-actions-smoke="pass"' 'PASS: PDF utility quick actions preserve canonical branding and run extract/blank-page tools'
reset_profile
run_product_case "pdf-utility-menu-audit-smoke.html" "$OUT_DIR/pdf-utility-menu-audit-smoke-dom.html" 'data-pdf-utility-menu-audit-smoke="pass"' 'PASS: all PDF utility menus mount stable right-stage workspaces without scroll lock'
reset_profile
run_product_case "pdf-utility-curated-core-smoke.html" "$OUT_DIR/pdf-utility-curated-core-smoke-dom.html" 'data-pdf-utility-curated-core-smoke="pass"' 'PASS: curated PDF Utility keeps 18 essential workflows, restores PDF file inspection, and renders solid upload cards'
reset_profile
run_product_case "pdf-preflight-output-tool-dock-smoke.html" "$OUT_DIR/pdf-preflight-output-tool-dock-smoke-dom.html" 'data-pdf-output-tool-dock-smoke="pass"' 'PASS: PDF tool dialogs render inside the right progress/result panel'
reset_profile
run_product_case "pdf-utility-background-margin-smoke.html" "$OUT_DIR/pdf-utility-background-margin-smoke-dom.html" 'data-pdf-background-margin-smoke="pass"' 'PASS: background cleanup margin removal follows PDF Utility selected file and stays out of compression'
reset_profile
run_product_case "pdf-print-output-stage1-smoke.html" "$OUT_DIR/pdf-print-output-stage1-smoke-dom.html" 'data-print-output-smoke="pass"' 'PASS: print-output branding applied without removing PDF editor controls'
reset_profile
run_product_case "pdf-security-storage-policy-smoke.html" "$OUT_DIR/pdf-security-storage-smoke-dom.html" 'data-pdf-security-storage-smoke="pass"' 'PASS: PDF encrypt/decrypt uses Storage above 20MB with a 200MB file ceiling'
reset_profile
run_product_case "pdf-editor-workflow-v2-smoke.html" "$OUT_DIR/pdf-editor-workflow-v2-smoke-dom.html" 'data-workflow-v2-smoke="pass"' 'PASS: PDF editor page list collapses while the remaining recovery sidebar controls stay visible'
reset_profile
run_product_case "pdf-divider-modal-layout-smoke.html" "$OUT_DIR/pdf-divider-modal-layout-smoke-dom.html" 'data-divider-modal-smoke="pass"' 'PASS: divider modal survives delayed studio load, opens on click and keeps actions in the narrow left panel'
reset_profile
run_product_case "pdf-fast-insert-actions-smoke.html" "$OUT_DIR/pdf-fast-insert-smoke-dom.html" 'data-pdf-fast-insert-smoke="pass"' 'PASS: large PDF optimized preview keeps blank-page and divider insertion actions'
reset_profile
run_product_case "pdf-preview-insert-persistence-smoke.html" "$OUT_DIR/pdf-preview-insert-persistence-smoke-dom.html" 'data-pdf-preview-insert-persistence-smoke="pass"' 'PASS: multi-file preview rerenders keep blank-page and divider insertion controls at every row boundary'
reset_profile
run_product_case "pdf-nup-interaction-stability-smoke.html" "$OUT_DIR/pdf-nup-interaction-stability-smoke-dom.html" 'data-pdf-nup-stability-smoke="pass"' 'PASS: N-up mouse edit keeps scroll/output face fixed and preserves user-selected 200% preview zoom'
reset_profile
run_product_case "pdf-editor-interaction-polish-smoke.html" "$OUT_DIR/pdf-editor-interaction-polish-smoke-dom.html" 'data-pdf-editor-interaction-polish-smoke="pass"' 'PASS: asymmetric facing margins coexist with N-up edits, sidebar is number-only, and resize direction is stable'
reset_profile
run_product_case "pdf-page-transform-edit-smoke.html" "$OUT_DIR/pdf-page-transform-edit-smoke-dom.html" 'data-pdf-page-transform-smoke="pass"' 'PASS: crop -> exact rotation -> scale/move request pipeline is stable'
reset_profile
run_product_case "pdf-drag-crop-autofit-smoke.html" "$OUT_DIR/pdf-drag-crop-autofit-smoke-dom.html" 'data-pdf-drag-crop-autofit-smoke="pass"' 'PASS: drag crop uses cached lazy sources, reduced fallback hydration, and keeps pointer crop/autofit semantics'
reset_profile
run_product_case "pdf-precision-edit-tools-smoke.html" "$OUT_DIR/pdf-precision-edit-tools-smoke-dom.html" 'data-pdf-precision-edit-tools-smoke="pass"' 'PASS: live margins, focused Ctrl+Z history, crop panel sync, and free-angle rotation stay in sync'
reset_profile
run_product_case "pdf-orientation-scale-regression-smoke.html" "$OUT_DIR/pdf-orientation-scale-regression-smoke-dom.html" 'data-pdf-orientation-scale-regression-smoke="pass"' 'PASS: legacy rotation stays canonical and corner resize is outward-grow inward-shrink'
reset_profile
run_product_case "pdf-output-save-actions-smoke.html" "$OUT_DIR/pdf-output-save-smoke-dom.html" 'data-pdf-output-save-smoke="pass"' 'PASS: direct PDF save and print preflight save remain actionable after preview state recovery'
reset_profile
run_product_case "pdf-page-list-quick-add-smoke.html" "$OUT_DIR/pdf-page-list-quick-add-smoke-dom.html" 'data-pdf-page-list-quick-add-smoke="pass"' 'PASS: page list keeps sticky PDF append action and removes legacy jump panel from view'
reset_profile
run_product_case "pdf-layout-sidebar-title-smoke.html" "$OUT_DIR/pdf-layout-sidebar-title-smoke-dom.html" 'data-pdf-layout-sidebar-title-smoke="pass"' 'PASS: layout PDF editor removes only the sidebar top title'
reset_profile
run_product_case "pdf-advanced-upload-facing-smoke.html" "$OUT_DIR/pdf-advanced-upload-facing-smoke-dom.html" 'data-pdf-advanced-upload-facing-smoke="pass"' 'PASS: advanced PDF upload parity and facing-page state are active'
reset_profile
run_product_case "pdf-advanced-sidebar-hard-isolation-smoke.html" "$OUT_DIR/pdf-advanced-sidebar-hard-isolation-smoke-dom.html" 'data-pdf-advanced-sidebar-hard-isolation-smoke="pass"' 'PASS: /pdf-editor-advanced stays advanced, hides spread/N-up/order controls and skips general print-layout modules'
reset_profile
run_product_case "pdf-editor-runtime-profile-split-smoke.html" "$OUT_DIR/pdf-editor-runtime-profile-split-smoke-dom.html" 'data-pdf-editor-runtime-profile-split-smoke="pass"' 'PASS: default PDF editor stays lightweight and legacy advanced query compatibility remains isolated; standalone /pdf-editor-advanced is covered separately'
reset_profile
run_product_case "pdf-advanced-workspace-stability-smoke.html" "$OUT_DIR/pdf-advanced-workspace-stability-smoke-dom.html" 'data-pdf-advanced-workspace-stability-smoke="pass"' 'PASS: advanced PDF workspace keeps one-page editing, headerless layout, X/Y move sliders, fixed status height, stable viewport and proxied quick actions'
reset_profile
run_product_case "pdf-advanced-shell-upload-stability-smoke.html" "$OUT_DIR/pdf-advanced-shell-upload-stability-smoke-dom.html" 'data-pdf-advanced-shell-upload-stability-smoke="pass"' 'PASS: advanced shell loads first, removes top gap, pins upload open, recovers file input and keeps sidebar actions visible'
reset_profile
run_product_case "pdf-advanced-overlays-interaction-smoke.html" "$OUT_DIR/pdf-advanced-overlays-interaction-smoke-dom.html" 'data-pdf-advanced-overlays-interaction-smoke="pass"' 'PASS: advanced PDF text overlays drag smoothly and PNG/JPG image insertion renders on the selected page'

bash "$ROOT_DIR/scripts/run_pdf_print_workflow_focus_smoke.sh"
echo "PDF program unified shell, lightweight/advanced runtime split, hard-isolated advanced sidebar, layout sidebar title cleanup, advanced upload/facing parity, headerless advanced layout, stable advanced upload/actions, advanced text/image interaction, X/Y move sliders, stable advanced editing workspace, direct utility workflows, utility quick actions, full utility menu audit, curated utility core, output-panel tool docking, background margin removal, storage security, page-list collapse, divider-modal, persistent insert, stable N-up direct edit, sticky preview zoom, asymmetric margin/N-up bridge, live margin guides, Ctrl+Z edit undo, free-angle corner rotation, number-only sidebar, stable resize direction, crop/rotation transform editing, drag keep-region crop/autofit, canonical legacy rotation, outward-grow/inward-shrink corner resize, output-save, fast-insert, page-list quick-add and product-focus browser smokes passed using $BROWSER"
