from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]


def test_preview_controller_drops_duplicate_requests_while_running():
    source = (ROOT / "js" / "pdf-editor" / "preview-controller.js").read_text(encoding="utf-8")

    assert "signature !== activeSignature" in source
    assert "passCount < 2" in source
    assert "window.__pdfEditorManualPreviewRequest = false" in source
    assert "__pdfPreviewControllerV3" in source


def test_loader_uses_new_preview_controller_asset_version():
    source = (ROOT / "js" / "pdf-editor" / "loader.js").read_text(encoding="utf-8")

    assert "preview-controller.js?v=20260727-3" in source
    assert "__pdfEditorModuleLoaderV35" in source
