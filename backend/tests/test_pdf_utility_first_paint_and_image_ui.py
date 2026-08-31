from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]
APP_VERSION = ROOT / "js" / "app-version.js"
BOOT_GUARD = ROOT / "js" / "app-boot-guard.js"
PREFLIGHT_RUNTIME = ROOT / "js" / "pdf-preflight" / "route-runtime.js"
CONVERTER = ROOT / "js" / "pdf-utility-image-converter.js"
RETIRED_FIRST_PAINT = ROOT / "js" / "pdf-utility-first-paint.js"


def test_pdf_utility_first_paint_is_owned_by_canonical_boot_sequence():
    observer = APP_VERSION.read_text(encoding="utf-8")
    boot = BOOT_GUARD.read_text(encoding="utf-8")
    runtime = PREFLIGHT_RUNTIME.read_text(encoding="utf-8")

    assert not RETIRED_FIRST_PAINT.exists()
    executable_observer = observer.split("/*", 1)[0] + observer.rsplit("*/", 1)[-1]
    assert "pdfUtilityFirstPaintScriptV1" not in executable_observer
    assert "ProgramStudioPreflightRuntimeReady" in boot
    assert "clean-workspace-v2" in boot
    assert "pdfPreflightPanelBalanceScriptV1" in runtime
    assert runtime.index("pdfUtilityImageConverterScriptV1") < runtime.index("pdfPreflightPanelBalanceScriptV1")


def test_image_converter_limits_remain_bounded_after_legacy_first_paint_removal():
    converter = CONVERTER.read_text(encoding="utf-8")
    runtime = PREFLIGHT_RUNTIME.read_text(encoding="utf-8")

    assert "pdfUtilityImageConverterScriptV1" in runtime
    assert "pdfUtilityImageConverterFinalizeScriptV1" in runtime
    assert "MAX_BYTES = 500 * 1024 * 1024" in converter
    assert "MAX_PAGES = 100" in converter
