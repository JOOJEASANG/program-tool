from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]
INDEX = ROOT / "print-checker" / "index.html"
CORE = ROOT / "js" / "print-checker" / "print-checker.js"
GUIDES = ROOT / "js" / "print-checker" / "production-guides-v2.js"
ZOOM = ROOT / "js" / "print-checker" / "preview-zoom.js"
SPINE_LIVE = ROOT / "js" / "print-checker" / "spine-live-dimension.js"
PAGE_LAYOUT = ROOT / "js" / "print-checker" / "page-layout-v2.js"
GUIDE_CSS = ROOT / "css" / "print-checker-production-guides.css"
PAGE_LAYOUT_CSS = ROOT / "css" / "print-checker-page-layout-v2.css"
INJECT = ROOT / "scripts" / "inject_boot_guard.py"
HOSTING = ROOT / "scripts" / "prepare_hosting_dist.py"


def text(path: Path) -> str:
    return path.read_text(encoding="utf-8")


def test_print_checker_uses_distinct_transparent_production_guide_layers():
    index = text(INDEX)
    source = text(GUIDES)
    css = text(GUIDE_CSS)

    assert "/css/print-checker-production-guides.css?v=20260911-2" in index
    assert "/js/print-checker/production-guides-v2.js?v=20260910-3" in index
    assert "v4-thin-dotted-guides" in source
    assert "const THIN_DOTTED = Object.freeze({ width: 1.2, dash: [4, 4] });" in source
    assert "drawCoverGuides" in source
    assert "뒷면 안쪽 여백" in source
    assert "앞면 안쪽 여백" in source
    assert "작업사이즈 전체" in source
    assert "재단선(실제사이즈)" in source
    assert "rgba(255,255,255,.96)" not in source
    assert "#previewGuideLayer" in css and "display:none!important" in css
    assert "#previewCanvas" in css and "opacity:0!important" in css
    assert "#productionGuideLayer" in css and "background:transparent!important" in css
    assert "--pc-work-ratio" in css


def test_leaflet_and_invitation_fold_guides_are_separated():
    core = text(CORE)
    source = text(GUIDES)

    assert "leaflet:" in core and "hasFold: true" in core
    for fold_key in ("'2fold'", "'3roll'", "'3zfold'", "'4fold'"):
        assert fold_key in core
        assert fold_key in source

    assert "leafletFoldType: byId('foldType')?.value || '3roll'" in source
    assert "if (product === 'leaflet') drawLeafletFolds(ctx, specs, trim);" in source
    assert "리플렛 접지선" in source
    assert "emphasizedFoldLine" in source

    assert "if (product === 'invitation') drawInvitationFolds(ctx, specs, trim);" in source
    assert "초대장 반접기선" in source
    assert "반접기 · 가운데 1줄" in source
    assert "접지 없음" in source
    assert 'value="tri_z"' not in source
    assert 'value="tri_roll"' not in source
    assert "초대장·안내장은 반접기선만 별도로 표시합니다." in source


def test_preview_canvas_starts_fit_to_screen_and_keeps_manual_zoom_controls():
    index = text(INDEX)
    zoom = text(ZOOM)
    css = text(GUIDE_CSS)

    assert "/js/print-checker/preview-zoom.js?v=20260911-3" in index
    for control_id in ("previewZoomOut", "previewZoomLabel", "previewZoomIn", "previewZoomReset"):
        assert f'id="{control_id}"' in index

    assert 'id="previewZoomReset"' in index and ">맞춤</button>" in index
    assert 'id="previewZoomReset" type="button">100%</button>' not in index
    assert "const MIN_ZOOM = 25;" in zoom
    assert "const MAX_ZOOM = 200;" in zoom
    assert "const STEP = 25;" in zoom
    assert "const FIT_MAX_ZOOM = 100;" in zoom
    assert "function fitToScreen()" in zoom
    assert "mode = 'fit'" in zoom
    assert "programstudio:print-checker-product-stable" in zoom
    assert "programstudio:print-checker-zoom-changed" in zoom
    assert "event.ctrlKey" in zoom and "event.metaKey" in zoom
    assert "dimensionHeight" not in zoom
    assert "v3-fit-compact-top" in zoom
    assert "width:var(--pc-preview-zoom, 100%)" in css
    assert "overflow:auto" in css


