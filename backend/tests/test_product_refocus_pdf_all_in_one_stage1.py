from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]
PDF_STAGE = ROOT / "js" / "pdf-all-in-one-stage1.js"
PDF_TOOLS = ROOT / "backend" / "routers" / "pdf_tools.py"
PREFLIGHT_RUNTIME = ROOT / "js" / "pdf-preflight" / "route-runtime.js"
PDF_EDITOR_RUNTIME = ROOT / "js" / "pdf-editor" / "route-runtime.js"
RUNNER = ROOT / "scripts" / "run_pdf_program_shell_smoke.sh"
UTILITY_SMOKE = ROOT / "tests" / "browser" / "pdf-utility-quick-actions-smoke.html"
PRINT_SMOKE = ROOT / "tests" / "browser" / "pdf-print-output-stage1-smoke.html"


def test_pdf_utility_quick_actions_surface_existing_extract_and_blank_page_tools_without_branding_ownership():
    source = PDF_STAGE.read_text(encoding="utf-8")
    backend = PDF_TOOLS.read_text(encoding="utf-8")
    for marker in (
        "pdf-utility-quick-actions-v2",
        "페이지 추출·나누기",
        "빈 페이지 자동 제거",
        "apiPdfTool('extract'",
        "apiPdfTool('remove-blank'",
        "인쇄·출력 도구",
        "subscription-alternative-stage1",
    ):
        assert marker in source
    assert "PDF 올인원" not in source
    assert "applyUtilityBranding" not in source
    assert '@pdf_tools_bp.route("/extract", methods=["POST"])' in backend
    assert '@pdf_tools_bp.route("/remove-blank", methods=["POST"])' in backend


def test_quick_actions_runtime_and_browser_regression_are_wired_to_canonical_routes():
    preflight = PREFLIGHT_RUNTIME.read_text(encoding="utf-8")
    editor = PDF_EDITOR_RUNTIME.read_text(encoding="utf-8")
    runner = RUNNER.read_text(encoding="utf-8")
    utility_smoke = UTILITY_SMOKE.read_text(encoding="utf-8")
    print_smoke = PRINT_SMOKE.read_text(encoding="utf-8")

    assert "/js/pdf-all-in-one-stage1.js?v=20260831-2" in preflight
    assert "pdfAllInOneStage1ScriptV1" in preflight
    assert "/js/pdf-all-in-one-stage1.js" in editor
    assert "pdf-utility-quick-actions-smoke.html" in runner
    assert "pdf-print-output-stage1-smoke.html" in runner
    assert "dataset.pdfQuickActionsSmoke='pass'" in utility_smoke
    assert "dataset.printOutputSmoke='pass'" in print_smoke
