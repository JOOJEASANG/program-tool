from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]


def text(path: str) -> str:
    return (ROOT / path).read_text(encoding="utf-8")


def test_home_quick_start_is_task_first_and_explains_the_real_output_flow():
    source = text("js/home-print-workflow.js")
    for marker in (
        "무엇을 하려는지 선택하세요",
        "디자인 만들기",
        "PDF 편집 · 인쇄배치",
        "인쇄 전 검사",
        "이미지 작업",
        "추천 출력 흐름",
        "검사 후 PDF 저장",
        "task-first-print-workflow-home-v2",
    ):
        assert marker in source


def test_pdf_editor_lists_controls_without_step_filtering_and_allows_page_list_collapse():
    sidebar = text("js/pdf-editor/simple-sidebar-ui.js")
    ui_runtime = text("js/pdf-editor/ui-runtime.js")
    shell = text("js/program-shell-unify.js")
    for marker in (
        "all-visible-page-list-collapsible",
        "keepSectionsOpen",
        "blockToggle",
        "if(sec.id==='thumbSection')",
        "if(head.closest('#thumbSection'))",
        "#thumbSection>#sb-pages.hidden{display:none!important}",
        "ps-sidebar-toggle",
        "program-studio:pdf-editor:advanced",
        "클릭=미리보기 이동",
        "로그아웃",
        "single-sidebar-page-list-collapsible-hotfix-v4",
    ):
        assert marker in sidebar
    assert "/js/pdf-editor/simple-sidebar-ui.js?v=20260831-1" in ui_runtime
    assert "/js/pdf-editor/workflow-ui.js" not in ui_runtime
    assert "/js/pdf-editor/workspace-layout.js" not in ui_runtime
    assert "/js/pdf-editor/ui-runtime.js?v=${PDF_UI_RUNTIME_VERSION}" in shell
    assert "workflowStage:'pdf-all-controls-visible-v1'" in shell
    assert "uiRuntimeStage:'pdf-editor-always-visible-sidebar-runtime-v2'" in shell
    assert "stage:'pdf-tools-headerless-unified-shell'" in shell


def test_pdf_sidebar_ui_does_not_replace_core_page_or_download_state():
    source = text("js/pdf-editor/simple-sidebar-ui.js")
    for forbidden in (
        "parsedPages =",
        "uploadedFiles =",
        "downloadBtn.addEventListener",
        "previewBtn.addEventListener",
        "eval(",
        "setInterval(",
    ):
        assert forbidden not in source
