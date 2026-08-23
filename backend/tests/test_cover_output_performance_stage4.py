import subprocess
from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]
MODULE = ROOT / "js" / "cover-output-performance-safety.js"
REGISTER = ROOT / "js" / "sw-register.js"
EDITOR = ROOT / "perfect-binding-cover" / "index.html"
DESIGN_OUTPUT = ROOT / "js" / "design-editor" / "output.js"
BEHAVIOR = ROOT / "backend" / "tests" / "test_cover_output_performance_behavior_stage4.cjs"


def test_output_budget_uses_integrated_design_editor_300dpi_dimensions():
    output = DESIGN_OUTPUT.read_text(encoding="utf-8")
    legacy = EDITOR.read_text(encoding="utf-8")
    for marker in (
        "const DPI=300",
        "const PX_PER_MM=DPI/25.4",
        "const MAX_PIXELS=42000000",
        "function expectedOutputSpec(p)",
        "widthPx:Math.max(1,Math.round(widthMm*PX_PER_MM))",
        "heightPx:Math.max(1,Math.round(heightMm*PX_PER_MM))",
        "if(pixels>MAX_PIXELS)",
    ):
        assert marker in output
    assert "/design-editor/?mode=cover" in legacy
    assert 'id="pdfBtn"' not in legacy
    assert "renderCover(" not in legacy


def test_pdf_page_size_and_raster_placement_contract_remain_in_millimeters():
    output = DESIGN_OUTPUT.read_text(encoding="utf-8")
    assert "new JsPdf({orientation,unit:'mm',format:[rendered.totalW,rendered.totalH],compress:true})" in output
    assert "pdf.addImage(image.data,image.format,0,0,rendered.totalW,rendered.totalH" in output
    assert "standard:{id:'standard'" in output
    assert "lossless:{id:'lossless'" in output
    assert "format:'PNG'" in output
    assert "format:'JPEG'" in output
    assert "colorSpace:'RGB'" in output


def test_device_memory_tiers_never_exceed_the_existing_hard_pixel_limit():
    source = MODULE.read_text(encoding="utf-8")
    for marker in (
        "HARD_PIXEL_CAP = 52_000_000",
        "memory > 0 && memory <= 2) return 24_000_000",
        "memory > 0 && memory <= 4) return 34_000_000",
        "memory > 0 && memory <= 8) return 46_000_000",
        "Math.min(HARD_PIXEL_CAP, deviceCap)",
        "WORKING_BYTES_PER_PIXEL = 12",
        "CANVAS_DIMENSION_CAP = 16_384",
    ):
        assert marker in source


def test_output_guard_reports_dimensions_memory_and_recovery_actions():
    source = MODULE.read_text(encoding="utf-8")
    for marker in (
        "button.dataset.coverOutputWidthPx",
        "button.dataset.coverOutputHeightPx",
        "button.dataset.coverOutputPixels",
        "button.dataset.coverOutputWorkingMb",
        "작업 메모리 약 ${formatMegabytes(budget.estimatedWorkingBytes)}",
        "button.addEventListener('click', handleOutputClick, { capture: true })",
        "if (hasBlockingPreflightError()) return",
    ):
        assert marker in source


def test_jspdf_has_a_bounded_output_time_recovery_path():
    source = MODULE.read_text(encoding="utf-8")
    for marker in (
        "JSPDF_FALLBACK_URL = 'https://cdn.jsdelivr.net/npm/jspdf@2.5.1/dist/jspdf.umd.min.js'",
        "typeof window.jspdf?.jsPDF === 'function'",
        "script.dataset.coverJspdfFallback = '1'",
        "PDF 라이브러리 연결 시간이 초과됐습니다.",
        "12_000",
        "pendingRetryButton",
        "retry?.click()",
        "jsPdfPromise = null",
    ):
        assert marker in source
    assert "setInterval(" not in source


def test_output_performance_guard_loads_after_ui_normalization_and_before_final_render_safety():
    source = REGISTER.read_text(encoding="utf-8")
    ui = "/js/cover-ui-runtime-normalizer.js"
    output = "/js/cover-output-performance-safety.js?v=20260805-1"
    final_safety = "/js/cover-runtime-safety.js"
    assert source.count("coverOutputPerformanceSafetyScriptV1") == 1
    assert source.count(output) == 1
    assert source.index(ui) < source.index(output) < source.index(final_safety)


def test_output_performance_matrix_executes_for_standard_and_custom_sizes():
    result = subprocess.run(
        ["node", str(BEHAVIOR)],
        cwd=ROOT,
        text=True,
        capture_output=True,
        check=False,
    )
    assert result.returncode == 0, result.stderr or result.stdout
    assert "cover-output-performance behavior passed" in result.stdout


def test_output_performance_guard_is_bounded_and_exposes_its_stage():
    source = MODULE.read_text(encoding="utf-8")
    assert "INSTALL_DELAYS = [0, 260, 700, 1200, 2000, 3000]" in source
    assert "for (const delay of INSTALL_DELAYS) setTimeout(install, delay)" in source
    assert "eval(" not in source
    assert "stage: 'device-output-budget-jspdf-recovery'" in source
