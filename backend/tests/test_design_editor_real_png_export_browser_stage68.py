from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]
HARNESS = ROOT / "tests" / "browser" / "design-editor-smoke.html"
RUNNER = ROOT / "scripts" / "run_design_editor_browser_smoke.sh"
REGISTER = ROOT / "js" / "sw-register.js"


def test_stage68_output_boots_before_embedded_runtime_rewrites_general_route():
    source = REGISTER.read_text(encoding="utf-8")
    output_entry = "['designEditorOutputScriptV1','/js/design-editor/output.js?v=20260823-1']"
    embedded_entry = "['designEditorEmbeddedRuntimeScriptV1','/js/design-editor/embedded-runtime.js?v=20260821-1']"
    assert source.index(output_entry) < source.index(embedded_entry)


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
