from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]
LOADER = ROOT / "js" / "pdf-editor" / "loader.js"
NUP_HELPER = ROOT / "js" / "pdf-editor" / "nup-helper.js"
PREVIEW_ROW = ROOT / "js" / "pdf-editor" / "preview-row-default.js"
EDITOR = ROOT / "pdf-editor" / "index.html"
LEGACY = ROOT / "tools" / "pdf-editor.html"


def source() -> str:
    return NUP_HELPER.read_text(encoding="utf-8")


def test_booklet_guide_is_integrated_without_adding_runtime_modules():
    loader = LOADER.read_text(encoding="utf-8")
    text = source()
    legacy = LEGACY.read_text(encoding="utf-8")
    assert "__pdfEditorNupHelperV8" in text
    assert "/js/pdf-editor/nup-helper.js" in loader
    assert "/js/pdf-editor/booklet-print-guide.js" not in loader
    assert loader.count("'/js/pdf-editor/") == 8
    assert EDITOR.read_text(encoding="utf-8") != legacy
    assert "/pdf-editor/" in legacy
    assert "location.replace" in legacy
    assert "location.search+location.hash" in legacy


def test_duplex_flip_guide_has_long_and_short_edge_options():
    text = source()
    assert "짧은쪽 넘김" in text
    assert "긴쪽 넘김" in text
    assert "paperIsLandscape() ? 'short' : 'long'" in text
    assert "첫 용지 한 장" in text
    assert "실제 크기 또는 100%" in text
    assert "소책자 양면 인쇄 안내" in text


def test_preview_labels_include_sheet_side_and_source_pages():
    text = source()
    assert "pdf-output-source-label" in text
    assert "Math.floor(index / 2) + 1" in text
    assert "index % 2 === 1" in text
    assert "원본 ${sourceText}" in text
    assert "pageDetail" in text
    assert "파일 내 ${Number(page.page_index || 0) + 1}페이지" in text


def test_print_guide_counts_output_faces_and_physical_sheets():
    text = source()
    assert "function outputPageGroups()" in text
    assert "Math.ceil(outputCount / 2)" in text
    assert "${outputCount}면 · 용지 ${physicalSheets}장" in text
    assert "bookletReorderPreview(active, currentNup())" in text
    assert "groupByNup(pages)" in text


def test_booklet_flip_is_preserved_in_browser_and_successful_editor_sessions():
    text = source()
    guard = PREVIEW_ROW.read_text(encoding="utf-8")
    assert "state.bookletFlip" in text
    assert "collectWithBookletGuide" in text
    assert "loadWithBookletGuide" in text
    assert "localStorage.setItem(STORAGE_KEY, value)" in text
    assert "__bookletGuideStateV2" in text
    assert "installBookletSessionResultGuard" in guard
    assert "modalWasOpen && modalStillOpen" in guard
    assert "statusText.includes('불러오기 완료!')" in guard
    assert "if (!sessionApplied)" in guard
    assert "restoreStoredBookletFlip(previousStoredValue)" in guard


def test_preview_annotation_uses_observer_without_render_function_wrapping():
    text = source()
    assert "new MutationObserver" in text
    assert "requestAnimationFrame(annotatePreview)" in text
    assert "previewObserver.disconnect()" in text
    assert "patchDisplayPreview" not in text
    assert "displayPreview =" not in text
    assert "renderThumbs =" not in text


def test_old_click_to_exclude_hint_is_replaced():
    text = source()
    assert "클릭=미리보기 이동" in text
    assert "우클릭=페이지 메뉴" in text


def test_booklet_guide_has_no_eval_or_unbounded_polling():
    text = source()
    guard = PREVIEW_ROW.read_text(encoding="utf-8")
    assert "eval(" not in text
    assert "setInterval(" not in text
    assert "eval(" not in guard
    assert "setInterval(" not in guard
