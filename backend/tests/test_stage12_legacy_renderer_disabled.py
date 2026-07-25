from models.schemas import PdfProcessRequest
from services import install_common_engine_entrypoint, pdf_ops
from services import pdf_layout_engine


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

    monkeypatch.setattr(pdf_layout_engine, "process_pdf_bytes", fake_process_pdf_bytes)

    install_common_engine_entrypoint()
    result = pdf_ops.process_pdf([b"source"], request)

    assert result == expected
    assert calls == [([b"source"], request)]
    assert pdf_ops.process_pdf.__module__ == "services"
