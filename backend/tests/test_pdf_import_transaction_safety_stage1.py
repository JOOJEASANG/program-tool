import subprocess
from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]
SAFETY = ROOT / "js" / "pdf-editor" / "import-transaction-safety.js"
REGISTER = ROOT / "js" / "sw-register.js"
BEHAVIOR = ROOT / "backend" / "tests" / "test_pdf_import_transaction_safety_behavior.cjs"


def test_pdf_import_transaction_module_is_single_loaded_after_existing_file_scope():
    source = REGISTER.read_text(encoding="utf-8")
    file_scope = source.index("/js/pdf-editor/file-context-scope.js")
    transaction = source.index("/js/pdf-editor/import-transaction-safety.js")
    assert file_scope < transaction
    assert source.count("pdfImportTransactionSafetyScriptV1") == 1
    assert source.count("/js/pdf-editor/import-transaction-safety.js") == 1


def test_pdf_import_stages_every_page_before_mutating_editor_arrays():
    source = SAFETY.read_text(encoding="utf-8")
    stage_start = source.index("async function stagePdfFile")
    stage_end = source.index("function commitStagedFile", stage_start)
    stage = source[stage_start:stage_end]
    for marker in (
        "const stagedPages = []",
        "pdfjsLib.getDocument({ data: buffer }).promise",
        "for (let pageNumber = 1; pageNumber <= total; pageNumber += 1)",
        "const pdfPage = await pdfDocument.getPage(pageNumber)",
        "const thumbCanvas = await renderPdfPage(pdfPage, 0.9, 0)",
        "stagedPages.push({",
        "file_index: null",
        "return { file, shortName, total, pages: stagedPages",
    ):
        assert marker in stage
    assert "uploadedFiles.push" not in stage
    assert "parsedPages.push" not in stage


def test_pdf_import_commits_once_and_rolls_back_commit_failure():
    source = SAFETY.read_text(encoding="utf-8")
    commit_start = source.index("function commitStagedFile")
    commit_end = source.index("async function transactionalHandleFile", commit_start)
    commit = source[commit_start:commit_end]
    for marker in (
        "const before = captureEditorState()",
        "const fileIndex = isNew ? 0 : uploadedFiles.length",
        "parsedPages = isNew ? committedPages : [...parsedPages, ...committedPages]",
        "uploadedFiles = isNew ? [stage.file] : [...uploadedFiles, stage.file]",
        "previewCanvases = []",
        "fileNupMap = {}",
        "renderThumbs()",
        "restoreEditorState(before)",
    ):
        assert marker in commit


def test_pdf_import_failure_restores_id_and_releases_staged_canvases():
    source = SAFETY.read_text(encoding="utf-8")
    for marker in (
        "const startId = _nextId",
        "_nextId = startId",
        "releaseStagedPages(stagedPages)",
        "await pdfDocument?.destroy?.()",
        "기존 작업은 그대로 유지됩니다.",
        "pdf-import-failed",
        "() => window.handleFile(file)",
    ):
        assert marker in source


def test_pdf_import_uses_safe_status_text_and_serializes_overlapping_imports():
    source = SAFETY.read_text(encoding="utf-8")
    for marker in (
        "text.textContent =",
        "bar.replaceChildren()",
        "importQueue = importQueue",
        ".catch(() => false)",
        ".then(() => transactionalHandleFile(file, requestedMode))",
        "input.disabled = Boolean(value)",
        "stage: 'stage-all-pages-atomic-commit-rollback'",
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
