from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]


def test_general_design_preview_guides_use_colored_dashed_lines_and_show_size():
    source = (ROOT / "js" / "design-editor" / "preview-guide-enhancement.js").read_text(encoding="utf-8")

    assert "if(params.get('mode')==='cover')return" in source
    assert "완성 규격 ${mm(p.width)} × ${mm(p.height)} mm" in source
    assert "작업영역 ${mm(totalW)}×${mm(totalH)}mm" in source
    assert "재단영역 ${mm(p.width)}×${mm(p.height)}mm" in source
    assert "재단여백 ${mm(bleed)}mm" in source
    assert "안전여백 ${mm(p.safe)}mm" in source
    assert "접지선 ${folds.map(value=>mm(value)).join(' / ')}mm" in source
    assert "가로 접지선 ${foldsY.map(value=>mm(value)).join(' / ')}mm" in source

    assert "outline:1.5px dashed #2563eb!important" in source
    assert "border:1.5px dashed #dc2626!important" in source
    assert "border:1.2px dashed #16a34a!important" in source
    assert "border-left:1.5px dashed #f59e0b!important" in source
    assert "border-top:1.5px dashed #f59e0b!important" in source
    assert "rgba(124,58,237,.10)" in source


def test_leaflet_preview_shows_numbered_panels_and_each_panel_safe_margin():
    source = (ROOT / "js" / "design-editor" / "preview-guide-enhancement.js").read_text(encoding="utf-8")

    assert "p?.designMode==='leaflet2'||p?.designMode==='leaflet3'" in source
    assert "const PANEL_ID='designPreviewPanelOverlay'" in source
    assert "design-preview-panel-safe" in source
    assert "design-preview-panel-label" in source
    assert "design-preview-panel-margin-label" in source
    assert "${index+1}단${panelName?` · ${panelName}`:''} · ${mm(span)}mm" in source
    assert "${index+1}단 여백 ${mm(safe)}mm" in source
    assert "단별 여백 ${mm(p.safe)}mm" in source
    assert "surface?.foldAxis==='y'||foldsY.length" in source
    assert "#0891b2" in source
    assert "data-leaflet-panel-guides" in source


def test_general_preview_supports_horizontal_and_vertical_leaflet_folds():
    source = (ROOT / "js" / "design-editor" / "preview-guide-enhancement.js").read_text(encoding="utf-8")

    assert ".fold-guide.leaflet2-horizontal-fold-guide" in source
    assert "numericList(surface?.foldsY)" in source
    assert "numericList(surface?.folds)" in source
    assert "designLeaflet2Layout" in source
    assert "surface?.foldAxis==='y'" in source


def test_general_preview_work_area_includes_bleed_on_all_sides():
    source = (ROOT / "js" / "design-editor" / "preview-guide-enhancement.js").read_text(encoding="utf-8")

    assert "const totalW=(Number(p.width)||0)+bleed*2" in source
    assert "const totalH=(Number(p.height)||0)+bleed*2" in source
    assert "const BLEED_ID='designPreviewBleedBand'" in source
    assert "--design-preview-bleed-px" in source
    assert "p.showGuides!==false" in source
    assert "p.showFolds!==false" in source


def test_general_preview_guides_are_loaded_with_fresh_asset_key():
    source = (ROOT / "js" / "app-version.js").read_text(encoding="utf-8")

    assert "designPreviewGuideEnhancementScriptV1" in source
    assert "/js/design-editor/preview-guide-enhancement.js?v=20260825-3" in source
    assert "currentPath==='/design-editor/general'" in source
