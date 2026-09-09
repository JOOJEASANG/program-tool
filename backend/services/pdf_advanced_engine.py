"""Standalone PDF advanced-editor rendering engine.

This engine intentionally has no N-up, booklet, divider, grouping, or print-layout
state. It preserves each source page's physical size and applies only direct page
editing plus document overlays owned by the advanced editor.
"""
from __future__ import annotations

import io
from pathlib import Path

import fitz

from models.advanced_schemas import AdvancedPageInfo, PdfAdvancedProcessRequest
from services import pdf_ops, pdf_text_renderer


EMPTY_SOURCE_PAGE_ERROR = "nothing to show - source page empty"
_HF_TEXT_FIELDS = (
    "header_left",
    "header_center",
    "header_right",
    "footer_left",
    "footer_center",
    "footer_right",
)


def _advanced_hf_aliases(text: str) -> str:
    """Map advanced-editor friendly variables to the shared renderer tokens."""
    return str(text or "").replace("{page}", "{n}").replace("{pages}", "{total}")


def _advanced_header_footer_settings(settings):
    cloned = settings.model_copy(deep=True)
    for field in _HF_TEXT_FIELDS:
        setattr(cloned, field, _advanced_hf_aliases(getattr(cloned, field, "")))
    for section in list(getattr(cloned, "sections", []) or []):
        for field in _HF_TEXT_FIELDS:
            setattr(section, field, _advanced_hf_aliases(getattr(section, field, "")))
    return cloned


def _clip_rect(source_rect: fitz.Rect, page: AdvancedPageInfo) -> fitz.Rect:
    width = source_rect.width
    height = source_rect.height
    rect = fitz.Rect(
        source_rect.x0 + width * page.crop_left_ratio,
        source_rect.y0 + height * page.crop_top_ratio,
        source_rect.x1 - width * page.crop_right_ratio,
        source_rect.y1 - height * page.crop_bottom_ratio,
    )
    if rect.width <= 1e-6 or rect.height <= 1e-6:
        raise ValueError("잘라내기 영역이 너무 작습니다")
    return rect


def _erased_source_document(
    source_doc: fitz.Document,
    page_index: int,
    page: AdvancedPageInfo,
) -> fitz.Document | None:
    regions = list(page.erase_regions or [])[:40]
    if not regions:
        return None

    source_page = source_doc[page_index]
    source_rect = fitz.Rect(source_page.rect)
    temp_doc = fitz.open()
    try:
        temp_page = temp_doc.new_page(width=source_rect.width, height=source_rect.height)
        temp_page.show_pdf_page(temp_page.rect, source_doc, page_index, keep_proportion=False)
        shape = temp_page.new_shape()
        for region in regions:
            rect = fitz.Rect(
                source_rect.x0 + source_rect.width * float(region.x0),
                source_rect.y0 + source_rect.height * float(region.y0),
                source_rect.x0 + source_rect.width * float(region.x1),
                source_rect.y0 + source_rect.height * float(region.y1),
            )
            if rect.width > 1e-6 and rect.height > 1e-6:
                shape.draw_rect(rect)
        shape.finish(color=None, fill=(1.0, 1.0, 1.0), width=0)
        shape.commit(overlay=True)
        return temp_doc
    except Exception:
        temp_doc.close()
        raise


def _fit_rect(box: fitz.Rect, source_width: float, source_height: float, rotation: int) -> fitz.Rect:
    if rotation in (90, 270):
        source_width, source_height = source_height, source_width
    if source_width <= 0 or source_height <= 0:
        return fitz.Rect(box)
    scale = min(box.width / source_width, box.height / source_height)
    width = source_width * scale
    height = source_height * scale
    x0 = box.x0 + (box.width - width) / 2
    y0 = box.y0 + (box.height - height) / 2
    return fitz.Rect(x0, y0, x0 + width, y0 + height)


def _effective_margin_mm(
    request: PdfAdvancedProcessRequest,
    output_index: int,
) -> tuple[float, float, float, float]:
    left = float(request.margins.left_mm)
    right = float(request.margins.right_mm)
    top = float(request.margins.top_mm)
    bottom = float(request.margins.bottom_mm)
    if request.margins.facing_pages and (output_index + 1) % 2 == 0:
        left, right = right, left
    return left, right, top, bottom


def _content_box(
    page_width: float,
    page_height: float,
    request: PdfAdvancedProcessRequest,
    output_index: int = 0,
) -> fitz.Rect:
    left_mm, right_mm, top_mm, bottom_mm = _effective_margin_mm(request, output_index)
    left = left_mm * pdf_ops.MM_TO_PT
    right = right_mm * pdf_ops.MM_TO_PT
    top = top_mm * pdf_ops.MM_TO_PT
    bottom = bottom_mm * pdf_ops.MM_TO_PT
    if left + right >= page_width - 2 or top + bottom >= page_height - 2:
        raise ValueError("설정한 여백이 페이지 크기보다 큽니다")
    return fitz.Rect(left, top, page_width - right, page_height - bottom)


