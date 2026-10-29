from pathlib import Path
import subprocess

ROOT = Path(__file__).resolve().parents[2]


def read(path: str) -> str:
    return (ROOT / path).read_text(encoding="utf-8")


def test_all_utility_upload_widgets_keep_real_file_inputs_accessible():
    cases = [
        ("js/pdf-suite/direct-tool-bridge.js", ".pdfud-file input{position:absolute!important;"),
        ("js/pdf-suite/centered-workspace.js", ".pdfuc-tool-input{position:absolute!important;"),
        ("js/pdf-suite/ocr-tools.js", ".pdfocr-file input{position:absolute!important;"),
        ("js/pdf-large-output-tiling.js", ".plot-file input{position:absolute!important;"),
    ]
    for path, marker in cases:
        source = read(path)
        assert marker in source
        assert "clip-path:inset(50%)!important" in source
        assert "focus-within" in source
        assert marker.replace("position:absolute!important;", "display:none") not in source


def test_image_upload_shows_real_files_and_exports_webp():
    bridge = read("js/pdf-suite/direct-tool-bridge.js")
    assert "const files=Array.isArray(value)?value:value?[value]:[];" in bridge
    assert "valid.map(file=>file.name).join(', ')" in bridge
    assert "run.disabled=!valid.length" in bridge
    assert "selected(root,files);" in bridge
    assert "selected(root,files.length?files.map" not in bridge
    assert "image/jpeg,image/png,image/webp" in bridge
    assert "const isWebp=file.type==='image/webp'" in bridge
    assert "loaded.onload=()=>resolve(loaded);" in bridge
    assert "canvas.toDataURL('image/png')" in bridge
    assert "pdf.embedPng(canvas.toDataURL('image/png'))" in bridge
    assert "Math.max" not in bridge.split("function selected(root,value)")[1].split("function fileValid")[0]
    assert "const previousVisual=visualState;visualState=null;" in bridge
    assert "root.querySelector('.pdfud-run').disabled=true;const previousVisual" in bridge


def test_upload_handlers_and_large_downloads_use_fresh_assets():
    loader = read("scripts/prepare_hosting_dist.py")
    hook = read("js/pdf-suite/direct-tool-hook.js")
    runtime = read("js/pdf-preflight/route-runtime.js")
    assert "direct-tool-bridge.js?v=20261029-3" in loader
    assert "direct-tool-hook.js?v=20261029-1" in loader
    assert "ocr-tools.js?v=20261029-1" in loader
    assert "pdf-large-output-tiling.js?v=20261029-1" in loader
    assert "direct-tool-large-storage.js?v=20261029-1" in hook
    assert "centered-workspace.js?v=20261029-1" in hook
    assert "pdf-large-output-tiling.js?v=20261029-1" in runtime
    for path in ("js/pdf-suite/direct-tool-bridge.js",
                 "js/pdf-suite/direct-tool-large-storage.js",
                 "js/pdf-large-output-tiling.js"):
        assert "setTimeout(()=>URL.revokeObjectURL(url),60000)" in read(path)


def test_upload_workflows_have_browser_selection_and_webp_regressions():
    curated = read("tests/browser/pdf-utility-curated-core-smoke.html")
    for name in (
        "merge selected files not listed",
        "extract run disabled after file upload",
        "compression selection display missing",
        "image count missing",
        "image file replacement not reflected",
        "OCR selected file not displayed",
        "local rotation selection did not register",
    ):
        assert name in curated
    webp = read("tests/browser/pdf-utility-image-upload-smoke.html")
    assert "WebP upload produces real PNG bytes for PDF" in webp
    assert "embedPng:async(bytes)" in webp
    assert "image/webp" in webp
    assert "getComputedStyle(input).display==='none'" in webp
    shell = read("scripts/run_pdf_program_shell_smoke.sh")
    assert "pdf-utility-image-upload-smoke.html" in shell
    assert "pdf-utility-curated-core-smoke.html" in shell
    manual = read("js/program-manuals/pdf-suite.js")
    assert "updated: '2026-10-29'" in manual
    assert "WebP" in manual


def test_changed_pdf_utility_scripts_syntax():
    for filename in (
        "js/pdf-suite/direct-tool-bridge.js",
        "js/pdf-suite/centered-workspace.js",
        "js/pdf-suite/ocr-tools.js",
        "js/pdf-large-output-tiling.js",
        "js/pdf-suite/direct-tool-hook.js",
        "js/pdf-suite/direct-tool-large-storage.js",
    ):
        result = subprocess.run(
            ["node", "--check", str(ROOT / filename)],
            cwd=ROOT, capture_output=True, text=True, check=False
        )
        assert result.returncode == 0, filename + ": " + result.stderr

def test_visual_upload_discards_stale_async_results():
    bridge = read("js/pdf-suite/direct-tool-bridge.js")
    smoke = read("tests/browser/pdf-utility-direct-tools-smoke.html")
    assert "const loadId=++visualLoadId;" in bridge
    assert "if(loadId!==visualLoadId||!root.isConnected)" in bridge
    assert "function reset(){visualLoadId++;" in bridge
    assert "previous slow upload replaced latest visual PDF" in smoke
    assert "closed visual upload returned after tool switch" in smoke
