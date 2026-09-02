from pathlib import Path
import json
from conftest import version_tuple


ROOT = Path(__file__).resolve().parents[2]


def version_tuple(value: str) -> tuple[int, int, int, int]:
    parts = tuple(int(part) for part in str(value).split("."))
    assert len(parts) == 4
    return parts


def test_document_editor_stage1_release_floor_and_runtime_assets_remain_available():
    version = json.loads((ROOT / "version.json").read_text(encoding="utf-8"))
    assert version_tuple(version["version"]) >= (2026, 8, 23, 4)

    page = (ROOT / "document-editor" / "index.html").read_text(encoding="utf-8")
    app = (ROOT / "js" / "document-editor" / "app.js").read_text(encoding="utf-8")
    assert "/js/document-editor/app.js?v=20260823-1" in page
    assert "stage:'document-editor-core-stage1'" in app
    assert "programStudio.documentEditor.stage1" in app
