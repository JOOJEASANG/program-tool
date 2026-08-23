from pathlib import Path
import json


ROOT = Path(__file__).resolve().parents[2]
RELEASE_FLOOR = (2026, 8, 24, 3)


def version_tuple(value: str) -> tuple[int, int, int, int]:
    parts = tuple(int(part) for part in str(value).split("."))
    assert len(parts) == 4
    return parts


def test_document_editor_stage4_release_floor_and_runtime_sync():
    version = json.loads((ROOT / "version.json").read_text(encoding="utf-8"))
    current = version["version"]
    assert version_tuple(current) >= RELEASE_FLOOR

    sw_register = (ROOT / "js" / "sw-register.js").read_text(encoding="utf-8")
    sw = (ROOT / "sw.js").read_text(encoding="utf-8")
    firebase = (ROOT / "js" / "firebase-config.js").read_text(encoding="utf-8")
    page = (ROOT / "document-editor" / "index.html").read_text(encoding="utf-8")
    workflow = (ROOT / "js" / "document-editor" / "workflow.js").read_text(encoding="utf-8")
    table_tools = (ROOT / "js" / "document-editor" / "table-tools.js").read_text(encoding="utf-8")

    assert f"const VERSION='{current}'" in sw_register
    assert f"const APP_VERSION='{current}'" in sw
    assert f"/js/sw-register.js?v={current}" in firebase
    assert "/js/document-editor/workflow.js?v=20260824-2" in page
    assert "/css/document-editor-table-tools.css?v=20260824-1" in page
    assert "/js/document-editor/table-tools.js?v=20260824-1" in page
    assert "stage:'document-editor-workflow-stage2'" in workflow
    assert "stage:'document-editor-table-tools-stage4'" in table_tools
