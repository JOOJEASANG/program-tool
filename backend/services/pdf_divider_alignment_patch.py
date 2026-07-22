"""Patch divider rendering so saved left/center/right positions are preserved in exported PDFs."""
import fitz
from services import pdf_ops


def _text_rect(page_w: float, center_x: float, y0: float, y1: float, pad: float):
    if center_x <= page_w * 0.25:
        return fitz.Rect(pad, y0, page_w * 0.72, y1), fitz.TEXT_ALIGN_LEFT
    if center_x >= page_w * 0.75:
        return fitz.Rect(page_w * 0.28, y0, page_w - pad, y1), fitz.TEXT_ALIGN_RIGHT
    return fitz.Rect(pad, y0, page_w - pad, y1), fitz.TEXT_ALIGN_CENTER


def _render_divider_page(out_doc: fitz.Document, content_raw: str, style: str,
                           paper_w_pt: float, paper_h_pt: float):
    content = pdf_ops._parse_divider_content(content_raw)
    title = content.get("title", "")
    subtitle = content.get("subtitle", "")
    note = content.get("note", "")
    fg = (0.067, 0.094, 0.153)
    resolved_style = content.get("style", style or "simple")

    title_y = paper_h_pt * pdf_ops._safe_float(content.get("titleY", 45), 45, 5, 95) / 100
    subtitle_y = paper_h_pt * pdf_ops._safe_float(content.get("subtitleY", 55), 55, 5, 95) / 100
    note_y = paper_h_pt * pdf_ops._safe_float(content.get("noteY", 88), 88, 5, 95) / 100
    title_x = paper_w_pt * pdf_ops._safe_float(content.get("titleX", 50), 50, 5, 95) / 100
    subtitle_x = paper_w_pt * pdf_ops._safe_float(content.get("subtitleX", 50), 50, 5, 95) / 100
    note_x = paper_w_pt * pdf_ops._safe_float(content.get("noteX", 50), 50, 5, 95) / 100

    page = out_doc.new_page(width=paper_w_pt, height=paper_h_pt)
    pad = 40

    if resolved_style in ("lines", "band"):
        half = paper_w_pt * 0.32
        x0 = max(pad, title_x - half)
        x1 = min(paper_w_pt - pad, title_x + half)
        shape = page.new_shape()
        shape.draw_line(fitz.Point(x0, title_y - paper_h_pt * 0.09), fitz.Point(x1, title_y - paper_h_pt * 0.09))
        shape.draw_line(fitz.Point(x0, title_y + paper_h_pt * 0.09), fitz.Point(x1, title_y + paper_h_pt * 0.09))
        shape.finish(color=fg, width=1.0)
        shape.commit()

    if title:
        rect, align = _text_rect(paper_w_pt, title_x, title_y - 32, title_y + 14, pad)
        page.insert_textbox(rect, title, fontsize=28, fontname="helv", color=fg, align=align)
    if subtitle:
        rect, align = _text_rect(paper_w_pt, subtitle_x, subtitle_y - 24, subtitle_y + 12, pad)
        page.insert_textbox(rect, subtitle, fontsize=18, fontname="helv", color=fg, align=align)
    if note:
        rect, align = _text_rect(paper_w_pt, note_x, note_y - 18, note_y + 10, pad)
        page.insert_textbox(rect, note, fontsize=11, fontname="helv", color=fg, align=align)


pdf_ops._render_divider_page = _render_divider_page
