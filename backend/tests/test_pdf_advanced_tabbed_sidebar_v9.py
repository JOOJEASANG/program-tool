from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]


def read(path: str) -> str:
    return (ROOT / path).read_text(encoding="utf-8")


def test_advanced_editor_uses_tabbed_right_sidebar_and_canvas_statusbar():
    facing = read("js/pdf-editor-advanced/facing-upload.js")
    layout = read("js/pdf-editor-advanced/workspace-tabbed-sidebar-v9.js")

    assert "import './workspace-tabbed-sidebar-v9.js';" in facing
    assert "workspace-settings-sidebar-v8.js" not in facing
    assert "advancedPagesTab" in layout
    assert "advancedSettingsTab" in layout
    assert "data-active-tab=\"settings\"" in layout
    assert "advancedSettingsScroller" in layout
    assert "advancedCanvasStatusBar" in layout
    assert "advancedCanvasPaperText" in layout
    assert "grid-template-columns:310px minmax(0,1fr) 320px" in layout


def test_page_tab_keeps_single_column_proportional_thumbnails():
    layout = read("js/pdf-editor-advanced/workspace-tabbed-sidebar-v9.js")

    assert ".advanced-page-sidebar .page-list{display:grid!important;grid-template-columns:1fr!important" in layout
    assert "width:180px!important;height:auto!important" in layout
    assert ".page-item-info span{display:none!important}" in layout
    assert "right:9px!important;top:9px!important" in layout


def test_settings_tab_contains_print_settings_but_output_stays_fixed():
    layout = read("js/pdf-editor-advanced/workspace-tabbed-sidebar-v9.js")

    assert "advancedPaperSizeSection" in layout
    assert "advanced-margin-section" in layout
    assert "advanced-header-footer-section" in layout
    assert "advanced-page-number-section" in layout
    assert "advanced-output-section" in layout
    assert "for (const node of [inspector, paper, margin, headerFooter, pageNumbers]) scroller.appendChild(node)" in layout
    assert "sidebar.appendChild(output)" in layout


def test_workspace_reset_icon_remains_red_next_to_pdf_save():
    layout = read("js/pdf-editor-advanced/workspace-tabbed-sidebar-v9.js")
    inline_review = read("js/pdf-editor-advanced/workspace-inline-review-v4.js")

    assert "#advancedWorkspaceResetBtn{border-color:#fecaca" in layout
    assert "color:#dc2626" in layout
    assert "download.insertAdjacentElement('afterend', reset)" in inline_review


def test_left_sidebar_keeps_overlay_editing_tools_visible():
    layout = read("js/pdf-editor-advanced/workspace-tabbed-sidebar-v9.js")

    assert "not(#insertOverlaySection)" in layout
    assert ".advanced-sidebar #insertOverlaySection{display:block!important}" in layout
