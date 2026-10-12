from pathlib import Path


def test_historical_print_checker_audit_document_stays_removed():
    root = Path(__file__).resolve().parents[2]
    assert not (root / "docs" / "print-checker-current-audit.md").exists()
