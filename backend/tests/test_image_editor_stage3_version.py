from pathlib import Path
import json


ROOT = Path(__file__).resolve().parents[2]


def test_image_editor_stage3_deployment_version_is_synchronized():
    version = json.loads((ROOT / "version.json").read_text(encoding="utf-8"))
    assert version["version"] == "2026.08.23.003"
    assert "자르기 프리셋" in version["label"]
    assert "2026.08.23.003" in (ROOT / "js" / "sw-register.js").read_text(encoding="utf-8")
    assert "2026.08.23.003" in (ROOT / "sw.js").read_text(encoding="utf-8")
    assert "/js/sw-register.js?v=2026.08.23.003" in (ROOT / "js" / "firebase-config.js").read_text(encoding="utf-8")
