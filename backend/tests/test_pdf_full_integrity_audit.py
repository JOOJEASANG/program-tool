from pathlib import Path

import pytest
from pydantic import ValidationError

from models.schemas import PdfProcessRequest
from routers import pdf as pdf_router
from services import pdf_divider_alignment_patch as divider_patch
from services import pdf_ops
from services import pdf_route_integrity_patch  # noqa: F401


ROOT = Path(__file__).resolve().parents[2]
LOADER = ROOT / "js" / "pdf-editor" / "loader.js"
PREVIEW = ROOT / "js" / "pdf-editor" / "preview-controller.js"
UPLOAD = ROOT / "js" / "pdf-editor" / "upload-fix.js"
THUMBNAILS = ROOT / "js" / "pdf-editor" / "thumbnail-integrity.js"
LAYOUT_EXPORT = ROOT / "js" / "pdf-editor" / "layout-export.js"
RUNTIME = ROOT / "js" / "pdf-editor" / "runtime-integrity.js"
PAGE_NUMBER = ROOT / "js" / "pdf-editor" / "page-number-preview-parity.js"


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


def test_layout_export_intercepts_only_exact_same_origin_pdf_routes():
    text = _text(LAYOUT_EXPORT)
    assert "url.origin !== location.origin" in text
    assert "path === '/api/pdf/process'" in text
    assert "path === '/api/pdf/process-storage'" in text
    assert "includes('/api/pdf/process')" not in text


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


def test_route_request_hook_preserves_current_korean_divider_renderer():
    pdf_ops._render_divider_page = lambda *args, **kwargs: None
    pdf_router._patch_divider_renderer()
    assert pdf_ops._render_divider_page is divider_patch._render_divider_page
    assert pdf_ops._program_studio_divider_renderer is True
