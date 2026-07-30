from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]
PDF_HTML = ROOT / "pdf-editor" / "index.html"
PDF_LOADER = ROOT / "js" / "pdf-editor" / "loader.js"
PDF_UPLOAD = ROOT / "js" / "pdf-editor" / "upload-fix.js"
COVER_HTML = ROOT / "perfect-binding-cover" / "index.html"
COVER_DOCK = ROOT / "js" / "cover-floating-action-dock.js"
SW_REGISTER = ROOT / "js" / "sw-register.js"


def test_pdf_file_library_is_fully_removed():
    html = PDF_HTML.read_text(encoding="utf-8")
    loader = PDF_LOADER.read_text(encoding="utf-8")
    storage_rules = (ROOT / "storage.rules").read_text(encoding="utf-8")
    firestore_rules = (ROOT / "firestore.rules").read_text(encoding="utf-8")
    for token in ("navHistoryBtn", "fileHistoryModal", "pdf_history", "openFileHistory", "saveToStorage", "내 파일함"):
        assert token not in html
    assert "pdf_history" not in storage_rules
    assert "pdf_history" not in firestore_rules
    assert "history-policy.js" not in loader
    assert "storage-cleanup.js" not in loader
    assert not (ROOT / "js" / "pdf-editor" / "history-policy.js").exists()
    assert not (ROOT / "js" / "pdf-editor" / "storage-cleanup.js").exists()

    for path in ROOT.rglob("*"):
        if not path.is_file() or path.suffix.lower() not in {".html", ".js"}:
            continue
        site_text = path.read_text(encoding="utf-8")
        assert "내 파일함" not in site_text, f"file library wording remains in {path}"
        assert "pdf_history" not in site_text, f"file library code remains in {path}"


def test_pdf_download_remains_local_and_large_preview_is_explained():
    html = PDF_HTML.read_text(encoding="utf-8")
    upload = PDF_UPLOAD.read_text(encoding="utf-8")
    assert "a.download = filename" in html
    assert "showStatus('PDF 저장 완료!'" in html
    assert "대용량 PDF라 자동 미리보기를 줄였습니다" in upload
    assert "EXTREME_PREVIEW_OUTPUT_LIMIT" in upload
    assert "pdf_history" not in html


def test_cover_product_name_is_consistent():
    cover = COVER_HTML.read_text(encoding="utf-8")
    assert "<title>책표지제작 · Program Studio</title>" in cover
    assert '<div class="nav-title">책표지제작</div>' in cover
    binding = "무선" + "제본"
    old_names = (
        binding + " 표지제작기",
        binding + " 표지 제작기",
        binding + "용 표지 제작기",
        binding + " 표지 제작",
    )
    for path in ROOT.rglob("*"):
        if not path.is_file() or path.suffix.lower() not in {".html", ".js", ".json", ".md", ".py", ".yml", ".yaml"}:
            continue
        text = path.read_text(encoding="utf-8")
        for name in old_names:
            assert name not in text, f"old product name remains in {path}: {name}"


def test_cover_uses_pdf_style_floating_action_dock():
    dock = COVER_DOCK.read_text(encoding="utf-8")
    register = SW_REGISTER.read_text(encoding="utf-8")
    assert "cover-floating-dock" in dock
    assert "position:fixed!important" in dock
    assert "sidebar.clientWidth - paddingLeft - paddingRight" in dock
    assert "작업 메뉴" in dock
    assert "화면 고정" in dock
    assert "cover-floating-action-dock.js" in register
