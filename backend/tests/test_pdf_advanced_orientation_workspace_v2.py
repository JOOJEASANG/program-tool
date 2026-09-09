from __future__ import annotations

from pathlib import Path

import fitz

from models.advanced_schemas import AdvancedPageInfo, PdfAdvancedProcessRequest
from services.pdf_advanced_engine import _fit_rect, process_advanced_pdf_bytes


ROOT = Path(__file__).resolve().parents[2]


def _source_pdf(width: float = 400, height: float = 300) -> bytes:
    doc = fitz.open()
    page = doc.new_page(width=width, height=height)
    page.insert_text((60, 120), "ADVANCED ORIENTATION TEST", fontsize=14)
    data = doc.tobytes(garbage=4, deflate=True)
    doc.close()
    return data


def test_advanced_schema_and_engine_support_bounded_fine_rotation():
    page = AdvancedPageInfo(file_index=0, page_index=0, rotation=90, fine_rotation_deg=2.5)
    assert page.fine_rotation_deg == 2.5
    request = PdfAdvancedProcessRequest(pages=[page])
    output_bytes = process_advanced_pdf_bytes([_source_pdf()], request)
    output = fitz.open(stream=output_bytes, filetype="pdf")
    try:
        assert output.page_count == 1
        rect = output[0].rect
        # A 400x300 source rotated by the quarter turn keeps portrait output size;
        # fine rotation only deskews content inside that physical page.
        assert abs(rect.width - 300) < 0.1
        assert abs(rect.height - 400) < 0.1
        assert output[0].search_for("ADVANCED ORIENTATION TEST")
    finally:
        output.close()


def test_arbitrary_rotation_fit_uses_rotated_bounds():
    box = fitz.Rect(0, 0, 300, 400)
    straight = _fit_rect(box, 200, 300, 0)
    tilted = _fit_rect(box, 200, 300, 7.5)
    assert tilted.width <= box.width + 1e-6
    assert tilted.height <= box.height + 1e-6
    assert abs(tilted.width - straight.width) > 0.1 or abs(tilted.height - straight.height) > 0.1


def test_workspace_v2_contract_covers_all_requested_controls():
    workspace = (ROOT / "js" / "pdf-editor-advanced" / "workspace-v2.js").read_text(encoding="utf-8")
    preview = (ROOT / "js" / "pdf-editor-advanced" / "preview.js").read_text(encoding="utf-8")
    state = (ROOT / "js" / "pdf-editor-advanced" / "state.js").read_text(encoding="utf-8")
    css = (ROOT / "css" / "pdf-editor-advanced-workspace-v2.css").read_text(encoding="utf-8")
    bridge = (ROOT / "js" / "pdf-editor-advanced" / "facing-upload.js").read_text(encoding="utf-8")

    assert "pdfPage.rotate" in workspace
    assert "intrinsicRotation" in workspace
    assert "세로로 맞춤" in workspace
    assert "pairPreviewRow" in workspace and "pairPrevBtn" in workspace and "pairNextBtn" in workspace
    assert "fineRotationRange" in workspace and "fineRotateHandle" in workspace
    assert "전체 자동 회전·정렬" in workspace and "getTextContent" in workspace
    assert "textContent?.styles?.[item.fontName]?.vertical" in workspace
    assert "renderPagePreview" in preview and "fineRotation" in preview
    assert "fine_rotation_deg" in state
    assert ".page-item-info span{display:none!important}" in css
    assert "grid-template-columns:1fr 1fr" in css
    assert "import './workspace-v2.js';" in bridge
