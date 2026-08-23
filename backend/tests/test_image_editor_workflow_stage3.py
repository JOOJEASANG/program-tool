from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]
PAGE = ROOT / "image-editor" / "index.html"
WORKFLOW = ROOT / "js" / "image-editor" / "workflow.js"
WORKFLOW_STYLE = ROOT / "css" / "image-editor-workflow.css"
SMOKE = ROOT / "tests" / "browser" / "image-editor-workflow-smoke.html"
RUNNER = ROOT / "scripts" / "run_image_editor_workflow_smoke.sh"
QUALITY = ROOT / ".github" / "workflows" / "quality-gate.yml"


def test_stage3_exposes_practical_crop_presets_and_clipboard_hint():
    source = PAGE.read_text(encoding="utf-8")
    for marker in (
        'data-crop-ratio="square"',
        'data-crop-ratio="portrait45"',
        'data-crop-ratio="photo32"',
        'data-crop-ratio="wide169"',
        'id="cropPresetStatus"',
        'id="clipboardStatus"',
        '<kbd>Ctrl+V</kbd>',
        '/css/image-editor-workflow.css?v=20260823-3',
        '/js/image-editor/workflow.js?v=20260823-3',
    ):
        assert marker in source
    assert WORKFLOW_STYLE.exists()


def test_stage3_workflow_has_centered_ratio_math_and_safe_clipboard_paste():
    source = WORKFLOW.read_text(encoding="utf-8")
    for marker in (
        "square:{label:'1:1',ratio:1}",
        "portrait45:{label:'4:5',ratio:4/5}",
        "photo32:{label:'3:2',ratio:3/2}",
        "wide169:{label:'16:9',ratio:16/9}",
        "function centeredCropForRatio(width,height,ratio)",
        "function applyCropRatio(key)",
        "editor.setCrop(crop)",
        "async function pasteImageBlob(blob,name='clipboard-image.png')",
        "function editableTarget(target)",
        "function handlePaste(event)",
        "document.addEventListener('paste',handlePaste)",
        "stage:'image-editor-workflow-stage3'",
    ):
        assert marker in source
    assert "fetch(" not in source
    assert "XMLHttpRequest" not in source


def test_stage3_real_browser_checks_ratio_geometry_and_clipboard_import():
    smoke = SMOKE.read_text(encoding="utf-8")
    runner = RUNNER.read_text(encoding="utf-8")
    quality = QUALITY.read_text(encoding="utf-8")
    for marker in (
        "square.x===20&&square.y===0&&square.w===80&&square.h===80",
        "wide.x===0&&wide.y===6&&wide.w===120&&wide.h===68",
        "workflow.pasteImageBlob(pastedBlob,'clipboard-test.png')",
        "workflow.handlePaste(fakeEvent)",
        "editable control paste should be ignored",
        "PASS: centered crop presets and clipboard image workflow",
    ):
        assert marker in smoke
    assert 'PROFILE_DIR="$(mktemp -d)"' in runner
    assert 'data-workflow-stage="image-editor-workflow-stage3"' in runner
    assert "bash scripts/run_image_editor_workflow_smoke.sh" in quality
