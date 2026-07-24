import fitz

from models.schemas import PdfProcessRequest
from services import pdf_engine


def _source_bytes(page_count: int = 8) -> bytes:
    document = fitz.open()
    for _ in range(page_count):
        page = document.new_page(width=200, height=300)
        page.insert_text((30, 40), "performance")
    data = document.tobytes()
    document.close()
    return data


def _request(page_count: int = 8) -> PdfProcessRequest:
    return PdfProcessRequest.model_validate({
        "paper": {"width_mm": 210, "height_mm": 297},
        "pages": [
            {"file_index": 0, "page_index": index, "page_type": "normal"}
            for index in range(page_count)
        ],
        "nup_default": 2,
        "margin_h_mm": 10,
        "margin_v_mm": 10,
        "gap_mm": 5,
    })


def test_repeated_nup_pages_build_layout_once(monkeypatch):
    calls = 0
    original = pdf_engine._build_page_layout

    def counted(*args, **kwargs):
        nonlocal calls
        calls += 1
        return original(*args, **kwargs)

    monkeypatch.setattr(pdf_engine, "_build_page_layout", counted)
    output = pdf_engine.process_pdf_bytes([_source_bytes()], _request())

    with fitz.open(stream=output, filetype="pdf") as document:
        assert document.page_count == 4
    assert calls == 1


def test_page_layout_precomputes_all_cell_rectangles():
    layout = pdf_engine._build_page_layout(4, 595, 842, 20, 20, 10)

    assert layout.cols * layout.rows == 4
    assert len(layout.cell_rects) == 4
    assert all(rect.width > 0 and rect.height > 0 for rect in layout.cell_rects)
