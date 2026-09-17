from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]
MAIN_FILE = ROOT / "backend" / "main.py"


def _main_source() -> str:
    return MAIN_FILE.read_text(encoding="utf-8")


def test_print_checker_sessions_are_in_server_reconciliation():
    source = _main_source()

    assert "PRINT_CHECKER_SESSION_SOURCE_PATTERN = re.compile(" in source
    assert '"print_checker_sessions",' in source
    assert 'if collection_id == "print_checker_sessions":' in source
    assert 'expected_prefix = f"print_checker_sessions/{uid}/{session_id}/"' in source
    assert "source_pattern = PRINT_CHECKER_SESSION_SOURCE_PATTERN" in source

    assert "print_checker_session_paths = _trim_firestore_group(" in source
    assert '        "print_checker_sessions",' in source
    assert (
        '_delete_old_orphans(bucket, "print_checker_sessions/", '
        "print_checker_session_paths, cutoff)"
    ) in source


def test_print_checker_cleanup_does_not_reuse_pdf_session_source_pattern():
    source = _main_source()
    branch_start = source.index('if collection_id == "print_checker_sessions":')
    branch_end = source.index("safe_paths: list[str] = []", branch_start)
    branch = source[branch_start:branch_end]

    assert 'expected_prefix = f"print_checker_sessions/{uid}/{session_id}/"' in branch
    assert "source_pattern = PRINT_CHECKER_SESSION_SOURCE_PATTERN" in branch
    assert "source_pattern = PDF_SESSION_SOURCE_PATTERN" in branch
