from __future__ import annotations

from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]


def read(relative: str) -> str:
    return (ROOT / relative).read_text(encoding="utf-8")


def test_pdf_advanced_uses_inline_workspace_review_instead_of_separate_print_review():
    facing = read("js/pdf-editor-advanced/facing-upload.js")
    shell = read("js/pdf-editor-advanced/workspace-inline-review-v4.js")

    assert "import './workspace-inline-review-v4.js';" in facing
    assert "import './print-review.js';" not in facing
    assert "import './print-review-validation.js';" not in facing
    assert "removeLegacyPrintReview" in shell
    assert "advancedPrintReviewWorkspace" in shell
    assert "print-review-active" in shell
    assert "new MutationObserver(() => removeLegacyPrintReview())" not in shell
    assert "subtree: true" not in shell


def test_pdf_advanced_moves_page_picker_to_right_sidebar_with_thumbnails():
    shell = read("js/pdf-editor-advanced/workspace-inline-review-v4.js")
    right = read("js/pdf-editor-advanced/workspace-right-sidebar-v5.js")

    assert "advanced-page-sidebar" in shell
    assert "페이지 선택" in shell
    assert "renderThumbnail" in shell
    assert "page-sidebar-thumb" in shell
    assert "페이지를 클릭하면 가운데 편집창에서 즉시 해당 페이지를 편집합니다." in shell
    assert "grid-template-columns:340px minmax(0,1fr) 300px" in right


def test_pdf_advanced_moves_canvas_header_and_size_controls_to_right_sidebar():
    facing = read("js/pdf-editor-advanced/facing-upload.js")
    right = read("js/pdf-editor-advanced/workspace-right-sidebar-v5.js")

    assert "import './workspace-right-sidebar-v5.js';" in facing
    assert "moveCanvasHeaderToRightSidebar" in right
    assert "sidebar.insertBefore(toolbar, sidebar.firstChild)" in right
    assert "toolbar.insertAdjacentElement('afterend', inspector)" in right
    assert ".advanced-page-sidebar .workspace-toolbar" in right
    assert ".advanced-page-sidebar .advanced-size-inspector" in right
    assert ".advanced-page-sidebar .toolbar-actions" in right
    assert ".advanced-workspace .busy-overlay{inset:0!important}" in right


def test_pdf_advanced_reset_is_icon_next_to_pdf_save():
    shell = read("js/pdf-editor-advanced/workspace-inline-review-v4.js")

    assert "advancedWorkspaceResetBtn" in shell
    assert "download.textContent = 'PDF 저장'" in shell
    assert "grid-template-columns:minmax(0,1fr) 42px" in shell
    assert "aria-label', '편집 초기화'" in shell
    assert "<svg viewBox=\"0 0 24 24\"" in shell


def test_pdf_advanced_shows_actual_and_trim_sizes_directly_in_editor():
    shell = read("js/pdf-editor-advanced/workspace-inline-review-v4.js")

    assert "파일 실제" in shell
    assert "재단사이즈" in shell
    assert "advancedActualGuide" in shell
    assert "advancedTrimGuide" in shell
    assert "detectTrim" in shell
    assert "재단여유 사방" in shell
    assert "재단사이즈가 파일보다 큽니다" in shell
    assert "currentLayout" in shell
