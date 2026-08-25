from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]


def test_print_fold_module_draws_its_own_visible_fold_lines():
    source = (ROOT / "js" / "design-editor" / "print-fold-production.js").read_text(encoding="utf-8")

    assert "design-print-fold-line x" not in source  # class is assembled from the current axis
    assert "design-print-fold-line ${axis}" in source
    assert "border-left:2px dashed #f59e0b" in source
    assert "border-top:2px dashed #f59e0b" in source
    assert "접지 ${index+1} · ${mm(fold)}mm" in source
    assert "folds.forEach((fold,index)=>" in source


def test_leaflet_orientation_changes_fold_axis_and_panel_shape():
    source = (ROOT / "js" / "design-editor" / "print-fold-production.js").read_text(encoding="utf-8")

    assert "orientation==='portrait'?'top-bottom':'left-right'" in source
    assert "const axis=p.leaflet2Layout==='top-bottom'?'y':'x'" in source
    assert "const axis=orientation==='portrait'?'y':'x'" in source
    assert "surface.foldsY=folds.map(round1)" in source
    assert "surface.folds=folds.map(round1)" in source
    assert "delete surface.foldsY" in source
    assert "[third,third*2]" in source


def test_leaflet_panels_keep_per_panel_labels_and_margins():
    preview = (ROOT / "js" / "design-editor" / "preview-guide-enhancement.js").read_text(encoding="utf-8")
    production = (ROOT / "js" / "design-editor" / "print-fold-production.js").read_text(encoding="utf-8")

    assert "design-preview-panel-safe" in preview
    assert "${index+1}단 여백 ${mm(safe)}mm" in preview
    assert "surface.panels=[...panels]" in production
    assert "['상단 외부','하단 외부']" in production
    assert "['내용 상단','내용 하단']" in production
    assert "['상단 면','가운데 면','하단 면']" in production


def test_top_bottom_invitation_can_rotate_one_panel_for_print_output():
    source = (ROOT / "js" / "design-editor" / "print-fold-production.js").read_text(encoding="utf-8")
    output = (ROOT / "js" / "design-editor" / "output.js").read_text(encoding="utf-8")

    assert "상하 접기 인쇄 방향" in source
    assert "상단 180° · 초대장/카드" in source
    assert "하단 180° · 반대 방향 접기" in source
    assert "item.rotation=next" in source
    assert "printFoldBaseRotation" in source
    assert "printFoldAutoRotated" in source
    assert "withRotation(ctx,item" in output
    assert "rotationDegrees(item)" in output


def test_print_fold_module_is_loaded_on_design_editor():
    source = (ROOT / "js" / "app-version.js").read_text(encoding="utf-8")

    assert "designPrintFoldProductionScriptV1" in source
    assert "/js/design-editor/print-fold-production.js?v=20260825-1" in source
    assert "currentPath==='/design-editor/general'" in source
