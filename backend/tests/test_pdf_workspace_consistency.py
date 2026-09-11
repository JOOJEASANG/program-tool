from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]
ADVANCED_CSS = ROOT / "css" / "pdf-editor-advanced.css"
STABILITY = ROOT / "js" / "pdf-suite" / "workspace-stability.js"
HOSTING = ROOT / "scripts" / "prepare_hosting_dist.py"
MENU_SMOKE = ROOT / "tests" / "browser" / "pdf-utility-menu-audit-smoke.html"
RUNNER = ROOT / "scripts" / "run_pdf_program_shell_smoke.sh"


def read(path: Path) -> str:
    return path.read_text(encoding="utf-8")


def test_advanced_editor_empty_preview_is_hard_centered():
    css = read(ADVANCED_CSS)
    hosting = read(HOSTING)

    for marker in (
        'body[data-pdf-advanced-standalone="1"] #previewScroll>#emptyState',
        "position:absolute",
        "place-content:center",
        "place-items:center",
        "text-align:center",
        '#previewScroll>#emptyState[hidden]{display:none!important}',
    ):
        assert marker in css

    assert 'PDF_ADVANCED_EMPTY_STATE_MARKER = "data-pdf-advanced-empty-state-center"' in hosting
    assert "PDF_ADVANCED_EMPTY_STATE_SNIPPET" in hosting
    assert "place-content:center!important" in hosting


def test_pdf_suite_hides_legacy_first_paint_until_split_workspace_is_ready():
    hosting = read(HOSTING)

    for marker in (
        'PDF_SUITE_FIRST_PAINT_MARKER = "data-pdf-suite-first-paint-guard"',
        "root.classList.add('pdf-suite-booting')",
        "root.dataset.pdfUtilityLayout==='split'",
        "root.classList.remove('pdf-suite-booting')",
        "root.dataset.pdfUtilityFirstPaint='ready'",
        "html.pdf-suite-booting body>*{visibility:hidden!important}",
        "setTimeout(reveal,8000)",
        "_inject_before(suite, PDF_SUITE_FIRST_PAINT_MARKER, \"</head>\", PDF_SUITE_FIRST_PAINT_SNIPPET)",
    ):
        assert marker in hosting

    assert "single-page-shell.js?v=20260911-4" in hosting
    assert "workspace-stability.js?v=20260911-2" in hosting


def test_pdf_utility_rejects_stale_overlays_from_previous_menu_selection():
    source = read(STABILITY)

    for marker in (
        "__programStudioPdfUtilityWorkspaceStabilityV2",
        "function expectedOverlayIds",
        "if(!expectedOverlayIds(name).has(overlay.id)){closeOverlay(overlay);return false;}",
        "if(expected.has(overlay.id))normalizeOverlay(overlay,name);",
        "else closeOverlay(overlay);",
        "document.addEventListener('click',onMenuBeforeChange,true)",
        "document.addEventListener('click',onMenuAfterChange,false)",
        "if(serial!==auditSerial||name!==currentName())return;",
        "pdf-utility-workspace-stability-v2",
    ):
        assert marker in source

    assert "removeClass(overlay,'open','pdfu-inline-overlay','pdfu-stable-inline')" in source


def test_full_pdf_utility_menu_browser_audit_remains_in_quality_gate():
    smoke = read(MENU_SMOKE)
    runner = read(RUNNER)

    assert "dataset.pdfUtilityMenuAuditSmoke='pass'" in smoke
    assert "for(const button of allButtons)" in smoke
    assert "assertUnlocked(name);assertStage(name);" in smoke
    assert "pdf-utility-menu-audit-smoke.html" in runner
