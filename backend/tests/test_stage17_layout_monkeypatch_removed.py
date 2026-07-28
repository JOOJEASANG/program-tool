from pathlib import Path

import pytest

from services import pdf_ops

BACKEND = Path(__file__).resolve().parents[1]


def test_legacy_layout_implementation_is_removed():
    assert not (BACKEND / "services/pdf_layout_implementation.py").exists()


def test_services_package_has_no_legacy_layout_module_alias():
    source = (BACKEND / "services/__init__.py").read_text(encoding="utf-8")
    assert "pdf_individual_margin_patch" not in source
    assert "sys.modules" not in source


def test_removed_layout_implementation_cannot_create_process_entrypoint():
    assert not hasattr(pdf_ops, "process_pdf")
    with pytest.raises(ImportError):
        from services import pdf_layout_implementation  # noqa: F401
    assert not hasattr(pdf_ops, "process_pdf")
