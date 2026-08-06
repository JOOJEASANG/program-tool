import subprocess
from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]
SAFETY = ROOT / "js" / "cover-spine-print-safety.js"
REGISTER = ROOT / "js" / "sw-register.js"
BEHAVIOR = ROOT / "backend" / "tests" / "test_cover_spine_print_safety_behavior.cjs"


def test_cover_spine_safety_loads_after_quality_before_final_confirm():
    source = REGISTER.read_text(encoding="utf-8")
    quality = source.index("/js/cover-image-print-quality.js")
    spine = source.index("/js/cover-spine-print-safety.js")
    confirm = source.index("/js/cover-final-output-confirm.js")
    assert quality < spine < confirm
    assert source.count("coverSpinePrintSafetyScriptV1") == 1


def test_cover_spine_safety_matches_multi_layer_renderer_contract():
    source = SAFETY.read_text(encoding="utf-8")
    for marker in (
        "const MAX_TEXT_WIDTH_RATIO = 0.28",
        "window.CoverTextZones?.data?.spine",
        "state.layout?.[entry.id]",
        "fontHeightMm = renderedPt * MM_PER_PT",
        "maxLengthMm = trimHeightMm * MAX_TEXT_WIDTH_RATIO",
        "compressionRatio",
        "spineMm < 2.2",
        "crossFillRatio > 0.9",
        "compressionRatio < 0.65",
        "overlapWarnings(layers, trimHeightMm)",
    ):
        assert marker in source


def test_cover_spine_safety_places_visible_panel_in_current_text_editor():
    source = SAFETY.read_text(encoding="utf-8")
    for marker in (
        "const root = byId('coverTextZones')",
        "const textPanel = byId('coverTextZonePanel')",
        "textPanel.insertBefore(panel, root)",
        "책등 인쇄 글자",
        "role', 'status'",
        "aria-live', 'polite'",
        "cover-spine-safety-layers",
        "문제 있는 ${result.adjustable.length}개 글자 크기 맞추기",
    ):
        assert marker in source


def test_cover_spine_safety_adjusts_only_unsafe_spine_layers():
    source = SAFETY.read_text(encoding="utf-8")
    for marker in (
        "const recommendations = new Map(result.adjustable.map",
        "for (const zone of ZONES)",
        "entry.size = recommended",
        "api.save?.()",
        "cover-text-side-tab[data-side=\"spine\"]",
        "window.requestRender?.()",
    ):
        assert marker in source
    assert "front" not in source[source.index("function applyRecommendedSizes"):source.index("function appendPreflightRow")]
    assert "back" not in source[source.index("function applyRecommendedSizes"):source.index("function appendPreflightRow")]


def test_cover_spine_safety_extends_preflight_and_blocks_unprintable_text():
    source = SAFETY.read_text(encoding="utf-8")
    for marker in (
        "title: '책등 글자 인쇄 오류'",
        "title: '책등 글자 확인 필요'",
        "title: '책등 글자 인쇄 적합'",
        "button.onclick.__coverSpinePrintSafetyV1",
        "const base = previous.apply(this, args)",
        "if (item) items.push(item)",
        "updatePreflightSummary(items)",
    ):
        assert marker in source
    assert "setInterval(" not in source
    assert "eval(" not in source


def test_cover_spine_safety_behavior_executes():
    result = subprocess.run(
        ["node", str(BEHAVIOR)],
        cwd=ROOT,
        text=True,
        capture_output=True,
        check=False,
    )
    assert result.returncode == 0, result.stderr or result.stdout
    assert "cover-spine-print-safety behavior passed" in result.stdout
