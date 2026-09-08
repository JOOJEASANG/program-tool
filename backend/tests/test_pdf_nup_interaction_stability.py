from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]
STABILITY = ROOT / "js" / "pdf-editor" / "nup-interaction-stability.js"
ZOOM_PERSISTENCE = ROOT / "js" / "pdf-editor" / "preview-zoom-persistence.js"
CORE_RUNTIME = ROOT / "js" / "pdf-editor" / "core-runtime.js"
ADVANCED_RUNTIME = ROOT / "js" / "pdf-editor" / "advanced-runtime.js"
BROWSER_SMOKE = ROOT / "tests" / "browser" / "pdf-nup-interaction-stability-smoke.html"


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


def test_user_selected_preview_zoom_blocks_background_autofit_until_user_changes_it():
    source = ZOOM_PERSISTENCE.read_text(encoding="utf-8")

    assert "#zoomInBtn,#zoomOutBtn,#zoomResetBtn" in source
    assert "userPinned=true" in source
    assert "explicitAutoFit=true" in source
    assert "effectiveAutoFit=requestedAutoFit&&(!userPinned||explicit)" in source
    assert "document.addEventListener('click',onZoomControl,true)" in source
    assert "stage:'user-selected-preview-zoom-sticky-v1'" in source


def test_zoom_persistence_loads_before_nup_interaction_handlers_in_advanced_runtime():
    core = CORE_RUNTIME.read_text(encoding="utf-8")
    source = ADVANCED_RUNTIME.read_text(encoding="utf-8")

    zoom = source.index(".then(()=>loadPreviewZoomPersistence())")
    stability = source.index(".then(()=>loadNupInteractionStability())")
    adjustment = source.index(".then(()=>loadNupPageAdjust())")
    direct = source.index(".then(()=>loadNupDirectPreviewEdit())")

    assert zoom < stability < adjustment < direct
    assert "pdfPreviewZoomPersistenceScriptV1" in source
    assert "/js/pdf-editor/preview-zoom-persistence.js?v=20260908-1" in source
    assert "pdfNupInteractionStabilityScriptV1" in source
    assert "/js/pdf-editor/nup-interaction-stability.js?v=20260908-1" in source
    module_block = core.split("const MODULES=Object.freeze([", 1)[1].split("]);", 1)[0]
    assert module_block.count("src:'/js/pdf-editor/") == 8
    assert "pdfPreviewZoomPersistenceScriptV1" not in core
    assert "stage:'pdf-editor-core-runtime-manifest-v1'" in core
    assert "stage:'pdf-editor-advanced-runtime-v1'" in source


def test_browser_smoke_verifies_200_percent_stays_fixed_during_nup_edit_and_reset_is_explicit():
    source = BROWSER_SMOKE.read_text(encoding="utf-8")

    assert "pinnedAt200" in source
    assert "sticky200" in source
    assert "explicitReset" in source
    assert "window.displayPreview([],true)" in source
    assert "zoomLabel').textContent==='200%'" in source
    assert "preserves user-selected 200% preview zoom" in source
