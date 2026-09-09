from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]
DIRECT_EDIT = ROOT / "js" / "pdf-editor" / "direct-page-edit-v2.js"


def _source() -> str:
    return DIRECT_EDIT.read_text(encoding="utf-8")


def test_direct_edit_decorates_selected_page_only():
    source = _source()
    assert "pdfDirectPageEditPerf='selected-page-only-v3'" in source
    assert "document.querySelectorAll('.pdf-nup-adjust-hit').forEach" not in source
    assert "document.querySelector('.pdf-nup-adjust-hit[data-selected=\"true\"]')" in source
    assert "pruneFrames(hit)" in source


def test_direct_edit_does_not_recalculate_on_every_scroll():
    source = _source()
    assert ".addEventListener('scroll',queueDecorate" not in source
    assert "window.addEventListener('resize',queueDecorate" in source


def test_direct_edit_observer_ignores_its_own_frame_mutations():
    source = _source()
    assert "function mutationNeedsDecorate(records)" in source
    assert "classList?.contains('pdf-direct-page-frame')" in source
    assert "attributeFilter:['data-selected']" in source


def test_direct_edit_has_no_permanent_polling_loop():
    source = _source()
    assert "setInterval(" not in source
    assert "const INSTALL_DELAYS=" in source
