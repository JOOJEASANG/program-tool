from pathlib import Path

import fitz
import pytest

from routers.pdf_utility import _extract_pdf_bytes, _parse_page_selection


ROOT = Path(__file__).resolve().parents[2]
RUNTIME = ROOT / "js" / "pdf-preflight" / "route-runtime.js"
FRONTEND = ROOT / "js" / "pdf-utility" / "page-extract.js"
BACKEND = ROOT / "backend" / "routers" / "pdf_utility.py"


def _pdf_bytes(page_count: int = 5) -> bytes:
    doc = fitz.open()
    try:
        for index in range(page_count):
            page = doc.new_page(width=180, height=240)
            page.insert_text((24, 50), f"SOURCE PAGE {index + 1}", fontsize=14)
        return doc.tobytes(garbage=4, deflate=True)
    finally:
        doc.close()


def test_page_selection_parser_preserves_order_and_deduplicates():
    assert _parse_page_selection("3, 1-2, 2, 5", 5) == [3, 1, 2, 5]


@pytest.mark.parametrize(
    "selection,message",
    [
        ("", "페이지 범위"),
        ("0", "1 이상"),
        ("4-2", "시작 페이지"),
        ("1,,2", "빈 항목"),
        ("1-a", "형식"),
        ("6", "전체 5페이지"),
    ],
)
def test_page_selection_parser_rejects_invalid_ranges(selection, message):
    with pytest.raises(ValueError, match=message):
        _parse_page_selection(selection, 5)


def test_extract_pdf_bytes_keeps_requested_page_order():
    extracted, page_count = _extract_pdf_bytes(_pdf_bytes(5), "3,1-2")
    assert page_count == 3
    doc = fitz.open(stream=extracted, filetype="pdf")
    try:
        assert doc.page_count == 3
        assert "SOURCE PAGE 3" in doc[0].get_text()
        assert "SOURCE PAGE 1" in doc[1].get_text()
        assert "SOURCE PAGE 2" in doc[2].get_text()
    finally:
        doc.close()


def test_page_extract_runtime_is_local_first_and_has_server_fallback():
    source = FRONTEND.read_text(encoding="utf-8")
    for marker in (
        "local-first-with-server-fallback",
        "parsePageSelection",
        "extractLocally",
        "PDFDocument.load",
        "PDFDocument.create",
        "copyPages",
        "file.arrayBuffer()",
        "/api/pdf-utility/extract-storage",
        "pdfUtilityExtractBtn",
        "페이지 추출",
        "서버 업로드 없음",
    ):
        assert marker in source


def test_page_extract_is_loaded_after_shared_local_processing():
    runtime = RUNTIME.read_text(encoding="utf-8")
    local_pos = runtime.index("pdfUtilityLocalProcessingScriptV1")
    extract_pos = runtime.index("pdfUtilityPageExtractScriptV1")
    assert local_pos < extract_pos
    assert "/js/pdf-utility/page-extract.js?v=20260904-1" in runtime
    assert "canonical-preflight-runtime-v1" in runtime


def test_page_extract_server_route_is_bounded_and_storage_scoped():
    source = BACKEND.read_text(encoding="utf-8")
    assert '@pdf_utility_bp.route("/extract-storage", methods=["POST"])' in source
    assert "_validate_storage_path(uid, raw_path)" in source
    assert "_extract_pdf_path" in source
    assert "MAX_TOTAL_PAGES" in source
    assert 'response.headers["X-PDF-Page-Count"]' in source
