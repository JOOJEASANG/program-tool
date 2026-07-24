from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]
LOADER = ROOT / "js" / "pdf-editor" / "loader.js"
BOOKLET = ROOT / "js" / "pdf-editor" / "booklet-reliability.js"


def test_booklet_reliability_module_is_loaded():
    loader = LOADER.read_text(encoding="utf-8")
    assert "/js/pdf-editor/booklet-reliability.js" in loader
    assert loader.rfind("booklet-reliability.js") > loader.rfind("page-selection-preview-focus.js")


def test_booklet_option_is_visible_for_supported_default_nup():
    text = BOOKLET.read_text(encoding="utf-8")
    assert "new Set([2, 4, 6, 8])" in text
    assert "row.style.display = supported ? '' : 'none'" in text
    assert "syncBookletUi();" in text


def test_booklet_preview_uses_uniform_global_groups():
    text = BOOKLET.read_text(encoding="utf-8")
    assert "uniformBookletGroups" in text
    assert "pages.slice(index, index + size)" in text
    assert "bookletEnabled()" in text
    assert "return uniformBookletGroups(pages || [], size)" in text


def test_booklet_temporarily_disables_conflicting_file_nup_controls():
    text = BOOKLET.read_text(encoding="utf-8")
    assert ".file-nup-select-v5" in text
    assert "select.disabled = true" in text
    assert "페이지별·파일별 N-up과 비연속 구분을 잠시 무시" in text


def test_booklet_module_has_no_eval_or_unbounded_polling():
    text = BOOKLET.read_text(encoding="utf-8")
    assert "eval(" not in text
    assert "setInterval(" not in text
