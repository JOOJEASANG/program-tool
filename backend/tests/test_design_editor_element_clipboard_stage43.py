from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]
CLIPBOARD = ROOT / "js" / "design-editor" / "phase10-element-clipboard.js"
REGISTER = ROOT / "js" / "sw-register.js"


def test_element_clipboard_loads_after_core_editing_modules():
    source = REGISTER.read_text(encoding="utf-8")
    assert "designEditorElementClipboardScriptV1" in source
    assert "/js/design-editor/phase10-element-clipboard.js?v=20260821-1" in source
    assert source.index("designEditorPhase4SmartLayoutScriptV1") < source.index("designEditorElementClipboardScriptV1")


def test_element_clipboard_supports_text_images_shapes_and_cross_surface_paste():
    source = CLIPBOARD.read_text(encoding="utf-8")
    for marker in (
        ".phase2-extra-object.selected",
        ".design-text.selected",
        "current.extras?.find",
        "current.elements?.find",
        "clipboard={kind:record.kind,data}",
        "current.elements.push(item)",
        "current.extras.push(item)",
        "item.id=uid()",
        "item.locked=false",
        "DesignEditorDraftScope?.saveCurrent?.('clipboard-paste')",
        "Ctrl+C / Ctrl+V",
        "stage:'cross-surface-element-copy-paste'",
    ):
        assert marker in source


def test_element_clipboard_keyboard_shortcuts_do_not_override_typing():
    source = CLIPBOARD.read_text(encoding="utf-8")
    assert "event.ctrlKey||event.metaKey" in source
    assert "['INPUT','TEXTAREA','SELECT'].includes(tag)||event.target?.isContentEditable" in source
    assert "key==='c'" in source
    assert "key==='v'" in source
    assert "MutationObserver" not in source
    assert "setInterval(" not in source
    assert "eval(" not in source
