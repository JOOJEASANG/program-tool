from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]


def text(path: str) -> str:
    return (ROOT / path).read_text(encoding="utf-8")


def test_home_exposes_only_the_three_current_programs():
    source = text("index.html")
    for marker in ("인쇄물 사전 검토", "PDF 편집 · 인쇄배치", "PDF 도구 모음"):
        assert marker in source
    for retired in ("디자인 편집기", "문서 편집기", "이미지 편집기"):
        assert retired not in source


def test_pdf_editor_lists_controls_without_step_filtering_and_allows_page_list_collapse():
    sidebar = text("js/pdf-editor/simple-sidebar-ui.js")
    ui_runtime = text("js/pdf-editor/ui-runtime.js")
    shell = text("js/program-shell-unify.js")
    for marker in ("all-visible-page-list-collapsible", "keepSectionsOpen", "blockToggle", "if(sec.id==='thumbSection')", "if(head.closest('#thumbSection'))", "#thumbSection>#sb-pages.hidden{display:none!important}", "ps-sidebar-toggle", "program-studio:pdf-editor:advanced", "클릭=미리보기 이동", "로그아웃", "single-sidebar-page-list-collapsible-hotfix-v4"):
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
    for forbidden in ("parsedPages =", "uploadedFiles =", "downloadBtn.addEventListener", "previewBtn.addEventListener", "eval(", "setInterval("):
        assert forbidden not in source
