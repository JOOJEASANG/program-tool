from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]
MODULE = ROOT / "js" / "pdf-editor" / "file-context-scope.js"
REGISTER = ROOT / "js" / "sw-register.js"
EDITOR = ROOT / "pdf-editor" / "index.html"


def test_discontinuous_file_is_identified_by_group_break_and_file_index():
    source = MODULE.read_text(encoding="utf-8")
    for marker in (
        "normalizedFileIndex(page)",
        "candidate?.groupBreak === true",
        "breaks.has(fileIndex)",
        "normalizedFileIndex(candidate) === fileIndex",
        "mode: 'file'",
        "pages: filePages",
    ):
        assert marker in source


def test_continuous_files_keep_the_existing_document_wide_actions():
    source = MODULE.read_text(encoding="utf-8")
    assert "if (!discontinuous || filePages.length === 0)" in source
    assert "mode: 'document'" in source
    assert "const result = original.call(this, event, page, index)" in source
    assert "rewriteBulkRotationItems(currentScope(page))" in source
    assert source.index("original.call(this, event, page, index)") < source.index(
        "rewriteBulkRotationItems(currentScope(page))"
    )


def test_file_scoped_rotation_only_uses_the_resolved_source_file_pages():
    source = MODULE.read_text(encoding="utf-8")
    assert "const targets = [...scope.pages]" in source
    assert "scope.mode !== 'file'" in source
    assert "page.rotation = ((page.rotation || 0) + degrees + 360) % 360" in source
    assert "page.thumbCanvas = await renderPdfPage(page.pdfPage, 0.9, page.rotation)" in source
    assert "parsedPages.filter(p => p.pageType === 'pdf'" not in source


def test_context_menu_explains_and_replaces_the_three_bulk_rotation_items():
    source = MODULE.read_text(encoding="utf-8")
    for marker in (
        "비연속 추가 파일 · ${scope.label} · ${scope.pages.length}p",
        "이 파일 전체 시계방향 90° 회전",
        "이 파일 전체 시계반대방향 90° 회전",
        "이 파일 전체 180° 회전",
        "menu.querySelectorAll('.ctx-item.all-rotate')",
        "oldItem.replaceWith(scopedItem",
        "iconElement.textContent = icon",
        "document.createTextNode(label)",
    ):
        assert marker in source
    assert "element.innerHTML" not in source


def test_break_scope_is_recorded_on_thumb_render_and_survives_first_page_deletion():
    source = MODULE.read_text(encoding="utf-8")
    assert "const breakFileIndices = new Set()" in source
    assert "if (pageCollectionRef !== parsedPages)" in source
    assert "breakFileIndices.clear()" in source
    assert "breakFileIndices.add(fileIndex)" in source
    assert "breakObserver = new MutationObserver(syncBreakFileIndices)" in source
    assert "breakObserver.observe(thumbArea, { childList: true, subtree: true })" in source
    assert "installBreakObserver()" in source
    assert source.index("installBreakObserver()") < source.index("const original = window._openThumbCtxMenu")
    assert "resolveScopeFor(page, parsedPages, breakFileIndices)" in source


def test_file_context_runtime_loads_once_after_session_save_safety():
    register = REGISTER.read_text(encoding="utf-8")
    session = "/js/pdf-editor/session-save-safety.js?v=20260805-2"
    context = "/js/pdf-editor/file-context-scope.js?v=20260805-1"
    assert register.count("pdfFileContextScopeScript") == 1
    assert register.count(context) == 1
    assert register.index(session) < register.index(context)


def test_existing_editor_contract_contains_document_wide_rotation_and_break_metadata():
    editor = EDITOR.read_text(encoding="utf-8")
    assert "const groupBreak = !isNew && isBreak && i === 1" in editor
    assert "async function rotateAllAndRefresh(deg)" in editor
    assert "전체 시계방향 90° 회전" in editor


def test_context_scope_wrapper_is_bounded_and_does_not_poll_forever():
    source = MODULE.read_text(encoding="utf-8")
    assert "MAX_INSTALL_ATTEMPTS = 40" in source
    assert "setTimeout(install, 100 + installAttempts * 25)" in source
    assert "setInterval(" not in source
    assert "eval(" not in source
    assert "stage: 'discontinuous-file-context-actions'" in source
