import json
from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]


def test_product_refocus_release_version_is_synced_with_canonical_pdf_routes():
    version = json.loads((ROOT / "version.json").read_text(encoding="utf-8"))
    sw = (ROOT / "sw.js").read_text(encoding="utf-8")
    register = (ROOT / "js" / "sw-register.js").read_text(encoding="utf-8")
    firebase = (ROOT / "js" / "firebase-config.js").read_text(encoding="utf-8")
    preflight = (ROOT / "js" / "pdf-preflight" / "route-runtime.js").read_text(encoding="utf-8")
    pdf_editor = (ROOT / "js" / "pdf-editor" / "route-runtime.js").read_text(encoding="utf-8")

    expected = str(version["version"]).strip()
    assert expected
    assert str(version.get("label") or "").strip()
    assert f"APP_VERSION='{expected}'" in sw
    assert f"const VERSION='{expected}'" in register
    assert f"/js/sw-register.js?v={expected}" in firebase
    assert "home-professional-suite.js" not in register
    assert "/js/pdf-preflight/route-runtime.js?v=20260831-1" in register
    assert "/js/pdf-all-in-one-stage1.js?v=20260831-2" in preflight
    assert "/js/pdf-all-in-one-stage1.js" in pdf_editor
