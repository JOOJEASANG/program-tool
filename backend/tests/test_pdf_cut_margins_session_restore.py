"""Editor-session restore and per-cut-sheet canvas parity regression coverage."""
from pathlib import Path
import subprocess

ROOT = Path(__file__).resolve().parents[2]


def test_saved_mixed_sources_restore_without_losing_previous_work():
    result = subprocess.run(
        ["node", str(ROOT / "backend/tests/test_pdf_session_restore_behavior.cjs")],
        cwd=ROOT,
        capture_output=True,
        text=True,
        check=False,
        timeout=30,
    )
    assert result.returncode == 0, result.stderr or result.stdout
    assert "pdf session mixed file save-load recovery passed" in result.stdout


def test_saved_session_uses_original_filenames_and_low_memory_pdf_loading():
    editor = (ROOT / "pdf-editor/index.html").read_text(encoding="utf-8")
    optimize = (ROOT / "js/pdf-editor/upload-fix.js").read_text(encoding="utf-8")
    for marker in (
        "fileNames: uploadedFiles.map(file => file.name)",
        "state.fileNames?.[i]",
        "makeLightweightPdfPage(pi, total)",
        "makePagePlaceholder(pi, total, 0)",
        "restoredPageCount + total >= 120",
        "previewCanvases = prevPreviewCanvases",
        "복원할 편집 페이지가 없습니다.",
        "편집 불러오기 실패:",
        "restoreButtons.forEach(button => { button.disabled = false; });",
    ):
        assert marker in editor
    assert "makeLightweightPdfPage" in optimize


def test_repeat_cut_margin_geometry_is_shared_by_preview_and_export():
    preview = (ROOT / "js/pdf-editor/layout-export.js").read_text(encoding="utf-8")
    editor = (ROOT / "pdf-editor/index.html").read_text(encoding="utf-8")
    backend = (ROOT / "backend/services/pdf_engine.py").read_text(encoding="utf-8")
    for marker in (
        "const cutWidth = pw / cols",
        "const cutHeight = ph / rows",
        "repeated ? 0 : gp",
        "cutWidth - margins.left - margins.right",
        "cutHeight - margins.top - margins.bottom",
        "context.drawImage(overlay, cutX * mm2px, cutY * mm2px,",
    ):
        assert marker in preview
    for marker in (
        "const cutW = pw / cols;",
        "const cutH = ph / rows;",
        "const cellW = repeated ? cutW - 2 * mh",
        "ctx.drawImage(overlay, cutX * mm2px, cutY * mm2px",
    ):
        assert marker in editor
    for marker in ("cut_rects:", "repeat_cell_overlays: bool = False", "cut_w = paper_w_pt / cols",
                   "cut_h = paper_h_pt / rows", "target = layout.cut_rects[slot_idx]"):
        assert marker in backend
