from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]


def test_general_editor_runtime_modules_with_explicit_route_guards_target_general_editor():
    guarded_modules = [
        ROOT / "js" / "design-editor" / "runtime-diagnostics.js",
        ROOT / "js" / "design-editor" / "phase2.js",
        ROOT / "js" / "design-editor" / "phase16-simple-interface.js",
    ]
    for path in guarded_modules:
        source = path.read_text(encoding="utf-8")
        assert "/design-editor/general" in source, path.name
        assert "/design-editor/general.html" in source, path.name
