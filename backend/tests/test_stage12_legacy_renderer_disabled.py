from models.schemas import PdfProcessRequest
from services import pdf_engine, pdf_ops


def test_legacy_process_pdf_delegates_to_common_engine(monkeypatch):
    request = PdfProcessRequest.model_validate(
        {
            "pages": [
                {"file_index": 0, "page_index": 0, "page_type": "normal"}
            ]
        }
    )
    expected = b"COMMON-ENGINE"
    calls = []

    def fake_process_pdf_bytes(file_bytes_list, received_request):
        calls.append((file_bytes_list, received_request))
        return expected

    monkeypatch.setattr(pdf_engine, "process_pdf_bytes", fake_process_pdf_bytes)

    result = pdf_ops.process_pdf([b"source"], request)

    assert result == expected
    assert calls == [([b"source"], request)]
    assert pdf_ops.process_pdf.__module__ == "services"
