from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]
MODULE = ROOT / "js" / "pdf-utility-image-converter.js"
RUNTIME = ROOT / "js" / "pdf-preflight" / "route-runtime.js"
APP = ROOT / "js" / "app-version.js"


def test_pdf_utility_image_converter_is_owned_only_by_canonical_preflight_runtime():
    source = MODULE.read_text(encoding="utf-8")
    runtime = RUNTIME.read_text(encoding="utf-8")
    app = APP.read_text(encoding="utf-8")
    assert "pdf-preflight" in source
    assert "pdfUtilityImageConverterScriptV1" in runtime
    assert "/js/pdf-utility-image-converter.js?v=20260819-1" in runtime
    executable_app = app.split("/*", 1)[0] + app.rsplit("*/", 1)[-1]
    assert "pdfUtilityImageConverterScriptV1" not in executable_app


def test_converter_has_500mb_10_file_and_100_page_guards():
    source = MODULE.read_text(encoding="utf-8")
    assert "MAX_FILES = 10" in source
    assert "MAX_BYTES = 500 * 1024 * 1024" in source
    assert "MAX_PAGES = 100" in source
    assert "validatePdf" in source
    assert "validateImages" in source


def test_converter_supports_common_print_sizes_and_auto_fit():
    source = MODULE.read_text(encoding="utf-8")
    for marker in ("A5", "A4", "A3", "A2", "B5", "B4", "Letter", "Legal"):
        assert marker in source
    assert "orientation === 'auto'" in source
    assert "function contain" in source
    assert "PDF → 이미지" in source
    assert "이미지 → PDF" in source


def test_converter_is_client_side_and_does_not_call_pdf_utility_api():
    source = MODULE.read_text(encoding="utf-8")
    assert "pdfjs" in source
    assert "pdf-lib" in source
    assert "JSZip" in source
    assert "fetch('/api/" not in source
    assert "firebase.storage" not in source
