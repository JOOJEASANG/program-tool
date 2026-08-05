from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]
MODULE = ROOT / "js" / "pdf-editor" / "session-save-safety.js"
REGISTER = ROOT / "js" / "sw-register.js"
EDITOR = ROOT / "pdf-editor" / "index.html"


def test_multi_source_session_snapshot_preserves_file_and_break_mapping():
    source = MODULE.read_text(encoding="utf-8")
    editor = EDITOR.read_text(encoding="utf-8")

    for marker in (
        "const files = [...uploadedFiles]",
        "state = cloneSerializable(collectEditorState())",
        "file_index",
        "page_index",
        "groupBreak",
        "fileCount: files.length",
        "pageCount: state.pages.length",
        "storagePaths: [...storagePaths]",
    ):
        assert marker in source

    for marker in (
        "file_index: p.file_index ?? 0",
        "page_index: p.page_index ?? 0",
        "groupBreak: !!p.groupBreak",
        "const key = `${s.file_index ?? 0}_${s.page_index ?? 0}`",
        "p.groupBreak = !!s.groupBreak",
    ):
        assert marker in editor


def test_session_save_rejects_broken_source_page_links_before_upload():
    source = MODULE.read_text(encoding="utf-8")
    validation_at = source.index("validateSnapshot(files, state);")
    first_upload_at = source.index("await storage.ref(path).put")
    assert validation_at < first_upload_at
    assert "fileIndex >= files.length" in source
    assert "!Number.isInteger(pageIndex) || pageIndex < 0" in source
    assert "저장 전 확인 실패" in source


def test_partial_storage_upload_is_cleaned_when_firestore_save_fails():
    source = MODULE.read_text(encoding="utf-8")
    assert "storagePaths.push(path)" in source
    assert "await storage.ref(path).put" in source
    assert "if (!documentRef) await cleanupUploadedPaths(storagePaths)" in source
    assert "Promise.allSettled(paths.map((path) => deleteStoragePath(path)))" in source
    assert "업로드된 임시 파일 정리를 시도했습니다." in source
    assert source.index("storagePaths.push(path)") < source.index("await storage.ref(path).put")


def test_missing_storage_objects_count_as_successful_cleanup():
    source = MODULE.read_text(encoding="utf-8")
    assert "function isMissingStorageError(error)" in source
    assert "error?.code === 'storage/object-not-found'" in source
    assert "error?.code === 'object-not-found'" in source
    assert "if (isMissingStorageError(error)) return { path, missing: true }" in source
    assert "paths.map((path) => deleteStoragePath(path))" in source


def test_old_sessions_are_trimmed_only_after_new_session_is_committed():
    source = MODULE.read_text(encoding="utf-8")
    add_at = source.index("documentRef = await collection.add")
    trim_at = source.index("await trimOldSessions(collection, documentRef.id)")
    assert add_at < trim_at
    assert "const excess = Math.max(0, snapshot.size - MAX_SESSIONS)" in source
    assert ".filter((document) => document.id !== newDocumentId)" in source
    assert "results.some((result) => result.status === 'rejected')" in source
    assert "keeping session document" in source


def test_editor_mutation_is_locked_while_session_files_upload():
    source = MODULE.read_text(encoding="utf-8")
    for marker in (
        "body.dataset.pdfSessionSaving = 'true'",
        "document.addEventListener('drop', blockMutation, true)",
        "document.addEventListener('keydown', blockMutationKey, true)",
        "document.addEventListener('click', blockPointerMutation, true)",
        "document.addEventListener('contextmenu', blockPointerMutation, true)",
        "document.addEventListener('pointerdown', blockPointerMutation, true)",
        "document.addEventListener('dragstart', blockPointerMutation, true)",
        "#thumbArea",
        "#thumbCtxMenu",
        "element.style.pointerEvents = 'none'",
        "removeMutationBlockers()",
        "unlockEditor()",
    ):
        assert marker in source


def test_thumbnail_and_context_menu_are_explicit_mutation_targets():
    source = MODULE.read_text(encoding="utf-8")
    assert "function isEditorMutationTarget(target)" in source
    assert "'#thumbArea, #thumbCtxMenu, #uploadZone, .mode-btn, '" in source
    assert "if (!active || !isEditorMutationTarget(event.target)) return" in source
    assert "reviewFixes: 'thumbnail-lock-not-found-cleanup'" in source


def test_capture_phase_intercepts_legacy_session_save_handlers_once():
    source = MODULE.read_text(encoding="utf-8")
    assert "button.addEventListener('click', interceptSave, true)" in source
    assert "input.addEventListener('keydown', interceptEnter, true)" in source
    assert "event.stopImmediatePropagation()" in source
    assert "button.dataset.sessionSaveSafetyV1" in source
    assert "MAX_INSTALL_ATTEMPTS = 40" in source
    assert "setInterval(" not in source
    assert "eval(" not in source


def test_session_safety_runtime_is_loaded_after_final_pdf_save_recovery():
    register = REGISTER.read_text(encoding="utf-8")
    recovery = "/js/pdf-editor/save-recovery.js?v=20260803-1"
    session = "/js/pdf-editor/session-save-safety.js?v=20260805-2"
    assert register.count("pdfSessionSaveSafetyScript") == 1
    assert register.count(session) == 1
    assert register.index(recovery) < register.index(session)
