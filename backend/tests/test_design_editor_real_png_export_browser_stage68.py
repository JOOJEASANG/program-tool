from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]
HARNESS = ROOT / "tests" / "browser" / "design-editor-smoke.html"
RUNNER = ROOT / "scripts" / "run_design_editor_browser_smoke.sh"
REGISTER = ROOT / "js" / "sw-register.js"
SIMPLE_INTERFACE = ROOT / "js" / "design-editor" / "phase16-simple-interface.js"


def test_stage68_general_only_modules_boot_before_embedded_runtime_rewrites_route():
    source = REGISTER.read_text(encoding="utf-8")
    embedded_entry = "['designEditorEmbeddedRuntimeScriptV1','/js/design-editor/embedded-runtime.js?v=20260821-1']"
    embedded_index = source.index(embedded_entry)
    for entry in (
        "['designEditorOutputScriptV1','/js/design-editor/output.js?v=20260823-1']",
        "['designEditorPhase2ScriptV1','/js/design-editor/phase2.js?v=20260822-2']",
        "['designEditorComponentBlocksScriptV1','/js/design-editor/phase17-component-blocks.js?v=20260822-2']",
    ):
        assert source.index(entry) < embedded_index


def test_stage68_simple_interface_accepts_embedded_unified_editor_route():
    source = SIMPLE_INTERFACE.read_text(encoding="utf-8")
    assert "const embedded=new URLSearchParams(location.search).get('embed')==='1'" in source
    assert "const embeddedGeneralPath=embedded&&(path==='/design-editor/index.html'||path.endsWith('/design-editor/index.html'))" in source
    assert "if(!generalPath&&!embeddedGeneralPath)return" in source


def test_stage68_browser_smoke_runs_real_png_export_through_final_print_gate():
    source = HARNESS.read_text(encoding="utf-8")
    assert "const finalCheck=window.DesignEditorFinalPrintCheck" in source
    assert "finalCheck.confirmBeforeOutput=async options=>{gateFormat=String(options?.format||'');return true;}" in source
    assert "await DesignEditorOutput.exportPng()" in source
    assert "assert(gateFormat==='png','PNG export did not pass through the final print gate')" in source
    assert "finally{" in source
    assert "finalCheck.confirmBeforeOutput=originalGate" in source
    assert "HTMLAnchorElement.prototype.click=originalAnchorClick" in source


def test_stage68_browser_smoke_validates_real_png_signature_ihdr_and_filename():
    source = HARNESS.read_text(encoding="utf-8")
    assert "capturedDownload?.href?.startsWith('data:image/png;base64,')" in source
    assert "capturedDownload?.download?.endsWith('_300dpi.png')" in source
    assert "[137,80,78,71,13,10,26,10].every" in source
    assert "const pngWidth=pngView.getUint32(16)" in source
    assert "const pngHeight=pngView.getUint32(20)" in source
    assert "pngWidth===spec.widthPx&&pngHeight===spec.heightPx" in source
    assert "capturedDownload.href.length>1000" in source
    assert "textContent.includes('검증 후 만들었습니다')" in source


def test_stage68_runner_requires_real_png_export_markers():
    source = RUNNER.read_text(encoding="utf-8")
    assert "real PNG export" in source
    assert "data-exported-png-width=\"2551\"" in source
    assert "data-exported-png-height=\"3579\"" in source
    assert "data-exported-png-gate=\"png\"" in source
    assert "--virtual-time-budget=30000" in source
