from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]


def test_phase15_design_manifest_loads_selection_context_runtime():
    shell = (ROOT / "design-editor" / "index.html").read_text(encoding="utf-8")
    runtime = (ROOT / "js" / "design-editor" / "shell-runtime.js").read_text(encoding="utf-8")
    assert "designSelectionContextbarScriptV1" in runtime
    assert "/js/design-editor/shared/selection-contextbar.js?v=20260831-1" in runtime
    assert "const ensureSelectionContextRuntime=ensurePrintRuntimes" in shell
    assert "selectionContextStage:'selection-context-properties-v1'" in shell
    assert "runtimeManifestStage:'design-shell-runtime-manifest-v1'" in shell


def test_phase15_selection_contextbar_exposes_only_selected_element_properties():
    source = (ROOT / "js" / "design-editor" / "shared" / "selection-contextbar.js").read_text(encoding="utf-8")
    for token in (
        "designSelectionContextbar",
        'data-context-field="text-font"',
        'data-context-field="text-size"',
        'data-context-field="text-weight"',
        'data-context-field="text-color"',
        'data-context-text-align="center"',
        'data-context-field="extra-w"',
        'data-context-field="extra-h"',
        'data-context-field="image-fit"',
        'data-context-field="image-focus-x"',
        'data-context-field="shape-fill"',
        'data-context-field="shape-stroke"',
        'data-context-field="shape-stroke-width"',
        'data-context-field="extra-opacity"',
    ):
        assert token in source
    assert "document.documentElement.dataset.designSelectionContext=record.kind" in source
    assert "html[data-design-selection-context] #designCanvasQuickbar" in source


def test_phase15_contextbar_reuses_existing_inspector_and_layout_actions():
    source = (ROOT / "js" / "design-editor" / "shared" / "selection-contextbar.js").read_text(encoding="utf-8")
    for token in (
        "#fontInput",
        "#sizeInput",
        "#weightInput",
        "#colorInput",
        '[data-extra-field=\"w\"]',
        '[data-extra-field=\"fit\"]',
        "#phase2ReplaceImage",
        "#duplicateBtn",
        "#phase2ExtraDuplicate",
    ):
        assert token in source
    assert "sourceControl(config.selector)" in source
    assert "control.dispatchEvent(new Event(eventName,{bubbles:true}))" in source
    assert "window.DesignEditorPhase3Controls?.alignSelected" in source
    assert "stage:'selection-context-properties-v1'" in source
    assert "localStorage.setItem" not in source


def test_phase15_browser_smoke_covers_text_image_shape_contexts():
    smoke = ROOT / "tests" / "browser" / "design-editor-selection-contextbar-smoke.html"
    runner = (ROOT / "scripts" / "run_design_editor_print_products_smoke.sh").read_text(encoding="utf-8")
    assert smoke.is_file()
    for marker in (
        'data-design-contextbar-status="pass"',
        'data-design-contextbar-text="font-size-weight-color-align"',
        'data-design-contextbar-image="size-fit-focus-opacity"',
        'data-design-contextbar-shape="fill-stroke-radius-opacity"',
        'data-design-contextbar-proxy="existing-inspector-controls"',
        'data-design-contextbar-floating="suppressed-when-context"',
    ):
        assert marker in runner
    assert "selection contextbar" in smoke.read_text(encoding="utf-8").lower()
