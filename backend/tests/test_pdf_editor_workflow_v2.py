from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]
WORKFLOW = ROOT / "js" / "pdf-editor" / "workflow-v2.js"
GLOBAL_UI = ROOT / "js" / "program-studio-ui-v2.js"


def test_pdf_workflow_v2_is_loaded_only_for_pdf_editor_surface():
    text = GLOBAL_UI.read_text(encoding="utf-8")
    assert "surface!=='pdf-editor'" in text
    assert "/js/pdf-editor/workflow-v2.js?v=20260828-1" in text
    assert "pdfEditorWorkflowV2Script" in text


def test_pdf_sidebar_toggle_waits_for_compact_shell_actions():
    text = GLOBAL_UI.read_text(encoding="utf-8")
    assert ".app > aside > .program-local-actions" in text
    assert "if(attempt>=8)return document.querySelector('.top-nav')" in text
    assert "if(attempt<10)setTimeout(()=>mountSidebarToggle" in text
    assert "setInterval(" not in text


def test_workflow_has_four_user_facing_steps_and_optional_advanced_controls():
    text = WORKFLOW.read_text(encoding="utf-8")
    for label in ("STEP 1", "STEP 2", "STEP 3", "STEP 4", "페이지·배치", "꾸미기", "출력"):
        assert label in text
    assert "data-pdf-advanced" in text
    assert "고급 설정" in text
    assert "pdf-output-dock-v2" in text


def test_thumbnail_help_matches_actual_click_navigation_contract():
    text = WORKFLOW.read_text(encoding="utf-8")
    assert "클릭=미리보기 이동 · 우클릭=페이지 메뉴 · 드래그=순서 변경" in text
    assert "클릭=제외" not in text


def test_workflow_does_not_replace_pdf_render_or_save_runtime_functions():
    text = WORKFLOW.read_text(encoding="utf-8")
    forbidden = (
        "renderThumbs =",
        "triggerPreview =",
        "schedulePreview =",
        "apiProcessPdf =",
        "fetch =",
        "window.eval(",
        "setInterval(",
    )
    for marker in forbidden:
        assert marker not in text


def test_workflow_uses_bounded_dom_install_and_targeted_state_observation():
    text = WORKFLOW.read_text(encoding="utf-8")
    assert "attempts<20" in text
    assert "new MutationObserver(queueSync)" in text
    assert "$('downloadBtn'),$('thumbSection'),$('slideCount')" in text
    assert "requestAnimationFrame(()=>requestAnimationFrame" in text


def test_workflow_surfaces_runtime_failures_and_provides_recovery_actions():
    text = WORKFLOW.read_text(encoding="utf-8")
    assert "programstudio:runtime-script-result" in text
    assert "unhandledrejection" in text
    assert "AbortError" in text
    assert 'data-error-action="preview"' in text
    assert 'data-error-action="reload"' in text
    assert "PdfPreviewController?.request" in text


def test_output_summary_is_created_with_text_nodes_not_user_html():
    text = WORKFLOW.read_text(encoding="utf-8")
    assert "summary.replaceChildren()" in text
    assert "strong.textContent" in text
    assert "text.textContent" in text
