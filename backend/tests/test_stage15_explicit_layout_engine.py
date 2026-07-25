from pathlib import Path

from models.schemas import PdfProcessRequest
from services import install_common_engine_entrypoint, pdf_ops


def test_startup_no_longer_imports_individual_margin_patch():
    main = Path("main.py").read_text(encoding="utf-8")
    assert "from services import pdf_individual_margin_patch" not in main


def test_compatibility_entrypoint_uses_explicit_layout_engine(monkeypatch):
    import services.pdf_layout_engine as layout_engine

    request = PdfProcessRequest.model_validate(
        {"pages": [{"file_index": 0, "page_index": 0, "page_type": "normal"}]}
    )
    calls = []

    def fake_process(file_bytes_list, received_request):
        calls.append((file_bytes_list, received_request))
        return b"LAYOUT-ENGINE"

    monkeypatch.setattr(layout_engine, "process_pdf_bytes", fake_process)
    install_common_engine_entrypoint()

    assert pdf_ops.process_pdf([b"source"], request) == b"LAYOUT-ENGINE"
    assert calls == [([b"source"], request)]
