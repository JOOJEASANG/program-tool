import re
from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]
TOOLS = ROOT / "js" / "design-editor" / "cover-spine-tools.js"
REGISTER = ROOT / "js" / "sw-register.js"
HARNESS = ROOT / "tests" / "browser" / "design-editor-cover-smoke.html"
RUNNER = ROOT / "scripts" / "run_design_editor_cover_smoke.sh"
LEGACY_ORIENTATION = ROOT / "js" / "cover-spine-orientation-controls.js"
LEGACY_SAFETY = ROOT / "js" / "cover-spine-print-safety.js"


def manifest_entries(source: str):
    block = re.search(r"const DESIGN_EDITOR_RUNTIME_SCRIPTS=Object\.freeze\(\[(.*?)\]\);", source, re.S)
    assert block
    return re.findall(r"\['([^']+)','([^']+)'\]", block.group(1))


def test_stage74_spine_tools_preserve_three_directions_and_cover_zones():
    source = TOOLS.read_text(encoding="utf-8")
    for marker in (
        "const DIRECTIONS=['bottomToTop','vertical','topToBottom']",
        "const DIRECTION_ROTATION={bottomToTop:-90,vertical:0,topToBottom:90}",
        "const ZONES={top:18,center:50,bottom:82}",
        "data-spine-add=\"top\"",
        "data-spine-add=\"center\"",
        "data-spine-add=\"bottom\"",
        "data-spine-direction=\"bottomToTop\"",
        "data-spine-direction=\"vertical\"",
        "data-spine-direction=\"topToBottom\"",
        "coverRole='spine-title'",
        "text.style.writingMode='vertical-rl'",
        "text.style.textOrientation='upright'",
    ):
        assert marker in source


def test_stage74_spine_tools_keep_text_centered_on_spine_and_preserve_y_drag_only():
    source = TOOLS.read_text(encoding="utf-8")
    assert "function centerX()" in source
    assert "entry.x=centerX()-entry.w/2" in source
    assert "function captureDraggedPosition()" in source
    assert "entry.spineYPercent=clamp(center/trimH*100,3,97)" in source
    assert "persist('cover-spine-position')" in source
    assert "document.addEventListener('pointerup',()=>{if(selectedSpineEntry())captureDraggedPosition()" in source


def test_stage74_spine_print_safety_keeps_thresholds_and_blocks_errors():
    source = TOOLS.read_text(encoding="utf-8")
    for marker in (
        "spine<2.2",
        "ratio>.9",
        "compression<.65",
        "ratio>.72",
        "compression<.85",
        "size<6",
        "spine*.72/MM_PER_PT",
        "overlap>2",
        "function installOutputGuard()",
        "if(evaluation.errors)",
        "return false",
        "__coverSpineSafetyGuard",
        "stage:'unified-cover-spine-writing-and-print-safety'",
    ):
        assert marker in source


def test_stage74_runtime_manifest_keeps_spine_module_after_rotation_before_preview():
    source = REGISTER.read_text(encoding="utf-8")
    entries = manifest_entries(source)
    assert len(entries) == 32
    ids = [item[0] for item in entries]
    assert ids.index("designEditorRotationScriptV1") < ids.index("designEditorCoverSpineToolsScriptV1")
    assert ids.index("designEditorCoverSpineToolsScriptV1") < ids.index("designEditorCoverPreviewZonesScriptV1")
    assert ("designEditorCoverSpineToolsScriptV1", "/js/design-editor/cover-spine-tools.js?v=20260823-1") in entries


def test_stage74_real_browser_checks_three_directions_safety_fit_and_real_300dpi_spine_ink():
    source = HARNESS.read_text(encoding="utf-8")
    for marker in (
        "ids.size===32&&latest.size===32",
        "DesignEditorCoverSpineTools.addSpineTitle('center')",
        "spineTitle.spineDirection==='bottomToTop'&&spineTitle.rotation===-90",
        "DesignEditorCoverSpineTools.setDirection('topToBottom')",
        "spineTitle.rotation===90",
        "DesignEditorCoverSpineTools.setDirection('vertical')",
        "spineTitle.rotation===0",
        "DesignEditorCoverSpineTools.applyRecommendedSize()===1",
        "DesignEditorOutput.renderSurface(project,surface)",
        "assert(spineInk",
    ):
        assert marker in source


def test_stage74_runner_requires_runtime_direction_and_real_render_markers():
    source = RUNNER.read_text(encoding="utf-8")
    for marker in (
        'data-cover-runtime="32"',
        'data-cover-spine-titles="1"',
        'data-cover-spine-direction="bottomToTop"',
        'data-cover-spine-ink="true"',
        "PASS: unified cover preview zones, settings, spine direction, safety and real render",
    ):
        assert marker in source


def test_stage74_legacy_spine_modules_are_removed_after_integrated_parity():
    assert not LEGACY_ORIENTATION.exists()
    assert not LEGACY_SAFETY.exists()
    source = TOOLS.read_text(encoding="utf-8")
    assert "bottomToTop" in source and "vertical" in source and "topToBottom" in source
    assert "spine<2.2" in source
