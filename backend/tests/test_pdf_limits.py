from routers import pdf as pdf_router


def test_pdf_total_limit_is_bounded_below_function_memory():
    assert pdf_router.MAX_TOTAL_PDF_BYTES == 300 * 1024 * 1024
    assert pdf_router.MAX_TOTAL_PDF_BYTES > pdf_router.MAX_PDF_FILE_BYTES
