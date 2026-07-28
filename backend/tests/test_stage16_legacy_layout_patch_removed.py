from pathlib import Path

BACKEND = Path(__file__).resolve().parents[1]


def test_legacy_individual_margin_patch_file_is_removed():
    assert not (BACKEND / "services/pdf_individual_margin_patch.py").exists()


def test_legacy_layout_adapter_files_are_removed():
    assert not (BACKEND / "services/pdf_layout_engine.py").exists()
    assert not (BACKEND / "services/pdf_layout_implementation.py").exists()


def test_startup_does_not_reference_legacy_layout_patch():
    source = (BACKEND / "main.py").read_text(encoding="utf-8")
    assert "pdf_individual_margin_patch" not in source
