import fitz

from models.schemas import PdfProcessRequest
from services import pdf_engine, pdf_ops


def _source_pdf(page_count: int = 4) -> bytes:
    document = fitz.open()
    try:
        for index in range(page_count):
            page = document.new_page(width=210, height=297)
            page.insert_text((24, 36), f"LEGACY-EQUIVALENCE-{index + 1}")
        return document.tobytes()
    finally:
        document.close()


def _request(page_count: int = 4) -> PdfProcessRequest:
    return PdfProcessRequest.model_validate(
        {
            "paper": {"width_mm": 210, "height_mm": 297},
            "pages": [
                {
                    "file_index": 0,
                    "page_index": index,
                    "page_type": "normal",
                }
                for index in range(page_count)
            ],
            "nup_default": 2,
            "margin_h_mm": 8,
            "margin_v_mm": 8,
            "gap_mm": 4,
            "add_border": True,
        }
    )


def _snapshot(pdf_bytes: bytes) -> tuple[int, list[tuple[float, float]], list[str]]:
    document = fitz.open(stream=pdf_bytes, filetype="pdf")
    try:
        return (
            document.page_count,
            [
                (round(page.rect.width, 3), round(page.rect.height, 3))
                for page in document
            ],
            [page.get_text().strip() for page in document],
        )
    finally:
        document.close()


def test_legacy_entrypoint_matches_shared_engine_output():
    source = _source_pdf()
    request = _request()

    legacy_output = pdf_ops.process_pdf([source], request)
    shared_output = pdf_engine.process_pdf_bytes([source], request)

    assert _snapshot(legacy_output) == _snapshot(shared_output)
