from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]


def test_phase13_design_manifest_loads_fixed_product_topbar_runtime():
    shell = (ROOT / "design-editor" / "index.html").read_text(encoding="utf-8")
    runtime = (ROOT / "js" / "design-editor" / "shell-runtime.js").read_text(encoding="utf-8")
    assert "designPrintProductTopbarScriptV1" in runtime
    assert "/js/design-editor/print-product-topbar.js?v=20260828-2" in runtime
    assert "const ensureProductTopbarRuntime=ensurePrintRuntimes" in shell
    assert "productTopbarStage:'professional-design-commandbar-v2'" in shell
    assert "runtimeManifestStage:'design-shell-runtime-manifest-v1'" in shell


def test_phase13_product_topbar_keeps_product_choice_above_canvas_and_settings_visible():
    source = (ROOT / "js" / "design-editor" / "print-product-topbar.js").read_text(encoding="utf-8")
    for label in ("표지", "포스터", "전단", "초대장·안내장", "리플렛"):
        assert label in source
    assert "document.querySelector('.editor-toolbar')" in source
    assert "toolbar.insertBefore(root,tabs||toolbar.firstChild)" in source
    assert ".editor-toolbar{position:sticky!important;top:0!important" in source
    assert "data-print-product-top" in source
    assert "button.click()" in source
    assert "card.dataset.psToolAlways='1'" in source
    assert "delete card.dataset.psToolStep" in source
    assert "grid.hidden=true" in source
    assert "문서 설정" in source


def test_phase13_topbar_browser_smoke_is_chained_into_print_product_suite():
    runner = (ROOT / "scripts" / "run_design_editor_print_products_smoke.sh").read_text(encoding="utf-8")
    smoke = (ROOT / "tests" / "browser" / "design-editor-product-topbar-smoke.html")
    assert smoke.is_file()
    assert "design-editor-product-topbar-smoke.html" in runner
    assert "data-design-product-topbar-status=\"pass\"" in runner
    assert "data-design-product-topbar-fixed=\"sticky\"" in runner
    assert "data-design-product-topbar-proxy=\"flyer\"" in runner
