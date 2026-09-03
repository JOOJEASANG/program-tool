from routers.pdf_utility import _safe_pdf_filename
from routers.preflight import _safe_pdf_name


def test_pdf_utility_result_filename_sanitizes_without_name_error():
    assert _safe_pdf_filename("PDF 합치기 최종본.pdf") == "PDF_.pdf"
    assert _safe_pdf_filename("../../unsafe name") == "unsafe_name.pdf"


def test_preflight_result_filename_sanitizes_without_name_error():
    assert _safe_pdf_name("검수 결과 최종본.pdf", "light") == "document_light.pdf"
    assert _safe_pdf_name("unsafe name.pdf", "repaired") == "unsafe_name_repaired.pdf"
