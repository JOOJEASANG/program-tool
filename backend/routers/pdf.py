import json
import os
from flask import Blueprint, request, jsonify, Response
import fitz
import firebase_admin.storage as fa_storage

from models.schemas import PdfProcessRequest
import services.pdf_ops as pdf_ops
from utils.auth import require_auth

pdf_bp = Blueprint("pdf", __name__)

MAX_PDF_FILE_BYTES = 200 * 1024 * 1024
MAX_TOTAL_PDF_BYTES = 300 * 1024 * 1024
MAX_PDF_FILES = 50
MAX_REQUEST_PAGES = 2000
DEFAULT_STORAGE_BUCKET = os.environ.get("FIREBASE_STORAGE_BUCKET", "program-tool.firebasestorage.app")


def _bucket():
    """Return the same Firebase Storage bucket used by the web client."""
    return fa_storage.bucket(DEFAULT_STORAGE_BUCKET)


def _max_file_mb() -> int:
    return MAX_PDF_FILE_BYTES // (1024 * 1024)


def _max_total_mb() -> int:
    return MAX_TOTAL_PDF_BYTES // (1024 * 1024)


def _safe_float(value, fallback, min_value=0.0, max_value=100.0):
    try:
        n = float(value)
    except Exception:
        n = fallback
    return max(min_value, min(max_value, n))


def _validate_total_bytes(file_bytes_list: list[bytes]) -> None:
    total_bytes = sum(len(data) for data in file_bytes_list)
    if total_bytes > MAX_TOTAL_PDF_BYTES:
        raise ValueError(f"전체 PDF 용량은 최대 {_max_total_mb()} MB까지 처리할 수 있습니다")


def _validate_pdf_request(req: PdfProcessRequest, file_bytes_list: list[bytes]) -> None:
    """Validate file sizes and page references before handing work to PyMuPDF."""
    if not file_bytes_list:
        raise ValueError("파일이 없습니다")
    if len(file_bytes_list) > MAX_PDF_FILES:
        raise ValueError(f"파일은 최대 {MAX_PDF_FILES}개까지 처리할 수 있습니다")
    _validate_total_bytes(file_bytes_list)
    if not req.pages:
        raise ValueError("출력할 페이지가 없습니다")
    if len(req.pages) > MAX_REQUEST_PAGES:
        raise ValueError(f"페이지는 최대 {MAX_REQUEST_PAGES}개까지 처리할 수 있습니다")

    docs = []
    try:
        for data in file_bytes_list:
            if len(data) > MAX_PDF_FILE_BYTES:
                raise ValueError(f"파일이 {_max_file_mb()} MB를 초과합니다")
            docs.append(fitz.open(stream=data, filetype="pdf"))

        for page in req.pages:
            if page.excluded or page.page_type in ("divider", "blank"):
                continue
            if page.file_index < 0 or page.file_index >= len(docs):
                raise ValueError("페이지 정보의 파일 번호가 올바르지 않습니다")
            if page.page_index < 0 or page.page_index >= len(docs[page.file_index]):
                raise ValueError("페이지 정보의 페이지 번호가 올바르지 않습니다")
    finally:
        for doc in docs:
            try:
                doc.close()
            except Exception:
                pass


def _validate_storage_path(uid: str, path: str) -> None:
    if not isinstance(path, str) or not path:
        raise ValueError("잘못된 파일 경로입니다")
    if ".." in path or path.startswith("/"):
        raise PermissionError("허용되지 않은 파일 경로입니다")
    if not path.startswith(f"pdf_temp/{uid}/"):
        raise PermissionError("허용되지 않은 파일 경로입니다")
    if not path.lower().endswith(".pdf"):
        raise ValueError("PDF 파일만 처리할 수 있습니다")


