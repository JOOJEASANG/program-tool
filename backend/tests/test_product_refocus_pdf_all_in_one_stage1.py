from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]
HOME = ROOT / "js" / "home-professional-suite.js"
PDF_STAGE = ROOT / "js" / "pdf-all-in-one-stage1.js"
PDF_TOOLS = ROOT / "backend" / "routers" / "pdf_tools.py"
RUNTIME = ROOT / "js" / "sw-register.js"
RUNNER = ROOT / "scripts" / "run_pdf_program_shell_smoke.sh"
UTILITY_SMOKE = ROOT / "tests" / "browser" / "pdf-all-in-one-stage1-smoke.html"
PRINT_SMOKE = ROOT / "tests" / "browser" / "pdf-print-output-stage1-smoke.html"


def test_home_is_refocused_on_subscription_alternative_work_tools():
    source = HOME.read_text(encoding="utf-8")
    for marker in (
        "name:'PDF 올인원'",
        "name:'인쇄·출력 도구'",
        "name:'이미지 작업 도구'",
        "name:'디자인 제작'",
        "name:'OCR · 문서 변환'",
        "구독 프로그램 없이",
        "subscription-alternative-home-stage1",
    ):
        assert marker in source
    assert "id:'document-editor'" not in source
    assert source.index("id:'pdf-utility'") < source.index("id:'pdf-editor'")


def test_pdf_all_in_one_surfaces_existing_extract_and_blank_page_tools():
    source = PDF_STAGE.read_text(encoding="utf-8")
    backend = PDF_TOOLS.read_text(encoding="utf-8")
    for marker in (
        "pdf-all-in-one-stage1",
        "페이지 추출·나누기",
        "빈 페이지 자동 제거",
        "apiPdfTool('extract'",
        "apiPdfTool('remove-blank'",
        "인쇄·출력 도구",
        "subscription-alternative-stage1",
    ):
        assert marker in source
    assert '@pdf_tools_bp.route("/extract", methods=["POST"])' in backend
    assert '@pdf_tools_bp.route("/remove-blank", methods=["POST"])' in backend


def test_stage1_runtime_and_browser_regression_are_wired():
    runtime = RUNTIME.read_text(encoding="utf-8")
    runner = RUNNER.read_text(encoding="utf-8")
    utility_smoke = UTILITY_SMOKE.read_text(encoding="utf-8")
    print_smoke = PRINT_SMOKE.read_text(encoding="utf-8")

    assert "/js/home-professional-suite.js?v=20260824-1" in runtime
    assert "/js/pdf-all-in-one-stage1.js?v=20260824-1" in runtime
    assert runtime.count("pdfAllInOneStage1ScriptV1") == 2
    assert "pdf-all-in-one-stage1-smoke.html" in runner
    assert "pdf-print-output-stage1-smoke.html" in runner
    assert "data-pdf-all-in-one-smoke=\"pass\"" in utility_smoke
    assert "data-print-output-smoke=\"pass\"" in print_smoke
