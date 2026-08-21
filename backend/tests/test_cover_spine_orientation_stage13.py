import subprocess
from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]
MODULE = ROOT / "js" / "cover-spine-orientation-controls.js"
REGISTER = ROOT / "js" / "sw-register.js"
BEHAVIOR = ROOT / "backend" / "tests" / "test_cover_spine_orientation_behavior.cjs"
PROJECT_BRIDGE = ROOT / "js" / "cover-project-state-bridge.js"


def test_cover_spine_orientation_loads_after_text_zones_before_print_safety():
    source = REGISTER.read_text(encoding="utf-8")
    text_zones = source.index("coverTextZonesScriptV3")
    orientation = source.index("coverSpineOrientationControlsScriptV1")
    print_safety = source.index("coverSpinePrintSafetyScriptV1")
    assert text_zones < orientation < print_safety
    assert source.count("/js/cover-spine-orientation-controls.js") == 1
    assert "/js/cover-spine-orientation-controls.js?v=20260821-2" in source


def test_cover_spine_orientation_supports_three_per_layer_modes():
    source = MODULE.read_text(encoding="utf-8")
    for marker in (
        "const DIRECTIONS = ['bottomToTop', 'vertical', 'topToBottom']",
        "entry.direction = normalizeDirection",
        "data-spine-direction=\"bottomToTop\"",
        "data-spine-direction=\"vertical\"",
        "data-spine-direction=\"topToBottom\"",
        "현재 방향을 모든 책등 글자에 적용",
        "ctx.rotate(direction === 'topToBottom' ? Math.PI / 2 : -Math.PI / 2)",
        "String(entry.text || '').replace(/\\s+/g, '')",
    ):
        assert marker in source


def test_cover_spine_orientation_preserves_existing_render_and_state_paths():
    source = MODULE.read_text(encoding="utf-8")
    for marker in (
        "const result = runWithoutNativeSpine(() => original.apply(this, arguments))",
        "api.data.spine[zone] = []",
        "api.data.spine[zone] = savedZones[zone] || []",
        "savedLegacy[id] = element.value",
        "element.value = ''",
        "textApi()?.save?.()",
        "state.layout?.[entry.id]",
        "state.hitBoxes[entry.id]",
        "window.renderCover = wrapped",
        "stage:'per-layer-spine-writing-direction'",
    ):
        assert marker in source
    assert "setInterval(" not in source
    assert "eval(" not in source
    assert "innerHTML +=" not in source
    assert "new MutationObserver" not in source


def test_cover_project_bridge_keeps_orientation_inside_text_zone_entries():
    source = PROJECT_BRIDGE.read_text(encoding="utf-8")
    assert "textZones: getTextZones()" in source
    assert "setTextZones(data.textZones)" in source
    assert "clone(api.data)" in source


def test_cover_spine_orientation_behavior_executes():
    result = subprocess.run(
        ["node", str(BEHAVIOR)],
        cwd=ROOT,
        text=True,
        capture_output=True,
        check=False,
    )
    assert result.returncode == 0, result.stderr or result.stdout
    assert "cover-spine-orientation behavior passed" in result.stdout