def _hex_color(value, fallback=(0.0, 0.0, 0.0)) -> tuple[float, float, float]:
    """Convert CSS #RGB / #RRGGBB colors to PyMuPDF RGB tuples."""
    text = str(value or "").strip().lower()
    if text.startswith("#"):
        text = text[1:]
    if len(text) == 3:
        text = "".join(ch * 2 for ch in text)
    if len(text) != 6:
        return fallback
    try:
        return tuple(int(text[index:index + 2], 16) / 255 for index in (0, 2, 4))
    except ValueError:
        return fallback


def _divider_align(value, x_pct: float) -> str:
    if value in ("left", "center", "right"):
        return value
    if x_pct <= 20:
        return "left"
    if x_pct >= 80:
        return "right"
    return "center"


def _draw_divider_text(
    page,
    text,
    *,
    x_pct,
    y_pct,
    font_size,
    color,
    align="center",
    weight=400,
    italic=False,
    opacity=1.0,
    rotation=0.0,
    paper_w_pt,
    paper_h_pt,
):
    """Draw one divider text layer using the same anchor model as the browser canvas."""
    if text is None or str(text) == "":
        return

    text = str(text)
    x_pct = _safe_float(x_pct, 50, 0, 100)
    y_pct = _safe_float(y_pct, 50, 0, 100)
    font_size = _safe_float(font_size, 18, 4, 240)
    opacity = _safe_float(opacity, 1, 0.05, 1)
    rotation = _safe_float(rotation, 0, -180, 180)
    align = _divider_align(align, x_pct)

    fontname = "korea"
    try:
        text_width = fitz.get_text_length(text, fontname=fontname, fontsize=font_size)
    except Exception:
        text_width = max(font_size, len(text) * font_size * 0.65)

    anchor_x = paper_w_pt * x_pct / 100
    anchor_y = paper_h_pt * y_pct / 100
    if align == "left":
        origin_x = anchor_x
    elif align == "right":
        origin_x = anchor_x - text_width
    else:
        origin_x = anchor_x - text_width / 2
    origin_y = anchor_y + font_size * 0.35

    max_width = paper_w_pt * 0.88
    horizontal_scale = min(1.0, max_width / text_width) if text_width > 0 else 1.0
    matrix = fitz.Matrix(horizontal_scale, 1)
    if italic:
        matrix.preshear(12, 0)
    if rotation:
        matrix.prerotate(rotation)

    kwargs = {
        "fontsize": font_size,
        "fontname": fontname,
        "set_simple": False,
        "color": color,
        "fill_opacity": opacity,
        "morph": (fitz.Point(anchor_x, anchor_y), matrix),
        "overlay": True,
    }
    page.insert_text(fitz.Point(origin_x, origin_y), text, **kwargs)
    if _safe_float(weight, 400, 100, 900) >= 700:
        page.insert_text(fitz.Point(origin_x + 0.35, origin_y), text, **kwargs)


