from pathlib import Path

import fitz

from services.pdf_tiling import MM_TO_PT, tile_pdf_bytes


ROOT = Path(__file__).resolve().parents[2]


def _pdf(width_mm: float, height_mm: float) -> bytes:
    document = fitz.open()
    try:
        page = document.new_page(width=width_mm * MM_TO_PT, height=height_mm * MM_TO_PT)
        page.insert_text((12 * MM_TO_PT, 18 * MM_TO_PT), "VECTOR-TEXT", fontsize=14)
        return document.tobytes(garbage=4, deflate=True)
    finally:
        document.close()


def test_a1_actual_size_uses_six_a3_sheets_when_three_mm_printer_margin_is_reserved():
    result = tile_pdf_bytes(
        _pdf(594, 841),
        paper_size="A3",
        orientation="auto",
        printer_margin_mm=3,
        overlap_mm=0,
    )

    assert result.sheet_count == 6
    output = fitz.open(stream=result.data, filetype="pdf")
    try:
        assert len(output) == 6
        sizes = {(round(page.rect.width * 25.4 / 72), round(page.rect.height * 25.4 / 72)) for page in output}
        assert sizes == {(420, 297)}
        assert "VECTOR-TEXT" in output[0].get_text()
    finally:
        output.close()


def test_five_mm_overlap_increases_shared_coverage_without_scaling_source():
    no_overlap = tile_pdf_bytes(
        _pdf(800, 500),
        paper_size="A3",
        orientation="landscape",
        printer_margin_mm=3,
        overlap_mm=0,
    )
    overlap = tile_pdf_bytes(
        _pdf(800, 500),
        paper_size="A3",
        orientation="landscape",
        printer_margin_mm=3,
        overlap_mm=5,
    )

    assert no_overlap.sheet_count == 4
    assert overlap.sheet_count == 4
    assert overlap.overlap_mm == 5


def test_small_source_stays_one_sheet_and_keeps_physical_scale():
    result = tile_pdf_bytes(
        _pdf(100, 150),
        paper_size="A4",
        orientation="portrait",
        printer_margin_mm=3,
        overlap_mm=0,
    )
    output = fitz.open(stream=result.data, filetype="pdf")
    try:
        assert len(output) == 1
        page = output[0]
        blocks = page.get_text("blocks")
        assert any("VECTOR-TEXT" in block[4] for block in blocks)
    finally:
        output.close()


def test_tiling_ui_and_api_are_wired_for_pdf_and_images():
    frontend = (ROOT / "js" / "pdf-large-output-tiling.js").read_text(encoding="utf-8")
    runtime = (ROOT / "js" / "pdf-preflight" / "route-runtime.js").read_text(encoding="utf-8")
    main = (ROOT / "backend" / "main.py").read_text(encoding="utf-8")
    router = (ROOT / "backend" / "routers" / "pdf_utility_tiling.py").read_text(encoding="utf-8")

    assert "대형 분할 출력" in frontend
    assert "PDF / JPG / PNG" in frontend
    assert "value=\"3\"" in frontend
    assert "5mm 겹침" in frontend
    assert "예상" in frontend and "DPI" in frontend
    assert "imageToPdf" in frontend
    assert "/api/pdf-utility/tile" in frontend
    assert "/api/pdf-utility/tile-storage" in frontend
    assert "pdfLargeOutputTilingScriptV1" in runtime
    assert "/js/pdf-large-output-tiling.js?v=20260831-1" in runtime
    assert "pdf_utility_tiling_bp" in main
    assert '@pdf_utility_tiling_bp.route("/tile"' in router
    assert '@pdf_utility_tiling_bp.route("/tile-storage"' in router
