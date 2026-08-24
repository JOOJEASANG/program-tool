from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]
PAGE = ROOT / "image-editor" / "index.html"
APP = ROOT / "js" / "image-editor" / "app.js"
HOME = ROOT / "js" / "home-professional-suite.js"
SMOKE = ROOT / "tests" / "browser" / "image-editor-background-smoke.html"
CORE_SMOKE = ROOT / "tests" / "browser" / "image-editor-smoke.html"
RUNNER = ROOT / "scripts" / "run_image_editor_background_smoke.sh"
QUALITY = ROOT / ".github" / "workflows" / "quality-gate.yml"


def test_stage2_background_removal_ui_is_explicitly_single_color_and_transparency_aware():
    source = PAGE.read_text(encoding="utf-8")
    for marker in (
        "흰색 · 단색 배경 제거",
        'id="backgroundColor"',
        'id="sampleBackgroundBtn"',
        'id="backgroundTolerance"',
        'id="backgroundFeather"',
        'id="removeBackgroundBtn"',
        'id="exportNote"',
        "PNG 또는 WebP로 저장하면 투명 배경을 유지",
    ):
        assert marker in source
    assert "AI 배경 제거" not in source


def test_stage2_background_removal_is_local_non_networked_and_undoable():
    source = APP.read_text(encoding="utf-8")
    for marker in (
        "function sampleBackgroundFromCorners(options={})",
        "function syncBackgroundColorFromCorners()",
        "function removeBackground(options={})",
        "pushHistory('배경 제거')",
        "ctx.getImageData(0,0,state.base.width,state.base.height)",
        "ctx.putImageData(image,0,0)",
        "distance=Math.sqrt((dr*dr+dg*dg+db*db)/3)",
        "data[i+3]=0",
        "stage:'image-editor-core-stage2-background'",
    ):
        assert marker in source
    assert "fetch(" not in source
    assert "XMLHttpRequest" not in source


def test_stage2_transparent_exports_keep_png_webp_and_flatten_jpeg_to_white():
    source = APP.read_text(encoding="utf-8")
    assert "if(mime==='image/jpeg'){ctx.fillStyle='#fff';ctx.fillRect(0,0,out.width,out.height)}" in source
    assert "JPEG는 투명도를 지원하지 않아 투명 영역을 흰색으로 저장합니다." in source
    assert "PNG는 투명 배경을 그대로 저장합니다." in source
    assert "WebP는 투명 배경을 유지하면서 파일 크기를 줄일 수 있습니다." in source


def test_stage2_home_can_truthfully_advertise_background_removal():
    source = HOME.read_text(encoding="utf-8")
    start = source.index("id:'image-editor'")
    block = source[start:source.index("  ];", start)]
    assert "배경 제거" in block
    assert "status:'active'" in block
    assert "url:'image-editor/'" in block


def test_stage2_real_browser_verifies_transparency_jpeg_flatten_and_undo():
    smoke = SMOKE.read_text(encoding="utf-8")
    core_smoke = CORE_SMOKE.read_text(encoding="utf-8")
    runner = RUNNER.read_text(encoding="utf-8")
    quality = QUALITY.read_text(encoding="utf-8")
    for marker in (
        "api.sampleBackgroundFromCorners()",
        "api.removeBackground({color:sampled.hex,tolerance:12,feather:8})",
        "corner[3]===0",
        "center[3]===255",
        "jpegCorner[3]===255",
        "api.undo()===true",
        "JPEG transparency guidance is missing",
    ):
        assert marker in smoke
    assert "api.exportBlob('image/png',.92)" not in smoke
    assert "api.exportBlob('image/png',.92)" in core_smoke
    assert "PNG export failed" in core_smoke
    assert '<link rel="icon" href="data:,">' in smoke
    assert 'PROFILE_DIR="$(mktemp -d)"' in runner
    assert 'data-background-stage="image-editor-core-stage2-background"' in runner
    assert "bash scripts/run_image_editor_background_smoke.sh" in quality
