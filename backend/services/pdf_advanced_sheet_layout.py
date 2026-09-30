from __future__ import annotations

import io
import math
from pathlib import Path

import fitz

from models.advanced_schemas import AdvancedPageInfo, PdfAdvancedProcessRequest
from services import pdf_advanced_engine, pdf_ops, pdf_text_renderer


def request_uses_sheet_layout(request: PdfAdvancedProcessRequest) -> bool:
    return any((not page.excluded) and (page.preserve_actual_size or page.crop_marks) for page in request.pages)


def _actual_size_rect(box: fitz.Rect, clip: fitz.Rect, rotation: float, scale: float, offset_x: float, offset_y: float) -> fitz.Rect:
    radians = math.radians(float(rotation) % 360.0)
    cosine = abs(math.cos(radians))
    sine = abs(math.sin(radians))
    width = clip.width * cosine + clip.height * sine
    height = clip.width * sine + clip.height * cosine
    width *= scale
    height *= scale
    center_x = box.width / 2 + offset_x
    center_y = box.height / 2 + offset_y
    return fitz.Rect(center_x - width / 2, center_y - height / 2, center_x + width / 2, center_y + height / 2)


def _render_actual_page_content(out_page: fitz.Page, source_doc: fitz.Document, page_info: AdvancedPageInfo, source_rect: fitz.Rect, content_box: fitz.Rect) -> fitz.Rect:
    erased_doc = pdf_advanced_engine._erased_source_document(source_doc, page_info.page_index, page_info)
    render_doc = erased_doc or source_doc
    render_index = 0 if erased_doc is not None else page_info.page_index
    try:
        clip = pdf_advanced_engine._clip_rect(source_rect, page_info)
        rotation = (int(page_info.rotation) + float(page_info.fine_rotation_deg or 0.0)) % 360.0
        local_box = fitz.Rect(0, 0, content_box.width, content_box.height)
        adjusted = _actual_size_rect(
            local_box,
            clip,
            rotation,
            float(page_info.edit_scale or 1.0),
            float(page_info.offset_x_mm or 0.0) * pdf_ops.MM_TO_PT,
            float(page_info.offset_y_mm or 0.0) * pdf_ops.MM_TO_PT,
        )
        clip_doc = fitz.open()
        try:
            clip_page = clip_doc.new_page(width=content_box.width, height=content_box.height)
            try:
                clip_page.show_pdf_page(adjusted, render_doc, render_index, rotate=rotation, keep_proportion=True, clip=clip)
            except ValueError as exc:
                if pdf_advanced_engine.EMPTY_SOURCE_PAGE_ERROR not in str(exc):
                    raise
            out_page.show_pdf_page(content_box, clip_doc, 0, keep_proportion=False)
        finally:
            clip_doc.close()
        return fitz.Rect(
            content_box.x0 + adjusted.x0,
            content_box.y0 + adjusted.y0,
            content_box.x0 + adjusted.x1,
            content_box.y0 + adjusted.y1,
        )
    finally:
        if erased_doc is not None:
            erased_doc.close()


def _draw_crop_marks(page: fitz.Page, trim: fitz.Rect, page_info: AdvancedPageInfo) -> None:
    length = float(page_info.crop_mark_length_mm or 5.0) * pdf_ops.MM_TO_PT
    gap = float(page_info.crop_mark_gap_mm or 2.0) * pdf_ops.MM_TO_PT
    shape = page.new_shape()
    segments = [
        ((trim.x0 - gap - length, trim.y0), (trim.x0 - gap, trim.y0)),
        ((trim.x1 + gap, trim.y0), (trim.x1 + gap + length, trim.y0)),
        ((trim.x0 - gap - length, trim.y1), (trim.x0 - gap, trim.y1)),
        ((trim.x1 + gap, trim.y1), (trim.x1 + gap + length, trim.y1)),
        ((trim.x0, trim.y0 - gap - length), (trim.x0, trim.y0 - gap)),
        ((trim.x1, trim.y0 - gap - length), (trim.x1, trim.y0 - gap)),
        ((trim.x0, trim.y1 + gap), (trim.x0, trim.y1 + gap + length)),
        ((trim.x1, trim.y1 + gap), (trim.x1, trim.y1 + gap + length)),
    ]
    for start, end in segments:
        shape.draw_line(fitz.Point(*start), fitz.Point(*end))
    shape.finish(color=(0, 0, 0), width=0.5)
    shape.commit(overlay=True)


