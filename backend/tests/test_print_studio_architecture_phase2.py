from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]


def text(path: str) -> str:
    return (ROOT / path).read_text(encoding="utf-8")


def test_home_is_print_first_from_initial_source_not_generic_category_runtime():
    source = text("index.html")
    for marker in (
        'data-home-static-professional="1"',
        "스마트 인쇄배치",
        "표지 디자인",
        "url:\'ai-design-maker/\'",
        "PDF배치",
        "PDF편집",
        "AI 배경·문구·PDF·이미지",
    ):
        assert marker in source
    for legacy in (
        "url:'design-editor/'",
        "url:'image-editor/'",
        "url:'document-editor/'",
        "let active='studio'",
        "switchCategory('studio')",
        "group:{label:",
        "office:{label:",
        "ai:{label:",
    ):
        assert legacy not in source


def test_pdf_workspace_separates_print_setup_and_page_management_with_accessible_collapsible_options():
    sidebar = text("js/pdf-editor/simple-sidebar-ui.js")
    ui_runtime = text("js/pdf-editor/ui-runtime.js")
    shell = text("js/program-shell-unify.js")
    for marker in (
        "stage:'two-sidebar-print-workflow-v2'",
        "neutralizeToolRail()",
        "restoreOutputRail()",
        "organizeWorkspace()",
        "organizeRightSidebar()",
        "flex-wrap:nowrap!important",
        ".sec.pdf-ui-closed>.sec-body.hidden{display:none!important}",
        "#thumbSection>#sb-pages.hidden{display:none!important}",
        "const defaultSections=new Set(['upload','paper','nup','output']);",
        "document.addEventListener('keydown',blockToggle,true)",
        ".ps-sidebar-toggle",
        "pdf-output-dock-v2",
        "aria-label','로그아웃",
    ):
        assert marker in sidebar
    for forbidden in (
        "parsedPages =",
        "uploadedFiles =",
        "downloadBtn.addEventListener",
        "previewBtn.addEventListener",
        "eval(",
        "setInterval(",
    ):
        assert forbidden not in sidebar
    assert "/js/pdf-editor/simple-sidebar-ui.js?v=20261112-3" in ui_runtime
    assert "/js/pdf-editor/workspace-layout.js" not in ui_runtime
    assert "/js/pdf-editor/workflow-ui.js" not in ui_runtime
    assert "/js/pdf-editor/ui-runtime.js?v=${PDF_UI_RUNTIME_VERSION}" in shell
    assert "workspaceStage:'pdf-two-sidebars-v3'" in shell
    assert "uiRuntimeStage:'pdf-editor-two-sidebar-workflow-runtime-v3'" in shell
    assert "stage:'pdf-tools-headerless-unified-shell'" in shell
