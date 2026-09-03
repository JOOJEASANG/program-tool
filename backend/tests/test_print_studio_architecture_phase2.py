from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]


def text(path: str) -> str:
    return (ROOT / path).read_text(encoding="utf-8")


def test_home_is_print_first_from_initial_source_not_generic_category_runtime():
    source = text("index.html")
    for marker in (
        'data-home-static-professional="1"',
        "url:'print-checker/'",
        "인쇄물 사전 검토",
        "PDF 편집 · 인쇄배치",
        "인쇄 전 검사",
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


def test_pdf_workspace_keeps_controls_in_one_sidebar_with_page_list_collapse_exception():
    sidebar = text("js/pdf-editor/simple-sidebar-ui.js")
    ui_runtime = text("js/pdf-editor/ui-runtime.js")
    shell = text("js/program-shell-unify.js")
    for marker in (
        "single-sidebar-page-list-collapsible-hotfix-v4",
        "neutralizeToolRail()",
        "restoreOutputRail()",
        "keepSectionsOpen()",
        "flex-wrap:nowrap!important",
        ".sec-body.hidden{display:block!important",
        "#thumbSection>#sb-pages.hidden{display:none!important}",
        "if(sec.id==='thumbSection')",
        "if(head.closest('#thumbSection'))",
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
    assert "/js/pdf-editor/simple-sidebar-ui.js?v=20260831-1" in ui_runtime
    assert "/js/pdf-editor/workspace-layout.js" not in ui_runtime
    assert "/js/pdf-editor/workflow-ui.js" not in ui_runtime
    assert "/js/pdf-editor/ui-runtime.js?v=${PDF_UI_RUNTIME_VERSION}" in shell
    assert "workspaceStage:'pdf-single-sidebar-v2'" in shell
    assert "uiRuntimeStage:'pdf-editor-always-visible-sidebar-runtime-v2'" in shell
    assert "stage:'pdf-tools-headerless-unified-shell'" in shell
