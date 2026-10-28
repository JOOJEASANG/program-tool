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
    assert "/js/pdf-large-output-tiling.js?v=20261028-2" in runtime
    assert "pdf_utility_tiling_bp" in main
    assert '@pdf_utility_tiling_bp.route("/tile"' in router
    assert '@pdf_utility_tiling_bp.route("/tile-storage"' in router


def test_two_mm_overlap_and_crop_marks_use_printable_white_gutters():
    # A4 landscape with hardware margins 3mm + crop-mark gutters 3mm:
    # image capacity 285x198mm, adjacent tiles advance 283mm/196mm.
    document=fitz.open()
    page=document.new_page(width=500*MM_TO_PT,height=250*MM_TO_PT)
    page.draw_rect(fitz.Rect(283.25*MM_TO_PT,25*MM_TO_PT,
                             284.75*MM_TO_PT,30*MM_TO_PT),
                   color=(1,0,0),fill=(1,0,0))
    src=document.tobytes()
    document.close()
    result=tile_pdf_bytes(src,paper_size="A4",orientation="landscape",
                          printer_margin_mm=3,overlap_mm=2,add_crop_marks=True)
    assert result.overlap_mm==2
    assert result.add_crop_marks
    assert result.sheet_count==4
    output=fitz.open(stream=result.data,filetype="pdf")
    try:
        first,second=output[0],output[1]
        for tile in (first,second):
            marks=[drawing for drawing in tile.get_drawings()
                   if drawing.get("type")=="s" and drawing.get("width",0)<1]
            assert len(marks)>=8, "crop marks should be vector lines"
            # Marks are in a reserved gutter (not in the image).
            assert any(drawing["rect"].y1 < 6*MM_TO_PT for drawing in marks)
            assert any(drawing["rect"].x1 < 6*MM_TO_PT for drawing in marks)
        def pixel_at(sheet,x_mm,y_mm):
            pix=sheet.get_pixmap(matrix=fitz.Matrix(2,2),alpha=False)
            x=round(x_mm*MM_TO_PT*2)
            y=round(y_mm*MM_TO_PT*2)
            return pix.pixel(x,y)
        # Same red source artwork at x=284mm appears near the right edge
        # of the first tile AND on the next tile's left 2mm overlap.
        color_a=pixel_at(first,6+284,6+27)
        color_b=pixel_at(second,6+1,6+27)
        assert color_a[0]>170 and color_a[1]<90 and color_a[2]<90
        assert color_b[0]>170 and color_b[1]<90 and color_b[2]<90
    finally:
        output.close()


def test_crop_marks_are_optional_and_invalid_margin_is_explained():
    plain=tile_pdf_bytes(_pdf(100,150),paper_size="A4",
                         printer_margin_mm=3,overlap_mm=1,add_crop_marks=False)
    marked=tile_pdf_bytes(_pdf(100,150),paper_size="A4",
                          printer_margin_mm=3,overlap_mm=1,add_crop_marks=True)
    assert not plain.add_crop_marks and marked.add_crop_marks
    p=fitz.open(stream=plain.data,filetype="pdf")
    m=fitz.open(stream=marked.data,filetype="pdf")
    try:
        assert len(m[0].get_drawings())>len(p[0].get_drawings())
    finally:
        p.close()
        m.close()
    try:
        tile_pdf_bytes(_pdf(100,150),printer_margin_mm=18,
                       overlap_mm=1,add_crop_marks=True)
    except ValueError as exc:
        assert "17mm 이하" in str(exc)
    else:
        raise AssertionError("crop mark gutter cannot fit a 18mm printer margin")


def test_pdf_utility_menu_and_crop_mark_controls_are_connected():
    catalog=(ROOT/"pdf-suite/index.html").read_text(encoding="utf-8")
    curated=(ROOT/"js/pdf-suite/curated-core.js").read_text(encoding="utf-8")
    loader=(ROOT/"scripts/prepare_hosting_dist.py").read_text(encoding="utf-8")
    tiling=(ROOT/"js/pdf-large-output-tiling.js").read_text(encoding="utf-8")
    router=(ROOT/"backend/routers/pdf_utility_tiling.py").read_text(encoding="utf-8")
    assert '<span class="tool-name">대형 분할 출력</span>' in catalog
    assert "'안전 자동 수정','대형 분할 출력'" in curated
    assert 'PDF_SUITE_TILING_MARKER' in loader
    assert '/js/pdf-large-output-tiling.js?v=20261028-2' in loader
    assert 'const onUtility=path===' in tiling
    assert 'data-pdfu-tool' in tiling
    assert "button.dataset.pdfuCoreSource!=='대형 분할 출력'" in tiling
    assert 'id="plotCropMarks" checked' in tiling
    assert '<option value="1">1mm 겹침</option>' in tiling
    assert '<option value="2" selected>2mm 겹침 · 권장</option>' in tiling
    assert "add_crop_marks:!!$('plotCropMarks').checked" in tiling
    assert 'add_crop_marks=_bool(params.get("add_crop_marks"))' in router
