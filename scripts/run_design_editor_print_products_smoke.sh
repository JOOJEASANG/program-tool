#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PORT="${DESIGN_EDITOR_PRINT_PRODUCTS_SMOKE_PORT:-4198}"
OUT_DIR="${DESIGN_EDITOR_BROWSER_SMOKE_OUT:-$ROOT_DIR/browser-smoke-artifacts}"
DOM_OUT="$OUT_DIR/design-editor-print-products-smoke-dom.html"
TOPBAR_DOM_OUT="$OUT_DIR/design-editor-product-topbar-smoke-dom.html"
CONTEXT_DOM_OUT="$OUT_DIR/design-editor-selection-contextbar-smoke-dom.html"
MULTI_DOM_OUT="$OUT_DIR/design-editor-multiselect-smoke-dom.html"
MULTI_SMART_DOM_OUT="$OUT_DIR/design-editor-multi-smart-guides-smoke-dom.html"
SIMPLE_RESULT_DOM_OUT="$OUT_DIR/design-editor-simple-result-smoke-dom.html"
SERVER_LOG="$OUT_DIR/design-editor-print-products-smoke-server.log"
PROFILE_DIR="$(mktemp -d)"
mkdir -p "$OUT_DIR"

find_browser(){ for candidate in google-chrome google-chrome-stable chromium chromium-browser; do if command -v "$candidate" >/dev/null 2>&1; then command -v "$candidate"; return 0; fi; done; return 1; }
BROWSER="$(find_browser || true)"
if [[ -z "$BROWSER" ]]; then echo "Headless Chrome/Chromium executable not found for print product smoke." >&2; rm -rf "$PROFILE_DIR"; exit 1; fi

python3 -m http.server "$PORT" --bind 127.0.0.1 --directory "$ROOT_DIR" >"$SERVER_LOG" 2>&1 &
SERVER_PID=$!
cleanup(){ kill "$SERVER_PID" >/dev/null 2>&1 || true; wait "$SERVER_PID" >/dev/null 2>&1 || true; rm -rf "$PROFILE_DIR"; }
trap cleanup EXIT
URL="http://127.0.0.1:$PORT/tests/browser/design-editor-print-products-smoke.html"
TOPBAR_URL="http://127.0.0.1:$PORT/tests/browser/design-editor-product-topbar-smoke.html"
CONTEXT_URL="http://127.0.0.1:$PORT/tests/browser/design-editor-selection-contextbar-smoke.html"
MULTI_URL="http://127.0.0.1:$PORT/tests/browser/design-editor-multiselect-smoke.html"
MULTI_SMART_URL="http://127.0.0.1:$PORT/tests/browser/design-editor-multi-smart-guides-smoke.html"
SIMPLE_RESULT_URL="http://127.0.0.1:$PORT/tests/browser/design-editor-simple-result-smoke.html"
for _ in $(seq 1 50); do
  if python3 - "$URL" <<'PY' >/dev/null 2>&1
import sys, urllib.request
with urllib.request.urlopen(sys.argv[1], timeout=1) as response:
    raise SystemExit(0 if response.status == 200 else 1)
PY
  then break; fi
  sleep 0.1
done

"$BROWSER" --headless=new --disable-gpu --no-sandbox --disable-dev-shm-usage --disable-background-networking --user-data-dir="$PROFILE_DIR" --virtual-time-budget=24000 --dump-dom "$URL" >"$DOM_OUT"

if ! grep -q 'data-print-products-status="pass"' "$DOM_OUT"; then echo "Design editor print products browser smoke failed." >&2; cat "$DOM_OUT" >&2; echo "----- HTTP server log -----" >&2; cat "$SERVER_LOG" >&2; exit 1; fi
for marker in 'data-print-products-menu="표지|포스터|전단|초대장·안내장|리플렛"' 'data-print-products-invitation="120mm-y-top"' 'data-print-products-leaflet8="4panels-3folds"' 'data-print-products-leaflet12="6panels-5folds-portrait"' 'data-print-products-restore="8p-gate"' 'data-print-products-runtime="ready"'; do
  if ! grep -q "$marker" "$DOM_OUT"; then echo "Print products marker missing: $marker" >&2; cat "$DOM_OUT" >&2; exit 1; fi
