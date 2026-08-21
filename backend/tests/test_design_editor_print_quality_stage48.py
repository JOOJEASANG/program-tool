from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]
QUALITY = ROOT / "js" / "design-editor" / "phase13-print-quality.js"
REGISTER = ROOT / "js" / "sw-register.js"


def test_print_quality_module_loads_after_rotation_stage():
    register = REGISTER.read_text(encoding="utf-8")
    assert "designEditorPrintQualityScriptV1" in register
    assert "/js/design-editor/phase13-print-quality.js?v=20260822-1" in register
    assert register.index("designEditorRotationScriptV1") < register.index("designEditorPrintQualityScriptV1")


def test_print_quality_uses_effective_dpi_from_pixels_and_placed_mm():
    source = QUALITY.read_text(encoding="utf-8")
    for marker in (
        "dimensions.width/(widthMm/25.4)",
        "dimensions.height/(heightMm/25.4)",
        "Math.round(Math.min(dpiX,dpiY))",
        "if(dpi>=300)",
        "if(dpi>=250)",
        "if(dpi>=200)",
        "저해상도",
        "이미지를 더 작게 배치하거나 더 큰 원본으로 교체",
    ):
        assert marker in source


def test_print_quality_checks_visible_images_and_selected_image_detail():
    source = QUALITY.read_text(encoding="utf-8")
    for marker in (
        "item?.type==='image'&&item.visible!==false&&item.src",
        ".phase2-extra-object.selected",
        "selectedImageId()",
        "summary.images.find",
        "선택 이미지",
        "300DPI 이상 권장",
        "stage:'lightweight-print-image-quality-assistant'",
    ):
        assert marker in source


def test_print_quality_is_cached_event_driven_and_bounded():
    source = QUALITY.read_text(encoding="utf-8")
    assert "const dimensionCache=new Map()" in source
    assert "dimensionCache.has(src)" in source
    assert "['click','change','pointerup']" in source
    assert "MutationObserver" not in source
    assert "setInterval(" not in source
    assert "eval(" not in source
    assert "[180,420,800,1300,2200,3200]" in source
