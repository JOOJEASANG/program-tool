import re
from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]
REGISTER = ROOT / "js" / "sw-register.js"


def runtime_entries(source: str) -> list[tuple[str, str]]:
    return re.findall(
        r"\['(designEditor[^']+)'\s*,\s*'(/js/design-editor/[^']+)'\]",
        source,
    )


def test_design_editor_runtime_uses_one_ordered_manifest():
    source = REGISTER.read_text(encoding="utf-8")
    assert "const DESIGN_EDITOR_RUNTIME_SCRIPTS=Object.freeze([" in source
    assert "async function loadSeries(entries)" in source
    assert "tasks.push(loadSeries(DESIGN_EDITOR_RUNTIME_SCRIPTS));" in source
    assert ".then(()=>load('designEditorDraftScopeScriptV1'" not in source


def test_design_editor_runtime_manifest_is_unique_and_preserves_dependency_order():
    source = REGISTER.read_text(encoding="utf-8")
    entries = runtime_entries(source)
    ids = [item[0] for item in entries]
    paths = [item[1] for item in entries]

    assert len(entries) == 22
    assert len(ids) == len(set(ids))
    assert len(paths) == len(set(paths))
    assert ids[0] == "designEditorDraftScopeScriptV1"
    assert ids[1] == "designEditorEmbeddedRuntimeScriptV1"
    assert ids[-2:] == [
        "designEditorPrintBlocksScriptV1",
        "designEditorStyleThemesScriptV1",
    ]
    assert ids.index("designEditorPhase2ScriptV1") < ids.index("designEditorOutputScriptV1")
    assert ids.index("designEditorPrintQualityScriptV1") < ids.index("designEditorPrintSafetyScriptV1")
    assert ids.index("designEditorCanvasQuickbarScriptV1") < ids.index("designEditorSmartSnapScriptV1")


def test_series_loader_guards_duplicate_ids_and_keeps_sequential_loading():
    source = REGISTER.read_text(encoding="utf-8")
    assert "const seen=new Set();" in source
    assert "seen.has(id)" in source
    assert "seen.add(id);" in source
    assert "await load(id,src);" in source
    assert "Promise.all(DESIGN_EDITOR_RUNTIME_SCRIPTS" not in source
