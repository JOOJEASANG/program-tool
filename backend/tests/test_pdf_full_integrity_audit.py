from pathlib import Path

import pytest
from pydantic import ValidationError

from models.schemas import PdfProcessRequest


ROOT = Path(__file__).resolve().parents[2]
LOADER = ROOT / "js" / "pdf-editor" / "loader.js"
PREVIEW = ROOT / "js" / "pdf-editor" / "preview-controller.js"
UPLOAD = ROOT / "js" / "pdf-editor" / "upload-fix.js"
THUMBNAILS = ROOT / "js" / "pdf-editor" / "thumbnail-integrity.js"
LAYOUT_EXPORT = ROOT / "js" / "pdf-editor" / "layout-export.js"
RUNTIME = ROOT / "js" / "pdf-editor" / "runtime-integrity.js"
PAGE_NUMBER = ROOT / "js" / "pdf-editor" / "page-number-preview-parity.js"
BACKEND_MAIN = ROOT / "backend" / "main.py"
PDF_ROUTER = ROOT / "backend" / "routers" / "pdf.py"


def _text(path: Path) -> str:
    return path.read_text(encoding="utf-8")


def test_integrity_modules_load_before_dependent_preview_wrappers():
    loader = _text(LOADER)
    assert "__pdfEditorModuleLoaderV34" in loader
    for module in (
        "thumbnail-integrity.js",
        "page-number-preview-parity.js",
        "runtime-integrity.js",
        "preview-controller.js",
    ):
        assert module in loader
    assert loader.index("page-number-preview-parity.js") < loader.index("operation-progress-summary.js")
    assert loader.index("runtime-integrity.js") < loader.index("operation-progress-summary.js")
    assert loader.index("preview-controller.js") < loader.index("operation-progress-summary.js")
    assert loader.index("thumbnail-integrity.js") > loader.index("page-productivity.js")


def test_preview_signature_tracks_all_output_affecting_controls():
    text = _text(PREVIEW)
    for required in (
        "wmEnabled", "wmText", "wmOpacity", "wmAngle", "wmColor",
        "hfEnabled", "hfHL", "hfHC", "hfHR", "hfFL", "hfFC", "hfFR",
        "hfSections", "pnFormat", "pnStart", "pnColor", "pnApplyTo",
        "pnAutoReserve", "printMarksEnabled", "printBleedMm",
        "fileNupMap", "dividerContent", "orderLR", "landscape",
    ):
        assert required in text
    assert "finishedSignature !== startedSignature" in text
    assert "setInterval(" not in text
    assert "eval(" not in text


def test_upload_patch_handles_aggregate_limits_rollback_and_auto_detection():
    text = _text(UPLOAD)
    for required in (
        "OPTIMIZED_PAGE_LIMIT = 120",
        "OPTIMIZED_BYTE_LIMIT = 160 * 1024 * 1024",
        "aggregateStats",
        "syncAggregateMode",
        "previous.parsedPages",
        "restorePaperState",
        "applyDetectedPaperSize",
        "makeLightweightPdfPage",
        "EXTREME_PREVIEW_OUTPUT_LIMIT = 24",
    ):
        assert required in text
    assert "uploadedFiles.splice(fileIndex, 1)" not in text
    assert "setInterval(" not in text
    assert "eval(" not in text


def test_thumbnail_integrity_repairs_rotation_and_divider_state():
    text = _text(THUMBNAILS)
    assert "pageRotation" in text
    assert "dividerSignature" in text
    assert "page.lightweight" in text
    assert "repairAll" in text
    assert "PdfPreviewController?.invalidate" in text


def test_layout_export_exposes_settings_without_global_fetch_monkeypatch():
    text = _text(LAYOUT_EXPORT)
    assert "window.PdfEditorLayoutExport = { patchSettings, marginValues }" in text
    assert "window.fetch =" not in text
    assert "window.apiProcessPdf =" not in text


def test_runtime_messages_and_session_names_are_rendered_as_text():
    text = _text(RUNTIME)
    assert "text.textContent" in text
    assert "info.appendChild(textBlock('fh-name'" in text
    assert "event.stopImmediatePropagation()" in text
    assert ".innerHTML" not in text


def test_page_number_preview_supports_all_formats_and_export_anchors():
    text = _text(PAGE_NUMBER)
    assert "pnFormat === 'number-total'" in text
    assert "pnFormat === 'dash'" in text
    assert "return `- ${visible} / ${visibleTotal} -`" in text
    assert "canvas.height - bottom - fontSize * 0.75" in text
    assert "pnEnabled = false" in text


def test_pdf_request_schema_rejects_invalid_geometry_and_rotation():
    base = {"pages": [{"file_index": 0, "page_index": 0}]}
    with pytest.raises(ValidationError):
        PdfProcessRequest.model_validate({**base, "paper": {"width_mm": 0, "height_mm": 297}})
    with pytest.raises(ValidationError):
        PdfProcessRequest.model_validate({**base, "gap_mm": 500})
    with pytest.raises(ValidationError):
        PdfProcessRequest.model_validate({"pages": [{"file_index": 0, "page_index": 0, "rotation": 45}]})
    with pytest.raises(ValidationError):
        PdfProcessRequest.model_validate({**base, "watermark": {"text": "x" * 501}})


def test_pdf_route_has_no_legacy_divider_request_hook():
    main = _text(BACKEND_MAIN)
    router = _text(PDF_ROUTER)
    assert "pdf_route_integrity_patch" not in main
    assert "_patch_divider_renderer" not in router
    assert "from services.pdf_engine import process_pdf_bytes" in router
