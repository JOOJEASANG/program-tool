from pathlib import Path


def test_startup_no_longer_imports_individual_margin_patch():
    main = Path("main.py").read_text(encoding="utf-8")
    assert "from services import pdf_individual_margin_patch" not in main


def test_startup_no_longer_reinstalls_pdf_entrypoint():
    main = Path("main.py").read_text(encoding="utf-8")
    services_init = Path("services/__init__.py").read_text(encoding="utf-8")

    assert "install_common_engine_entrypoint" not in main
    assert "install_common_engine_entrypoint" not in services_init
    assert "pdf_ops.process_pdf" not in services_init


def test_explicit_layout_engine_is_used_by_pdf_engine():
    pdf_engine = Path("services/pdf_engine.py").read_text(encoding="utf-8")
    layout_engine = Path("services/pdf_layout_engine.py").read_text(encoding="utf-8")

    assert "def process_pdf_bytes(" in pdf_engine
    assert "process_pdf_with_individual_margins" in layout_engine
