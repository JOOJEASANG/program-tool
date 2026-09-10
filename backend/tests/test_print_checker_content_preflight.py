from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]


def read(path: str) -> str:
    return (ROOT / path).read_text(encoding="utf-8")


def test_print_checker_exposes_automatic_content_preflight_surface():
    html = read("print-checker/index.html")
    assert 'id="contentPreflightSection"' in html
    assert 'id="contentPreflightSummary"' in html
    assert 'id="contentPreflightGrid"' in html
    assert "/css/print-checker-content-preflight.css?v=20260910-1" in html
    assert "/js/print-checker/content-preflight.js?v=20260910-1" in html
    assert "자동 내용·인쇄 검사" in html


def test_pdf_preflight_reads_native_text_fonts_and_color_operators():
    js = read("js/print-checker/content-preflight.js")
    for marker in (
        "getTextContent",
        "getOperatorList",
        "setFillRGBColor",
        "setStrokeRGBColor",
        "setFillCMYKColor",
        "setStrokeCMYKColor",
        "PDF 문자 내용 인식",
        "사용 글꼴",
        "PDF 색상 공간",
    ):
        assert marker in js
    assert "MAX_ANALYSIS_PAGES = 24" in js
    assert "MAX_DEEP_PDF_BYTES = 80 * 1024 * 1024" in js


def test_pdf_preflight_checks_text_against_safe_and_fold_guides():
    js = read("js/print-checker/content-preflight.js")
    for marker in (
        "checkSafeText",
        "foldLines",
        "countFoldTextOverlaps",
        "FOLD_TEXT_TOLERANCE_MM = 1.5",
        "앞·뒤 표지 안쪽 여백",
        "안쪽 여백 문자 점검",
        "접는선 문자 겹침",
        "invitationFoldType",
    ):
        assert marker in js
    assert "PDF_MM_TOLERANCE = 0.8" in js
    assert "현재 입력한 작업규격과 PDF 실제 크기가 달라 위치 판정을 보류했습니다." in js


def test_image_preflight_calculates_effective_print_dpi_and_color_family():
    js = read("js/print-checker/content-preflight.js")
    assert "result.widthPx / (cfg.fileW / 25.4)" in js
    assert "result.heightPx / (cfg.fileH / 25.4)" in js
    assert "effective >= 300" in js
    assert "effective >= 200" in js
    assert "jpegComponentCount" in js
    assert "RGB 계열 PNG" in js
    assert "CMYK/YCCK 가능" in js
    assert "이미지 유효 해상도" in js


def test_content_preflight_does_not_overclaim_ocr_or_font_embedding():
    js = read("js/print-checker/content-preflight.js")
    assert "OCR 없이는 개별 문자 위치를 판정할 수 없습니다." in js
    assert "PDF.js만으로 모든 폰트의 임베딩 상태를 확정하지는 않습니다." in js
    assert "PDF 내부 이미지 색상은 이 수치에 모두 포함되지 않을 수 있습니다." in js


def test_content_preflight_renders_file_content_as_text_not_html():
    js = read("js/print-checker/content-preflight.js")
    assert "label.textContent = item.label" in js
    assert "detail.textContent = item.detail" in js
    assert "guide.textContent = item.guide" in js
    assert "window.PrintCheckerContentPreflight = Object.freeze" in js
