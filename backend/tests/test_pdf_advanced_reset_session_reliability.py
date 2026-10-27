"""Advanced editor reset and session-restore regression contracts."""
from pathlib import Path
import subprocess

ROOT = Path(__file__).resolve().parents[2]
ADV = ROOT / "js" / "pdf-editor-advanced"


def source(path: str) -> str:
    return (ROOT / path).read_text(encoding="utf-8")


def test_settings_reference_identity_survives_editor_reset_and_undo():
    result = subprocess.run(
        ["node", "--test", str(ROOT / "tests" / "pdf-advanced-reset-state.test.mjs")],
        cwd=ROOT, capture_output=True, text=True, timeout=30, check=False,
    )
    assert result.returncode == 0, result.stdout + result.stderr


def test_reset_discards_embedded_overlays_and_sticky_erase_mode():
    reset = source("js/pdf-editor-advanced/workspace-reset.js")
    sticky = source("js/pdf-editor-advanced/workspace-input-polish.js")
    assert "page.overlays = [];" in reset
    assert "persistPageMetadata?.(page)" in reset
    assert "setValue('advancedTrimWidth', '');" in reset
    assert "emitStateChange('workspace-reset')" in reset
    assert "reason === 'workspace-reset'" in sticky
    assert "stickyErase = false" in sticky


def test_saved_session_imports_are_awaited_and_atomic():
    app = source("js/pdf-editor-advanced/app.js")
    session = source("js/pdf-editor-advanced/session-persistence.js")
    html = source("pdf-editor-advanced/index.html")
    assert "export async function loadPdfFiles(fileList, { replace = false } = {})" in app
    assert "const oldDocuments = [...advancedState.documents]" in app
    assert "const imported = await loadPdfFiles(files, { replace: true });" in session
    assert "if (!imported) throw new Error(" in session
    assert "Object.assign(advancedState.margins, clone(state.margins || {}))" in session
    assert "new DataTransfer()" not in session
    assert "waitForImport(" not in session
    # Keep one ESM module instance: a different query string causes duplicate init.
    assert "from './app.js?v=20261027-2'" in session
    assert 'src="/js/pdf-editor-advanced/app.js?v=20261027-2"' in html


def test_no_program_page_adds_usage_help_controls():
    ui = source("js/program-studio-ui-v2.js")
    for obsolete in ("SIMPLE_HELP", "psSimpleHelpTrigger", "openSimpleHelp", "mountSimpleHelpTrigger"):
        assert obsolete not in ui
    catalog = source("js/program-manuals/catalog.js")
    assert "30초 안내" not in catalog
