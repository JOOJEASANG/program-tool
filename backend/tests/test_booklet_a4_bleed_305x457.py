"""A4 saddle-stitch 3mm bleed on 305×457mm paper: real vector PDF regression."""
import fitz
import pytest

from models.schemas import NupValue, PageInfo, PaperSize, PdfProcessRequest
from services.pdf_engine import build_pdf_document
from services.pdf_ops import MM_TO_PT


def source_document(width=216, height=303):
    doc=fitz.open()
    m=MM_TO_PT
    left_numbers={8,2,6,4}
    for number in range(1,9):
        page=doc.new_page(width=width*m,height=height*m)
        color=(1,0,0) if number in left_numbers else (0,0.2,1)
        page.draw_rect(page.rect,fill=color,color=None)
        if number in left_numbers:
            # The RIGHT 3mm is redundant inward bleed, removed before stitching.
            page.draw_rect(fitz.Rect((width-3)*m,0,width*m,height*m),fill=(0,1,0),color=None)
        else:
            # The LEFT 3mm is redundant inward bleed.
            page.draw_rect(fitz.Rect(0,0,3*m,height*m),fill=(0,1,0),color=None)
        page.insert_text((16*m,28*m),f"PAGE{number}",fontsize=18,color=(0,0,0))
    return doc


def request():
    return PdfProcessRequest(
        pages=[PageInfo(file_index=0,page_index=i) for i in range(8)],
        nup_default=NupValue.two,
        booklet=True,
        booklet_spine_align=True,
        booklet_bleed_inner_mm=3,
        paper=PaperSize(width_mm=457,height_mm=305),
        placement_width_mm=213,
        placement_height_mm=303,
        margin_h_mm=0,
        margin_v_mm=0,
        gap_mm=5,
        add_border=False,
    )


def pixel_at_mm(page,x,y):
    pix=page.get_pixmap(matrix=fitz.Matrix(1,1),alpha=False)
    return pix.pixel(round(x*MM_TO_PT),round(y*MM_TO_PT))[:3]


def test_8page_bleed_has_no_center_gutter_and_preserves_all_three_trim_bleeds():
    src=source_document()
    out=build_pdf_document([src],request())
    try:
        assert out.page_count==4
        for face in out:
            assert face.rect.width==pytest.approx(457*MM_TO_PT,abs=0.15)
            assert face.rect.height==pytest.approx(305*MM_TO_PT,abs=0.15)
            fold=457/2
            left=pixel_at_mm(face,fold-0.7,152.5)
            right=pixel_at_mm(face,fold+0.7,152.5)
            assert left[0]>180 and left[1]<100 and left[2]<100,left
            assert right[2]>180 and right[0]<100 and right[1]<120,right
            # Source inward bleed was GREEN: neither side may show it at fold.
            assert not (left[1]>180 and left[0]<100)
            assert not (right[1]>180 and right[0]<100)
            # Every leaf is 213mm wide: outer paper margin 15.5mm each.
            for x in [8,449]:
                assert min(pixel_at_mm(face,x,152.5))>235
            for x in [16,441]:
                assert min(pixel_at_mm(face,x,152.5))<100
            # Source keeps its 3mm TOP and BOTTOM bleed. Placement is at y=1.
            for y in [0.3,304.7]:
                assert min(pixel_at_mm(face,fold-0.7,y))>235
            for y in [1.5,303.5]:
                assert min(pixel_at_mm(face,fold-0.7,y))<100
    finally:
        out.close()
        src.close()


def test_rotated_180_left_page_crops_opposite_source_edge():
    src=source_document()
    # This page will be physically on the left of the fold, but after a
    # 180-degree turn its SOURCE left edge faces the fold.
    src[7].draw_rect(
        fitz.Rect(0,0,3*MM_TO_PT,303*MM_TO_PT),
        fill=(0,1,0),color=None,
    )
    job=request()
    job.pages[7].rotation=180
    out=build_pdf_document([src],job)
    try:
        color=pixel_at_mm(out[0],457/2-0.7,152.5)
        assert color[0]>180 and color[1]<100 and color[2]<100,color
    finally:
        out.close()
        src.close()


def test_bleed_mode_rejects_90_degree_pages_that_cannot_fit_one_side():
    src=source_document()
    job=request()
    job.pages[7].rotation=90
    try:
        with pytest.raises(ValueError,match="0° 또는 180°"):
            out=build_pdf_document([src],job)
            out.close()
    finally:
        src.close()


def test_bleed_mode_checks_each_source_page_size_without_scaling():
    src=source_document(width=215,height=303)
    try:
        with pytest.raises(ValueError,match="216×303"):
            out=build_pdf_document([src],request())
            out.close()
    finally:
        src.close()


@pytest.mark.parametrize("field, bad", [
    ("placement_width_mm",210),
    ("placement_height_mm",297),
    ("booklet_spine_align",False),
    ("nup_default",4),
])
def test_a4_bleed_rejects_incorrect_imposition(field,bad):
    payload=request().model_dump()
    payload[field]=bad
    with pytest.raises(ValueError,match="A4 중철 도련 처리"):
        PdfProcessRequest.model_validate(payload)


def test_browser_preview_and_export_share_the_same_imposed_side_crop():
    from pathlib import Path
    root=Path(__file__).resolve().parents[2]
    html=(root/"pdf-editor/index.html").read_text(encoding="utf-8")
    layout=(root/"js/pdf-editor/layout-export.js").read_text(encoding="utf-8")
    engine=(root/"backend/services/pdf_engine.py").read_text(encoding="utf-8")
    assert 'id="bookletA4BleedPresetBtn"' in html
    assert 'id="bookletBleedEnabled"' in html
    assert "'customW').value='305'" in html
    assert "'customH').value='457'" in html
    assert "'actualWidthMm').value='213'" in html
    assert "'actualHeightMm').value='303'" in html
    assert "ctx.drawImage(src,cropX,0,src.width-bleedPx,src.height,dx,dy,dw,dh)" in html
    assert "bookletSide==='right'?bleedPx:0" in html
    assert "booklet_bleed_inner_mm: getBookletBleedMm()" in html
    assert "foldCell?(column===0?'left':'right'):null" in layout
    assert "settings.booklet_bleed_inner_mm =" in layout
    assert "? {} // null means inherit the current global margin" in layout
    assert "inner_edge_is_right = (booklet_fold_side == \"left\")" in engine
    assert "clip_rect.x0 += crop" in engine
