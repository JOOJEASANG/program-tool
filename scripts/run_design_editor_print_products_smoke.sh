#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PORT="${DESIGN_EDITOR_PRINT_PRODUCTS_SMOKE_PORT:-4198}"
OUT_DIR="${DESIGN_EDITOR_BROWSER_SMOKE_OUT:-$ROOT_DIR/browser-smoke-artifacts}"
DOM_OUT="$OUT_DIR/design-editor-print-products-smoke-dom.html"
TOPBAR_DOM_OUT="$OUT_DIR/design-editor-product-topbar-smoke-dom.html"
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

"$BROWSER" --headless=new --disable-gpu --no-sandbox --disable-dev-shm-usage --disable-background-networking --user-data-dir="$PROFILE_DIR" --virtual-time-budget=12000 --dump-dom "$TOPBAR_URL" >"$TOPBAR_DOM_OUT"

if ! grep -q 'data-design-product-topbar-status="pass"' "$TOPBAR_DOM_OUT"; then echo "Design editor product topbar browser smoke failed." >&2; cat "$TOPBAR_DOM_OUT" >&2; echo "----- HTTP server log -----" >&2; cat "$SERVER_LOG" >&2; exit 1; fi
for marker in 'data-design-product-topbar-fixed="sticky"' 'data-design-product-topbar-sidebar="details-only"' 'data-design-product-topbar-proxy="flyer"' 'data-design-product-topbar-sync="leaflet"'; do
  if ! grep -q "$marker" "$TOPBAR_DOM_OUT"; then echo "Product topbar marker missing: $marker" >&2; cat "$TOPBAR_DOM_OUT" >&2; exit 1; fi
done
if ! grep -q 'PASS: 작업 종류 상단 고정, 사이드바 세부 설정 유지, 기존 메뉴 클릭 프록시와 활성 상태 동기화 확인' "$TOPBAR_DOM_OUT"; then echo "Product topbar completion marker missing." >&2; cat "$TOPBAR_DOM_OUT" >&2; exit 1; fi

echo "Design editor print products + fixed product topbar browser smokes passed using $BROWSER"
