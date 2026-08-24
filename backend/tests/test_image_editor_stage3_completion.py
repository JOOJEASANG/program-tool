from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]


def test_image_editor_stage3_completion_scope_is_documented():
    text = (ROOT / "docs" / "image-editor-stage3.md").read_text(encoding="utf-8")
    for marker in ("1:1", "4:5", "3:2", "16:9", "Ctrl+V", "브라우저 로컬 처리", "2026.08.23.003"):
        assert marker in text
