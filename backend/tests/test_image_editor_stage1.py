from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]
PAGE = ROOT / "image-editor" / "index.html"
APP = ROOT / "js" / "image-editor" / "app.js"
STYLE = ROOT / "css" / "image-editor.css"
HOME = ROOT / "js" / "home-professional-suite.js"
SMOKE = ROOT / "tests" / "browser" / "image-editor-smoke.html"
RUNNER = ROOT / "scripts" / "run_image_editor_browser_smoke.sh"
QUALITY = ROOT / ".github" / "workflows" / "quality-gate.yml"


def test_image_editor_stage1_has_real_workspace_and_core_tools():
    page = PAGE.read_text(encoding="utf-8")
    for marker in (
        "이미지 편집기",
        'id="fileInput"',
        'id="cropX"',
        'id="rotateLeftBtn"',
        'id="resizeW"',
        'id="brightness"',
        'id="exportFormat"',
        "/js/image-editor/app.js?v=20260823-2",
    ):
        assert marker in page
    assert STYLE.exists()


def test_image_editor_stage1_core_is_local_and_exportable():
    source = APP.read_text(encoding="utf-8")
    for marker in (
        "const MAX_PIXELS=60_000_000",
        "async function loadBlob",
        "const rotateLeft=()=>transform('rotate-left')",
        "const rotateRight=()=>transform('rotate-right')",
        "const flipHorizontal=()=>transform('flip-h')",
        "function applyCrop()",
        "function resize(width,height)",
        "function setAdjustments(next={})",
        "function renderOutput(mime='image/png')",
        "async function exportBlob",
        "async function resetOriginal()",
        "stage:'image-editor-core-stage2-background'",
    ):
        assert marker in source
    assert "fetch(" not in source
    assert "XMLHttpRequest" not in source


def test_image_editor_home_card_is_active_and_matches_available_core_features():
    source = HOME.read_text(encoding="utf-8")
    start = source.index("id:'image-editor'")
    image_block = source[start:source.index("  ];", start)]
    assert "url:'image-editor/'" in image_block
    assert "status:'active'" in image_block
    assert "자르기" in image_block and "리사이즈" in image_block and "기본 보정" in image_block
    assert "이미지 작업 도구" in image_block


def test_image_editor_stage1_has_real_chrome_smoke_in_quality_gate():
    smoke = SMOKE.read_text(encoding="utf-8")
    runner = RUNNER.read_text(encoding="utf-8")
    quality = QUALITY.read_text(encoding="utf-8")
    for marker in (
        "api.loadBlob(blob,'smoke-source.png')",
        "api.rotateRight()",
        "api.undo()===true",
        "api.flipHorizontal()",
        "api.setCrop({x:10,y:5,w:40,h:30})",
        "api.resize(20,15)",
        "api.setAdjustments({brightness:120,contrast:110,saturation:80})",
        "api.exportBlob('image/png',.92)",
        "api.resetOriginal()",
    ):
        assert marker in smoke
    assert 'PROFILE_DIR="$(mktemp -d)"' in runner
    assert '--user-data-dir="$PROFILE_DIR"' in runner
    assert "image-editor-browser-smoke:" in quality
    assert "bash scripts/run_image_editor_browser_smoke.sh" in quality