def _patch_divider_renderer():
    """Make exported divider pages match the final browser renderer."""
    if getattr(pdf_ops, "_divider_renderer_patched_v3", False):
        return

    def render_divider_page(out_doc, content_raw, style, paper_w_pt, paper_h_pt):
        content = pdf_ops._parse_divider_content(content_raw)
        resolved_style = content.get("style", style or "simple")
        no_bg = content.get("noBg", True) is not False
        bg = (1.0, 1.0, 1.0) if no_bg else _hex_color(content.get("bg"), (1.0, 1.0, 1.0))
        fg = _hex_color(content.get("fg"), (0.0, 0.0, 0.0))

        page = out_doc.new_page(width=paper_w_pt, height=paper_h_pt)
        page.draw_rect(page.rect, color=None, fill=bg, overlay=True)

        if not no_bg and resolved_style == "band":
            page.draw_rect(
                fitz.Rect(0, paper_h_pt * 0.34, paper_w_pt, paper_h_pt * 0.66),
                color=None,
                fill=fg,
                fill_opacity=0.16,
                overlay=True,
            )
        elif resolved_style == "lines":
            shape = page.new_shape()
            for y_pct in (38, 64):
                y = paper_h_pt * y_pct / 100
                shape.draw_line(fitz.Point(paper_w_pt * 0.14, y), fitz.Point(paper_w_pt * 0.86, y))
            shape.finish(color=fg, width=max(0.8, paper_w_pt * 0.002), stroke_opacity=0.28)
            shape.commit(overlay=True)

        offset = _safe_float(content.get("textVOffset", 0), 0, -50, 50)
        title_x = _safe_float(content.get("titleX", 50), 50, 0, 100)
        subtitle_x = _safe_float(content.get("subtitleX", 50), 50, 0, 100)
        note_x = _safe_float(content.get("noteX", 50), 50, 0, 100)

        _draw_divider_text(
            page,
            content.get("title", ""),
            x_pct=title_x,
            y_pct=_safe_float(content.get("titleY", 45), 45, 0, 100) + offset,
            font_size=42,
            color=fg,
            align=_divider_align(None, title_x),
            weight=700,
            opacity=1,
            paper_w_pt=paper_w_pt,
            paper_h_pt=paper_h_pt,
        )
        _draw_divider_text(
            page,
            content.get("subtitle", ""),
            x_pct=subtitle_x,
            y_pct=_safe_float(content.get("subtitleY", 55), 55, 0, 100) + offset,
            font_size=24,
            color=fg,
            align=_divider_align(None, subtitle_x),
            weight=400,
            opacity=0.82,
            paper_w_pt=paper_w_pt,
            paper_h_pt=paper_h_pt,
        )
        _draw_divider_text(
            page,
            content.get("note", ""),
            x_pct=note_x,
            y_pct=_safe_float(content.get("noteY", 88), 88, 0, 100) + offset,
            font_size=15,
            color=fg,
            align=_divider_align(None, note_x),
            weight=400,
            opacity=0.68,
            paper_w_pt=paper_w_pt,
            paper_h_pt=paper_h_pt,
        )

        page_scale = min(paper_w_pt / 595, paper_h_pt / 842)
        extras = content.get("extraTexts", [])
        if isinstance(extras, list):
            for item in extras:
                if not isinstance(item, dict) or item.get("hidden"):
                    continue
                _draw_divider_text(
                    page,
                    item.get("text", ""),
                    x_pct=item.get("x", 50),
                    y_pct=item.get("y", 70),
                    font_size=_safe_float(item.get("size", 18), 18, 6, 96) * page_scale,
                    color=_hex_color(item.get("color"), (0.0, 0.0, 0.0)),
                    align=item.get("align", "center"),
                    weight=item.get("weight", 400),
                    italic=bool(item.get("italic")),
                    opacity=item.get("opacity", 1),
                    rotation=item.get("rotation", 0),
                    paper_w_pt=paper_w_pt,
                    paper_h_pt=paper_h_pt,
                )

    pdf_ops._render_divider_page = render_divider_page
    pdf_ops._divider_renderer_patched_v3 = True


def _cleanup_temp_files(bucket, storage_paths: list[str]) -> None:
    for path in storage_paths:
        try:
            bucket.blob(path).delete()
        except Exception:
            pass


@pdf_bp.route("/process", methods=["POST"])
@require_auth
def process(uid):
    try:
        req = PdfProcessRequest.model_validate(json.loads(request.form.get("settings", "{}")))
    except Exception as exc:
        return jsonify({"detail": f"Invalid settings: {exc}"}), 422

    files = request.files.getlist("files")
    if not files:
        return jsonify({"detail": "No files provided"}), 400
    if len(files) > MAX_PDF_FILES:
        return jsonify({"detail": f"파일은 최대 {MAX_PDF_FILES}개까지 처리할 수 있습니다"}), 400

    file_bytes_list = []
    total_bytes = 0
    for uploaded in files:
        if not (uploaded.filename or "").lower().endswith(".pdf"):
            return jsonify({"detail": f"File '{uploaded.filename}' is not a PDF"}), 400
        data = uploaded.read()
        if len(data) > MAX_PDF_FILE_BYTES:
            return jsonify({"detail": f"File '{uploaded.filename}' exceeds {_max_file_mb()} MB"}), 413
        total_bytes += len(data)
        if total_bytes > MAX_TOTAL_PDF_BYTES:
            return jsonify({"detail": f"전체 PDF 용량은 최대 {_max_total_mb()} MB까지 처리할 수 있습니다"}), 413
        file_bytes_list.append(data)

    try:
        _validate_pdf_request(req, file_bytes_list)
        _patch_divider_renderer()
        output_bytes = pdf_ops.process_pdf(file_bytes_list, req)
    except ValueError as exc:
        return jsonify({"detail": str(exc)}), 400
    except Exception as exc:
        return jsonify({"detail": f"PDF processing failed: {exc}"}), 500

    return Response(
        output_bytes,
        status=200,
        mimetype="application/pdf",
        headers={"Content-Disposition": "attachment; filename=output.pdf"},
    )


