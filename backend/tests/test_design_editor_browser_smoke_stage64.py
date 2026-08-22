from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]
HARNESS = ROOT / "tests" / "browser" / "design-editor-smoke.html"
RUNNER = ROOT / "scripts" / "run_design_editor_browser_smoke.sh"
WORKFLOW = ROOT / ".github" / "workflows" / "quality-gate.yml"


def test_stage64_browser_harness_uses_real_design_editor_core_and_production_runtime_loader():
    source = HARNESS.read_text(encoding="utf-8")
    assert "history.replaceState(null,'','/design-editor/general.html?browser-smoke=1')" in source
    for marker in (
        "/js/design-editor/presets.js",
        "/js/design-editor/app.js",
        "/js/sw-register.js",
    ):
        assert marker in source
    assert '<script src="/js/design-editor/runtime-diagnostics.js' not in source
    assert '<script src="/js/design-editor/output.js' not in source
    assert '<script src="/js/design-editor/phase16-simple-interface.js' not in source
    assert "DesignEditorApp.startProject('flyer-a4')" in source
    assert "document.getElementById('addTitleBtn').click()" in source
    assert "tabs[1].click()" in source
    assert "textInput.dispatchEvent(new Event('input',{bubbles:true}))" in source


def test_stage64_browser_harness_checks_print_geometry_and_fail_closed_output_contract():
    source = HARNESS.read_text(encoding="utf-8")
    assert "spec.dpi===300" in source
    assert "spec.surfaceCount===2" in source
    assert "spec.widthMm===216&&spec.heightMm===303" in source
    assert "spec.widthPx===2551&&spec.heightPx===3579" in source
    assert "DesignEditorOutput.verifyRenderedSurface" in source
    assert "error?.code==='OUTPUT_VERIFICATION_FAILED'" in source
    assert "data-smoke-status=\"pending\"" in source
    assert "document.body.dataset.smokeStatus='pass'" in source


def test_stage64_runner_uses_installed_headless_browser_without_new_npm_dependency():
    source = RUNNER.read_text(encoding="utf-8")
    package = (ROOT / "package.json").read_text(encoding="utf-8")
    for browser in ("google-chrome", "google-chrome-stable", "chromium", "chromium-browser"):
        assert browser in source
    assert "python3 -m http.server" in source
    assert "--headless=new" in source
    assert "--virtual-time-budget=12000" in source
    assert "--dump-dom" in source
    assert "data-smoke-status=\"pass\"" in source
    assert "playwright" not in package.lower()
    assert "puppeteer" not in package.lower()


def test_stage64_quality_gate_runs_browser_smoke_and_keeps_failure_artifacts():
    source = WORKFLOW.read_text(encoding="utf-8")
    assert "design-editor-browser-smoke:" in source
    assert "name: Design editor browser smoke" in source
    assert "bash scripts/run_design_editor_browser_smoke.sh" in source
    assert "name: design-editor-browser-smoke" in source
    assert "path: browser-smoke-artifacts" in source
    assert "if: always()" in source
