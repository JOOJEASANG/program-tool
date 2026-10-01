from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]


def read(path: str) -> str:
    return (ROOT / path).read_text(encoding="utf-8")


def test_advanced_editor_separates_edit_tools_and_output_settings():
    facing = read("js/pdf-editor-advanced/facing-upload.js")
    layout = read("js/pdf-editor-advanced/workspace-settings-sidebar-v8.js")

    assert "import './workspace-settings-sidebar-v8.js';" in facing
    assert "grid-template-columns:310px minmax(0,1fr) 360px" in layout
    assert "advancedPaperSizeSection" in layout
    assert "advanced-margin-section" in layout
    assert "advanced-header-footer-section" in layout
    assert "advanced-page-number-section" in layout
    assert "advanced-output-section" in layout
    assert "tool-section:not(.upload-section):not(#pageEditSection)" in layout
    assert "edit-left-settings-right-v8" in layout


def test_workspace_reset_icon_is_red_and_stays_next_to_pdf_save():
    layout = read("js/pdf-editor-advanced/workspace-settings-sidebar-v8.js")
    inline_review = read("js/pdf-editor-advanced/workspace-inline-review-v4.js")

    assert "#advancedWorkspaceResetBtn{border-color:#fecaca" in layout
    assert "color:#dc2626" in layout
    assert "PDF 저장" in inline_review
    assert "download.insertAdjacentElement('afterend', reset)" in inline_review
