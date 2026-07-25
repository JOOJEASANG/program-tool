from pathlib import Path


def test_legacy_individual_margin_patch_file_is_removed():
    assert not Path("services/pdf_individual_margin_patch.py").exists()


def test_layout_engine_uses_neutral_implementation_module():
    source = Path("services/pdf_layout_engine.py").read_text(encoding="utf-8")
    assert "pdf_layout_implementation" in source
    assert "pdf_individual_margin_patch" not in source


def test_startup_does_not_reference_legacy_layout_patch():
    source = Path("main.py").read_text(encoding="utf-8")
    assert "pdf_individual_margin_patch" not in source
