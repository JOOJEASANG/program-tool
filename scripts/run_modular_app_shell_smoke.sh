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
with urllib.request.urlopen(f"http://127.0.0.1:{sys.argv[1]}/tests/browser/modular-app-shell-smoke.html?app=cover", timeout=1) as response:
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
for app in cover poster flyer invitation notice leaflet pdf-layout booklet; do
  out="$OUT_DIR/modular-app-${app}-smoke-dom.html"
  url="http://127.0.0.1:$PORT/tests/browser/modular-app-shell-smoke.html?app=$app"
  run_browser_case "$url" "$out" 'data-modular-shell-smoke="pass"'
  grep -q "data-modular-shell-app=\"$app\"" "$out" || { cat "$out" >&2; exit 1; }
  grep -q "data-modular-shell-theme=\"$app\"" "$out" || { cat "$out" >&2; exit 1; }
  grep -q 'data-modular-shell-access-race="pass"' "$out" || { cat "$out" >&2; exit 1; }
  if [[ "$app" == "pdf-layout" || "$app" == "booklet" ]]; then expected_quick=0; else expected_quick=4; fi
  grep -q "data-modular-shell-quick=\"$expected_quick\"" "$out" || { cat "$out" >&2; exit 1; }
done

profile_out="$OUT_DIR/standalone-product-profile-smoke-dom.html"
profile_url="http://127.0.0.1:$PORT/tests/browser/standalone-product-profile-smoke.html"
run_browser_case "$profile_url" "$profile_out" 'data-standalone-profile-smoke="pass"'
grep -q 'data-notice-runtime="invitation"' "$profile_out" || { cat "$profile_out" >&2; exit 1; }
grep -q 'data-leaflet-fold="true"' "$profile_out" || { cat "$profile_out" >&2; exit 1; }
grep -q 'data-booklet-default="true"' "$profile_out" || { cat "$profile_out" >&2; exit 1; }

for app in cover poster flyer invitation notice leaflet; do
  out="$OUT_DIR/standalone-design-${app}-boundary-smoke-dom.html"
  url="http://127.0.0.1:$PORT/tests/browser/standalone-boundary-ui-smoke.html?kind=design&app=$app"
  run_browser_case "$url" "$out" 'data-standalone-boundary-smoke="pass"'
  grep -q "data-boundary-app=\"$app\"" "$out" || { cat "$out" >&2; exit 1; }
done

for app in layout booklet; do
  out="$OUT_DIR/standalone-pdf-${app}-boundary-smoke-dom.html"
  url="http://127.0.0.1:$PORT/tests/browser/standalone-boundary-ui-smoke.html?kind=pdf&app=$app"
  run_browser_case "$url" "$out" 'data-standalone-boundary-smoke="pass"'
  grep -q "data-boundary-app=\"$app\"" "$out" || { cat "$out" >&2; exit 1; }
done

workspace_nav_out="$OUT_DIR/design-workspace-navigation-smoke-dom.html"
workspace_nav_url="http://127.0.0.1:$PORT/tests/browser/design-workspace-navigation-smoke.html"
run_browser_case "$workspace_nav_url" "$workspace_nav_out" 'data-workspace-nav-smoke="pass"'
grep -q 'data-workspace-nav-steps="4"' "$workspace_nav_out" || { cat "$workspace_nav_out" >&2; exit 1; }
grep -q 'data-workspace-nav-product="cover"' "$workspace_nav_out" || { cat "$workspace_nav_out" >&2; exit 1; }

for app in cover poster flyer invitation notice leaflet; do
  sidebar_out="$OUT_DIR/design-product-sidebar-${app}-smoke-dom.html"
  sidebar_url="http://127.0.0.1:$PORT/tests/browser/design-product-sidebar-order-smoke.html?app=$app"
  run_browser_case "$sidebar_url" "$sidebar_out" 'data-product-sidebar-order-smoke="pass"'
  grep -q "data-product-sidebar-order-app=\"$app\"" "$sidebar_out" || { cat "$sidebar_out" >&2; exit 1; }
  grep -q 'data-product-sidebar-order-sections="5"' "$sidebar_out" || { cat "$sidebar_out" >&2; exit 1; }
  grep -q 'data-product-sidebar-section-collapse="pass"' "$sidebar_out" || { cat "$sidebar_out" >&2; exit 1; }
  grep -q 'data-product-sidebar-workspace-open="pass"' "$sidebar_out" || { cat "$sidebar_out" >&2; exit 1; }
  grep -q 'data-product-sidebar-card-hierarchy="pass"' "$sidebar_out" || { cat "$sidebar_out" >&2; exit 1; }
done

for mode in integrated standalone; do
  professional_out="$OUT_DIR/design-professional-ui-${mode}-smoke-dom.html"
  if [[ "$mode" == "standalone" ]]; then
    professional_url="http://127.0.0.1:$PORT/tests/browser/design-professional-ui-boundary-smoke.html?embed=1&app=cover&case=standalone"
    expected_owner="workspace-navigation"
  else
    professional_url="http://127.0.0.1:$PORT/tests/browser/design-professional-ui-boundary-smoke.html?embed=1&case=integrated"
    expected_owner="professional-ui"
  fi
  run_browser_case "$professional_url" "$professional_out" 'data-professional-boundary-smoke="pass"'
  grep -q "data-professional-boundary-case=\"$mode\"" "$professional_out" || { cat "$professional_out" >&2; exit 1; }
  grep -q "data-professional-boundary-owner=\"$expected_owner\"" "$professional_out" || { cat "$professional_out" >&2; exit 1; }
  grep -q 'data-professional-boundary-shared="loaded"' "$professional_out" || { cat "$professional_out" >&2; exit 1; }
done

multi_selection_out="$OUT_DIR/design-multi-selection-shared-smoke-dom.html"
multi_selection_url="http://127.0.0.1:$PORT/tests/browser/design-multi-selection-shared-smoke.html"
run_browser_case "$multi_selection_url" "$multi_selection_out" 'data-multi-selection-shared-smoke="pass"'
grep -q 'data-multi-selection-shared-count="2"' "$multi_selection_out" || { cat "$multi_selection_out" >&2; exit 1; }
grep -q 'data-multi-selection-shared-ownership="pass"' "$multi_selection_out" || { cat "$multi_selection_out" >&2; exit 1; }

smart_guides_out="$OUT_DIR/design-smart-guides-shared-smoke-dom.html"
smart_guides_url="http://127.0.0.1:$PORT/tests/browser/design-editor-multi-smart-guides-smoke.html"
run_browser_case "$smart_guides_url" "$smart_guides_out" 'data-design-multi-smart-status="pass"'
grep -q 'data-design-multi-smart-ownership="contextbar"' "$smart_guides_out" || { cat "$smart_guides_out" >&2; exit 1; }
grep -q 'data-design-multi-smart-gap="horizontal-6-vertical-4"' "$smart_guides_out" || { cat "$smart_guides_out" >&2; exit 1; }
grep -q 'data-design-multi-smart-snap="artboard-center"' "$smart_guides_out" || { cat "$smart_guides_out" >&2; exit 1; }

echo "Modular app browser smoke passed for 8 routes, access-promise replacement recovery, product-themed workspace headers/shortcuts, design/PDF profiles, boundary UI, shared workspace navigation, product-specific sidebar order/card hierarchy, professional UI ownership, multi-selection ownership and smart guides using $BROWSER"