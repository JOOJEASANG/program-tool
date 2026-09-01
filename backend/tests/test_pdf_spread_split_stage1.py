from pathlib import Path

import fitz

from models.schemas import PageInfo, PaperSize, PdfProcessRequest
from services.pdf_engine import build_pdf_document

ROOT = Path(__file__).resolve().parents[2]


def read(path: str) -> str:
    return (ROOT / path).read_text(encoding="utf-8")


def test_page_info_supports_spread_half_selection():
    schema = read("backend/models/schemas.py")
    assert 'split_side: Optional[Literal["left", "right"]]' in schema


def test_pdf_engine_clips_spread_halves_before_layout():
    engine = read("backend/services/pdf_engine.py")
    assert 'split_side = getattr(page_info, "split_side", None)' in engine
    assert "clip_rect = fitz.Rect(" in engine
    assert "clip=clip_rect" in engine


def _spread_source() -> fitz.Document:
    doc = fitz.open()
    page = doc.new_page(width=200, height=100)
    page.draw_rect(fitz.Rect(0, 0, 100, 100), color=None, fill=(1, 0, 0))
    page.draw_rect(fitz.Rect(100, 0, 200, 100), color=None, fill=(0, 0, 1))
    return doc


def _render_half(side: str) -> tuple[int, int, int]:
    src = _spread_source()
    request = PdfProcessRequest(
        pages=[PageInfo(file_index=0, page_index=0, split_side=side)],
        nup_default=1,
        paper=PaperSize(width_mm=35.2777778, height_mm=35.2777778),
        margin_h_mm=0,
        margin_v_mm=0,
        margin_left_mm=0,
        margin_right_mm=0,
        margin_top_mm=0,
        margin_bottom_mm=0,
        gap_mm=0,
    )
    out = build_pdf_document([src], request)
    try:
        pix = out[0].get_pixmap(alpha=False)
        return pix.pixel(pix.width // 2, pix.height // 2)[:3]
    finally:
        out.close()
        src.close()


def test_left_and_right_spread_halves_render_as_independent_pages():
    left = _render_half("left")
    right = _render_half("right")
    assert left[0] > 200 and left[2] < 60
    assert right[2] > 200 and right[0] < 60


def test_pdf_editor_loads_spread_split_stage1_module():
    runtime = read("js/pdf-editor/route-runtime.js")
    split = read("js/pdf-editor/spread-split.js")
    assert "pdfEditorSpreadSplitScriptV1" in runtime
    assert "/js/pdf-editor/spread-split.js?v=20260825-1" in runtime
    assert "펼침면 좌우 분할" in split
    assert "splitSide" in split
    assert "firstPageSkip" in split
    assert "lastPageSkip" in split
    assert "readingOrder" in split
    assert "patchApiProcessPdf" in split


def test_spread_split_can_be_undone_without_reupload():
    split = read("js/pdf-editor/spread-split.js")
    assert "originalPages" in split
    assert "restoreOriginal" in split
    assert "다시 업로드하지 않고" in split
