from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
CONVERTER = ROOT / "js" / "pdf-utility-image-converter.js"
RUNNER = ROOT / "scripts" / "run_phase5_browser_smoke.sh"
SMOKE = ROOT / "tests" / "browser" / "pdf-utility-image-converter-reliability-smoke.html"


def test_converter_uses_csp_allowed_jsdelivr_dependencies():
    source = CONVERTER.read_text(encoding="utf-8")
    assert "https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/build/pdf.min.js" in source
    assert "https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/build/pdf.worker.min.js" in source
    assert "https://cdn.jsdelivr.net/npm/pdf-lib@1.17.1/dist/pdf-lib.min.js" in source
    assert "https://cdn.jsdelivr.net/npm/jszip@3.10.1/dist/jszip.min.js" in source
    assert "cdnjs.cloudflare.com" not in source


def test_converter_recovers_from_library_load_failures():
    source = CONVERTER.read_text(encoding="utf-8")
    assert "LIB_LOAD_TIMEOUT_MS = 15_000" in source
    assert "removeFailedScript" in source
    assert "script.dataset.pdfConverterState = 'failed'" in source
    assert "libsPromise = null" in source
    assert "네트워크 상태를 확인한 뒤 다시 시도하세요" in source


def test_converter_has_memory_and_encoding_guards():
    source = CONVERTER.read_text(encoding="utf-8")
    assert "MAX_RENDER_PIXELS = 32_000_000" in source
    assert "MAX_TOTAL_RENDER_PIXELS = 250_000_000" in source
    assert "MAX_INPUT_IMAGE_PIXELS = 60_000_000" in source
    assert "assertRenderBudget(outW, outH, accumulatedPixels)" in source
    assert "canvasToBlob" in source
    assert "이미지 인코딩에 실패했습니다" in source
    assert "pdf.destroy" in source


def test_converter_reliability_smoke_is_wired_into_phase5():
    runner = RUNNER.read_text(encoding="utf-8")
    smoke = SMOKE.read_text(encoding="utf-8")
    assert "pdf-utility-image-converter-reliability-smoke.html" in runner
    assert 'data-pdf-utility-image-converter-reliability-smoke="pass"' in runner
    assert "pdfUtilityImageConverterReliabilitySmoke = 'pass'" in smoke
    assert "assertRenderBudget(10000, 10000, 0)" in smoke
