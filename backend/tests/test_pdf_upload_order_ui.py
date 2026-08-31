from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
UPLOAD_ORDER = ROOT / "js" / "pdf-editor" / "upload-order-ui.js"
CORE_RUNTIME = ROOT / "js" / "pdf-editor" / "core-runtime.js"


def test_upload_order_ui_stages_multiple_pdf_files_before_existing_pipeline():
    source = UPLOAD_ORDER.read_text(encoding="utf-8")

    for marker in (
        "pdfUploadOrderPanelV1",
        "selected.length<2",
        "input.addEventListener('change',onFileInputChange,true)",
        "zone.addEventListener('drop',onUploadDrop,true)",
        "await callExistingHandleFile(ordered[index])",
        "function effectiveMode(batchMode,index,hadPages)",
    ):
        assert marker in source


def test_upload_order_ui_supports_drag_reorder_buttons_and_two_quick_add_modes():
    source = UPLOAD_ORDER.read_text(encoding="utf-8")

    for marker in (
        "quickButton('＋ 연속 추가','cont')",
        "quickButton('＋ 새 묶음 추가','break')",
        "row.draggable=!pending.busy",
        "row.addEventListener('dragstart'",
        "row.addEventListener('drop'",
        "up.textContent='↑'",
        "down.textContent='↓'",
        "remove.textContent='×'",
        "confirm.textContent='이 순서로 추가'",
    ):
        assert marker in source


def test_noncontinuous_batch_keeps_each_following_pdf_as_a_new_group():
    source = UPLOAD_ORDER.read_text(encoding="utf-8")

    assert "return batchMode==='break'?'break':'cont'" in source
    assert "if(index===0&&!hadPages)return 'new'" in source
    assert "if(batchMode==='new')return index===0?'new':'cont'" in source


def test_pdf_processing_redirect_card_is_hidden_from_print_editor():
    source = UPLOAD_ORDER.read_text(encoding="utf-8")

    assert "#pdfPrintUtilityRedirectCard{display:none!important}" in source


def test_upload_order_helper_loads_without_expanding_stable_core_module_manifest():
    source = CORE_RUNTIME.read_text(encoding="utf-8")

    assert source.count("src:'/js/pdf-editor/") == 8
    assert "upload-order-ui.js?v=20260831-1" in source
    assert "pending.push(loadUploadOrderUi())" in source
    assert "installUploadOrderModeSafety()" in source
