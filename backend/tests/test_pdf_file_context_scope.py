from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]
MODULE = ROOT / "js" / "pdf-editor" / "file-context-scope.js"
REGISTER = ROOT / "js" / "sw-register.js"


def test_file_context_helper_is_single_loaded_on_pdf_editor_route():
    register = REGISTER.read_text(encoding="utf-8")
    assert register.count("pdfFileContextScopeScript") == 1
    assert register.count("/js/pdf-editor/file-context-scope.js") == 1


def test_bulk_rotation_targets_only_the_clicked_source_file():
    source = MODULE.read_text(encoding="utf-8")
    assert "candidate.file_index === page.file_index" in source
    assert "sameFile(candidate, page)" in source
    assert "filePdfPages(page)" in source
    assert "parsedPages.filter(candidate =>" in source
    assert "parsedPages.filter(p => p.pageType === 'pdf'" not in source


def test_context_labels_no_longer_claim_document_wide_rotation():
    source = MODULE.read_text(encoding="utf-8")
    assert "이 파일 전체 시계방향 90° 회전" in source
    assert "이 파일 전체 시계반대방향 90° 회전" in source
    assert "이 파일 전체 180° 회전" in source
    assert "파일에만 회전을 적용했습니다." in source


def test_non_file_pages_cannot_trigger_document_wide_bulk_rotation():
    source = MODULE.read_text(encoding="utf-8")
    assert "if (!hasFileScope(page))" in source
    assert "items.forEach(item => item.remove())" in source


def test_helper_keeps_runtime_patch_bounded():
    source = MODULE.read_text(encoding="utf-8")
    assert "MAX_INSTALL_ATTEMPTS = 20" in source
    assert "__fileContextScopePatchedV1" in source
    assert "setInterval" not in source
    assert "eval(" not in source
