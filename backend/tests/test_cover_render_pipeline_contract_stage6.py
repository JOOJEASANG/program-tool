import subprocess
from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]
PIPELINE = ROOT / "js" / "cover-render-pipeline-contract.js"
REGISTER = ROOT / "js" / "sw-register.js"
BEHAVIOR = ROOT / "backend" / "tests" / "test_cover_render_pipeline_contract_behavior.cjs"


def test_cover_render_pipeline_installs_after_runtime_safety():
    source = REGISTER.read_text(encoding="utf-8")
    safety = source.index("/js/cover-runtime-safety.js")
    pipeline = source.index("/js/cover-render-pipeline-contract.js")
    assert safety < pipeline
    assert source.count("coverRenderPipelineContractScriptV1") == 1


def test_cover_render_pipeline_has_one_final_owner_and_bounded_installation():
    source = PIPELINE.read_text(encoding="utf-8")
    for marker in (
        "function coverRenderPipelineOwner(...args)",
        "delegate = current",
        "window.renderCover = makeOwner()",
        "owner.__coverRenderPipelineOwner = true",
        "INSTALL_DELAYS = [3200, 3800, 4600]",
        "setTimeout(detectDrift, 5600)",
        "stage: 'final-render-entrypoint-contract'",
    ):
        assert marker in source
    assert "setInterval(" not in source
    assert "eval(" not in source


def test_cover_render_pipeline_retires_inactive_compatibility_script_nodes_once():
    source = PIPELINE.read_text(encoding="utf-8")
    assert "cover-editor-multiselect.js" in source
    assert "cover-editor-layer-style.js" in source
    assert "if (script.dataset.coverCompatibilityRetired === '1') continue" in source
    assert "script.dataset.coverCompatibilityRetired = '1'" in source
    assert "script.remove()" in source
    assert "cover-editor-image-tools.js" not in source


def test_cover_render_pipeline_behavior_executes():
    result = subprocess.run(
        ["node", str(BEHAVIOR)],
        cwd=ROOT,
        text=True,
        capture_output=True,
        check=False,
    )
    assert result.returncode == 0, result.stderr or result.stdout
    assert "cover-render-pipeline-contract behavior passed" in result.stdout
