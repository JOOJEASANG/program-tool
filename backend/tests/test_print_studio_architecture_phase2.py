from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]


def text(path: str) -> str:
    return (ROOT / path).read_text(encoding="utf-8")


def test_home_is_print_first_from_initial_source_not_generic_category_runtime():
    source = text("index.html")
    for marker in (
        'data-home-static-professional="1"',
        "const CATEGORIES={studio:",
        "무엇을 하려는지 선택하세요",
        "디자인 제작",
        "PDF 편집 · 인쇄배치",
        "인쇄 전 검사",
        "이미지 작업",
        "let active='studio'",
        "switchCategory('studio')",
    ):
        assert marker in source
    for legacy in ("group:{label:", "office:{label:", "ai:{label:"):
        assert legacy not in source


def test_design_original_workspace_is_three_pane_and_inspector_is_contextual_right_panel():
    source = text("design-editor/general.html")
    for marker in (
        'grid-template-columns:300px minmax(0,1fr) 306px',
        'data-workspace="three-pane"',
        'aria-label="디자인 제작 도구"',
        'id="propertiesPanel"',
        'class="properties-panel"',
        'id="inspector"',
        'id="layerList"',
        "선택한 항목에 필요한 설정만 표시",
    ):
        assert marker in source
    assert source.index('class="editor-main"') < source.index('id="propertiesPanel"')


def test_design_document_type_is_canonical_with_legacy_compatibility():
    state = text("js/design-editor/document-type-state.js")
    shell = text("design-editor/index.html")
    runtime = text("js/design-editor/shell-runtime.js")
    professional = text("js/design-editor/professional-ui.js")
    for marker in (
        "project.documentType=type",
        "project.designMode=type",
        "canonical-document-type-state-v1",
        "programstudio:document-type-change",
    ):
        assert marker in state
    assert "/js/design-editor/document-type-state.js?v=20260828-1" in runtime
    assert "documentStateStage:'canonical-document-type-state-v1'" in shell
    assert "runtimeManifestStage:'design-shell-runtime-manifest-v1'" in shell
    assert "workspaceStage:'three-pane-context-properties-v1'" in shell
    assert "DesignEditorDocumentTypeState?.current?.(p)" in professional
    assert "professional-workspace-result-first-v2" in professional


def test_pdf_workspace_moves_output_settings_to_a_real_right_rail_without_replacing_core_actions():
    workspace = text("js/pdf-editor/workspace-layout.js")
    ui_runtime = text("js/pdf-editor/ui-runtime.js")
    shell = text("js/program-shell-unify.js")
    for marker in (
        "three-pane-output-settings-v1",
        "pdfOutputRail",
        "sectionByKey('paper')",
        "sectionByKey('edit')",
        "outputSection()",
        "rail.appendChild(paper)",
        "rail.appendChild(edit)",
        "rail.appendChild(output)",
        'data-pdf-workspace="three-pane"',
    ):
        assert marker in workspace
    for forbidden in (
        "parsedPages =",
        "uploadedFiles =",
        "downloadBtn.addEventListener",
        "previewBtn.addEventListener",
        "eval(",
        "setInterval(",
    ):
        assert forbidden not in workspace
    assert "/js/pdf-editor/workspace-layout.js?v=20260828-1" in ui_runtime
    assert "/js/pdf-editor/ui-runtime.js?v=${PDF_UI_RUNTIME_VERSION}" in shell
    assert "workspaceStage:'pdf-three-pane-output-settings-v1'" in shell
    assert "uiRuntimeStage:'pdf-editor-ui-runtime-manifest-v1'" in shell
    assert "stage:'pdf-tools-headerless-unified-shell'" in shell