@pdf_bp.route("/process-storage", methods=["POST"])
@require_auth
def process_storage(uid):
    """Read temporary source PDFs from Firebase Storage and always clean them up."""
    try:
        body = request.get_json(force=True) or {}
        storage_paths = body.get("storage_paths", [])
        req = PdfProcessRequest.model_validate(body.get("settings", {}))
    except Exception as exc:
        return jsonify({"detail": f"Invalid request: {exc}"}), 422

    if not storage_paths:
        return jsonify({"detail": "No files provided"}), 400
    if not isinstance(storage_paths, list):
        return jsonify({"detail": "storage_paths 형식이 올바르지 않습니다"}), 400
    if len(storage_paths) > MAX_PDF_FILES:
        return jsonify({"detail": f"파일은 최대 {MAX_PDF_FILES}개까지 처리할 수 있습니다"}), 400

    try:
        for path in storage_paths:
            _validate_storage_path(uid, path)
    except PermissionError as exc:
        return jsonify({"detail": str(exc)}), 403
    except ValueError as exc:
        return jsonify({"detail": str(exc)}), 400

    bucket = _bucket()
    try:
        blobs = []
        total_declared_bytes = 0
        for path in storage_paths:
            blob = bucket.blob(path)
            try:
                blob.reload()
            except Exception:
                return jsonify({"detail": f"업로드된 임시 파일을 찾을 수 없습니다. 다시 저장을 눌러주세요. ({path})"}), 404
            size = int(blob.size or 0)
            if size > MAX_PDF_FILE_BYTES:
                return jsonify({"detail": f"파일이 {_max_file_mb()} MB를 초과합니다"}), 413
            total_declared_bytes += size
            if total_declared_bytes > MAX_TOTAL_PDF_BYTES:
                return jsonify({"detail": f"전체 PDF 용량은 최대 {_max_total_mb()} MB까지 처리할 수 있습니다"}), 413
            blobs.append(blob)

        file_bytes_list = []
        total_downloaded_bytes = 0
        for blob in blobs:
            data = blob.download_as_bytes()
            if len(data) > MAX_PDF_FILE_BYTES:
                return jsonify({"detail": f"파일이 {_max_file_mb()} MB를 초과합니다"}), 413
            total_downloaded_bytes += len(data)
            if total_downloaded_bytes > MAX_TOTAL_PDF_BYTES:
                return jsonify({"detail": f"전체 PDF 용량은 최대 {_max_total_mb()} MB까지 처리할 수 있습니다"}), 413
            file_bytes_list.append(data)

        try:
            _validate_pdf_request(req, file_bytes_list)
            _patch_divider_renderer()
            output_bytes = pdf_ops.process_pdf(file_bytes_list, req)
        except ValueError as exc:
            return jsonify({"detail": str(exc)}), 400
        except Exception as exc:
            return jsonify({"detail": f"PDF 처리 실패: {exc}"}), 500

        return Response(
            output_bytes,
            status=200,
            mimetype="application/pdf",
            headers={"Content-Disposition": "attachment; filename=output.pdf"},
        )
    except Exception as exc:
        return jsonify({"detail": f"Storage 다운로드 실패: {exc}"}), 500
    finally:
        _cleanup_temp_files(bucket, storage_paths)
