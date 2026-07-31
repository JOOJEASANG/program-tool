from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
MODULE = ROOT / "js" / "pdf-editor" / "crop-marks.js"
REGISTER = ROOT / "js" / "sw-register.js"
LOADER = ROOT / "js" / "pdf-editor" / "loader.js"
API = ROOT / "js" / "api.js"


def test_crop_marks_are_loaded_only_for_pdf_editor():
    register = REGISTER.read_text(encoding="utf-8")
    assert "pdfCropMarksScript" in register
    assert "/js/pdf-editor/crop-marks.js?v=20260731-2" in register
    assert register.count("pdfCropMarksScript") == 1
    assert LOADER.read_text(encoding="utf-8").count("'/js/pdf-editor/") == 8


def test_crop_marks_module_does_not_enable_bleed():
    source = MODULE.read_text(encoding="utf-8")
    assert "재단선 추가" in source
    assert "bleed_mm: 0" in source
    assert "도련 작업영역과 원본 그림 확장은 적용하지 않습니다." in source
    assert "printBleedMm" not in source
    assert "setInterval(" not in source
    assert "eval(" not in source


def test_crop_mark_preview_and_export_share_settings():
    source = MODULE.read_text(encoding="utf-8")
    api = API.read_text(encoding="utf-8")
    assert "pages.map((canvas) => addMarks(canvas, mm2px))" in source
    assert "state.cropMarks = settings()" in source
    assert "window.PdfPrintMarks = {" in source
    assert "next.print_marks = window.PdfPrintMarks.settings()" in api
    assert "mark_length_mm" in source
    assert "mark_offset_mm" in source


def test_sidebar_upload_and_margin_controls_are_bounded_and_integrated():
    source = MODULE.read_text(encoding="utf-8")
    assert "pdf-upload-sticky-v2" in source
    assert "pdfUploadCompactGuideV2" in source
    assert "PDF 업로드 · 페이지 편집 · 간지 삽입" in source
    assert "font-weight:400!important" in source
    assert "marginFacingPagesV2" in source
    assert "좌·우 여백 마주보기" in source
    assert "original.dispatchEvent(new Event('change'" in source


def test_preview_document_overlays_use_independent_horizontal_margins():
    source = MODULE.read_text(encoding="utf-8")
    assert "function horizontalMargins(outputIndex)" in source
    assert "Number(outputIndex) % 2 === 1" in source
    assert "function paperMarginAwareOverlays" in source
    assert "Math.max(adjustedX, leftPx)" in source
    assert "Math.min(adjustedX, canvas.width - rightPx)" in source
    assert "const centerPx = (leftPx + canvas.width - rightPx) / 2" in source


def test_crop_mark_module_has_bounded_startup_retries():
    source = MODULE.read_text(encoding="utf-8")
    assert "attempts < 16" in source
    assert "setTimeout(boot, 180 + attempts * 60)" in source
