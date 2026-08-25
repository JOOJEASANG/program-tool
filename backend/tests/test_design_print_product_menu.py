from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]


def test_visible_print_product_menu_replaces_direct_and_split_leaflet_buttons():
    runtime = (ROOT / "js" / "design-editor" / "print-product-menu.js").read_text(encoding="utf-8")
    assert "['cover','표지']" in runtime
    assert "['poster','포스터']" in runtime
    assert "['flyer','전단']" in runtime
    assert "['invitation','초대장·안내장']" in runtime
    assert "['leaflet','리플렛']" in runtime
    product_block = runtime.split("const PRODUCTS=[", 1)[1].split("];", 1)[0]
    assert "custom" not in product_block
    assert "2단" not in product_block
    assert "3단" not in product_block


def test_invitation_supports_asymmetric_fold_axis_position_and_rotation():
    runtime = (ROOT / "js" / "design-editor" / "print-product-menu.js").read_text(encoding="utf-8")
    assert 'id="designProductAxis"' in runtime
    assert 'id="designProductFoldPosition"' in runtime
    assert '접지 위치 정중앙 50:50' in runtime
    assert 'id="designProductFlip"' in runtime
    assert "p[POSITION_KEY]=position" in runtime
    assert "p[FLIP_KEY]=data.flip||'none'" in runtime
    assert "surface.foldsY=folds.map(round1)" in runtime


def test_leaflet_supports_4p_through_12p_and_variable_fold_counts():
    runtime = (ROOT / "js" / "design-editor" / "print-product-menu.js").read_text(encoding="utf-8")
    ensure = (ROOT / "js" / "design-editor" / "print-fold-runtime-ensure.js").read_text(encoding="utf-8")
    for pages in (4, 6, 8, 10, 12):
        assert str(pages) in runtime
    assert "pages/2" in runtime
    assert "accordion" in runtime
    assert "roll" in runtime
    assert "gate" in runtime
    assert "Math.max(1,(Number(p.printProductPages)||6)/2-1)" in ensure


def test_saved_product_geometry_is_not_overwritten_by_legacy_leaflet2_handler():
    legacy = (ROOT / "js" / "design-editor" / "phase25-leaflet2-layout.js").read_text(encoding="utf-8")
    restore = (ROOT / "js" / "design-editor" / "print-product-state-restore.js").read_text(encoding="utf-8")
    assert "p&&!p.printProductMode" in legacy
    assert "p.printProductMode==='invitation'" in restore
    assert "p.printProductMode==='leaflet'" in restore
    assert "validPages=new Set([4,6,8,10,12])" in restore


def test_print_product_browser_smoke_is_chained_into_design_suite():
    runner = (ROOT / "scripts" / "run_design_editor_browser_smoke.sh").read_text(encoding="utf-8")
    smoke = (ROOT / "tests" / "browser" / "design-editor-print-products-smoke.html").read_text(encoding="utf-8")
    assert 'run_design_editor_print_products_smoke.sh' in runner
    assert "dataset.printProductsInvitation='120mm-y-top'" in smoke
    assert "dataset.printProductsLeaflet8='4panels-3folds'" in smoke
    assert "dataset.printProductsLeaflet12='6panels-5folds-portrait'" in smoke
    assert "dataset.printProductsRestore='8p-gate'" in smoke
