from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]
LOADER = ROOT / "js" / "pdf-editor" / "loader.js"
MODULE = ROOT / "js" / "pdf-editor" / "print-marks-bleed.js"
SCHEMAS = ROOT / "backend" / "models" / "schemas.py"
ENGINE = ROOT / "backend" / "services" / "pdf_engine.py"


def test_print_marks_module_loads_after_summary_and_booklet_guides():
    loader = LOADER.read_text(encoding="utf-8")
    assert "/js/pdf-editor/print-marks-bleed.js" in loader
    assert loader.rfind("print-marks-bleed.js") > loader.rfind("operation-progress-summary.js")
    assert loader.rfind("print-marks-bleed.js") > loader.rfind("booklet-print-guide.js")
    assert loader.rfind("print-marks-bleed.js") < loader.rfind("dock-width-align.js")


def test_ui_explains_that_artwork_is_not_artificially_extended():
    text = MODULE.read_text(encoding="utf-8")
    assert "재단선·도련 작업영역 추가" in text
    assert "도련 여유(mm)" in text
    assert "재단선 길이(mm)" in text
    assert "원본 그림이나 배경은 자동으로 바깥까지 늘어나지 않습니다" in text
    assert "실제 도련 인쇄가 필요하면 원본 PDF 자체" in text


def test_preview_draws_crop_trim_and_bleed_guides():
    text = MODULE.read_text(encoding="utf-8")
    assert "drawCropMarks" in text
    assert "context.setLineDash([4, 3])" in text
    assert "빨강=완성선 · 청록=도련 경계 · 검정=재단선" in text
    assert "addMarksToCanvas" in text
    assert "pages.map((canvas) => addMarksToCanvas" in text


def test_export_injects_validated_print_mark_settings():
    text = MODULE.read_text(encoding="utf-8")
    assert "print_marks: settings()" in text
    assert "bleed_mm" in text
    assert "mark_length_mm" in text
    assert "mark_offset_mm" in text
    assert "edge_padding_mm: 2" in text


def test_print_mark_settings_are_saved_and_shown_in_summary():
    text = MODULE.read_text(encoding="utf-8")
    assert "state.printMarks = settings()" in text
    assert "loadStateWithPrintMarks" in text
    assert "data-print-marks-summary" in text
    assert "출력 용지 확대" in text


def test_common_engine_applies_validated_print_mark_settings():
    engine = ENGINE.read_text(encoding="utf-8")
    assert "from services.pdf_print_marks import" in engine
    assert "apply_print_marks_if_enabled(buffer.getvalue(), request)" in engine
    assert "rewrite_path_with_print_marks(destination, request)" in engine
    schema = SCHEMAS.read_text(encoding="utf-8")
    assert "class PrintMarkSettings" in schema
    assert "print_marks: PrintMarkSettings" in schema


def test_print_marks_module_has_no_eval_or_unbounded_polling():
    text = MODULE.read_text(encoding="utf-8")
    assert "eval(" not in text
    assert "setInterval(" not in text
