from pathlib import Path

BACKEND = Path(__file__).resolve().parents[1]


def test_legacy_process_pdf_monkeypatch_is_removed():
    services_init = (BACKEND / "services/__init__.py").read_text(encoding="utf-8")
    main = (BACKEND / "main.py").read_text(encoding="utf-8")

    assert "install_common_engine_entrypoint" not in services_init
    assert "pdf_ops.process_pdf" not in services_init
    assert "install_common_engine_entrypoint" not in main


def test_pdf_router_imports_explicit_engine():
    router = (BACKEND / "routers/pdf.py").read_text(encoding="utf-8")

    assert "from services.pdf_engine import process_pdf_bytes" in router
    assert "output_bytes = process_pdf_bytes(file_bytes_list, req)" in router
