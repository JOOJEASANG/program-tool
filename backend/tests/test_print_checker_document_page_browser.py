from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]
INLINE = ROOT / "js" / "pdf-editor-advanced" / "workspace-inline-review-v4.js"
LOADER = ROOT / "js" / "pdf-editor-advanced" / "facing-upload.js"


def test_document_review_has_right_side_full_page_browser():
    source = INLINE.read_text(encoding="utf-8")
    loader = LOADER.read_text(encoding="utf-8")

    for marker in (
        "advanced-page-sidebar",
        "페이지 선택",
        "page-sidebar-thumb",
        "renderThumbnail",
        "IntersectionObserver",
        "scrollIntoView",
    ):
        assert marker in source

    assert "grid-template-columns:340px minmax(0,1fr) 238px" in source
    assert "import './workspace-inline-review-v4.js';" in loader
    assert "import './print-review.js';" not in loader


def test_document_preview_shows_actual_and_trim_size_inline():
    source = INLINE.read_text(encoding="utf-8")

    for marker in (
        "advanced-size-inspector",
        "파일 실제",
        "재단사이즈",
        "advancedActualGuide",
        "advancedTrimGuide",
        "detectTrim",
        "재단여유 사방",
    ):
        assert marker in source


def test_document_review_keeps_trim_size_validation_in_editor():
    source = INLINE.read_text(encoding="utf-8")

    for marker in (
        "STANDARD_TRIMS",
        "A5",
        "B5",
        "A4",
        "B4",
        "A3",
        "재단사이즈가 파일보다 큽니다",
        "advancedTrimWidth",
        "advancedTrimHeight",
    ):
        assert marker in source
