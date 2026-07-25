from pathlib import Path

from services import pdf_ops


def test_layout_implementation_contains_no_monkeypatch_state():
    source = Path("services/pdf_layout_implementation.py").read_text(encoding="utf-8")
    assert "pdf_ops.process_pdf =" not in source
    assert "_individual_margin_patch_v" not in source
    assert "pdf_ops._group_booklet_pages =" not in source
    assert "pdf_ops._booklet_layout =" not in source


def test_services_package_has_no_legacy_layout_module_alias():
    source = Path("services/__init__.py").read_text(encoding="utf-8")
    assert "pdf_individual_margin_patch" not in source
    assert "sys.modules" not in source


def test_importing_layout_implementation_does_not_replace_process_entrypoint():
    before = pdf_ops.process_pdf
    from services import pdf_layout_implementation  # noqa: F401

    assert pdf_ops.process_pdf is before