def test_cover_live_dimensions_are_outside_canvas_at_toolbar_left():
    index = text(INDEX)
    source = text(SPINE_LIVE)
    css = text(GUIDE_CSS)

    assert "/js/print-checker/spine-live-dimension.js?v=20260911-3" in index
    assert "coverLiveDimensions" in source
    assert "실시간 치수" in source
    assert "cover-spine-dimension" in source
    assert ">책등</span>" in source
    assert "data-cover-work-dimension" in source
    assert "data-cover-spine-dimension" in source
    assert "workW = trimW * 2 + spine + wing * 2 + bleed * 2" in source
    assert "byId('previewZoomToolbar')" in source
    assert "toolbar.prepend(bar)" in source
    assert "wrap.prepend(bar)" not in source
    assert "justify-content:flex-start" in source
    assert "v3-toolbar-left-compact" in source
    assert ".print-checker-page #printCheckerMain.canvas-area" in css
    assert "padding-top:8px" in css
    assert "gap:8px" in css
    assert ".print-checker-page .canvas-wrap" in css
    assert "padding:4px 8px 8px" in css
    assert "margin:0 0 2px" in css


def test_booklet_mode_hides_preview_canvas_and_keeps_imposition_board_only():
    css = text(GUIDE_CSS)

    marker = 'html[data-print-checker-booklet-layout-only="1"]'
    assert f"{marker} #previewZoomToolbar" in css
    assert f"{marker} .canvas-wrap" in css
    assert f"{marker} #leafletGuide" in css
    assert f"{marker} #contentPreflightSection" in css
    assert f"{marker} #reportSection" in css
    assert "display:none!important" in css
    assert f"{marker} #impositionGuide" not in css


def test_top_guide_box_removed_and_large_front_back_layout_is_connected():
    index = text(INDEX)
    layout = text(PAGE_LAYOUT)
    css = text(PAGE_LAYOUT_CSS)

    assert 'id="canvasHeader"' not in index
    assert "PRINT SPEC CHECKER" not in index
    assert 'class="canvas-tips"' not in index
    assert "/css/print-checker-page-layout-v2.css?v=20260910-1" in index
    assert "/js/print-checker/page-layout-v2.js?v=20260910-2" in index
    assert "pc-layout-columns" in layout
    assert "앞면 배치" in layout
    assert "뒷면 배치" in layout
    assert "리플렛 페이지 배치" in layout
    assert "소책자 페이지 배치" in layout
    assert "pc-booklet-only-hidden" in layout
    assert "grid-template-columns:minmax(0,1fr) minmax(0,1fr)" in css
    assert ".pc-layout-front" in css
    assert ".pc-layout-back" in css
    assert ".pc-booklet-page" in css


def test_booklet_layout_is_restored_as_html_board_even_if_legacy_mode_hides_it():
    layout = text(PAGE_LAYOUT)

    assert "typeof PrintChecker !== 'undefined'" in layout
    assert "window.PrintCheckerBookletLayoutOnly" in layout
    assert "helper?.buildLayoutPlan" in layout
    assert "target.classList.remove('pc-booklet-only-hidden')" in layout
    assert "target.hidden = false" in layout
    assert "guideObserver.observe(target" in layout
    assert "모든 시트의 앞면" in layout
    assert "모든 시트의 뒷면" in layout


def test_program_manual_subsystem_is_not_injected_or_packaged_anymore():
    inject = text(INJECT)
    hosting = text(HOSTING)

    assert "program-manual" not in inject
    assert '"manuals"' not in hosting
    assert "program manual center" not in hosting

    retired = (
        ".github/workflows/manual-sync.yml",
        "css/program-manual-home-modal.css",
        "css/program-manuals.css",
        "docs/manuals/README.md",
        "manuals/index.html",
        "js/program-manuals/app.js",
        "js/program-manuals/catalog.js",
        "js/program-manuals/context-link.js",
        "js/program-manuals/home-modal.js",
        "js/program-manuals/pdf-editor-advanced.js",
        "js/program-manuals/pdf-editor.js",
        "js/program-manuals/pdf-suite.js",
        "js/program-manuals/print-checker.js",
        "js/program-manuals/smart-print-layout.js",
        "scripts/check_manual_sync.py",
        "scripts/run_program_manuals_browser_smoke.sh",
        "scripts/validate_program_manuals.py",
        "tests/browser/program-manuals-smoke.html",
    )
    for relative in retired:
        assert not (ROOT / relative).exists(), relative