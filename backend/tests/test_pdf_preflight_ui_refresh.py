from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]


def read(path: str) -> str:
    return (ROOT / path).read_text(encoding="utf-8")


def test_pdf_preflight_ui_is_clean_left_tools_right_results_workflow():
    source = read("js/pdf-preflight-panel-balance.js")
    assert "PDF 검사 · 유틸리티" in source
    assert "PDF 파일 업로드" in source
    assert "검사 · PDF 유틸리티" in source
    assert "작업 진행 · 결과" in source
    assert "grid-template-columns:minmax(350px,420px) minmax(0,1fr)!important" in source
    assert "pdf-preflight-input-panel" in source
    assert "pdf-preflight-output-panel" in source
    assert "pdfPreflightOutputEmpty" in source
    assert "pdfAllInOneExtractBtn" in source
    assert "pdfAllInOneBlankBtn" in source
    assert "results-section-heading" in source
    assert "인쇄 전 확인 항목" in source
    assert 'href="/pdf-editor/"' in source
    assert "clean-workspace-v2" in source
    assert "left-tools-right-results-v1" in source


def test_pdf_preflight_page_preloads_firebase_scripts_for_faster_boot():
    page = read("pdf-preflight/index.html")
    assert 'rel="preconnect" href="https://www.gstatic.com"' in page
    assert 'rel="preload" href="https://www.gstatic.com/firebasejs/9.23.0/firebase-app-compat.js" as="script"' in page
    assert 'rel="preload" href="https://www.gstatic.com/firebasejs/9.23.0/firebase-auth-compat.js" as="script"' in page
    assert 'rel="preload" href="https://www.gstatic.com/firebasejs/9.23.0/firebase-firestore-compat.js" as="script"' in page
    # Preload hints must appear before the actual script tags in the document
    preload_pos = page.index('rel="preload" href="https://www.gstatic.com/firebasejs')
    script_pos = page.index('<script src="https://www.gstatic.com/firebasejs')
    assert preload_pos < script_pos


def test_pdf_preflight_ui_refresh_keeps_processing_logic_separate_and_canonical():
    source = read("js/pdf-preflight-panel-balance.js")
    page = read("pdf-preflight/index.html")
    runtime = read("js/pdf-preflight/route-runtime.js")
    app_version = read("js/app-version.js")

    assert "apiPreflightCheck(selectedFile" in page
    assert "apiPdfTool('encrypt'" in page
    assert "apiPdfTool('decrypt'" in page
    assert "apiPreflightCheck" not in source
    assert "apiPdfTool" not in source
    assert "/js/pdf-preflight-panel-balance.js" in runtime
    assert runtime.index("pdfPreflightPanelBalanceScriptV1") > runtime.index("pdfUtilityFinalizeScriptV1")
    executable = app_version.split("/*", 1)[0] + app_version.rsplit("*/", 1)[-1]
    assert "/js/pdf-preflight-panel-balance.js" not in executable
