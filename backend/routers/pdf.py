import json
import os

import firebase_admin.storage as fa_storage
import fitz
from flask import Blueprint, Response, jsonify, request

from models.schemas import PdfProcessRequest
import services.pdf_ops as pdf_ops
from utils.auth import require_auth


pdf_bp = Blueprint("pdf", __name__)

MAX_PDF_FILE_BYTES = 200 * 1024 * 1024
MAX_TOTAL_PDF_BYTES = 400 * 1024 * 1024
MAX_PDF_FILES = 50
MAX_REQUEST_PAGES = 2000
MULTIPART_OVERHEAD_BYTES = 10 * 1024 * 1024
DEFAULT_STORAGE_BUCKET = os.environ.get(
    "FIREBASE_STORAGE_BUCKET", "program-tool.firebasestorage.app"
)


def _bucket():
    """Return the same Firebase Storage bucket used by the web client."""
    return fa_storage.bucket(DEFAULT_STORAGE_BUCKET)


def _max_file_mb() -> int:
    return MAX_PDF_FILE_BYTES // (1024 * 1024)


def _max_total_mb() -> int:
    return MAX_TOTAL_PDF_BYTES // (1024 * 1024)


def _safe_float(value, fallback, min_value=0.0, max_value=100.0):
    try:
        number = float(value)
    except Exception:
        number = fallback
    return max(min_value, min(max_value, number))


def _validate_pdf_request(req: PdfProcessRequest, file_bytes_list: list[bytes]) -> None:
    """Validate aggregate limits and page references before invoking PyMuPDF."""
    if not file_bytes_list:
        raise ValueError("파일이 없습니다")
    if len(file_bytes_list) > MAX_PDF_FILES:
        raise ValueError(f"파일은 최대 {MAX_PDF_FILES}개까지 처리할 수 있습니다")
    if sum(len(data) for data in file_bytes_list) > MAX_TOTAL_PDF_BYTES:
        raise ValueError(f"전체 PDF 용량은 최대 {_max_total_mb()} MB까지 처리할 수 있습니다")
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
        for document in docs:
            try:
                document.close()
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


def _cleanup_storage_paths(bucket, storage_paths: list[str]) -> None:
    for path in storage_paths:
        try:
            bucket.blob(path).delete()
        except Exception:
            pass


def _patch_divider_renderer():
    """Install a minimal fallback only when the richer renderer did not load."""
    if getattr(pdf_ops, "_divider_renderer_patched_v2", False):
        return

    def render_divider_page(out_doc, content_raw, style, paper_w_pt, paper_h_pt):
        content = pdf_ops._parse_divider_content(content_raw)
        title = content.get("title", "") or ""
        subtitle = content.get("subtitle", "") or ""
        note = content.get("note", "") or ""
        resolved_style = content.get("style", style or "simple")
        foreground = (0.067, 0.094, 0.153)
        padding = 40

        title_y = paper_h_pt * _safe_float(content.get("titleY", 45), 45, 5, 95) / 100
        subtitle_y = paper_h_pt * _safe_float(content.get("subtitleY", 55), 55, 5, 95) / 100
        note_y = paper_h_pt * _safe_float(content.get("noteY", 88), 88, 5, 95) / 100

        page = out_doc.new_page(width=paper_w_pt, height=paper_h_pt)
        if resolved_style in ("lines", "band"):
            shape = page.new_shape()
            shape.draw_line(
                fitz.Point(padding, max(12, title_y - paper_h_pt * 0.09)),
                fitz.Point(paper_w_pt - padding, max(12, title_y - paper_h_pt * 0.09)),
            )
            shape.draw_line(
                fitz.Point(padding, min(paper_h_pt - 12, title_y + paper_h_pt * 0.09)),
                fitz.Point(paper_w_pt - padding, min(paper_h_pt - 12, title_y + paper_h_pt * 0.09)),
            )
            shape.finish(color=foreground, width=1.0)
            shape.commit()

        if title:
            page.insert_textbox(
                fitz.Rect(padding, title_y - 32, paper_w_pt - padding, title_y + 14),
                title,
                fontsize=28,
                fontname="korea",
                color=foreground,
                align=fitz.TEXT_ALIGN_CENTER,
            )
        if subtitle:
            page.insert_textbox(
                fitz.Rect(padding, subtitle_y - 24, paper_w_pt - padding, subtitle_y + 12),
                subtitle,
                fontsize=18,
                fontname="korea",
                color=foreground,
                align=fitz.TEXT_ALIGN_CENTER,
            )
        if note:
            page.insert_textbox(
                fitz.Rect(padding, note_y - 18, paper_w_pt - padding, note_y + 10),
                note,
                fontsize=11,
                fontname="korea",
                color=foreground,
                align=fitz.TEXT_ALIGN_CENTER,
            )

    pdf_ops._render_divider_page = render_divider_page
    pdf_ops._divider_renderer_patched_v2 = True


