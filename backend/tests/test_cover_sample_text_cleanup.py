import subprocess
from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]
REFINE = ROOT / "js" / "cover-text-ui-refine.js"
BEHAVIOR = ROOT / "backend" / "tests" / "test_cover_sample_text_cleanup_behavior.cjs"


def test_cover_sample_cleanup_contract_is_present():
    source = REFINE.read_text(encoding="utf-8")
    for marker in (
        "programTool.coverTextZones.demoClean.v5",
        "programTool.coverEditor.autosave.v3",
        "programTool.coverEditor.autosave.v2",
        "function hasDemoSignature(fields)",
        "function cleanAutosavePayload(payload)",
        "function cleanLegacyDemoState()",
        "const clearedDemoState = cleanLegacyDemoState()",
        "normalizeData(clearedDemoState)",
        "window.CoverSampleTextCleanup",
    ):
        assert marker in source


def test_cover_reset_removes_autosave_and_image_effect_state():
    source = REFINE.read_text(encoding="utf-8")
    for key in (
        "programTool.coverTextZones.v3",
        "programTool.coverEditor.autosave.v3",
        "programTool.coverEditor.autosave.v2",
        "programTool.coverEditor.imageTools.v1",
    ):
        assert key in source
    assert "location.reload()" in source


def test_cover_sample_cleanup_preserves_non_demo_work():
    result = subprocess.run(
        ["node", str(BEHAVIOR)],
        cwd=ROOT,
        text=True,
        capture_output=True,
        check=False,
    )
    assert result.returncode == 0, result.stderr or result.stdout
    assert "cover sample text cleanup behavior passed" in result.stdout
