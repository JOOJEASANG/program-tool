from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]
PREVIEW = ROOT / "js" / "design-editor" / "cover-preview-zones.js"
POLISH = ROOT / "js" / "design-editor" / "phase6-embedded-polish.js"
REGISTER = ROOT / "js" / "sw-register.js"
GENERAL_HARNESS = ROOT / "tests" / "browser" / "design-editor-smoke.html"
COVER_HARNESS = ROOT / "tests" / "browser" / "design-editor-cover-smoke.html"
COVER_RUNNER = ROOT / "scripts" / "run_design_editor_cover_smoke.sh"


def test_stage75_cover_preview_is_preview_only_and_tracks_three_cover_regions():
    source = PREVIEW.read_text(encoding="utf-8")
    for marker in (
        "const DEFAULTS={visible:true,labels:true,safe:true,opacity:12,zoom:1}",
        "zoneBox('back'",
        "zoneBox('spine'",
        "zoneBox('front'",
        "overlay.dataset.zoneCount='3'",
        "programstudio:cover-geometry-change",
        "가이드와 화면 배율은 PNG/PDF 출력에 포함되지 않습니다.",
        "stage:'preview-zones-wheel-and-context-menu'",
    ):
        assert marker in source
    assert "project().surfaces" not in source


def test_stage75_cover_mouse_uses_wheel_and_context_menu_without_replacing_plain_scroll():
    source = PREVIEW.read_text(encoding="utf-8")
    for marker in (
        "event.ctrlKey||event.metaKey",
        "changeZoom(event.deltaY<0?.1:-.1)",
        "event.altKey&&selectedNode()",
        "event.shiftKey&&Math.abs(event.deltaY)>Math.abs(event.deltaX)",
        "document.addEventListener('contextmenu',showContextMenu,true)",
        "책등 제목 추가",
        "복제",
        "잠금 / 잠금 해제",
        "삭제",
    ):
        assert marker in source


def test_stage75_design_mode_selector_is_kept_first_and_sticky():
    source = POLISH.read_text(encoding="utf-8")
    for marker in (
        "function keepModeCardFirst()",
        "sidebar.firstElementChild!==card",
        "sidebar.insertBefore(card,sidebar.firstElementChild)",
        "sidebar.dataset.designModeCardPinned='top'",
        ".sidebar>#designEmbeddedModeCard{order:-9999!important;position:sticky!important;top:0!important",
        "sidebarObserver.observe(sidebar,{childList:true});",
    ):
        assert marker in source
    assert "subtree:true" not in source


def test_stage75_general_mouse_menu_reuses_existing_editor_controls():
    source = POLISH.read_text(encoding="utf-8")
    for marker in (
        "DesignEditorElementClipboard?.copySelected?.()",
        "clickFirst('phase2ExtraDuplicate','duplicateBtn')",
        "clickFirst('phase2ExtraFront','layerFrontBtn')",
        "clickFirst('phase2ExtraBack','layerBackBtn')",
        "DesignEditorPhase3Controls?.alignSelected?.(direction)",
        "clickFirst('phase2ExtraDelete','deleteBtn')",
        "showContextMenu",
        "scaleSelected",
        "handleWheel",
        "stage:'top-pinned-mode-selector-wheel-and-context-menu'",
    ):
        assert marker in source


def test_stage75_runtime_manifest_and_real_browser_contract_include_preview_and_mouse_behaviors():
    register = REGISTER.read_text(encoding="utf-8")
    general = GENERAL_HARNESS.read_text(encoding="utf-8")
    cover = COVER_HARNESS.read_text(encoding="utf-8")
    runner = COVER_RUNNER.read_text(encoding="utf-8")
    assert "designEditorCoverPreviewZonesScriptV1" in register
    assert "/js/design-editor/cover-preview-zones.js?v=20260823-1" in register
    assert "runtimeBoot.manifest.length===32" in general
    assert "firstElementChild?.id==='designEmbeddedModeCard'" in general
    assert "new MouseEvent('contextmenu'" in general
    assert "new WheelEvent('wheel'" in general
    assert "data-mode-selector-top" in general
    assert "ids.size===32&&latest.size===32" in cover
    assert "data-cover-preview-zones" in cover
    assert "PASS: unified cover preview zones, settings, spine direction, safety and real render" in runner
    assert 'data-cover-runtime="32"' in runner
