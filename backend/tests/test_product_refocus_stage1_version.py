import json
import re
from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]
EXPECTED = "2026.08.25.010"


def test_product_refocus_stage1_release_version_is_synced():
    version = json.loads((ROOT / "version.json").read_text(encoding="utf-8"))
    sw = (ROOT / "sw.js").read_text(encoding="utf-8")
    register = (ROOT / "js" / "sw-register.js").read_text(encoding="utf-8")
    firebase = (ROOT / "js" / "firebase-config.js").read_text(encoding="utf-8")

    assert version["version"] == EXPECTED
    assert version["label"] == "인쇄실무 · 펼침면 PDF 좌우 분할"
    assert f"APP_VERSION='{EXPECTED}'" in sw
    assert f"const VERSION='{EXPECTED}'" in register
    assert f"/js/sw-register.js?v={EXPECTED}" in firebase
    assert re.search(r"/js/home-professional-suite\.js\?v='\+VERSION", register)
    assert re.search(r"/js/pdf-all-in-one-stage1\.js\?v=20260824-1", register)
