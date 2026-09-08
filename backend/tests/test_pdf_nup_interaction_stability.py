from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]
STABILITY = ROOT / "js" / "pdf-editor" / "nup-interaction-stability.js"
CORE_RUNTIME = ROOT / "js" / "pdf-editor" / "core-runtime.js"


def test_nup_mouse_edit_locks_scroll_and_blocks_legacy_rebuild_cycle():
    source = STABILITY.read_text(encoding="utf-8")

    assert "data-pdf-nup-interaction-lock" in source
    assert "overflow-anchor:none" in source
    assert "scrollSnapshot()" in source
    assert "restoreScroll" in source
    assert "event.stopPropagation()" in source
    assert "prevent the old target-level pointer handler" in source
    assert "api?.setValues" in source
    assert "Do not request a new lazy/full preview here" in source
    assert "PdfNupPageAdjust?.selectPage" in source
    assert "stage:'fixed-output-face-direct-edit-v1'" in source


def test_nup_interaction_stability_suppresses_lazy_refresh_while_pointer_is_active():
    source = STABILITY.read_text(encoding="utf-8")

    assert "wrapLazyRequest" in source
    assert "pdfNupInteractionLock==='1'" in source
    assert "return Promise.resolve(false)" in source
    assert "suppressSyntheticClick" in source
    assert "finishScrollLock" in source


def test_stability_listener_loads_before_existing_nup_pointer_handlers():
    source = CORE_RUNTIME.read_text(encoding="utf-8")

    stability = source.index(".then(()=>loadNupInteractionStability())")
    adjustment = source.index(".then(()=>loadNupPageAdjust())")
    direct = source.index(".then(()=>loadNupDirectPreviewEdit())")

    assert stability < adjustment < direct
    assert "pdfNupInteractionStabilityScriptV1" in source
    assert "/js/pdf-editor/nup-interaction-stability.js?v=20260908-1" in source
    assert source.count("{id:'pdfEditor") == 8
    assert "stage:'pdf-editor-core-runtime-manifest-v1'" in source
