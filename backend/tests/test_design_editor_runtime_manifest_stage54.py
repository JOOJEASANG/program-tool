import re
from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]
REGISTER = ROOT / "js" / "sw-register.js"


def _manifest_entries(source: str):
    match = re.search(
        r"const DESIGN_EDITOR_RUNTIME_SCRIPTS=Object\.freeze\(\[(.*?)\]\);",
        source,
        re.S,
    )
    assert match
    return re.findall(r"\['([^']+)','([^']+)'\]", match.group(1))


def test_design_editor_runtime_manifest_is_single_ordered_source_of_truth():
    source = REGISTER.read_text(encoding="utf-8")
    entries = _manifest_entries(source)

    assert len(entries) == 27
    ids = [item[0] for item in entries]
    paths = [item[1] for item in entries]
    assert len(ids) == len(set(ids))
    assert len(paths) == len(set(paths))
    assert ids[0] == "designEditorRuntimeDiagnosticsScriptV1"
    assert ids[1] == "designEditorDraftScopeScriptV1"
    assert ids[2] == "designEditorEmbeddedRuntimeScriptV1"
    assert ids[-2:] == [
        "designEditorStyleThemesScriptV1",
        "designEditorDesignRecipesScriptV1",
    ]
    assert paths[0] == "/js/design-editor/runtime-diagnostics.js?v=20260823-1"
    assert "window.ProgramStudioDesignEditorRuntimeManifest" in source


def test_design_editor_runtime_manifest_preserves_dependency_order():
    source = REGISTER.read_text(encoding="utf-8")
    ids = [item[0] for item in _manifest_entries(source)]

    def before(first: str, second: str):
        assert ids.index(first) < ids.index(second)

    before("designEditorRuntimeDiagnosticsScriptV1", "designEditorDraftScopeScriptV1")
    before("designEditorDraftScopeScriptV1", "designEditorAssetStoreScriptV1")
    before("designEditorAssetStoreScriptV1", "designEditorPhase2ScriptV1")
    before("designEditorPhase2ScriptV1", "designEditorOutputScriptV1")
    before("designEditorOutputScriptV1", "designEditorFinalPrintCheckScriptV1")
    before("designEditorElementClipboardScriptV1", "designEditorProjectFileScriptV1")
    before("designEditorProjectFileScriptV1", "designEditorCloudProjectsScriptV1")
    before("designEditorQuickDesignScriptV1", "designEditorSimpleInterfaceScriptV1")
    before("designEditorSimpleInterfaceScriptV1", "designEditorComponentBlocksScriptV1")
    before("designEditorPrintBlocksScriptV1", "designEditorStyleThemesScriptV1")
    before("designEditorStyleThemesScriptV1", "designEditorDesignRecipesScriptV1")


def test_design_editor_runtime_manifest_uses_sequential_loader_only():
    source = REGISTER.read_text(encoding="utf-8")
    assert "async function loadSeries(entries)" in source
    assert "for(const [id,src] of entries)" in source
    assert "await load(id,src)" in source
    assert "tasks.push(loadSeries(DESIGN_EDITOR_RUNTIME_SCRIPTS))" in source

    general_start = source.index("if(isPath('/design-editor/general','/design-editor/general.html'))")
    general_end = source.index("if(isPath(\n      '/tools/pdf-editor.html'", general_start)
    general_block = source[general_start:general_end]
    for script_id, _ in _manifest_entries(source):
        assert f"load('{script_id}'" not in general_block


def test_runtime_loader_reports_failures_without_mislabeling_them_loaded():
    source = REGISTER.read_text(encoding="utf-8")
    assert "programstudio:runtime-script-result" in source
    assert "node.dataset.failed=status" in source
    assert "if(status==='loaded')" in source
    assert "script.addEventListener('error',()=>done('error')" in source
    assert "setTimeout(()=>done('timeout'),1200)" in source
    assert "const done=()=>{script.dataset.loaded='true';resolve()}" not in source
