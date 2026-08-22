from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]
HARNESS = ROOT / "tests" / "browser" / "design-editor-smoke.html"
REGISTER = ROOT / "js" / "sw-register.js"


def test_stage65_browser_smoke_collects_every_production_runtime_result():
    source = HARNESS.read_text(encoding="utf-8")
    assert "window.__browserSmokeRuntimeResults=[]" in source
    assert "programstudio:runtime-script-result" in source
    assert "runtimeResultsForManifest" in source
    assert "latest.size===manifest.length" in source
    assert "runtimeBoot.manifest.length===27" in source
    assert "event?.status==='loaded'" in source
    assert "node?.dataset?.loaded==='true'" in source
    assert "!node?.dataset?.failed" in source
    assert "dataset.runtimeExpected" in source
    assert "dataset.runtimeLoaded" in source


def test_stage65_browser_smoke_uses_runtime_diagnostics_as_second_independent_check():
    source = HARNESS.read_text(encoding="utf-8")
    for marker in (
        "DesignEditorRuntimeDiagnostics.audit()",
        "health.ok===true",
        "health.runtime.expected===runtimeBoot.manifest.length",
        "health.runtime.loaded===runtimeBoot.manifest.length",
        "health.runtime.failed===0",
        "health.runtime.missing===0",
        "health.storage.localStorage===true",
        "health.storage.indexedDB===true",
        "health.project.ready===true&&health.project.activeSurfaceExists===true",
    ):
        assert marker in source


def test_stage65_browser_smoke_rejects_runtime_and_resource_error_records():
    source = HARNESS.read_text(encoding="utf-8")
    assert "DesignEditorRuntimeDiagnostics.report()" in source
    assert "'error','rejection','resource-error','runtime-error','runtime-timeout'" in source
    assert "fatalRecords.length===0" in source
    assert "full runtime manifest" in source


def test_stage65_manifest_contract_and_browser_contract_keep_same_expected_count():
    register = REGISTER.read_text(encoding="utf-8")
    harness = HARNESS.read_text(encoding="utf-8")
    manifest_block = register[register.index("const DESIGN_EDITOR_RUNTIME_SCRIPTS=Object.freeze(["):register.index("]);", register.index("const DESIGN_EDITOR_RUNTIME_SCRIPTS=Object.freeze(["))]
    assert manifest_block.count("['designEditor") == 27
    assert "runtimeBoot.manifest.length===27" in harness
