from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]


def test_pdf_merge_reorder_smoke_is_wired_into_pdf_shell_runner():
    runner = (ROOT / "scripts/run_pdf_program_shell_smoke.sh").read_text(encoding="utf-8")
    smoke = (ROOT / "tests/browser/pdf-merge-reorder-smoke.html").read_text(encoding="utf-8")

    assert 'pdf-merge-reorder-smoke.html' in runner
    assert 'PASS: PDF merge files reorder by buttons and mouse drag' in runner
    assert 'data-pdf-merge-reorder-smoke="pass"' in runner
    assert "pdfucMergeOrder!=='drag-buttons-v1'" in smoke
    assert "data-pdfuc-move=\"1\"" in smoke
    assert "new DragEvent('dragstart'" in smoke
    assert "new DragEvent('drop'" in smoke
    assert "third.pdf" in smoke
