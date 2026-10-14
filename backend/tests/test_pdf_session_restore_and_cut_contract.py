"""Regression checks for saved PDF editor session loading and repeat cut-region layout."""
from pathlib import Path
import subprocess

ROOT = Path(__file__).resolve().parents[2]
EDITOR = ROOT / "pdf-editor/index.html"
ENGINE = ROOT / "backend/services/pdf_engine.py"
LAYOUT = ROOT / "js/pdf-editor/layout-export.js"
NODE = ROOT / "backend/tests/test_pdf_session_restore_behavior.cjs"


def test_editor_restores_sessions_without_resurrecting_deleted_pages():
    source = EDITOR.read_text(encoding="utf-8")
    for marker in (
        "fileNames: uploadedFiles.map(file => file.name)",
        "if (!savedPages.length)",
        "const p = { ...source, id: usedKeys.has(key) ? makeId() : source.id }",
        "const prevParsedPages = parsedPages",
        "parsedPages = prevParsedPages",
        "if (lightweight) await pdfDoc.destroy?.()",
        "restoreStatus.textContent = '편집 불러오기 실패:",
        "return false;",
    ):
        assert marker in source


def test_session_loader_node_behavior():
    result = subprocess.run(
        ["node", str(NODE)],
        cwd=ROOT, capture_output=True, text=True, check=False, timeout=30
    )
    assert result.returncode == 0, result.stderr or result.stdout
    assert "pdf session restore behavior passed" in result.stdout


def test_repeat_cut_geometry_is_identical_in_browser_and_backend():
    browser = LAYOUT.read_text(encoding="utf-8")
    backend = ENGINE.read_text(encoding="utf-8")
    for marker in (
        "const cutWidth = pw / cols",
        "const cutHeight = ph / rows",
        "margins.left + (repeated ? cutX",
        "margins.top + (repeated ? cutY",
        "context.drawImage(overlay, cutX * mm2px, cutY * mm2px",
    ):
        assert marker in browser
    for marker in (
        "cut_w = paper_w_pt / cols",
        "cut_h = paper_h_pt / rows",
        "cells.append(fitz.Rect(x + left, y + top, x + cut_w - right, y + cut_h - bottom))",
        "target = layout.cut_rects[slot_idx] if layout.cut_rects else layout.cell_rects[slot_idx]",
    ):
        assert marker in backend
