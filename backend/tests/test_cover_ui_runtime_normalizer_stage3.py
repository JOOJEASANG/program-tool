import subprocess
from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]
MODULE = ROOT / "js" / "cover-ui-runtime-normalizer.js"
REGISTER = ROOT / "js" / "sw-register.js"
EDITOR = ROOT / "perfect-binding-cover" / "index.html"
CMYK = ROOT / "js" / "cmyk-color-control.js"
TEXT_REFINE = ROOT / "js" / "cover-text-ui-refine.js"
BEHAVIOR = ROOT / "backend" / "tests" / "test_cover_ui_runtime_normalizer_behavior_stage3.cjs"


def test_duplicate_palette_sources_are_normalized_to_one_owner_per_color_input():
    cmyk = CMYK.read_text(encoding="utf-8")
    refine = TEXT_REFINE.read_text(encoding="utf-8")
    source = MODULE.read_text(encoding="utf-8")
    assert "visual-color-palette" in cmyk
    assert "cover-color-palette" in refine
    for marker in (
        "PALETTE_CLASSES = ['visual-color-palette', 'cover-color-palette']",
        "const palettes = directPalettes(input)",
        "const keep = palettes.find((palette) => palette.classList.contains('visual-color-palette'))",
        "palette.remove()",
        "input.dataset.coverPaletteOwner",
    ):
        assert marker in source


def test_mobile_dock_releases_fixed_position_only_while_virtual_keyboard_is_open():
    source = MODULE.read_text(encoding="utf-8")
    for marker in (
        "cover-virtual-keyboard-open #coverSidebarActions",
        "cover-virtual-keyboard-open .cover-floating-dock",
        "position: static !important",
        "viewport.height < window.innerHeight * 0.78",
        "isEditable(document.activeElement)",
        "visualViewport?.addEventListener('resize'",
        "document.addEventListener('focusin'",
        "document.addEventListener('focusout'",
    ):
        assert marker in source


def test_cover_output_status_is_announced_accessibly():
    source = MODULE.read_text(encoding="utf-8")
    assert "status.setAttribute('role', 'status')" in source
    assert "status.setAttribute('aria-live', 'polite')" in source
    assert "status.setAttribute('aria-atomic', 'true')" in source


def test_ui_normalizer_loads_after_dock_and_before_final_safety_boundary():
    source = REGISTER.read_text(encoding="utf-8")
    dock = "/js/cover-floating-action-dock.js"
    normalizer = "/js/cover-ui-runtime-normalizer.js?v=20260805-1"
    safety = "/js/cover-runtime-safety.js"
    assert source.count("coverUiRuntimeNormalizerScriptV1") == 1
    assert source.count(normalizer) == 1
    assert source.index(dock) < source.index(normalizer) < source.index(safety)


def test_retired_page_has_no_direct_renderer_or_pointer_owners_while_route_modules_remain_auditable():
    editor = EDITOR.read_text(encoding="utf-8")
    register = REGISTER.read_text(encoding="utf-8")
    assert "cover-editor-ux-upgrade.js" not in editor
    assert "cover-editor-image-tools.js" not in editor
    assert "<canvas" not in editor
    assert "/design-editor/?mode=cover" in editor
    assert register.index("perfect-binding-cover-fine-controls.js") < register.index("cover-editor-text-zones-v2.js")
    assert register.index("cover-editor-text-zones-v2.js") < register.index("cover-runtime-safety.js")

    ux = (ROOT / "js" / "cover-editor-ux-upgrade.js").read_text(encoding="utf-8")
    image = (ROOT / "js" / "cover-editor-image-tools.js").read_text(encoding="utf-8")
    fine = (ROOT / "js" / "perfect-binding-cover-fine-controls.js").read_text(encoding="utf-8")
    zones = (ROOT / "js" / "cover-editor-text-zones-v2.js").read_text(encoding="utf-8")
    safety = (ROOT / "js" / "cover-runtime-safety.js").read_text(encoding="utf-8")
    assert "__coverUxWrapped" in ux
    assert "__coverImageFxWrapped" in image
    assert "pointerdown" in fine and "stopImmediatePropagation" in fine
    assert "pointerdown" in zones and "stopImmediatePropagation" in zones
    assert "guardedCoverRender.__coverRuntimeSafetyV1" in safety


def test_obsolete_compatibility_files_remain_inert_until_orphan_cleanup():
    multiselect = (ROOT / "js" / "cover-editor-multiselect.js").read_text(encoding="utf-8")
    layer = (ROOT / "js" / "cover-editor-layer-style.js").read_text(encoding="utf-8")
    assert "coverMultiPanel" in multiselect
    assert "CoverMultiSelect" not in multiselect
    assert "의도적으로 비활성 상태" in layer
    assert "setInterval(" not in multiselect
    assert "setInterval(" not in layer


def test_ui_normalizer_is_bounded_and_executes():
    source = MODULE.read_text(encoding="utf-8")
    assert "INSTALL_DELAYS = [0, 250, 650, 1100, 1800, 2800]" in source
    assert "for (const delay of INSTALL_DELAYS) setTimeout(install, delay)" in source
    assert "setInterval(" not in source
    assert "eval(" not in source
    assert "stage: 'palette-mobile-dock-runtime-normalization'" in source

    result = subprocess.run(
        ["node", str(BEHAVIOR)],
        cwd=ROOT,
        text=True,
        capture_output=True,
        check=False,
    )
    assert result.returncode == 0, result.stderr or result.stdout
    assert "cover-ui-runtime-normalizer behavior passed" in result.stdout
