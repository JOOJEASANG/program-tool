from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]


def test_general_design_preview_guides_use_dashed_lines_and_show_size():
    source = (ROOT / "js" / "design-editor" / "preview-guide-enhancement.js").read_text(encoding="utf-8")

    assert "if(params.get('mode')==='cover')return" in source
    assert "완성 규격 ${mm(p.width)} × ${mm(p.height)} mm" in source
    assert "작업영역 ${mm(totalW)}×${mm(totalH)}mm" in source
    assert "재단영역 ${mm(p.width)}×${mm(p.height)}mm" in source
    assert "재단여백 ${mm(bleed)}mm" in source
    assert "안전여백 ${mm(p.safe)}mm" in source
    assert "접지선 ${folds.map(value=>mm(value)).join(' / ')}mm" in source
    assert "가로 접지선 ${foldsY.map(value=>mm(value)).join(' / ')}mm" in source

    assert "outline:1.5px dashed #64748b!important" in source
    assert "border:1.5px dashed #475569!important" in source
    assert "border:1.2px dashed #94a3b8!important" in source
    assert "border-left:1.5px dashed #334155!important" in source
    assert "border-top:1.5px dashed #334155!important" in source
    assert "background:transparent!important" in source


def test_general_preview_restores_leaflet_panel_labels_and_horizontal_fold():
    source = (ROOT / "js" / "design-editor" / "preview-guide-enhancement.js").read_text(encoding="utf-8")

    assert ".panel-guide-label{" in source
    assert "display:block!important" in source
    assert "visibility:visible!important" in source
    assert "artboard.querySelectorAll('.panel-guide-label')" in source
    assert "label.removeAttribute('hidden')" in source
    assert "...(surface?.panels||[])" in source
    assert ".fold-guide.leaflet2-horizontal-fold-guide" in source
    assert "...(surface?.foldsY||[]).map(round1)" in source
    assert "designLeaflet2Layout" in source


def test_general_preview_work_area_includes_bleed_on_all_sides():
    source = (ROOT / "js" / "design-editor" / "preview-guide-enhancement.js").read_text(encoding="utf-8")

    assert "const totalW=(Number(p.width)||0)+bleed*2" in source
    assert "const totalH=(Number(p.height)||0)+bleed*2" in source
    assert "p.showGuides!==false" in source
    assert "p.showFolds!==false" in source


def test_general_preview_guides_are_loaded_with_fresh_asset_key():
    source = (ROOT / "js" / "app-version.js").read_text(encoding="utf-8")

    assert "designPreviewGuideEnhancementScriptV1" in source
    assert "/js/design-editor/preview-guide-enhancement.js?v=20260825-2" in source
    assert "currentPath==='/design-editor/general'" in source
