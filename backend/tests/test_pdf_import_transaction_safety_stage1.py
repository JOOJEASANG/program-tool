import subprocess
from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]
SAFETY = ROOT / "js" / "pdf-editor" / "import-transaction-safety.js"
REGISTER = ROOT / "js" / "sw-register.js"
UPLOAD_FIX = ROOT / "js" / "pdf-editor" / "upload-fix.js"
BEHAVIOR = ROOT / "backend" / "tests" / "test_pdf_import_transaction_safety_behavior.cjs"


def test_pdf_import_transaction_module_is_single_loaded_after_existing_file_scope():
    source = REGISTER.read_text(encoding="utf-8")
    file_scope = source.index("/js/pdf-editor/file-context-scope.js")
    transaction = source.index("/js/pdf-editor/import-transaction-safety.js")
    assert file_scope < transaction
    assert source.count("pdfImportTransactionSafetyScriptV1") == 1
    assert source.count("/js/pdf-editor/import-transaction-safety.js") == 1


def test_pdf_import_preserves_existing_large_document_thresholds():
    source = SAFETY.read_text(encoding="utf-8")
    upload_source = UPLOAD_FIX.read_text(encoding="utf-8")
    markers = (
        "const RENDER_HEAVY_PAGE_LIMIT = 25",
        "const RENDER_HUGE_PAGE_LIMIT = 80",
        "const EXTREME_PAGE_LIMIT = 300",
        "const RENDER_HEAVY_BYTE_LIMIT = 30 * 1024 * 1024",
        "const RENDER_HUGE_BYTE_LIMIT = 80 * 1024 * 1024",
        "const OPTIMIZED_PAGE_LIMIT = 120",
    )
    for marker in markers:
        assert marker in source
        assert marker in upload_source
    for marker in (
        "thumbScale: huge ? 0.28 : (heavy ? 0.42 : 0.75)",
        "batchYield: huge ? 1 : (heavy ? 2 : 6)",
        "disableAutoFetch: Boolean(heavyMode)",
        "disableWorker: true",
        "page preview failed; using placeholder",
        "optimizationApi()?.makePagePlaceholder",
        "optimizationApi()?.makeLightweightPdfPage",
        "optimizationApi()?.syncAggregateMode?.()",
    ):
        assert marker in source


def test_pdf_import_stages_every_page_without_allocating_global_ids():
    source = SAFETY.read_text(encoding="utf-8")
    stage_start = source.index("async function stagePdfFile")
    stage_end = source.index("function commitStagedFile", stage_start)
    stage = source[stage_start:stage_end]
    for marker in (
        "const stagedPages = []",
        "safePdfGetDocument(buffer, likelyHeavyBySize)",
        "const plan = chooseImportPlan",
        "for (let pageNumber = 1; pageNumber <= total; pageNumber += 1)",
        "const checkedPage = await pdfDocument.getPage(pageNumber)",
        "const thumbCanvas = await safeRenderPdfPage",
        "id: null",
        "file_index: null",
        "return {",
        "plan,",
    ):
        assert marker in stage
    assert "makeId()" not in stage
    assert "_nextId" not in stage
    assert "uploadedFiles.push" not in stage
    assert "parsedPages.push" not in stage


def test_pdf_import_extreme_mode_validates_pages_without_full_canvas_rendering():
    source = SAFETY.read_text(encoding="utf-8")
    stage_start = source.index("async function stagePdfFile")
    stage_end = source.index("function commitStagedFile", stage_start)
    stage = source[stage_start:stage_end]
    extreme_start = stage.index("if (plan.extreme)")
    normal_start = stage.index("} else {", extreme_start)
    extreme = stage[extreme_start:normal_start]
    assert "pdfDocument.getPage(pageNumber)" in extreme
    assert "checkedPage.getViewport({ scale: 1 })" in extreme
    assert "checkedPage.cleanup?.()" in extreme
    assert "makeLightweightPdfPage(pageNumber, total)" in extreme
    assert "makePagePlaceholder(pageNumber, total, 0)" in extreme
    assert "safeRenderPdfPage" not in extreme
    assert "pageNumber % 50 === 0" in extreme


def test_pdf_import_commits_ids_once_and_rolls_back_commit_failure():
    source = SAFETY.read_text(encoding="utf-8")
    commit_start = source.index("function commitStagedFile")
    commit_end = source.index("async function transactionalHandleFile", commit_start)
    commit = source[commit_start:commit_end]
    for marker in (
        "const before = captureEditorState()",
        "id: makeId()",
        "const fileIndex = isNew ? 0 : uploadedFiles.length",
        "parsedPages = isNew ? committedPages : [...parsedPages, ...committedPages]",
        "uploadedFiles = isNew ? [stage.file] : [...uploadedFiles, stage.file]",
        "previewCanvases = []",
        "fileNupMap = {}",
        "renderThumbs()",
        "restoreEditorState(before)",
    ):
        assert marker in commit


def test_pdf_import_rollback_preserves_canvas_nodes_instead_of_serialized_markup():
    source = SAFETY.read_text(encoding="utf-8")
    for marker in (
        "previewNodes: previewScroll ? [...previewScroll.childNodes] : []",
        "previewScroll.replaceChildren(...(snapshot.previewNodes || []))",
        "try { renderThumbs(); } catch (_) {}",
        "restoreUiState(snapshot.ui)",
    ):
        assert marker in source
    capture_start = source.index("function captureUiState")
    capture_end = source.index("function restoreUiState", capture_start)
    restore_start = capture_end
    restore_end = source.index("function captureEditorState", restore_start)
    assert "innerHTML" not in source[capture_start:restore_end]


def test_pdf_import_failure_does_not_rewind_ids_used_during_staging():
    source = SAFETY.read_text(encoding="utf-8")
    assert "const startId = _nextId" not in source
    assert "_nextId = startId" not in source
    assert "before.nextId = stage.startId" not in source
    assert "releaseStagedPages(stagedPages)" in source
    assert "await pdfDocument?.destroy?.()" in source
    assert "기존 작업은 그대로 유지됩니다." in source
    assert "pdf-import-failed" in source


def test_pdf_import_uses_safe_status_and_serializes_overlapping_imports():
    source = SAFETY.read_text(encoding="utf-8")
    for marker in (
        "text.textContent =",
        "bar.replaceChildren()",
        "importQueue = importQueue",
        ".catch(() => false)",
        ".then(() => transactionalHandleFile(file, requestedMode))",
        "input.disabled = Boolean(value)",
        "stage: 'bounded-stage-atomic-commit-node-preserving-rollback'",
    ):
        assert marker in source
    assert "setInterval(" not in source
    assert "eval(" not in source


def test_pdf_import_transaction_behavior_executes():
    result = subprocess.run(
        ["node", str(BEHAVIOR)],
        cwd=ROOT,
        text=True,
        capture_output=True,
        check=False,
    )
    assert result.returncode == 0, result.stderr or result.stdout
    assert "pdf-import-transaction-safety behavior passed" in result.stdout
