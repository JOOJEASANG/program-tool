from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]
LAYOUT = ROOT / "js" / "pdf-utility-wide-layout.js"
FINALIZE = ROOT / "js" / "pdf-utility-finalize.js"


def test_pdf_utility_wide_layout_uses_desktop_workspace_width_and_sticky_file_panel():
    source = LAYOUT.read_text(encoding="utf-8")
    for marker in (
        "max-width:1660px!important",
        "grid-template-columns:minmax(365px,430px) minmax(0,1fr)!important",
        "position:sticky!important",
        "max-height:calc(100vh - 96px)!important",
        "@media(max-width:1050px)",
        "grid-template-columns:1fr!important",
        "pdfu-wide-layout",
    ):
        assert marker in source


def test_pdf_utility_wide_layout_groups_batch_and_selected_file_tools():
    source = LAYOUT.read_text(encoding="utf-8")
    for marker in (
        "여러 PDF 일괄 작업",
        "선택 파일 개별 작업",
        "최대 10개",
        "선택 1개",
        "pdfUtilityWideActiveFile",
        "['checkBtn', 'pdfUtilityMergeBtn']",
        "['pdfUtilityBackgroundBtn', 'pdfUtilityCompressBtn', 'pdfUtilityRepairBtn', 'encryptBtn', 'decryptBtn']",
        ".pdfuw-action-grid.batch",
        ".pdfuw-action-grid.single",
    ):
        assert marker in source


def test_pdf_utility_results_expand_for_wide_screen_review():
    source = LAYOUT.read_text(encoding="utf-8")
    assert "#pdfUtilityBatchResults .pdfu-result-list" in source
    assert "grid-template-columns:repeat(2,minmax(0,1fr))!important" in source
    assert "#results .checks-grid" in source
    assert "grid-template-columns:repeat(3,minmax(260px,1fr))!important" in source
    assert "width:min(620px,100%)!important" in source


def test_pdf_utility_finalize_loads_wide_layout_after_function_initialization():
    source = FINALIZE.read_text(encoding="utf-8")
    assert "function loadWideLayout()" in source
    assert "pdfUtilityWideLayoutScriptV1" in source
    assert "/js/pdf-utility-wide-layout.js?v=20260818-1" in source
    assert "document.documentElement.dataset.pdfUtilityFinalized = '1';" in source
    assert source.index("document.documentElement.dataset.pdfUtilityFinalized = '1';") < source.index("loadWideLayout();")
