"""The PDF layout download path avoids repeated uploads while preserving other tools."""
from pathlib import Path
import subprocess

ROOT = Path(__file__).resolve().parents[2]
NODE_TEST = ROOT / "backend/tests/test_pdf_export_source_reuse_behavior.cjs"


def test_editor_reuses_unchanged_sources_across_multiple_result_downloads():
    result = subprocess.run(
        ["node", str(NODE_TEST)],
        cwd=ROOT,
        capture_output=True,
        text=True,
        timeout=30,
        check=False,
    )
    assert result.returncode == 0, result.stderr or result.stdout
    assert "pdf editor repeated export input reuse and legacy one-shot cleanup passed" in result.stdout


def test_result_download_uses_opt_in_without_changing_other_programs():
    editor = (ROOT / "pdf-editor/index.html").read_text(encoding="utf-8")
    api = (ROOT / "js/api.js").read_text(encoding="utf-8")
    server = (ROOT / "backend/routers/pdf.py").read_text(encoding="utf-8")
    assert "reuseSources: true" in editor
    assert "const reuseSources = preparedOptions.reuseSources === true" in api
    assert "retain_temp_sources: true" in api
    assert "source_session_doc: saved?.docId" in api
    assert "if not retain_temp_sources:" in server
    assert "_cleanup_storage_paths(bucket, temporary_paths)" in server
    assert "_is_saved_source_path" in server
