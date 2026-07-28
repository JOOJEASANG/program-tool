from pathlib import Path

BACKEND = Path(__file__).resolve().parents[1]


def test_startup_no_longer_imports_individual_margin_patch():
    main = (BACKEND / "main.py").read_text(encoding="utf-8")
    assert "from services import pdf_individual_margin_patch" not in main


def test_startup_no_longer_reinstalls_pdf_entrypoint():
    main = (BACKEND / "main.py").read_text(encoding="utf-8")
    services_init = (BACKEND / "services/__init__.py").read_text(encoding="utf-8")

    assert "install_common_engine_entrypoint" not in main
    assert "install_common_engine_entrypoint" not in services_init
    assert "pdf_ops.process_pdf" not in services_init


def test_pdf_engine_is_the_single_layout_implementation():
    pdf_engine = (BACKEND / "services/pdf_engine.py").read_text(encoding="utf-8")

    assert "def process_pdf_bytes(" in pdf_engine
    assert "def _resolve_layout_margins(" in pdf_engine
    assert "def _booklet_layout(" in pdf_engine
    assert not (BACKEND / "services/pdf_layout_engine.py").exists()
    assert not (BACKEND / "services/pdf_layout_implementation.py").exists()
