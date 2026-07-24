from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]
LOADER = ROOT / "js" / "pdf-editor" / "loader.js"
GUIDE = ROOT / "js" / "pdf-editor" / "booklet-print-guide.js"


def test_booklet_print_guide_loads_after_operation_summary():
    loader = LOADER.read_text(encoding="utf-8")
    assert "/js/pdf-editor/booklet-print-guide.js" in loader
    assert loader.rfind("booklet-print-guide.js") > loader.rfind("operation-progress-summary.js")
    assert loader.rfind("booklet-print-guide.js") < loader.rfind("dock-width-align.js")


def test_duplex_flip_guide_has_long_and_short_edge_options():
    text = GUIDE.read_text(encoding="utf-8")
    assert "짧은쪽 넘김" in text
    assert "긴쪽 넘김" in text
    assert "paperIsLandscape() ? 'short' : 'long'" in text
    assert "첫 용지 한 장" in text
    assert "실제 크기 또는 100%" in text


def test_preview_labels_include_sheet_side_and_source_pages():
    text = GUIDE.read_text(encoding="utf-8")
    assert "booklet-output-label" in text
    assert "Math.floor(index / 2) + 1" in text
    assert "index % 2 === 0 ? '앞면' : '뒷면'" in text
    assert "원본 ${sourceText}" in text
    assert "pageTitle" in text


def test_print_guide_counts_output_faces_and_physical_sheets():
    text = GUIDE.read_text(encoding="utf-8")
    assert "outputPageGroups" in text
    assert "Math.ceil(outputs / 2)" in text
    assert "${outputs}면 · 용지 ${sheets}장" in text


def test_booklet_flip_is_preserved_in_saved_editor_sessions():
    text = GUIDE.read_text(encoding="utf-8")
    assert "state.bookletFlip" in text
    assert "loadStateWithBookletPrintGuide" in text
    assert "localStorage.setItem(STORAGE_KEY" in text


def test_booklet_guide_has_no_eval_or_unbounded_polling():
    text = GUIDE.read_text(encoding="utf-8")
    assert "eval(" not in text
    assert "setInterval(" not in text
