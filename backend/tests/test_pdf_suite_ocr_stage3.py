import json
from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]
OCR = ROOT / "js" / "pdf-suite" / "ocr-tools.js"
HOSTING = ROOT / "scripts" / "prepare_hosting_dist.py"
FIREBASE = ROOT / "firebase.json"
SMOKE = ROOT / "tests" / "browser" / "pdf-suite-ocr-smoke.html"
RUNNER = ROOT / "scripts" / "run_phase5_browser_smoke.sh"


def test_ocr_stage_uses_current_tesseract_and_pdf_render_pipeline_without_document_upload_code():
    source = OCR.read_text(encoding="utf-8")

    for marker in (
        "TESSERACT_VERSION='7.0.0'",
        "PDFJS_VERSION='3.11.174'",
        "MAX_OCR_BYTES=40*1024*1024",
        "MAX_OCR_PAGES=30",
        "OCR_DPI=180",
        "MAX_CANVAS_PIXELS=16_000_000",
        "Tesseract.createWorker(language,1",
        "page.render({canvasContext:ctx,viewport,background:'#FFFFFF'})",
        "worker.recognize(canvas",
        "{text:true,pdf:mode==='pdf'}",
        "output.copyPages(sourceDoc",
        "output.embedPage(sourcePage)",
        "OCR 검색 가능한 PDF",
        "한국어·영어 OCR 문자 인식",
        "removeRoadmap('한국어 OCR')",
        "removeRoadmap('검색 가능한 PDF')",
    ):
        assert marker in source

    assert "fetch(" not in source
    assert "XMLHttpRequest" not in source
    assert "tessdata.projectnaptha.com" not in source


def test_searchable_pdf_preserves_native_text_pages_and_ocrs_scanned_pages_only_by_default():
    source = OCR.read_text(encoding="utf-8")

    assert "data-ocr-native type=\"checkbox\" checked" in source
    assert "NATIVE_TEXT_THRESHOLD=30" in source
    assert "if(preserveNative&&nativeText.length>=NATIVE_TEXT_THRESHOLD)" in source
    assert "기존 텍스트 페이지 유지" in source
    assert "스캔 페이지만 OCR 처리" in source
    assert "검색 가능한 PDF + TXT" in source
    assert "OCR TXT만 저장" in source


def test_ocr_runtime_is_injected_into_hosting_and_csp_allows_only_engine_model_download_origin():
    hosting = HOSTING.read_text(encoding="utf-8")
    payload = json.loads(FIREBASE.read_text(encoding="utf-8"))

    for marker in (
        'PDF_SUITE_OCR_MARKER = "data-pdf-suite-ocr-tools"',
        "/js/pdf-suite/ocr-tools.js?v=20260905-1",
        "PDF_SUITE_OCR_SNIPPET",
        "_inject_before(suite, PDF_SUITE_OCR_MARKER",
    ):
        assert marker in hosting

    global_rule = next(rule for rule in payload["hosting"]["headers"] if rule["source"] == "**")
    csp = next(item["value"] for item in global_rule["headers"] if item["key"] == "Content-Security-Policy")
    connect = next(part.strip() for part in csp.split(";") if part.strip().startswith("connect-src "))
    worker = next(part.strip() for part in csp.split(";") if part.strip().startswith("worker-src "))
    assert "https://cdn.jsdelivr.net" in connect
    assert "https://cdn.jsdelivr.net" in worker
    assert "blob:" in worker


def test_ocr_browser_smoke_is_wired_into_phase5():
    runner = RUNNER.read_text(encoding="utf-8")
    smoke = SMOKE.read_text(encoding="utf-8")

    assert "pdf-suite-ocr-smoke.html" in runner
    assert "data-pdf-suite-ocr-smoke=\"pass\"" in runner
    assert "dataset.pdfSuiteOcrSmoke='pass'" in smoke