def build_sheet_layout_pdf_document(source_docs: list[fitz.Document], request: PdfAdvancedProcessRequest) -> fitz.Document:
    active_pages = [page for page in request.pages if not page.excluded]
    if not active_pages:
        raise ValueError("출력할 페이지가 없습니다")
    out_doc = fitz.open()
    total_pages = len(active_pages)
    header_footer = pdf_advanced_engine._advanced_header_footer_settings(request.header_footer)
    facing_pages = bool(request.margins.facing_pages)
    try:
        for output_index, page_info in enumerate(active_pages):
            source_doc = source_docs[page_info.file_index]
            source_page = source_doc[page_info.page_index]
            if int(getattr(source_page, "rotation", 0) or 0) % 360:
                source_page.set_rotation(0)
            source_rect = fitz.Rect(source_page.rect)
            page_width, page_height = pdf_advanced_engine._output_page_size(source_rect, page_info)
            out_page = out_doc.new_page(width=page_width, height=page_height)
            content_box = pdf_advanced_engine._content_box(page_width, page_height, request, output_index)
            if page_info.preserve_actual_size:
                trim = _render_actual_page_content(out_page, source_doc, page_info, source_rect, content_box)
            else:
                pdf_advanced_engine._render_page_content(out_page, source_doc, page_info, source_rect, content_box)
                trim = content_box
            if page_info.crop_marks:
                _draw_crop_marks(out_page, trim, page_info)
            pdf_advanced_engine._render_page_overlays(out_page, page_info, page_width, page_height)
            pdf_text_renderer.apply_header_footer(out_page, header_footer, page_width, page_height, output_index + 1, total_pages, facing_pages)
            left_mm, right_mm, top_mm, bottom_mm = pdf_advanced_engine._effective_margin_mm(request, output_index)
            paper_margins = tuple(value * pdf_ops.MM_TO_PT for value in (left_mm, right_mm, top_mm, bottom_mm))
            pdf_text_renderer.apply_page_numbers(out_page, request.page_numbers, output_index, total_pages, page_width, page_height, facing_pages, paper_margins=paper_margins)
        return out_doc
    except Exception:
        out_doc.close()
        raise


def process_sheet_layout_pdf_bytes(file_bytes_list: list[bytes], request: PdfAdvancedProcessRequest) -> bytes:
    source_docs = [fitz.open(stream=data, filetype="pdf") for data in file_bytes_list]
    out_doc = None
    try:
        out_doc = build_sheet_layout_pdf_document(source_docs, request)
        buffer = io.BytesIO()
        out_doc.save(buffer, garbage=4, deflate=True)
        return buffer.getvalue()
    finally:
        if out_doc is not None:
            out_doc.close()
        for doc in source_docs:
            doc.close()


def process_sheet_layout_pdf_paths(source_paths: list[str | Path], request: PdfAdvancedProcessRequest, output_path: str | Path) -> Path:
    source_docs = [fitz.open(str(Path(path))) for path in source_paths]
    out_doc = None
    destination = Path(output_path)
    try:
        out_doc = build_sheet_layout_pdf_document(source_docs, request)
        destination.parent.mkdir(parents=True, exist_ok=True)
        out_doc.save(str(destination), garbage=4, deflate=True)
        return destination
    finally:
        if out_doc is not None:
            out_doc.close()
        for doc in source_docs:
            doc.close()
