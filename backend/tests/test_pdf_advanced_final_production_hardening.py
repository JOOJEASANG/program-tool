from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]
CSS = ROOT / "css" / "pdf-editor-advanced.css"
RUNNER = ROOT / "scripts" / "run_phase5_browser_smoke.sh"
ISOLATION_SMOKE = ROOT / "tests" / "browser" / "pdf-advanced-sidebar-hard-isolation-smoke.html"
FACING_SMOKE = ROOT / "tests" / "browser" / "pdf-advanced-upload-facing-smoke.html"


def text(path: Path) -> str:
    return path.read_text(encoding="utf-8")


def test_crop_inputs_are_visually_separated_from_page_edit_actions():
    css = text(CSS)
    assert "#pageEditSection .number-grid.four + .button-grid.two{margin-top:12px}" in css


def test_standalone_advanced_pdf_runtime_is_in_release_browser_gate():
    runner = text(RUNNER)
    isolation = text(ISOLATION_SMOKE)
    facing = text(FACING_SMOKE)

    assert 'pdf-advanced-sidebar-hard-isolation-smoke.html' in runner
    assert 'data-pdf-advanced-sidebar-hard-isolation-smoke="pass"' in runner
    assert 'pdf-advanced-upload-facing-smoke.html' in runner
    assert 'data-pdf-advanced-upload-facing-smoke="pass"' in runner

    assert "pdfAdvancedSidebarHardIsolationSmoke='pass'" in isolation
    assert "pdfAdvancedUploadFacingSmoke='pass'" in facing
