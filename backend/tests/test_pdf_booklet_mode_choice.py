"""Separate general N-up and saddle-stitch UX without changing fold geometry.

The center join in PDF output is already implemented in the PDF engine. These
regressions check the public UI can select it and that ordinary N-up spacing
remains independent of booklet imposition and the zero-gutter fold.
"""
from pathlib import Path

import fitz
import pytest

from models.schemas import NupValue, PageInfo, PaperSize, PdfProcessRequest
from services.pdf_engine import build_pdf_document
from services.pdf_ops import MM_TO_PT

ROOT=Path(__file__).resolve().parents[2]


def read(path: str) -> str:
    return (ROOT/path).read_text(encoding="utf-8")


def test_explicit_mode_switch_wired_to_original_booklet_state():
    html=read("pdf-editor/index.html")
    controller=read("js/pdf-editor/booklet-mode-tabs.js")
    css=read("css/pdf-layout-booklet-mode.css")
    assert 'id="pdfLayoutModeTabs"' in html
    assert 'id="pdfNormalModeBtn"' in html
    assert 'id="pdfBookletModeBtn"' in html
    assert 'id="bookletCheck"' in html
    assert 'id="bookletSpineOptions"' in html
    assert 'id="pdfBookletCenterLock"' in html
    assert 'id="pdfBookletFoldGuide"' in html
    assert 'id="pdfBookletLandscapeBtn"' in html
    assert 'id="pdfBookletSheetPreviewOpenBtn"' in html
    assert 'id="pdfNormalPageOrderField"' in html
    assert 'id="pdfNormalGapField"' in html
    assert "pdf-editor/booklet-mode-tabs.js?v=20261124-1" in html
    assert "pdf-layout-booklet-mode.css?v=20261124-1" in html
    assert "check.dispatchEvent(new Event('change',{bubbles:true}))" in controller
    assert "check.checked=booklet;" in controller
    assert "savedGeneralNup=Number(selected?.dataset?.nup)||2" in controller
    assert 'document.querySelector(\'.nup-btn[data-nup="2"]\')?.click()' in controller
    assert "savedGeneralNup=null;" in controller
    assert "window.BookletSheetPreview.open()" in controller
    assert "if($('bookletSpineGather'))$('bookletSpineGather').checked=true;" in controller
    assert "pdf-booklet-workflow-active" in controller
    assert "pdf-booklet-guide-on" in controller
    assert "#pdfNormalPageOrderField" in css
    assert "#pdfNormalGapField" in css
    assert "display:none!important" in css
    assert ".pdf-booklet-fold-guide-overlay::after" in css
    assert "function ensureFoldOverlays()" in controller
    assert "page-preview::before" in css and "page-preview::after" in css
    assert 'overlay.className=\'pdf-booklet-fold-guide-overlay\'' in controller
    assert "pointer-events:none" in css
    assert "PDF 저장에는 포함 안 됨" in html


def test_manual_explains_2up_center_join_and_ordinary_spacing():
    manual=read("js/program-manuals/pdf-editor.js")
    assert "일반 배치와 소책자 모드 분리" in manual
    assert "소책자 · 중철제본" in manual
    assert "접지선 0mm" in manual
    assert "일반 슬라이드 간격" in manual
    assert "저장 PDF에 포함되지 않습니다" in manual


def _placements(face, side_width_mm=110, side_height_mm=160):
    matches=[]
    for item in face.get_drawings():
        rect=item.get("rect")
        if item.get("type")!="s" or not isinstance(rect,fitz.Rect):
            continue
        if abs(rect.width - side_width_mm*MM_TO_PT)>0.9:
            continue
        if abs(rect.height - side_height_mm*MM_TO_PT)>0.9:
            continue
        matches.append(rect)
    return sorted(matches,key=lambda rect:rect.x0)


@pytest.mark.parametrize("paper_mm",[(420,297),(360,250)])
def test_normal_gap_does_not_leak_into_saddle_stitch_fold(paper_mm):
    src=fitz.open()
    for index in range(8):
        page=src.new_page(width=140*MM_TO_PT,height=195*MM_TO_PT)
        page.insert_text((36,80),f"LEAF-{index+1}",fontsize=15)
    pages=[PageInfo(file_index=0,page_index=i,
                    content_margin_left_mm=12,content_margin_right_mm=12)
           for i in range(8)]
    def output(booklet):
        return build_pdf_document([src],PdfProcessRequest(
            pages=pages,paper=PaperSize(width_mm=paper_mm[0],height_mm=paper_mm[1]),
            nup_default=NupValue(2),booklet=booklet,
            booklet_spine_align=booklet,
            placement_width_mm=110,placement_height_mm=160,
            margin_h_mm=12,margin_v_mm=8,gap_mm=20,add_border=True,
        ))
    normal=output(False)
    stitched=output(True)
    try:
        assert normal.page_count==4
        assert stitched.page_count==4
        fold=paper_mm[0]*MM_TO_PT/2
        for face in stitched:
            left,right=_placements(face)
            assert left.x1==pytest.approx(fold,abs=.5)
            assert right.x0==pytest.approx(fold,abs=.5)
            assert right.x0-left.x1==pytest.approx(0,abs=.5)
            assert left.x0>0 and right.x1<face.rect.width
        first_normal=_placements(normal[0])
        assert len(first_normal)==2
        assert first_normal[0].x1<fold-2*MM_TO_PT
        assert first_normal[1].x0>fold+2*MM_TO_PT
        assert "LEAF-8" in stitched[0].get_text()
        assert "LEAF-1" in stitched[0].get_text()
        assert "LEAF-1" in normal[0].get_text()
        assert "LEAF-2" in normal[0].get_text()
    finally:
        normal.close()
        stitched.close()
        src.close()
