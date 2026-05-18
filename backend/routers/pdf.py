import json
from flask import Blueprint, request, jsonify, Response
import fitz

from models.schemas import PdfProcessRequest
import services.pdf_ops as pdf_ops
from utils.auth import require_auth

pdf_bp = Blueprint("pdf", __name__)


def _safe_float(value, fallback, min_value=0.0, max_value=100.0):
    try:
        n = float(value)
    except Exception:
        n = fallback
    return max(min_value, min(max_value, n))


def _patch_divider_renderer():
    """Patch divider output so it matches the free white-background editor behavior.

    Divider pages now always use a white background and black text. Optional titleY,
    subtitleY, and noteY values are percentages from top and are honored in exported PDFs.
    """
    if getattr(pdf_ops, "_divider_renderer_patched_v2", False):
        return

    def render_divider_page(out_doc, content_raw, style, paper_w_pt, paper_h_pt):
        content = pdf_ops._parse_divider_content(content_raw)
        title = content.get("title", "") or ""
        subtitle = content.get("subtitle", "") or ""
        note = content.get("note", "") or ""
        resolved_style = content.get("style", style or "simple")
        fg = (0.067, 0.094, 0.153)  # #111827
        pad = 40

        title_y = paper_h_pt * _safe_float(content.get("titleY", 45), 45, 5, 95) / 100
        subtitle_y = paper_h_pt * _safe_float(content.get("subtitleY", 55), 55, 5, 95) / 100
        note_y = paper_h_pt * _safe_float(content.get("noteY", 88), 88, 5, 95) / 100

        page = out_doc.new_page(width=paper_w_pt, height=paper_h_pt)

        if resolved_style in ("lines", "band"):
            shape = page.new_shape()
            shape.draw_line(fitz.Point(pad, max(12, title_y - paper_h_pt * 0.09)), fitz.Point(paper_w_pt - pad, max(12, title_y - paper_h_pt * 0.09)))
            shape.draw_line(fitz.Point(pad, min(paper_h_pt - 12, title_y + paper_h_pt * 0.09)), fitz.Point(paper_w_pt - pad, min(paper_h_pt - 12, title_y + paper_h_pt * 0.09)))
            shape.finish(color=fg, width=1.0)
            shape.commit()

        if title:
            rect = fitz.Rect(pad, title_y - 32, paper_w_pt - pad, title_y + 14)
            page.insert_textbox(rect, title, fontsize=28, fontname="helv", color=fg, align=fitz.TEXT_ALIGN_CENTER)

        if subtitle:
            rect = fitz.Rect(pad, subtitle_y - 24, paper_w_pt - pad, subtitle_y + 12)
            page.insert_textbox(rect, subtitle, fontsize=18, fontname="helv", color=fg, align=fitz.TEXT_ALIGN_CENTER)

        if note:
            rect = fitz.Rect(pad, note_y - 18, paper_w_pt - pad, note_y + 10)
            page.insert_textbox(rect, note, fontsize=11, fontname="helv", color=fg, align=fitz.TEXT_ALIGN_CENTER)

    pdf_ops._render_divider_page = render_divider_page
    pdf_ops._divider_renderer_patched_v2 = True


@pdf_bp.route("/process", methods=["POST"])
@require_auth
def process(uid):
    try:
        req = PdfProcessRequest.model_validate(json.loads(request.form.get("settings", "{}")))
    except Exception as e:
        return jsonify({"detail": f"Invalid settings: {e}"}), 422

    files = request.files.getlist("files")
    if not files:
        return jsonify({"detail": "No files provided"}), 400

    file_bytes_list = []
    for f in files:
        if not (f.filename or "").lower().endswith(".pdf"):
            return jsonify({"detail": f"File '{f.filename}' is not a PDF"}), 400
        data = f.read()
        if len(data) > 100 * 1024 * 1024:
            return jsonify({"detail": f"File '{f.filename}' exceeds 100 MB"}), 413
        file_bytes_list.append(data)

    try:
        _patch_divider_renderer()
        output_bytes = pdf_ops.process_pdf(file_bytes_list, req)
    except Exception as e:
        return jsonify({"detail": f"PDF processing failed: {e}"}), 500

    return Response(
        output_bytes,
        status=200,
        mimetype="application/pdf",
        headers={"Content-Disposition": "attachment; filename=output.pdf"},
    )