from pathlib import Path
import json


ROOT = Path(__file__).resolve().parents[2]


def version_tuple(value: str) -> tuple[int, int, int, int]:
    parts = tuple(int(part) for part in str(value).split("."))
    assert len(parts) == 4
    return parts


def test_image_editor_stage3_release_floor_and_runtime_assets_remain_available():
    version = json.loads((ROOT / "version.json").read_text(encoding="utf-8"))
    assert version_tuple(version["version"]) >= (2026, 8, 23, 3)

    page = (ROOT / "image-editor" / "index.html").read_text(encoding="utf-8")
    workflow = (ROOT / "js" / "image-editor" / "workflow.js").read_text(encoding="utf-8")
    completion = (ROOT / "IMAGE_EDITOR_STAGE3.md").read_text(encoding="utf-8")
    assert "/js/image-editor/workflow.js?v=20260823-3" in page
    assert "stage:'image-editor-workflow-stage3'" in workflow
    assert "1:1" in completion and "Ctrl+V" in completion