def _render_page_content(
    out_page: fitz.Page,
    source_doc: fitz.Document,
    page_info: AdvancedPageInfo,
    source_rect: fitz.Rect,
    content_box: fitz.Rect,
) -> None:
    erased_doc = _erased_source_document(source_doc, page_info.page_index, page_info)
    render_doc = erased_doc or source_doc
    render_index = 0 if erased_doc is not None else page_info.page_index
    try:
        clip = _clip_rect(source_rect, page_info)
        rotation = int(page_info.rotation) % 360
        local_box = fitz.Rect(0, 0, content_box.width, content_box.height)
        fitted = _fit_rect(local_box, clip.width, clip.height, rotation)
        scale = float(page_info.edit_scale or 1.0)
        offset_x = float(page_info.offset_x_mm or 0.0) * pdf_ops.MM_TO_PT
        offset_y = float(page_info.offset_y_mm or 0.0) * pdf_ops.MM_TO_PT
        center_x = (fitted.x0 + fitted.x1) / 2 + offset_x
        center_y = (fitted.y0 + fitted.y1) / 2 + offset_y
        adjusted = fitz.Rect(
            center_x - fitted.width * scale / 2,
            center_y - fitted.height * scale / 2,
            center_x + fitted.width * scale / 2,
            center_y + fitted.height * scale / 2,
        )

        # Render through a temporary page so zoom/move never paints into the
        # reserved margin/header/footer area.
        clip_doc = fitz.open()
        try:
            clip_page = clip_doc.new_page(width=content_box.width, height=content_box.height)
            try:
                clip_page.show_pdf_page(
                    adjusted,
                    render_doc,
                    render_index,
                    rotate=rotation,
                    keep_proportion=True,
                    clip=clip,
                )
            except ValueError as exc:
                if EMPTY_SOURCE_PAGE_ERROR not in str(exc):
                    raise
            out_page.show_pdf_page(content_box, clip_doc, 0, keep_proportion=False)
        finally:
            clip_doc.close()
    finally:
        if erased_doc is not None:
            erased_doc.close()


def build_advanced_pdf_document(
    source_docs: list[fitz.Document],
    request: PdfAdvancedProcessRequest,
) -> fitz.Document:
    active_pages = [page for page in request.pages if not page.excluded]
    if not active_pages:
        raise ValueError("출력할 페이지가 없습니다")

    out_doc = fitz.open()
    total_pages = len(active_pages)
    header_footer = _advanced_header_footer_settings(request.header_footer)
    facing_pages = bool(request.margins.facing_pages)
    try:
        for output_index, page_info in enumerate(active_pages):
            if page_info.file_index >= len(source_docs):
                raise ValueError("페이지의 원본 파일 번호가 올바르지 않습니다")
            source_doc = source_docs[page_info.file_index]
            if page_info.page_index >= source_doc.page_count:
                raise ValueError("페이지의 원본 페이지 번호가 올바르지 않습니다")

            source_page = source_doc[page_info.page_index]
            if int(getattr(source_page, "rotation", 0) or 0) % 360:
                source_page.set_rotation(0)
            source_rect = fitz.Rect(source_page.rect)
            rotation = int(page_info.rotation) % 360
            if rotation in (90, 270):
                page_width, page_height = source_rect.height, source_rect.width
            else:
                page_width, page_height = source_rect.width, source_rect.height

            out_page = out_doc.new_page(width=page_width, height=page_height)
            content_box = _content_box(page_width, page_height, request, output_index)
            _render_page_content(out_page, source_doc, page_info, source_rect, content_box)

            pdf_text_renderer.apply_header_footer(
                out_page,
                header_footer,
                page_width,
                page_height,
                output_index + 1,
                total_pages,
                facing_pages,
            )
            left_mm, right_mm, top_mm, bottom_mm = _effective_margin_mm(request, output_index)
            paper_margins = (
                left_mm * pdf_ops.MM_TO_PT,
                right_mm * pdf_ops.MM_TO_PT,
                top_mm * pdf_ops.MM_TO_PT,
                bottom_mm * pdf_ops.MM_TO_PT,
            )
            pdf_text_renderer.apply_page_numbers(
                out_page,
                request.page_numbers,
                output_index,
                total_pages,
                page_width,
                page_height,
                facing_pages,
                paper_margins=paper_margins,
            )

        return out_doc
    except Exception:
        out_doc.close()
        raise


def process_advanced_pdf_bytes(
    file_bytes_list: list[bytes],
    request: PdfAdvancedProcessRequest,
) -> bytes:
    source_docs: list[fitz.Document] = []
    out_doc: fitz.Document | None = None
    try:
        source_docs = [fitz.open(stream=data, filetype="pdf") for data in file_bytes_list]
        out_doc = build_advanced_pdf_document(source_docs, request)
        buffer = io.BytesIO()
        out_doc.save(buffer, garbage=4, deflate=True)
        return buffer.getvalue()
    finally:
        if out_doc is not None:
            out_doc.close()
        for doc in source_docs:
            doc.close()


def process_advanced_pdf_paths(
    source_paths: list[str | Path],
    request: PdfAdvancedProcessRequest,
    output_path: str | Path,
) -> Path:
    source_docs: list[fitz.Document] = []
    out_doc: fitz.Document | None = None
    destination = Path(output_path)
    try:
        source_docs = [fitz.open(str(Path(path))) for path in source_paths]
        out_doc = build_advanced_pdf_document(source_docs, request)
        destination.parent.mkdir(parents=True, exist_ok=True)
        out_doc.save(str(destination), garbage=4, deflate=True)
        return destination
    finally:
        if out_doc is not None:
            out_doc.close()
        for doc in source_docs:
            doc.close()
