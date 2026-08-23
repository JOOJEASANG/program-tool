from pathlib import Path
import json


ROOT = Path(__file__).resolve().parents[2]


def test_document_editor_stage1_release_floor_and_runtime_assets_remain_available():
    version = json.loads((ROOT / "version.json").read_text(encoding="utf-8"))
    prefix, revision = version["version"].rsplit(".", 1)
    assert prefix == "2026.08.23"
    assert int(revision) >= 4

    page = (ROOT / "document-editor" / "index.html").read_text(encoding="utf-8")
    app = (ROOT / "js" / "document-editor" / "app.js").read_text(encoding="utf-8")
    assert "/js/document-editor/app.js?v=20260823-1" in page
    assert "stage:'document-editor-core-stage1'" in app
    assert "programStudio.documentEditor.stage1" in app
