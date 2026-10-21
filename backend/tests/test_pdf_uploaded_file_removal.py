import subprocess
from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]
SCRIPT = ROOT / "js" / "pdf-editor" / "file-removal.js"
NAV = ROOT / "js" / "pdf-editor" / "file-navigation.js"
ROUTE = ROOT / "js" / "pdf-editor" / "route-runtime.js"
BEHAVIOR = ROOT / "backend" / "tests" / "test_pdf_uploaded_file_removal_behavior.cjs"


def test_pdf_layout_file_removal_is_loaded_once_outside_advanced_profile():
    route = ROUTE.read_text(encoding="utf-8")
    assert route.count("pdfUploadedFileRemovalScriptV1") == 2  # manifest and advanced skip
    assert route.count("/js/pdf-editor/file-removal.js") == 1
    assert "pdfUploadedFileRemovalScriptV1" in route.split("ADVANCED_UNUSED_ROUTE_IDS", 1)[1]


def test_pdf_layout_has_a_delete_action_for_each_uploaded_file_header():
    navigation = NAV.read_text(encoding="utf-8")
    for marker in (
        ".pdf-file-delete-btn",
        "remove.textContent = '파일 삭제'",
        "window.PdfUploadedFileRemoval?.removeFile(group.fileIndex)",
        "document.addEventListener('pdf-file-removed'",
        "collapsed.clear()",
        "selectedId = ''",
    ):
        assert marker in navigation


def test_pdf_layout_deletion_removes_source_pages_and_compacts_indices():
    source = SCRIPT.read_text(encoding="utf-8")
    for marker in (
        "window.confirm(",
        "page.pageType !== 'pdf'",
        "uploadedFiles.splice(index, 1)",
        "parsedPages = remainingPages",
        "page.file_index = oldIndex - 1",
        "fileNupMap = remapNupOverrides(fileNupMap, index)",
        "window.PdfEditorPageSelection?.clearSelection?.()",
        "window.PdfUploadOptimization?.syncAggregateMode?.()",
        "schedulePreview(0)",
        "setEmptyPreview()",
        "new CustomEvent('pdf-file-removed'",
    ):
        assert marker in source


def test_pdf_layout_file_deletion_behavior_executes():
    result = subprocess.run(
        ["node", str(BEHAVIOR)],
        cwd=ROOT,
        text=True,
        capture_output=True,
        check=False,
    )
    assert result.returncode == 0, result.stderr or result.stdout
    assert "pdf uploaded source removal behavior passed" in result.stdout
