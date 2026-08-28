from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]


def test_phase16_design_manifest_loads_multi_selection_runtime():
    shell = (ROOT / "design-editor" / "index.html").read_text(encoding="utf-8")
    runtime = (ROOT / "js" / "design-editor" / "shell-runtime.js").read_text(encoding="utf-8")
    assert "designMultiSelectionScriptV1" in runtime
    assert "/js/design-editor/multi-selection-context.js?v=20260828-1" in runtime
    assert "const ensureMultiSelectionRuntime=ensurePrintRuntimes" in shell
    assert "multiSelectionStage:'multi-select-align-distribute-group-v1'" in shell
    assert "runtimeManifestStage:'design-shell-runtime-manifest-v1'" in shell


def test_phase16_multi_selection_keeps_flat_project_model_and_adds_bulk_actions():
    source = (ROOT / "js" / "design-editor" / "multi-selection-context.js").read_text(encoding="utf-8")
    for token in (
        "data-design-multi-selection",
        "ps-multi-selected",
        'data-multi-action="left"',
        'data-multi-action="center"',
        'data-multi-action="right"',
        'data-multi-action="top"',
        'data-multi-action="middle"',
        'data-multi-action="bottom"',
        'data-multi-action="distribute-h"',
        'data-multi-action="distribute-v"',
        'data-multi-action="group"',
        'data-multi-action="ungroup"',
        'data-multi-action="lock"',
        'data-multi-action="duplicate"',
        'data-multi-action="delete"',
        "event.shiftKey||event.ctrlKey||event.metaKey",
        "groupId",
        "window.DesignEditorDraftScope?.saveCurrent?.",
        "window.DesignEditorApp?.resumeDraft?.",
        "stage:'multi-select-align-distribute-group-v1'",
    ):
        assert token in source
    assert "current.elements" in source
    assert "current.extras" in source
    assert "children" not in source


def test_phase16_multi_selection_supports_group_drag_keyboard_and_selection_bounds():
    source = (ROOT / "js" / "design-editor" / "multi-selection-context.js").read_text(encoding="utf-8")
    for token in (
        "function beginDrag",
        "function handleDragMove",
        "function moveBy",
        "ArrowLeft",
        "ArrowRight",
        "ArrowUp",
        "ArrowDown",
        "function align(direction)",
        "function distribute(axis)",
        "const gap=(end-start-total)/(sorted.length-1)",
        "event.key==='Delete'||event.key==='Backspace'",
        "event.key.toLowerCase()==='d'",
    ):
        assert token in source


def test_phase16_browser_smoke_covers_multi_selection_workflow():
    smoke = ROOT / "tests" / "browser" / "design-editor-multiselect-smoke.html"
    runner = (ROOT / "scripts" / "run_design_editor_print_products_smoke.sh").read_text(encoding="utf-8")
    assert smoke.is_file()
    for marker in (
        'data-design-multiselect-status="pass"',
        'data-design-multiselect-selection="modifier-3"',
        'data-design-multiselect-align="selection-bounds"',
        'data-design-multiselect-distribute="horizontal-vertical"',
        'data-design-multiselect-group="group-ungroup"',
        'data-design-multiselect-drag="group-drag-and-nudge"',
        'data-design-multiselect-bulk="lock-duplicate-delete"',
    ):
        assert marker in runner
    assert "multi selection" in smoke.read_text(encoding="utf-8").lower()
