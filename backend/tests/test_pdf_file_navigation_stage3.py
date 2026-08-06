import subprocess
from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]
NAVIGATION = ROOT / "js" / "pdf-editor" / "file-navigation.js"
REGISTER = ROOT / "js" / "sw-register.js"
BEHAVIOR = ROOT / "backend" / "tests" / "test_pdf_file_navigation_behavior.cjs"


def test_pdf_file_navigation_loads_after_lazy_preview_guard_once():
    source = REGISTER.read_text(encoding="utf-8")
    guard = source.index("/js/pdf-editor/viewport-lazy-preview-guard.js")
    navigation = source.index("/js/pdf-editor/file-navigation.js")
    assert guard < navigation
    assert source.count("pdfFileNavigationScriptV1") == 1
    assert source.count("/js/pdf-editor/file-navigation.js") == 1


def test_pdf_file_navigation_groups_by_source_and_shows_ranges():
    source = NAVIGATION.read_text(encoding="utf-8")
    for marker in (
        "function compactRanges(values, maxRanges = 2)",
        "function buildFileGroups(pages = parsedPages, files = uploadedFiles)",
        "group.edited.push(editedIndex + 1)",
        "group.originals.push(Number(page.page_index) + 1)",
        "group.editedRange = compactRanges(group.edited)",
        "group.originalRange = compactRanges(group.originals)",
        "숨김 ${group.excluded}",
        "편집 ${group.editedRange} · 원본 ${group.originalRange}",
    ):
        assert marker in source


def test_pdf_file_navigation_has_compact_accessible_jump_toolbar():
    source = NAVIGATION.read_text(encoding="utf-8")
    for marker in (
        "toolbar.setAttribute('role', 'navigation')",
        "toolbar.setAttribute('aria-label', 'PDF 페이지 빠른 이동')",
        "pdfEditedPageJump",
        "pdfOriginalFileJump",
        "pdfOriginalPageJump",
        "pdfCollapseAllFiles",
        "pdfExpandAllFiles",
        "status.setAttribute('aria-live', 'polite')",
        "if (event.key === 'Enter')",
    ):
        assert marker in source


def test_pdf_file_navigation_collapses_only_matching_file_items():
    source = NAVIGATION.read_text(encoding="utf-8")
    for marker in (
        "const hidden = collapsed.has(keyOf(page.file_index))",
        "item.hidden = hidden",
        "item.dataset.fileCollapsed = hidden ? 'true' : 'false'",
        "header.dataset.collapsed = hidden ? 'true' : 'false'",
        "collapsed.delete(keyOf(page.file_index))",
        "item.hidden = false",
    ):
        assert marker in source


def test_pdf_file_navigation_pauses_observer_while_enhancing_dom():
    source = NAVIGATION.read_text(encoding="utf-8")
    start = source.index("function enhance()")
    end = source.index("function queueEnhance()", start)
    enhance = source[start:end]
    assert "observer?.disconnect?.()" in enhance
    assert "reconnectObserver(area)" in enhance
    assert enhance.index("observer?.disconnect?.()") < enhance.index("installStyles()")
    assert enhance.index("reconnectObserver(area)") > enhance.index("applyCollapsed(groups)")
    assert "new MutationObserver(queueEnhance)" in source
    assert "observer.observe(area, { childList: true, subtree: false })" in source


def test_pdf_file_navigation_uses_existing_preview_paths_without_mutating_pages():
    source = NAVIGATION.read_text(encoding="utf-8")
    for marker in (
        "lazy?.buildOutputDescriptors?.()",
        "lazy?.descriptorIndexForPage?.(page, descriptors)",
        "await lazy.requestRender(outputIndex)",
        "if (typeof triggerPreview === 'function') await triggerPreview()",
        "renderThumbs = wrapped",
        "window.renderThumbs = wrapped",
        "stage: 'file-collapse-edited-original-page-jump'",
    ):
        assert marker in source
    assert "parsedPages =" not in source
    assert "uploadedFiles =" not in source
    assert "downloadBtn.addEventListener" not in source
    assert "setInterval(" not in source
    assert "eval(" not in source


def test_pdf_file_navigation_behavior_executes():
    result = subprocess.run(
        ["node", str(BEHAVIOR)],
        cwd=ROOT,
        text=True,
        capture_output=True,
        check=False,
    )
    assert result.returncode == 0, result.stderr or result.stdout
    assert "pdf-file-navigation behavior passed" in result.stdout
