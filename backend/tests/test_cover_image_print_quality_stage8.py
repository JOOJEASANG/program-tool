import subprocess
from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]
QUALITY = ROOT / "js" / "cover-image-print-quality.js"
REGISTER = ROOT / "js" / "sw-register.js"
BEHAVIOR = ROOT / "backend" / "tests" / "test_cover_image_print_quality_behavior.cjs"


def test_cover_image_quality_runtime_is_loaded_once_before_output_safety():
    source = REGISTER.read_text(encoding="utf-8")
    quality = source.index("/js/cover-image-print-quality.js")
    output = source.index("/js/cover-output-performance-safety.js")
    assert quality < output
    assert source.count("coverImagePrintQualityScriptV1") == 1


def test_cover_image_quality_has_compact_accessible_ui_and_updates():
    source = QUALITY.read_text(encoding="utf-8")
    for marker in (
        "인쇄 이미지 품질",
        "현재 확대율 기준",
        "row.id = `coverImageQuality${side === 'front' ? 'Front' : 'Back'}`",
        "const suffix = result.side === 'front' ? 'Front' : 'Back'",
        "byId(`coverImageQuality${suffix}`)",
        "role', 'status'",
        "aria-live', 'polite'",
        "panel.dataset.lowestDpi",
        "panel.dataset.hasLowQuality",
        "MutationObserver(scheduleDelayedUpdates)",
        "previewCanvas",
    ):
        assert marker in source
    assert "setInterval(" not in source
    assert "eval(" not in source


def test_cover_image_quality_uses_rendering_fit_and_scale_contract():
    source = QUALITY.read_text(encoding="utf-8")
    for marker in (
        "fit === 'contain'",
        "Math.min(widthMmPerPixel, heightMmPerPixel)",
        "Math.max(widthMmPerPixel, heightMmPerPixel)",
        "scalePercent / 100",
        "const dpi = 25.4 / mmPerPixel",
        "cropPercent",
        "hasBlankArea",
        "dpi >= 300",
        "dpi >= 250",
        "dpi >= 180",
        "dpi >= 120",
    ):
        assert marker in source


def test_cover_image_quality_behavior_executes():
    result = subprocess.run(
        ["node", str(BEHAVIOR)],
        cwd=ROOT,
        text=True,
        capture_output=True,
        check=False,
    )
    assert result.returncode == 0, result.stderr or result.stdout
    assert "cover-image-print-quality behavior passed" in result.stdout
