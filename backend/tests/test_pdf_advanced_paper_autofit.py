from __future__ import annotations

from pathlib import Path

import fitz
import pytest

from models.advanced_schemas import AdvancedPageInfo, PdfAdvancedProcessRequest
from services.pdf_advanced_engine import process_advanced_pdf_bytes


ROOT = Path(__file__).resolve().parents[2]


def _source_pdf(width: float = 400, height: float = 300) -> bytes:
    doc = fitz.open()
    page = doc.new_page(width=width, height=height)
    page.insert_text((50, 100), "ADVANCED PAPER SIZE", fontsize=14)
    data = doc.tobytes(garbage=4, deflate=True)
    doc.close()
    return data


def test_advanced_output_page_size_is_applied_to_downloaded_pdf():
    a4_width_pt = 210 * 72 / 25.4
    a4_height_pt = 297 * 72 / 25.4
    page = AdvancedPageInfo(
        file_index=0,
        page_index=0,
        rotation=0,
        output_width_pt=a4_width_pt,
        output_height_pt=a4_height_pt,
    )
    request = PdfAdvancedProcessRequest(pages=[page])
    result = process_advanced_pdf_bytes([_source_pdf()], request)
    output = fitz.open(stream=result, filetype="pdf")
    try:
        rect = output[0].rect
        assert rect.width == pytest.approx(a4_width_pt, abs=0.2)
        assert rect.height == pytest.approx(a4_height_pt, abs=0.2)
        assert output[0].search_for("ADVANCED PAPER SIZE")
    finally:
        output.close()


def test_advanced_output_page_size_requires_width_and_height_together():
    with pytest.raises(ValueError):
        AdvancedPageInfo(file_index=0, page_index=0, output_width_pt=595.0)


def test_advanced_paper_size_and_autofit_frontend_contract():
    paper = (ROOT / "js" / "pdf-editor-advanced" / "paper-size.js").read_text(encoding="utf-8")
    layout = (ROOT / "js" / "pdf-editor-advanced" / "layout-v3.js").read_text(encoding="utf-8")
    layout_css = (ROOT / "css" / "pdf-editor-advanced-layout-v3.css").read_text(encoding="utf-8")
    facing = (ROOT / "js" / "pdf-editor-advanced" / "facing-upload.js").read_text(encoding="utf-8")
    state = (ROOT / "js" / "pdf-editor-advanced" / "state.js").read_text(encoding="utf-8")

    for marker in ["원본 크기 유지", "A4 (210×297mm)", "A3 (297×420mm)", "B4 (250×354mm)", "B5 (176×250mm)", "Letter (216×279mm)", "직접 입력..."]:
        assert marker in paper
    assert "sourceWidthPt" in paper and "sourceHeightPt" in paper
    assert "현재 세로·가로 방향을 유지" in paper
    assert "output_width_pt" in state and "output_height_pt" in state
    assert "import './paper-size.js';" in facing
    assert "import './layout-v3.js';" in facing

    assert "empty.style.display = hasPages ? 'none' : ''" in layout
    assert "--advanced-page-max-width" in layout
    assert "--advanced-page-max-height" in layout
    assert "const gap = mobile ? 18 : window.innerWidth <= 980 ? 22 : 28" in layout
    assert "#emptyState[hidden]{display:none!important}" in layout_css
    assert "gap:var(--advanced-pair-gap,28px)!important" in layout_css
    assert "max-height:var(--advanced-page-max-height" in layout_css
