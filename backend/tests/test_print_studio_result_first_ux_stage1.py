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


def test_design_editor_exposes_result_first_workflow_and_output_cta():
    source = text("js/design-editor/professional-ui.js")
    for marker in (
        "designProfessionalWorkflow",
        "1</b>종류·규격",
        "2</b>내용 제작",
        "3</b>인쇄 점검",
        "4</b>PDF 만들기",
        "designProfessionalPdfCta",
        "data-simple-action=\"pdf\"",
        "professional-workspace-result-first-v2",
    ):
        assert marker in source
    assert "invitation:'초대장·안내장'" in source


def test_pdf_editor_guides_file_page_layout_paper_output_and_reuses_existing_actions():
    workflow = text("js/pdf-editor/workflow-ui.js")
    ui_runtime = text("js/pdf-editor/ui-runtime.js")
    shell = text("js/program-shell-unify.js")
    for marker in (
        "1 · PDF 파일",
        "2 · 페이지 정리",
        "3 · 인쇄 배치",
        "4 · 용지 · 여백",
        "5 · 결과 저장",
        "PDF 더 추가",
        "미리보기 갱신",
        "PDF 저장",
        "byId('previewBtn')?.click()",
        "byId('downloadBtn')?.click()",
        "guided-file-page-layout-paper-output-v1",
    ):
        assert marker in workflow
    assert "/js/pdf-editor/workflow-ui.js?v=20260828-1" in ui_runtime
    assert "/js/pdf-editor/ui-runtime.js?v=${PDF_UI_RUNTIME_VERSION}" in shell
    assert "pdf-tools-guided-unified-shell-v2" in shell
    assert "uiRuntimeStage:'pdf-editor-ui-runtime-manifest-v1'" in shell
    assert "stage:'pdf-tools-headerless-unified-shell'" in shell


def test_pdf_guided_ui_does_not_replace_core_page_or_download_state():
    source = text("js/pdf-editor/workflow-ui.js")
    for forbidden in (
        "parsedPages =",
        "uploadedFiles =",
        "downloadBtn.addEventListener",
        "previewBtn.addEventListener",
        "eval(",
        "setInterval(",
    ):
        assert forbidden not in source