done
if ! grep -q 'PASS: 5개 인쇄물 메뉴, 비대칭 초대장 접지, 8P·12P 가변 리플렛 접지와 저장 복원이 확인됨' "$DOM_OUT"; then echo "Print products completion marker missing." >&2; cat "$DOM_OUT" >&2; exit 1; fi

"$BROWSER" --headless=new --disable-gpu --no-sandbox --disable-dev-shm-usage --disable-background-networking --user-data-dir="$PROFILE_DIR" --virtual-time-budget=16000 --dump-dom "$TOPBAR_URL" >"$TOPBAR_DOM_OUT"
if ! grep -q 'data-design-product-topbar-status="pass"' "$TOPBAR_DOM_OUT"; then echo "Design editor professional command bar browser smoke failed." >&2; cat "$TOPBAR_DOM_OUT" >&2; echo "----- HTTP server log -----" >&2; cat "$SERVER_LOG" >&2; exit 1; fi
for marker in 'data-design-product-topbar-fixed="sticky"' 'data-design-product-topbar-sidebar="details-only"' 'data-design-product-topbar-proxy="flyer"' 'data-design-product-topbar-sync="leaflet"' 'data-design-product-topbar-hierarchy="product-surface"' 'data-design-product-topbar-commands="undo-redo-insert-panel-fit-output"' 'data-design-product-topbar-context="edit"'; do
  if ! grep -q "$marker" "$TOPBAR_DOM_OUT"; then echo "Professional command bar marker missing: $marker" >&2; cat "$TOPBAR_DOM_OUT" >&2; exit 1; fi
done
if ! grep -q 'PASS: professional command bar: 종류·면 계층, 실행취소, 빠른 추가, 패널, 맞춤, 도움말, 출력, 선택 자동 편집이 확인됨' "$TOPBAR_DOM_OUT"; then echo "Professional command bar completion marker missing." >&2; cat "$TOPBAR_DOM_OUT" >&2; exit 1; fi

"$BROWSER" --headless=new --disable-gpu --no-sandbox --disable-dev-shm-usage --disable-background-networking --user-data-dir="$PROFILE_DIR" --virtual-time-budget=16000 --dump-dom "$CONTEXT_URL" >"$CONTEXT_DOM_OUT"
if ! grep -q 'data-design-contextbar-status="pass"' "$CONTEXT_DOM_OUT"; then echo "Design editor selection contextbar browser smoke failed." >&2; cat "$CONTEXT_DOM_OUT" >&2; echo "----- HTTP server log -----" >&2; cat "$SERVER_LOG" >&2; exit 1; fi
for marker in 'data-design-contextbar-text="font-size-weight-color-align"' 'data-design-contextbar-image="size-fit-focus-opacity"' 'data-design-contextbar-shape="fill-stroke-radius-opacity"' 'data-design-contextbar-proxy="existing-inspector-controls"' 'data-design-contextbar-floating="suppressed-when-context"'; do
  if ! grep -q "$marker" "$CONTEXT_DOM_OUT"; then echo "Selection contextbar marker missing: $marker" >&2; cat "$CONTEXT_DOM_OUT" >&2; exit 1; fi
done
if ! grep -q 'PASS: selection contextbar: 글씨·이미지·도형 속성이 기존 inspector와 layout API를 통해 동기화됨' "$CONTEXT_DOM_OUT"; then echo "Selection contextbar completion marker missing." >&2; cat "$CONTEXT_DOM_OUT" >&2; exit 1; fi

