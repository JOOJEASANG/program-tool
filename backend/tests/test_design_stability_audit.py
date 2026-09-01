from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]


def read(path: str) -> str:
    return (ROOT / path).read_text(encoding="utf-8")


def test_product_boundary_observer_is_guarded_against_self_feedback():
    source = read("js/design-editor/product-boundary-ui.js")
    assert "applying=false" in source
    assert "observer?.disconnect()" in source
    assert "if(applying)return" in source
    assert "const setText=" in source
    assert "standalone-design-product-boundary-v3-stable" in source


def test_shared_resize_path_removes_legacy_phase3_handle():
    source = read("js/design-editor/stability-guards.js")
    assert "phase3-resize-handle" in source
    assert "removeLegacyResizeHandles" in source
    assert "data-design-direct-resize" not in source  # dataset is set through DOM API, not duplicated markup
    assert "document.documentElement.dataset.designDirectResize='1'" in source


def test_direct_text_resize_is_persisted_as_manual_width():
    source = read("js/design-editor/stability-guards.js")
    assert "entry.textBoxWidthMode='manual'" in source
    assert "designeditor:text-width-manual" in source
    assert "programstudio:design-resize" in source
    assert "DesignEditorTextAutoFit?.sync?.()" in source


def test_shell_loads_stability_guards_after_direct_resize():
    source = read("js/design-editor/shell-runtime.js")
    direct = source.index("await loadDirectResize()")
    stable = source.index("await loadStabilityGuards()")
    assert direct < stable
    assert "designStabilityGuardsScriptV1" in source
    assert "/js/design-editor/stability-guards.js?v=20260901-1" in source
