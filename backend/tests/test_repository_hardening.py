from pathlib import Path
from types import SimpleNamespace

import fitz
import pytest

from models.schemas import PdfProcessRequest
from services.pdf_engine import (
    _base_layout_margins,
    _build_page_layout,
    _resolve_layout_margins,
    process_pdf_bytes,
    process_pdf_paths,
)
from services.pdf_ops import MM_TO_PT
from services.pdf_text_renderer import page_number_value
from services.preflight_geometry import check_bleed_boxes, check_text_safe_margin


ROOT = Path(__file__).resolve().parents[2]


def _source_pdf(page_count: int = 4) -> bytes:
    document = fitz.open()
    for index in range(page_count):
        page = document.new_page(width=200, height=300)
        page.insert_text((70, 150), f"PAGE-{index + 1}", fontsize=14)
    data = document.tobytes()
    document.close()
    return data


def _request(**overrides):
    payload = {
        "pages": [
            {"file_index": 0, "page_index": index}
            for index in range(4)
        ],
        "nup_default": 4,
        "paper": {"width_mm": 210, "height_mm": 297},
        "margin_left_mm": 25,
        "margin_right_mm": 10,
        "margin_top_mm": 12,
        "margin_bottom_mm": 8,
        "gap_mm": 5,
    }
    payload.update(overrides)
    return PdfProcessRequest.model_validate(payload)


def test_schema_accepts_explicit_page_order():
    assert _request(page_order="column-major").page_order == "column-major"
    with pytest.raises(Exception):
        _request(page_order="diagonal")


def test_layout_rect_order_matches_browser_modes():
    margins = (10.0, 10.0, 10.0, 10.0)
    row = _build_page_layout(4, 600, 800, margins, 5, "row-major")
    column = _build_page_layout(4, 600, 800, margins, 5, "column-major")
    assert row.cell_rects[1].x0 > row.cell_rects[0].x0
    assert row.cell_rects[1].y0 == pytest.approx(row.cell_rects[0].y0)
    assert column.cell_rects[1].x0 == pytest.approx(column.cell_rects[0].x0)
    assert column.cell_rects[1].y0 > column.cell_rects[0].y0


def test_facing_margins_and_page_number_reserve_are_applied():
    request = _request(
        facing_pages=True,
        page_numbers={
            "enabled": True,
            "position": "bottom-right",
            "font_size": 12,
            "margin_mm": 5,
            "auto_reserve_space": True,
        },
    )
    odd = _base_layout_margins(request, 0)
    even = _base_layout_margins(request, 1)
    assert odd[:2] == pytest.approx((25 * MM_TO_PT, 10 * MM_TO_PT))
    assert even[:2] == pytest.approx((10 * MM_TO_PT, 25 * MM_TO_PT))
    assert _resolve_layout_margins(request, 0)[3] > odd[3]


def test_cover_exclusion_numbering_uses_visible_total():
    settings = SimpleNamespace(exclude_first=True, start=1)
    assert page_number_value(settings, 1, 6) == (1, 5)
    assert page_number_value(settings, 5, 6) == (5, 5)


def test_column_major_output_positions_match_preview_contract():
    output = fitz.open(
        stream=process_pdf_bytes(
            [_source_pdf()],
            _request(page_order="column-major"),
        ),
        filetype="pdf",
    )
    try:
        words = output[0].get_text("words")
        centers = {
            word[4]: ((word[0] + word[2]) / 2, (word[1] + word[3]) / 2)
            for word in words
            if str(word[4]).startswith("PAGE-")
        }
        assert centers["PAGE-1"][0] < centers["PAGE-3"][0]
        assert centers["PAGE-2"][0] < centers["PAGE-4"][0]
        assert centers["PAGE-1"][1] < centers["PAGE-2"][1]
        assert centers["PAGE-3"][1] < centers["PAGE-4"][1]
    finally:
        output.close()


def test_direct_and_disk_engines_share_layout(tmp_path):
    source = _source_pdf()
    request = _request(page_order="column-major")
    direct = fitz.open(stream=process_pdf_bytes([source], request), filetype="pdf")
    source_path = tmp_path / "source.pdf"
    output_path = tmp_path / "output.pdf"
    source_path.write_bytes(source)
    process_pdf_paths([source_path], request, output_path)
    disk = fitz.open(output_path)
    try:
        assert direct.page_count == disk.page_count
        assert direct[0].get_text("text") == disk[0].get_text("text")
    finally:
        direct.close()
        disk.close()


def test_geometry_preflight_distinguishes_bleed_and_safe_text():
    document = fitz.open()
    page = document.new_page(width=640, height=880)
    trim = fitz.Rect(30, 30, 610, 850)
    bleed = fitz.Rect(20, 20, 620, 860)
    page.set_trimbox(trim)
    page.set_bleedbox(bleed)
    page.insert_text((100, 100), "SAFE", fontsize=12)
    try:
        assert check_bleed_boxes(document).severity.value == "pass"
        assert check_text_safe_margin(document).severity.value == "pass"
    finally:
        document.close()


def test_missing_explicit_page_boxes_is_not_reported_as_pass():
    document = fitz.open()
    document.new_page(width=595, height=842)
    try:
        result = check_bleed_boxes(document)
        assert result.severity.value == "warning"
        assert "TrimBox/BleedBox" in result.detail
    finally:
        document.close()


def test_frontend_and_rules_use_hardened_contract():
    loader = (ROOT / "js" / "pdf-editor" / "loader.js").read_text(encoding="utf-8")
    contract = (ROOT / "js" / "pdf-editor" / "output-contract.js").read_text(encoding="utf-8")
    rules = (ROOT / "storage.rules").read_text(encoding="utf-8")
    tools = (ROOT / "backend" / "routers" / "pdf_tools.py").read_text(encoding="utf-8")
    claims = (ROOT / "backend" / "scripts" / "sync_admin_claims.py").read_text(encoding="utf-8")

    assert "output-contract.js" in loader
    assert "settings.page_order = currentOrder()" in contract
    assert "createdDocument = await collection.add" in contract
    assert "Promise.allSettled(storagePaths.map" in contract
    assert "isOwner(userId) && isApproved() && isPdfUpload()" in rules
    assert "MAX_IMAGE_FILES = 30" in tools
    assert "PDF_TOOL_INTERNAL_ERROR" in tools
    assert "--revoke-missing" in claims
