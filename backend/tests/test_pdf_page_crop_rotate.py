from pathlib import Path

import fitz
import pytest
from pydantic import ValidationError

from models.schemas import PdfProcessRequest
from services import pdf_engine


ROOT = Path(__file__).resolve().parents[2]


def _source_pdf_bytes() -> bytes:
    doc = fitz.open()
    page = doc.new_page(width=400, height=200)
    page.insert_text((35, 105), "LEFT-SIDE", fontsize=18)
    page.insert_text((275, 105), "RIGHT-SIDE", fontsize=18)
    page.draw_rect(fitz.Rect(10, 10, 390, 190), color=(0, 0, 0), width=1)
    data = doc.tobytes()
    doc.close()
    return data


def _request(**page_values) -> PdfProcessRequest:
    page = {"file_index": 0, "page_index": 0}
    page.update(page_values)
    return PdfProcessRequest.model_validate({
        "pages": [page],
        "nup_default": 1,
        "paper": {"width_mm": 210, "height_mm": 297},
        "margin_h_mm": 10,
        "margin_v_mm": 10,
        "gap_mm": 5,
    })


def test_crop_schema_defaults_bounds_and_visible_area_guard():
    page = _request().pages[0]
    assert page.rotation_locked is False
    assert page.crop_left_ratio == 0
    assert page.crop_top_ratio == 0
    assert page.crop_right_ratio == 0
    assert page.crop_bottom_ratio == 0

    bounded = _request(
        rotation=270,
        rotation_locked=True,
        crop_left_ratio=0.45,
        crop_right_ratio=0.49,
        crop_top_ratio=0.2,
        crop_bottom_ratio=0.3,
    ).pages[0]
    assert bounded.rotation == 270
    assert bounded.rotation_locked is True
    assert bounded.crop_left_ratio == pytest.approx(0.45)

    with pytest.raises(ValidationError):
        _request(crop_left_ratio=0.91)
    with pytest.raises(ValidationError):
        _request(crop_left_ratio=0.50, crop_right_ratio=0.45)
    with pytest.raises(ValidationError):
        _request(crop_top_ratio=0.80, crop_bottom_ratio=0.15)


def test_crop_rect_is_resolved_before_rotation_and_after_split():
    page = _request(
        crop_left_ratio=0.10,
        crop_top_ratio=0.20,
        crop_right_ratio=0.30,
        crop_bottom_ratio=0.10,
    ).pages[0]
    rect = pdf_engine._page_clip_rect(fitz.Rect(0, 0, 400, 200), page)
    assert rect == fitz.Rect(40, 40, 280, 180)

    split = _request(
        split_side="right",
        crop_left_ratio=0.10,
        crop_right_ratio=0.20,
    ).pages[0]
    split_rect = pdf_engine._page_clip_rect(fitz.Rect(0, 0, 400, 200), split)
    # Right half is 200..400 first; crop is then relative to that visible half.
    assert split_rect == fitz.Rect(220, 0, 360, 200)


def test_explicit_rotation_lock_prevents_legacy_auto_rotation():
    clip = fitz.Rect(0, 0, 400, 200)
    unlocked = _request(rotation=0, rotation_locked=False).pages[0]
    locked = _request(rotation=0, rotation_locked=True).pages[0]
    locked_270 = _request(rotation=270, rotation_locked=True).pages[0]

    assert pdf_engine._resolve_page_rotation(unlocked, 100, 300, clip) == 90
    assert pdf_engine._resolve_page_rotation(locked, 100, 300, clip) == 0
    assert pdf_engine._resolve_page_rotation(locked_270, 100, 300, clip) == 270


def test_crop_rotate_scale_move_are_combined_in_final_vector_pdf():
    source = _source_pdf_bytes()
    request = _request(
        crop_left_ratio=0.45,
        rotation=90,
        rotation_locked=True,
        content_scale=1.15,
        offset_x_mm=5,
        offset_y_mm=-4,
    )
    result = pdf_engine.process_pdf_bytes([source], request)

    doc = fitz.open(stream=result, filetype="pdf")
    try:
        assert doc.page_count == 1
        text = doc[0].get_text()
        assert "RIGHT-SIDE" in text
        assert "LEFT-SIDE" not in text
        assert doc[0].rect.width == pytest.approx(210 * 72 / 25.4, abs=0.2)
        assert doc[0].rect.height == pytest.approx(297 * 72 / 25.4, abs=0.2)
    finally:
        doc.close()


def test_client_exposes_crop_rotate_controls_and_runtime_order():
    source = (ROOT / "js" / "pdf-editor" / "page-transform-edit.js").read_text(encoding="utf-8")
    core = (ROOT / "js" / "pdf-editor" / "core-runtime.js").read_text(encoding="utf-8")

    for marker in (
        "회전 · 잘라내기",
        "pdfPageRotateLeftV1",
        "pdfPageRotateRightV1",
        "pdfPageCropToggleV1",
        "pdf-page-crop-handle",
        "crop_left_ratio",
        "crop_top_ratio",
        "crop_right_ratio",
        "crop_bottom_ratio",
        "rotation_locked",
        "pageTransforms",
        "crop-rotate-before-scale-pan-v1",
    ):
        assert marker in source

    module_block = core.split("const MODULES=Object.freeze([", 1)[1].split("]);", 1)[0]
    assert module_block.count("src:'/js/pdf-editor/") == 8
    assert "pdfPageTransformEditScriptV1" in core
    assert ".then(()=>loadNupPageAdjust())" in core
    assert ".then(()=>loadPageTransformEdit())" in core
    assert core.index(".then(()=>loadNupPageAdjust())") < core.index(".then(()=>loadPageTransformEdit())")
    assert core.index(".then(()=>loadPageTransformEdit())") < core.index(".then(()=>loadNupDirectPreviewEdit())")
