from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]
GLOBAL_UI = ROOT / "js" / "program-studio-ui-v2.js"
DOCUMENT = ROOT / "js" / "document-editor" / "workflow-v2.js"
IMAGE = ROOT / "js" / "image-editor" / "workflow-v2.js"


def test_global_ui_loads_document_and_image_workflows_on_their_surfaces():
    text = GLOBAL_UI.read_text(encoding="utf-8")
    assert "surface==='document-editor'" in text
    assert "/js/document-editor/workflow-v2.js?v=20260828-1" in text
    assert "documentEditorWorkflowV2Script" in text
    assert "surface==='image-editor'" in text
    assert "/js/image-editor/workflow-v2.js?v=20260828-1" in text
    assert "imageEditorWorkflowV2Script" in text


def test_document_workflow_reuses_existing_save_and_print_controls():
    text = DOCUMENT.read_text(encoding="utf-8")
    for marker in ("STEP 1", "STEP 2", "STEP 3", "STEP 4", "시작", "작성", "검토", "출력"):
        assert marker in text
    assert "$('saveNowBtn').click()" in text
    assert "$('printBtn').click()" in text
    assert "window.DocumentEditorApp?.saveDraft?.()" in text
    assert "window.DocumentEditorApp?.printDocument?.()" in text
    assert "document-workflow-output" in text
    assert "refresh(){syncQueued=false;sync();}" in text


def test_document_workflow_does_not_replace_editor_content_or_print_runtime():
    text = DOCUMENT.read_text(encoding="utf-8")
    for marker in ("DocumentEditorApp={", "window.print=", "document.execCommand=", "setInterval(", "window.eval("):
        assert marker not in text


def test_image_workflow_guides_four_steps_and_keeps_existing_export_pipeline():
    text = IMAGE.read_text(encoding="utf-8")
    for marker in ("STEP 1", "STEP 2", "STEP 3", "STEP 4", "불러오기", "자르기·크기", "보정·배경", "저장"):
        assert marker in text
    assert "image-output-dock-v2" in text
    assert "imageOutputSummaryV2" in text
    assert "$('openBtn')?.click()" in text
    assert "$('resetBtn')?.click()" in text
    assert "refresh(){syncQueued=false;protectEditableUndo();sync();}" in text


def test_image_workflow_prevents_editable_ctrl_z_from_reaching_global_image_undo_handler():
    text = IMAGE.read_text(encoding="utf-8")
    assert "data.imageUndoGuard" not in text
    assert "node.dataset.imageUndoGuard==='1'" in text
    assert "event.stopPropagation()" in text
    assert "String(event.key).toLowerCase()==='z'" in text
    assert "preventDefault()" not in text


def test_image_workflow_does_not_replace_image_processing_or_export_functions():
    text = IMAGE.read_text(encoding="utf-8")
    for marker in ("ImageEditorApp={", "exportBlob=", "renderOutput=", "removeBackground=", "applyCrop=", "setInterval(", "window.eval("):
        assert marker not in text
