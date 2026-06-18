import json
import os
from flask import Blueprint, request, jsonify, Response
import fitz
import firebase_admin.storage as fa_storage

from models.schemas import PdfProcessRequest
import services.pdf_ops as pdf_ops
from utils.auth import require_auth

pdf_bp = Blueprint("pdf", __name__)

MAX_PDF_FILE_BYTES = 100 * 1024 * 1024
MAX_PDF_FILES = 50
MAX_REQUEST_PAGES = 2000
DEFAULT_STORAGE_BUCKET = os.environ.get("FIREBASE_STORAGE_BUCKET", "program-tool.firebasestorage.app")


def _bucket():
    """Return the same Firebase Storage bucket used by the web client.

    Cloud Functions can default to a legacy bucket name in some projects. The PDF
    editor uploads temp files from the browser, so the backend must read from the
    configured Firebase Storage bucket explicitly.
    """
    return fa_storage.bucket(DEFAULT_STORAGE_BUCKET)


def _safe_float(value, fallback, min_value=0.0, max_value=100.0):
    try:
        n = float(value)
    except Exception:
        n = fallback
    return max(min_value, min(max_value, n))


def _validate_pdf_request(req: PdfProcessRequest, file_bytes_list: list[bytes]) -> None:
    """Validate page references before handing work to PyMuPDF.

    Pydantic validates shape, but actual file/page indexes must be checked against
    the uploaded documents to avoid 500s and accidental out-of-range access.
    """
    if not file_bytes_list:
        raise ValueError("파일이 없습니다")
    if len(file_bytes_list) > MAX_PDF_FILES:
        raise ValueError(f"파일은 최대 {MAX_PDF_FILES}개까지 처리할 수 있습니다")
    if not req.pages:
        raise ValueError("출력할 페이지가 없습니다")
    if len(req.pages) > MAX_REQUEST_PAGES:
        raise ValueError(f"페이지는 최대 {MAX_REQUEST_PAGES}개까지 처리할 수 있습니다")

    docs = []
    try:
        for data in file_bytes_list:
            if len(data) > MAX_PDF_FILE_BYTES:
                raise ValueError("파일이 100 MB를 초과합니다")
            docs.append(fitz.open(stream=data, filetype="pdf"))

        for p in req.pages:
            if p.excluded or p.page_type in ("divider", "blank"):
                continue
            if p.file_index < 0 or p.file_index >= len(docs):
                raise ValueError("페이지 정보의 파일 번호가 올바르지 않습니다")
            if p.page_index < 0 or p.page_index >= len(docs[p.file_index]):
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
    if len(files) > MAX_PDF_FILES:
        return jsonify({"detail": f"파일은 최대 {MAX_PDF_FILES}개까지 처리할 수 있습니다"}), 400

    file_bytes_list = []
    for f in files:
        if not (f.filename or "").lower().endswith(".pdf"):
            return jsonify({"detail": f"File '{f.filename}' is not a PDF"}), 400
        data = f.read()
        if len(data) > MAX_PDF_FILE_BYTES:
            return jsonify({"detail": f"File '{f.filename}' exceeds 100 MB"}), 413
        file_bytes_list.append(data)

    try:
        _validate_pdf_request(req, file_bytes_list)
        _patch_divider_renderer()
        output_bytes = pdf_ops.process_pdf(file_bytes_list, req)
    except ValueError as e:
        return jsonify({"detail": str(e)}), 400
    except Exception as e:
        return jsonify({"detail": f"PDF processing failed: {e}"}), 500

    return Response(
        output_bytes,
        status=200,
        mimetype="application/pdf",
        headers={"Content-Disposition": "attachment; filename=output.pdf"},
    )


@pdf_bp.route("/process-storage", methods=["POST"])
@require_auth
def process_storage(uid):
    """Storage-based endpoint: reads source PDFs from Firebase Storage, no HTTP body size limit."""
    try:
        body = request.get_json(force=True) or {}
        storage_paths = body.get("storage_paths", [])
        req = PdfProcessRequest.model_validate(body.get("settings", {}))
    except Exception as e:
        return jsonify({"detail": f"Invalid request: {e}"}), 422

    if not storage_paths:
        return jsonify({"detail": "No files provided"}), 400
    if not isinstance(storage_paths, list):
        return jsonify({"detail": "storage_paths 형식이 올바르지 않습니다"}), 400
    if len(storage_paths) > MAX_PDF_FILES:
        return jsonify({"detail": f"파일은 최대 {MAX_PDF_FILES}개까지 처리할 수 있습니다"}), 400

    try:
        for path in storage_paths:
            _validate_storage_path(uid, path)
    except PermissionError as e:
        return jsonify({"detail": str(e)}), 403
    except ValueError as e:
        return jsonify({"detail": str(e)}), 400

    # Download source PDFs from Storage
    try:
        bucket = _bucket()
        file_bytes_list = []
        for path in storage_paths:
            blob = bucket.blob(path)
            try:
                blob.reload()
            except Exception as e:
                return jsonify({"detail": f"업로드된 임시 파일을 찾을 수 없습니다. 다시 저장을 눌러주세요. ({path})"}), 404
            if blob.size is not None and blob.size > MAX_PDF_FILE_BYTES:
                return jsonify({"detail": "파일이 100 MB를 초과합니다"}), 413
            data = blob.download_as_bytes()
            if len(data) > MAX_PDF_FILE_BYTES:
                return jsonify({"detail": "파일이 100 MB를 초과합니다"}), 413
            file_bytes_list.append(data)
    except Exception as e:
        return jsonify({"detail": f"Storage 다운로드 실패: {e}"}), 500

    # Process
    try:
        _validate_pdf_request(req, file_bytes_list)
        _patch_divider_renderer()
        output_bytes = pdf_ops.process_pdf(file_bytes_list, req)
    except ValueError as e:
        return jsonify({"detail": str(e)}), 400
    except Exception as e:
        return jsonify({"detail": f"PDF 처리 실패: {e}"}), 500

    # Clean up temp files (best-effort)
    bucket_ref = _bucket()
    for path in storage_paths:
        try:
            bucket_ref.blob(path).delete()
        except Exception:
            pass

    return Response(
        output_bytes,
        status=200,
        mimetype="application/pdf",
        headers={"Content-Disposition": "attachment; filename=output.pdf"},
    )
