from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]


def test_phase17_design_manifest_loads_multi_smart_guides_runtime():
    shell = (ROOT / "design-editor" / "index.html").read_text(encoding="utf-8")
    runtime = (ROOT / "js" / "design-editor" / "shell-runtime.js").read_text(encoding="utf-8")
    assert "designMultiSmartGuidesScriptV1" in runtime
    assert "/js/design-editor/shared/multi-selection-smart-guides.js?v=20260828-1" in runtime
    assert "const ensureMultiSmartGuidesRuntime=ensurePrintRuntimes" in shell
    assert "multiSmartGuidesStage:'multi-smart-guides-exact-gap-v1'" in shell
    assert "runtimeManifestStage:'design-shell-runtime-manifest-v1'" in shell


def test_phase17_multi_smart_guides_adds_snap_targets_and_exact_gap_controls():
    source = (ROOT / "js" / "design-editor" / "shared" / "multi-selection-smart-guides.js").read_text(encoding="utf-8")
    for token in (
        "const SNAP_MM=2.2",
        "아트보드 가운데",
        "안전여백",
        "요소 왼쪽",
        "요소 가운데",
        "요소 오른쪽",
        "phase17-multi-guide",
        "data-multi-smart-toggle",
        'data-multi-exact-gap=\"horizontal\"',
        'data-multi-exact-gap=\"vertical\"',
        'data-multi-gap-apply=\"horizontal\"',
        'data-multi-gap-apply=\"vertical\"',
        "event.altKey",
        "function setExactGap(axis,value)",
        "window.DesignEditorDraftScope?.saveCurrent?.",
        "stage:'multi-smart-guides-exact-gap-v1'",
    ):
        assert token in source


def test_phase17_exact_gap_preserves_flat_records_and_rejects_board_overflow():
    source = (ROOT / "js" / "design-editor" / "shared" / "multi-selection-smart-guides.js").read_text(encoding="utf-8")
    assert "multi()?.records" not in source
    assert "api.records" in source
    assert "required>span+.001" in source
    assert "maxGap" in source
    assert "record.item.x=cursor" in source
    assert "record.item.y=cursor" in source
    assert "children" not in source


def test_phase17_smart_controls_stay_owned_by_multi_selection_bar_and_compact_on_mobile():
    source = (ROOT / "js" / "design-editor" / "shared" / "multi-selection-smart-guides.js").read_text(encoding="utf-8")
    assert "const bar=byId('designMultiSelectionContextbar')" in source
    assert "distribute.insertAdjacentElement('afterend',sep)" in source
    assert "sep.insertAdjacentElement('afterend',controls)" in source
    assert "@media(max-width:700px)" in source
    assert "#${CONTROLS_ID} .design-multi-gap-apply{display:none}" in source
    assert "#designMultiSelectionContextbar" in source


def test_phase17_browser_smoke_covers_smart_snap_and_exact_mm_gap():
    smoke = ROOT / "tests" / "browser" / "design-editor-multi-smart-guides-smoke.html"
    runner = (ROOT / "scripts" / "run_design_editor_print_products_smoke.sh").read_text(encoding="utf-8")
    assert smoke.is_file()
    for marker in (
        'data-design-multi-smart-status="pass"',
        'data-design-multi-smart-toggle="enabled"',
        'data-design-multi-smart-gap="horizontal-6-vertical-4"',
        'data-design-multi-smart-snap="artboard-center"',
        'data-design-multi-smart-guide="visible"',
    ):
        assert marker in runner
    source = smoke.read_text(encoding="utf-8")
    assert "multi smart guides" in source.lower()
    assert "group center did not snap to artboard center" in source
    assert "/js/design-editor/shared/multi-selection-smart-guides.js?v=20260828-1" in source