"$BROWSER" --headless=new --disable-gpu --no-sandbox --disable-dev-shm-usage --disable-background-networking --user-data-dir="$PROFILE_DIR" --virtual-time-budget=18000 --dump-dom "$MULTI_URL" >"$MULTI_DOM_OUT"
if ! grep -q 'data-design-multiselect-status="pass"' "$MULTI_DOM_OUT"; then echo "Design editor multi selection browser smoke failed." >&2; cat "$MULTI_DOM_OUT" >&2; echo "----- HTTP server log -----" >&2; cat "$SERVER_LOG" >&2; exit 1; fi
for marker in 'data-design-multiselect-selection="modifier-3"' 'data-design-multiselect-align="selection-bounds"' 'data-design-multiselect-distribute="horizontal-vertical"' 'data-design-multiselect-group="group-ungroup"' 'data-design-multiselect-drag="group-drag-and-nudge"' 'data-design-multiselect-bulk="lock-duplicate-delete"'; do
  if ! grep -q "$marker" "$MULTI_DOM_OUT"; then echo "Multi selection marker missing: $marker" >&2; cat "$MULTI_DOM_OUT" >&2; exit 1; fi
done
if ! grep -q 'PASS: multi selection: 선택·정렬·동일 간격·그룹·이동·잠금·복제·삭제가 확인됨' "$MULTI_DOM_OUT"; then echo "Multi selection completion marker missing." >&2; cat "$MULTI_DOM_OUT" >&2; exit 1; fi

"$BROWSER" --headless=new --disable-gpu --no-sandbox --disable-dev-shm-usage --disable-background-networking --user-data-dir="$PROFILE_DIR" --virtual-time-budget=18000 --dump-dom "$MULTI_SMART_URL" >"$MULTI_SMART_DOM_OUT"
if ! grep -q 'data-design-multi-smart-status="pass"' "$MULTI_SMART_DOM_OUT"; then echo "Design editor multi smart guides browser smoke failed." >&2; cat "$MULTI_SMART_DOM_OUT" >&2; echo "----- HTTP server log -----" >&2; cat "$SERVER_LOG" >&2; exit 1; fi
for marker in 'data-design-multi-smart-toggle="enabled"' 'data-design-multi-smart-gap="horizontal-6-vertical-4"' 'data-design-multi-smart-snap="artboard-center"' 'data-design-multi-smart-guide="visible"'; do
  if ! grep -q "$marker" "$MULTI_SMART_DOM_OUT"; then echo "Multi smart guide marker missing: $marker" >&2; cat "$MULTI_SMART_DOM_OUT" >&2; exit 1; fi
done
if ! grep -q 'PASS: multi smart guides: 자석 가이드·아트보드 중앙 스냅·가로/세로 정확한 mm 간격이 확인됨' "$MULTI_SMART_DOM_OUT"; then echo "Multi smart guides completion marker missing." >&2; cat "$MULTI_SMART_DOM_OUT" >&2; exit 1; fi

"$BROWSER" --headless=new --disable-gpu --no-sandbox --disable-dev-shm-usage --disable-background-networking --user-data-dir="$PROFILE_DIR" --virtual-time-budget=16000 --dump-dom "$SIMPLE_RESULT_URL" >"$SIMPLE_RESULT_DOM_OUT"
if ! grep -q 'data-design-simple-result-status="pass"' "$SIMPLE_RESULT_DOM_OUT"; then echo "Design editor simple result browser smoke failed." >&2; cat "$SIMPLE_RESULT_DOM_OUT" >&2; echo "----- HTTP server log -----" >&2; cat "$SERVER_LOG" >&2; exit 1; fi
for marker in 'data-design-simple-result-flow="background-logo-text-output"' 'data-design-simple-result-basic="advanced-hidden"' 'data-design-simple-result-background="bleed-cover-locked"' 'data-design-simple-result-logo="contain-safe"' 'data-design-simple-result-output="png-pdf"'; do
  if ! grep -q "$marker" "$SIMPLE_RESULT_DOM_OUT"; then echo "Simple result marker missing: $marker" >&2; cat "$SIMPLE_RESULT_DOM_OUT" >&2; exit 1; fi
done
if ! grep -q 'PASS: simple result workflow: 배경·로고·제목·본문·정보·PNG/PDF만 기본 노출하고 고급 편집은 접어 둠' "$SIMPLE_RESULT_DOM_OUT"; then echo "Simple result completion marker missing." >&2; cat "$SIMPLE_RESULT_DOM_OUT" >&2; exit 1; fi

echo "Design editor print products + command bar + contextbar + multi selection + smart guides + simple result workflow browser smokes passed using $BROWSER"