from pathlib import Path
ROOT=Path(__file__).resolve().parents[2]
def text(path:str)->str:return (ROOT/path).read_text(encoding="utf-8")
def test_home_exposes_current_review_and_ai_design_programs():
 source=text("index.html")
 for marker in ("스마트 인쇄배치","표지 디자인","PDF배치","PDF편집","PDF 유틸리티"): assert marker in source
 for retired in ("디자인 편집기","문서 편집기","이미지 편집기"): assert retired not in source
def test_pdf_editor_keeps_simple_primary_controls_and_collapses_advanced_sections():
 sidebar=text("js/pdf-editor/simple-sidebar-ui.js"); ui_runtime=text("js/pdf-editor/ui-runtime.js"); shell=text("js/program-shell-unify.js")
 for marker in ("stepwise-print-workflow-v2","organizeWorkspace","organizeRightSidebar","blockToggle","const sectionKey=", "pdf-ui-closed", "#thumbSection>#sb-pages.hidden{display:none!important}", "ps-sidebar-toggle", "program-studio:pdf-editor:advanced", "클릭=미리보기 이동", "로그아웃", "two-sidebar-print-workflow-v2"): assert marker in sidebar
 assert "/js/pdf-editor/simple-sidebar-ui.js?v=20261112-1" in ui_runtime and "/js/pdf-editor/workflow-ui.js" not in ui_runtime and "/js/pdf-editor/workspace-layout.js" not in ui_runtime and "/js/pdf-editor/ui-runtime.js?v=${PDF_UI_RUNTIME_VERSION}" in shell and "workflowStage:'pdf-progressive-controls-v2'" in shell and "uiRuntimeStage:'pdf-editor-two-sidebar-workflow-runtime-v3'" in shell and "stage:'pdf-tools-headerless-unified-shell'" in shell
def test_pdf_sidebar_ui_does_not_replace_core_page_or_download_state():
 source=text("js/pdf-editor/simple-sidebar-ui.js")
 for forbidden in ("parsedPages =","uploadedFiles =","downloadBtn.addEventListener","previewBtn.addEventListener","eval(","setInterval("): assert forbidden not in source
