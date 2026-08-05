import subprocess
from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]
EDITOR = ROOT / "perfect-binding-cover" / "index.html"
REGISTER = ROOT / "js" / "sw-register.js"
SAFETY = ROOT / "js" / "cover-runtime-safety.js"
BEHAVIOR = ROOT / "backend" / "tests" / "test_cover_runtime_safety_behavior_stage1.cjs"

DIRECT_MODULES = [
    "common-context-menu.js",
    "editor-enhancements.js",
    "cover-template-manager.js",
    "cmyk-color-control.js",
    "cover-editor-ux-upgrade.js",
    "cover-editor-multiselect.js",
    "cover-editor-layer-style.js",
    "cover-editor-preflight-project.js",
    "cover-editor-image-tools.js",
]

ROUTE_MODULES = [
    "perfect-binding-cover-fine-controls.js",
    "cover-editor-text-zones-v2.js",
    "cover-text-ui-refine.js",
    "cover-preview-workspace.js",
    "cover-project-state-bridge.js",
    "cover-floating-action-dock.js",
    "cover-runtime-safety.js",
]


def test_cover_direct_runtime_order_is_explicit():
    source = EDITOR.read_text(encoding="utf-8")
    positions = []
    for module in DIRECT_MODULES:
        needle = f'../js/{module}'
        assert source.count(needle) == 1
        positions.append(source.index(needle))
    assert positions == sorted(positions)


def test_cover_route_runtime_order_is_explicit_and_safety_is_last():
    source = REGISTER.read_text(encoding="utf-8")
    positions = []
    for module in ROUTE_MODULES:
        needle = f"/js/{module}"
        assert source.count(needle) == 1
        positions.append(source.index(needle))
    assert positions == sorted(positions)
    assert positions[-1] == source.index("/js/cover-runtime-safety.js")
    assert source.count("coverRuntimeSafetyScriptV1") == 1


def test_cover_safety_blocks_invalid_output_and_restores_render_state():
    source = SAFETY.read_text(encoding="utf-8")
    for marker in (
        "function snapshotLegacyText()",
        "function restoreLegacyText(values)",
        "try {",
        "finally {",
        "restoreLegacyText(legacyValues)",
        "hasBlockingPreflightError()",
        "event.preventDefault()",
        "event.stopImmediatePropagation()",
        "button.addEventListener('click', blockUnsafeOutput, { capture: true })",
    ):
        assert marker in source


def test_cover_safe_filename_uses_current_visible_front_text():
    source = SAFETY.read_text(encoding="utf-8")
    assert "CoverProjectStateBridge?.primaryText?.('front')" in source
    assert "window.safeName = safeFileStem" in source
    assert "책표지_작업" in source


def test_cover_safety_installation_is_bounded():
    source = SAFETY.read_text(encoding="utf-8")
    assert "INSTALL_DELAYS = [0, 180, 420, 800, 1250, 1900, 2800]" in source
    assert "for (const delay of INSTALL_DELAYS) setTimeout(install, delay)" in source
    assert "setInterval(" not in source
    assert "eval(" not in source
    assert "stage: 'runtime-audit-preflight-render-filename'" in source


def test_cover_runtime_safety_behavior_executes():
    result = subprocess.run(
        ["node", str(BEHAVIOR)],
        cwd=ROOT,
        text=True,
        capture_output=True,
        check=False,
    )
    assert result.returncode == 0, result.stderr or result.stdout
    assert "cover-runtime-safety behavior passed" in result.stdout


def test_cover_audit_records_remaining_runtime_debt():
    direct = EDITOR.read_text(encoding="utf-8")
    cmyk = (ROOT / "js" / "cmyk-color-control.js").read_text(encoding="utf-8")
    refine = (ROOT / "js" / "cover-text-ui-refine.js").read_text(encoding="utf-8")
    templates = (ROOT / "js" / "cover-template-manager.js").read_text(encoding="utf-8")
    image_tools = (ROOT / "js" / "cover-editor-image-tools.js").read_text(encoding="utf-8")

    assert "cover-editor-multiselect.js" in direct
    assert "cover-editor-layer-style.js" in direct
    assert "visual-color-palette" in cmyk
    assert "cover-color-palette" in refine
    assert "snapshotCurrent()" in templates
    assert "window.coverImageEffects" in image_tools
