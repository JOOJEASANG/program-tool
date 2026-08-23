#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PORT="${DESIGN_EDITOR_COVER_PROJECT_SMOKE_PORT:-4177}"
OUT_DIR="${DESIGN_EDITOR_BROWSER_SMOKE_OUT:-$ROOT_DIR/browser-smoke-artifacts}"
DOM_OUT="$OUT_DIR/design-editor-cover-project-smoke-dom.html"
SERVER_LOG="$OUT_DIR/design-editor-cover-project-smoke-server.log"
PROFILE_DIR="$(mktemp -d)"
mkdir -p "$OUT_DIR"

find_browser(){ for candidate in google-chrome google-chrome-stable chromium chromium-browser; do if command -v "$candidate" >/dev/null 2>&1; then command -v "$candidate"; return 0; fi; done; return 1; }
BROWSER="$(find_browser || true)"
if [[ -z "$BROWSER" ]]; then echo "Headless Chrome/Chromium executable not found for cover project smoke." >&2; rm -rf "$PROFILE_DIR"; exit 1; fi

python3 -m http.server "$PORT" --bind 127.0.0.1 --directory "$ROOT_DIR" >"$SERVER_LOG" 2>&1 &
SERVER_PID=$!
cleanup(){ kill "$SERVER_PID" >/dev/null 2>&1 || true; wait "$SERVER_PID" >/dev/null 2>&1 || true; rm -rf "$PROFILE_DIR"; }
trap cleanup EXIT
URL="http://127.0.0.1:$PORT/tests/browser/design-editor-cover-project-smoke.html"
for _ in $(seq 1 50); do
  if python3 - "$URL" <<'PY' >/dev/null 2>&1
import sys, urllib.request
with urllib.request.urlopen(sys.argv[1], timeout=1) as response:
    raise SystemExit(0 if response.status == 200 else 1)
PY
  then break; fi
  sleep 0.1
done

"$BROWSER" --headless=new --disable-gpu --no-sandbox --disable-dev-shm-usage --disable-background-networking --user-data-dir="$PROFILE_DIR" --virtual-time-budget=30000 --dump-dom "$URL" >"$DOM_OUT"

if ! grep -q 'data-cover-project-smoke-status="pass"' "$DOM_OUT"; then echo "Design editor cover project browser smoke failed." >&2; cat "$DOM_OUT" >&2; echo "----- HTTP server log -----" >&2; cat "$SERVER_LOG" >&2; exit 1; fi
if ! grep -q 'PASS: cover project file roundtrip preserves binding, common content and spine semantics' "$DOM_OUT"; then echo "Cover project roundtrip completion marker is missing." >&2; cat "$DOM_OUT" >&2; exit 1; fi
for marker in 'data-cover-project-runtime="32"' 'data-cover-project-width="430.5"' 'data-cover-project-spine="10.5"' 'data-cover-project-folds="210,220.5"' 'data-cover-project-direction="topToBottom"' 'data-cover-project-y="63"' 'data-cover-project-rejected="true"'; do
  if ! grep -q "$marker" "$DOM_OUT"; then echo "Cover project roundtrip marker missing: $marker" >&2; cat "$DOM_OUT" >&2; exit 1; fi
done

echo "Design editor cover project roundtrip browser smoke passed using $BROWSER"
