from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]


def test_actual_trim_is_screen_only_and_follows_rendered_placement():
    html = (ROOT / "pdf-editor/index.html").read_text(encoding="utf-8")
    layout = (ROOT / "js/pdf-editor/layout-export.js").read_text(encoding="utf-8")
    marks = (ROOT / "js/pdf-editor/crop-marks.js").read_text(encoding="utf-8")
    assert 'id="actualTrimGuidesToggle"' in html
    assert "recordActualTrimRect(ctx, dx-artworkShiftPx, dy, dw, dh" in html
    assert "appendActualTrimGuides(wrap,canvas)" in html
    assert "null, insideShiftPx);" in layout
    assert "x:rect.x+outer,y:rect.y+outer" in marks
    assert "html.pdf-actual-trim-hidden" in html
    assert "w-=bleed; h-=2*bleed" in html


def test_boot_accepts_single_canonical_layout_mode():
    guard = (ROOT / "js/app-boot-guard.js").read_text(encoding="utf-8")
    assert "window.PdfLayoutBookletTabs && root.classList.contains('pdf-booklet-dual-mode')" in guard
