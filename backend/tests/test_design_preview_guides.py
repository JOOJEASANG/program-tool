from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]


def test_general_design_preview_guides_show_size_and_color_coded_areas():
    source = (ROOT / "js" / "design-editor" / "preview-guide-enhancement.js").read_text(encoding="utf-8")

    assert "if(params.get('mode')==='cover')return" in source
    assert "완성 규격 ${mm(p.width)} × ${mm(p.height)} mm" in source
    assert "작업영역 ${mm(totalW)}×${mm(totalH)}mm" in source
    assert "재단영역 ${mm(p.width)}×${mm(p.height)}mm" in source
    assert "재단여백 ${mm(bleed)}mm" in source
    assert "안전여백 ${mm(p.safe)}mm" in source
    assert "접지선 ${folds.map(value=>mm(value)).join(' / ')}mm" in source

    assert "outline:1.5px solid #2563eb!important" in source
    assert "border:1.5px solid #e11d48!important" in source
    assert "border:1.25px dashed #16a34a!important" in source
    assert "border-left:1.5px dashed #d97706!important" in source


def test_general_preview_work_area_includes_bleed_on_all_sides():
    source = (ROOT / "js" / "design-editor" / "preview-guide-enhancement.js").read_text(encoding="utf-8")

    assert "const totalW=(Number(p.width)||0)+bleed*2" in source
    assert "const totalH=(Number(p.height)||0)+bleed*2" in source
    assert "p.showGuides!==false" in source
    assert "p.showFolds!==false" in source


def test_general_preview_guides_are_loaded_for_design_editor_routes():
    source = (ROOT / "js" / "app-version.js").read_text(encoding="utf-8")

    assert "designPreviewGuideEnhancementScriptV1" in source
    assert "/js/design-editor/preview-guide-enhancement.js?v=20260825-1" in source
    assert "currentPath==='/design-editor/general'" in source
