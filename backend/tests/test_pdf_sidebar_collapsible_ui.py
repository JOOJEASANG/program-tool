from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
SIDEBAR = ROOT / "js" / "pdf-editor" / "simple-sidebar-ui.js"
UI_RUNTIME = ROOT / "js" / "pdf-editor" / "ui-runtime.js"
SHELL = ROOT / "js" / "program-shell-unify.js"


def test_upload_section_is_pinned_and_non_collapsible():
    source = SIDEBAR.read_text(encoding="utf-8")

    for marker in (
        "data-pdf-upload-fixed",
        "position:sticky!important",
        "if(body?.id==='sb-upload')",
        "head.classList.remove('collapsed')",
        "body.classList.remove('hidden')",
        "pinned-upload-collapsible",
    ):
        assert marker in source


def test_other_sections_can_collapse_again():
    source = SIDEBAR.read_text(encoding="utf-8")

    assert ".sec-body.hidden{display:none!important}" in source
    assert "document.addEventListener('click',guardUploadToggle,true)" in source
    assert "stopImmediatePropagation" in source
    assert "keepSectionsOpen" not in source
    assert "blockToggle" not in source


def test_sidebar_control_sizes_are_normalized():
    source = SIDEBAR.read_text(encoding="utf-8")

    for marker in (
        'height:34px!important',
        'min-height:34px!important',
        'font-size:11px!important',
        'min-height:48px!important',
        '#pdfPageListQuickAddV1{display:none!important}',
    ):
        assert marker in source


def test_sidebar_runtime_cache_versions_are_bumped():
    ui = UI_RUNTIME.read_text(encoding="utf-8")
    shell = SHELL.read_text(encoding="utf-8")

    assert "simple-sidebar-ui.js?v=20260831-2" in ui
    assert "PDF_UI_RUNTIME_VERSION='20260831-2'" in shell
    assert "pdf-editor-pinned-upload-collapsible-sidebar-runtime-v3" in ui
