import subprocess
from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]
MODULE = ROOT / "js" / "cover-text-canvas-controls.js"
REGISTER = ROOT / "js" / "sw-register.js"
BEHAVIOR = ROOT / "backend" / "tests" / "test_cover_text_canvas_controls_behavior.cjs"


def test_cover_text_canvas_controls_load_before_final_render_owner():
    source = REGISTER.read_text(encoding="utf-8")
    runtime_safety = source.index("coverRuntimeSafetyScriptV1")
    canvas_controls = source.index("coverTextCanvasControlsScriptV1")
    final_owner = source.index("coverRenderPipelineContractScriptV1")
    assert runtime_safety < canvas_controls < final_owner
    assert source.count("/js/cover-text-canvas-controls.js") == 1


def test_cover_text_canvas_controls_offer_direct_preview_tools():
    source = MODULE.read_text(encoding="utf-8")
    for marker in (
        "data-cover-text-handle",
        "data-text-scale=\"-5\"",
        "data-text-scale=\"5\"",
        "data-align-axis=\"x\"",
        "data-align-axis=\"y\"",
        "coverTextSnapToggle",
        "자석 ON",
        "document.addEventListener('pointerdown', handlePointerDown, true)",
        "document.addEventListener('pointermove', handlePointerMove, true)",
        "document.addEventListener('keydown', handleKeydown, true)",
    ):
        assert marker in source


def test_cover_text_canvas_controls_snap_to_guides_and_other_text():
    source = MODULE.read_text(encoding="utf-8")
    for marker in (
        "function snapAxis(anchor, features, targets, threshold)",
        "function otherBoxTargets(entry, axis)",
        "다른 글자 왼쪽",
        "다른 글자 중앙",
        "다른 글자 오른쪽",
        "안전 여백 왼쪽",
        "표지 가로 중앙",
        "안전 여백 오른쪽",
        "안전 여백 위",
        "표지 세로 중앙",
        "안전 여백 아래",
        "const snapped = snapLayout(entry, proposed, drag.geo)",
        "guideState = snapped.guides",
    ):
        assert marker in source


def test_cover_text_canvas_controls_keep_print_and_project_data_paths():
    source = MODULE.read_text(encoding="utf-8")
    for marker in (
        "textApi()?.save?.()",
        "state.layout[entry.id]",
        "state.hitBoxes[entry.id]",
        "const result = withoutSpineEntries(() => Reflect.apply(original, this, arguments))",
        "finally { for (const zone of ZONES) data[zone] = saved[zone] || []; }",
        "drawSpineEntries(canvas, dpi)",
        "window.renderCover = wrapped",
        "window.CoverRenderPipeline?.installed",
        "stage: 'direct-text-move-resize-align-magnetic-snap'",
    ):
        assert marker in source
    assert "setInterval(" not in source
    assert "eval(" not in source
    assert "innerHTML +=" not in source


def test_cover_text_canvas_controls_respect_layout_lock():
    source = MODULE.read_text(encoding="utf-8")
    assert "window.CoverLayoutLock?.locked" in source
    assert "dataset?.coverLayoutLocked === '1'" in source
    assert "if (isLocked() || event.button !== 0" in source
    assert "html[data-cover-layout-locked=\"1\"] .cover-text-selection-box" in source


def test_cover_text_canvas_controls_behavior_executes():
    result = subprocess.run(
        ["node", str(BEHAVIOR)],
        cwd=ROOT,
        text=True,
        capture_output=True,
        check=False,
    )
    assert result.returncode == 0, result.stderr or result.stdout
    assert "cover-text-canvas-controls behavior passed" in result.stdout
