from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
MODULE = ROOT / "js" / "pdf-editor" / "crop-marks.js"
REGISTER = ROOT / "js" / "sw-register.js"
LOADER = ROOT / "js" / "pdf-editor" / "loader.js"
API = ROOT / "js" / "api.js"


def test_crop_marks_are_loaded_only_for_pdf_editor():
    register = REGISTER.read_text(encoding="utf-8")
    assert "pdfCropMarksScript" in register
    assert "/js/pdf-editor/crop-marks.js?v=20260731-1" in register
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
    assert "window.PdfPrintMarks = { settings" in source
    assert "next.print_marks = window.PdfPrintMarks.settings()" in api
    assert "mark_length_mm" in source
    assert "mark_offset_mm" in source


def test_crop_mark_module_has_bounded_startup_retries():
    source = MODULE.read_text(encoding="utf-8")
    assert "attempts < 12" in source
    assert "setTimeout(boot, 180 + attempts * 60)" in source
