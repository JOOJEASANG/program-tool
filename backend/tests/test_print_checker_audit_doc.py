from pathlib import Path


def test_print_checker_audit_document_records_cleanup_boundaries():
    root = Path(__file__).resolve().parents[2]
    source = (root / "docs" / "print-checker-current-audit.md").read_text(encoding="utf-8")
    assert "simple-editor" in source
    assert "1p 앞면 / 2p 뒷면" in source
    assert "실제 위치(mm)" in source
    assert "안전영역 기본 정책은 10mm" in source