@pdf_bp.route("/process", methods=["POST"])
@require_auth
def process(uid):
    if request.content_length and request.content_length > (
        MAX_TOTAL_PDF_BYTES + MULTIPART_OVERHEAD_BYTES
    ):
        return jsonify({
            "detail": f"전체 PDF 용량은 최대 {_max_total_mb()} MB까지 처리할 수 있습니다"
        }), 413

    try:
        req = PdfProcessRequest.model_validate(
            json.loads(request.form.get("settings", "{}"))
        )
    except Exception as exc:
        return jsonify({"detail": f"Invalid settings: {exc}"}), 422

    files = request.files.getlist("files")
    if not files:
        return jsonify({"detail": "No files provided"}), 400
    if len(files) > MAX_PDF_FILES:
        return jsonify({
            "detail": f"파일은 최대 {MAX_PDF_FILES}개까지 처리할 수 있습니다"
        }), 400

    file_bytes_list: list[bytes] = []
    total_bytes = 0
    for uploaded in files:
        if not (uploaded.filename or "").lower().endswith(".pdf"):
            return jsonify({
                "detail": f"File '{uploaded.filename}' is not a PDF"
            }), 400
        data = uploaded.read()
        if len(data) > MAX_PDF_FILE_BYTES:
            return jsonify({
                "detail": f"File '{uploaded.filename}' exceeds {_max_file_mb()} MB"
            }), 413
        total_bytes += len(data)
        if total_bytes > MAX_TOTAL_PDF_BYTES:
            return jsonify({
                "detail": f"전체 PDF 용량은 최대 {_max_total_mb()} MB까지 처리할 수 있습니다"
            }), 413
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
    """Read temporary source PDFs from Storage with bounded aggregate memory."""
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
        return jsonify({
            "detail": f"파일은 최대 {MAX_PDF_FILES}개까지 처리할 수 있습니다"
        }), 400

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
        declared_total = 0
        for path in storage_paths:
            blob = bucket.blob(path)
            try:
                blob.reload()
            except Exception:
                return jsonify({
                    "detail": "업로드된 임시 파일을 찾을 수 없습니다. 다시 저장을 눌러주세요."
                }), 404
            blob_size = int(blob.size or 0)
            if blob_size > MAX_PDF_FILE_BYTES:
                return jsonify({
                    "detail": f"파일이 {_max_file_mb()} MB를 초과합니다"
                }), 413
            declared_total += blob_size
            if declared_total > MAX_TOTAL_PDF_BYTES:
                return jsonify({
                    "detail": f"전체 PDF 용량은 최대 {_max_total_mb()} MB까지 처리할 수 있습니다"
                }), 413
            blobs.append(blob)

        file_bytes_list: list[bytes] = []
        actual_total = 0
        for blob in blobs:
            data = blob.download_as_bytes()
            if len(data) > MAX_PDF_FILE_BYTES:
                return jsonify({
                    "detail": f"파일이 {_max_file_mb()} MB를 초과합니다"
                }), 413
            actual_total += len(data)
            if actual_total > MAX_TOTAL_PDF_BYTES:
                return jsonify({
                    "detail": f"전체 PDF 용량은 최대 {_max_total_mb()} MB까지 처리할 수 있습니다"
                }), 413
            file_bytes_list.append(data)

        _validate_pdf_request(req, file_bytes_list)
        _patch_divider_renderer()
        output_bytes = pdf_ops.process_pdf(file_bytes_list, req)
    except ValueError as exc:
        return jsonify({"detail": str(exc)}), 400
    except Exception as exc:
        return jsonify({"detail": f"PDF 처리 실패: {exc}"}), 500
    finally:
        _cleanup_storage_paths(bucket, storage_paths)

    return Response(
        output_bytes,
        status=200,
        mimetype="application/pdf",
        headers={"Content-Disposition": "attachment; filename=output.pdf"},
    )
