import json
from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]
SHELL = ROOT / "design-editor" / "index.html"
RUNTIME = ROOT / "js" / "design-editor" / "embedded-runtime.js"
REGISTER = ROOT / "js" / "sw-register.js"
FIREBASE = ROOT / "firebase.json"


def test_shell_uses_absolute_routes_for_all_embedded_modes():
    source = SHELL.read_text(encoding="utf-8")
    assert 'src="/perfect-binding-cover/?embed=1&mode=cover"' in source
    assert "return '/perfect-binding-cover/?embed=1&mode=cover'" in source
    assert "return `/design-editor/general?${query.toString()}`" in source
    assert "return `general.html?${query.toString()}`" not in source
    assert "window.UnifiedDesignShell={openMode,route" in source


def test_clean_general_route_is_recognized_by_runtime_loader():
    runtime = RUNTIME.read_text(encoding="utf-8")
    register = REGISTER.read_text(encoding="utf-8")
    assert "originalPath==='/design-editor/general'" in runtime
    assert "isPath('/design-editor/general','/design-editor/general.html')" in register


def test_firebase_explicitly_routes_unified_shell_and_general_editor():
    config = json.loads(FIREBASE.read_text(encoding="utf-8"))
    rewrites = config["hosting"]["rewrites"]
    pairs = {(item.get("source"), item.get("destination")) for item in rewrites}
    assert ("/design-editor", "/design-editor/index.html") in pairs
    assert ("/design-editor/general", "/design-editor/general.html") in pairs
