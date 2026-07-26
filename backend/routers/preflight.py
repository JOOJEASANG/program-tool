import io
import os
import traceback

import firebase_admin.storage as fa_storage
import fitz
from flask import Blueprint, Response, jsonify, request

from models.schemas import PreflightReport
from services.preflight_reliability import run_reliable_checks
from services.preflight_repair import fix_pdf_response
from services.preflight_svc import compute_score
from utils.auth import require_auth

preflight_bp = Blueprint("preflight", __name__)
MAX_PDF_BYTES = 200 * 1024 * 1024
MAX_COMPRESS_PAGES = 2000
DEFAULT_STORAGE_BUCKET = os.environ.get("FIREBASE_STORAGE_BUCKET", "program-tool.firebasestorage.app")


def _bucket():
    return fa_storage.bucket(DEFAULT_STORAGE_BUCKET)


def _delete_storage_path(path: str | None) -> None:
    """Best-effort deletion for validated preflight temporary uploads."""
    if not path:
        return
    try:
        _bucket().blob(path).delete()
    except Exception:
        pass


def _read_pdf_from_request():
    file = request.files.get("file")
    if not file:
        return None, None, (jsonify({"detail": "파일이 없습니다"}), 400)
    if not (file.filename or "").lower().endswith(".pdf"):
        return None, None, (jsonify({"detail": "PDF 파일만 업로드 가능합니다"}), 400)
    data = file.read()
    if len(data) > MAX_PDF_BYTES:
        return None, None, (jsonify({"detail": "파일이 200 MB 제한을 초과합니다"}), 413)
    return file, data, None


def _validate_storage_path(uid: str, path: str | None):
    if not path or not isinstance(path, str):
        return jsonify({"detail": "Storage 파일 경로가 없습니다"}), 400
    if ".." in path or path.startswith("/"):
        return jsonify({"detail": "잘못된 Storage 파일 경로입니다"}), 400
    if not path.startswith(f"preflight_temp/{uid}/"):
        return jsonify({"detail": "이 파일에 접근할 권한이 없습니다"}), 403
    if not path.lower().endswith(".pdf"):
        return jsonify({"detail": "PDF 파일만 처리할 수 있습니다"}), 400
    return None


def _read_pdf_from_storage(uid: str):
    payload = request.get_json(silent=True) or {}
    path = payload.get("storage_path")
    filename = (payload.get("filename") or "document.pdf").strip() or "document.pdf"
    err = _validate_storage_path(uid, path)
    if err:
        return None, None, None, err
    try:
        blob = _bucket().blob(path)
        blob.reload()
        size = int(blob.size or 0)
        if size > MAX_PDF_BYTES:
            return None, None, path, (jsonify({"detail": "파일이 200 MB 제한을 초과합니다"}), 413)
        data = blob.download_as_bytes()
        if len(data) > MAX_PDF_BYTES:
            return None, None, path, (jsonify({"detail": "파일이 200 MB 제한을 초과합니다"}), 413)
        return filename, data, path, None
    except Exception as e:
        return None, None, path, (jsonify({"detail": f"Storage에서 PDF 파일을 읽지 못했습니다: {type(e).__name__}: {e}"}), 404)


def _open_pdf(data: bytes) -> fitz.Document:
    return fitz.open(stream=data, filetype="pdf")


def _safe_pdf_name(filename: str | None, suffix: str) -> str:
    base = (filename or "document.pdf").rsplit(".", 1)[0]
    base = base.strip() or "document"
    return f"{base}_{suffix}.pdf"


def _json_params() -> dict:
    payload = request.get_json(silent=True) or {}
    params = payload.get("params") or {}
    return params if isinstance(params, dict) else {}


def _compress_options() -> tuple[int, int, str]:
    params = _json_params()
    quality = (request.form.get("quality") or params.get("quality") or "balanced").strip().lower()
    presets = {
        "small": (120, 62, "small"),
        "balanced": (150, 72, "balanced"),
        "clear": (180, 82, "clear"),
    }
    return presets.get(quality, presets["balanced"])


def _run_check_response(filename: str, data: bytes):
    try:
        doc = _open_pdf(data)
    except Exception:
        return jsonify({"detail": "PDF 파일을 열 수 없습니다. PDF 복구/정상화 도구를 먼저 실행해 보세요."}), 400

    try:
        try:
            checks = run_reliable_checks(doc, len(data))
            score = compute_score(checks)
        except Exception as e:
            traceback.print_exc()
            return jsonify({"detail": f"검수 처리 실패: {type(e).__name__}: {e}. PDF 복구/정상화 후 다시 검수해 보세요."}), 500

        try:
            report = PreflightReport(
                filename=filename or "document.pdf",
                page_count=len(doc),
                checks=checks,
                ai_feedback=None,
                score=score,
            )
            return jsonify(report.model_dump())
        except Exception as e:
            traceback.print_exc()
            return jsonify({"detail": f"리포트 생성 실패: {type(e).__name__}: {e}"}), 500
    finally:
        doc.close()


@preflight_bp.route("/check", methods=["POST"])
@require_auth
def check(uid):
    file, data, err = _read_pdf_from_request()
    if err:
        return err
    return _run_check_response(file.filename or "document.pdf", data)


@preflight_bp.route("/check-storage", methods=["POST"])
@require_auth
def check_storage(uid):
    filename, data, path, err = _read_pdf_from_storage(uid)
    try:
        if err:
            return err
        return _run_check_response(filename or "document.pdf", data)
    finally:
        _delete_storage_path(path)


def _compress_pdf_response(filename: str, data: bytes):
    """Rasterize each page to JPEG at a controlled DPI to make image/effect-heavy PDFs lighter."""
    try:
        src = _open_pdf(data)
    except Exception as e:
        return jsonify({
            "detail": "PDF 파일을 열 수 없어 경량화를 진행할 수 없습니다. 먼저 PDF 복구/정상화를 실행해 보세요.",
            "error": f"{type(e).__name__}: {e}",
        }), 400

    out = fitz.open()
    dpi, jpg_q, quality = _compress_options()
    skipped_pages: list[int] = []
    try:
        if len(src) == 0:
            return jsonify({"detail": "페이지가 없습니다"}), 400
        if len(src) > MAX_COMPRESS_PAGES:
            return jsonify({"detail": f"경량화는 최대 {MAX_COMPRESS_PAGES}페이지까지 처리할 수 있습니다"}), 413
        if src.is_encrypted:
            src.close()
            return jsonify({"detail": "암호화된 PDF는 먼저 암호 해제를 실행한 뒤 경량화를 진행하세요."}), 400

        zoom = dpi / 72.0
        matrix = fitz.Matrix(zoom, zoom)
        for i in range(len(src)):
            try:
                page = src[i]
                rect = page.rect
                if rect.width <= 0 or rect.height <= 0:
                    raise ValueError("페이지 크기가 비정상입니다")
                pix = page.get_pixmap(matrix=matrix, alpha=False, annots=True)
                jpg_bytes = pix.tobytes("jpeg", jpg_quality=jpg_q)
                new_page = out.new_page(width=rect.width, height=rect.height)
                new_page.insert_image(new_page.rect, stream=jpg_bytes)
                pix = None
            except Exception:
                skipped_pages.append(i + 1)
                continue

        if len(out) == 0:
            return jsonify({"detail": "경량화 가능한 페이지가 없습니다."}), 400

        buf = io.BytesIO()
        out.save(buf, garbage=4, deflate=True, deflate_images=True, clean=True)
        out_bytes = buf.getvalue()
        out_name = _safe_pdf_name(filename, f"light_{quality}")
        note = f"rasterized-jpeg;quality={quality};dpi={dpi};jpg={jpg_q};input={len(data)};output={len(out_bytes)};skipped={','.join(map(str, skipped_pages))}"
        return Response(
            out_bytes,
            status=200,
            mimetype="application/pdf",
            headers={
                "Content-Disposition": f"attachment; filename={out_name}",
                "X-Compress-Note": note,
                "Access-Control-Expose-Headers": "X-Compress-Note, Content-Disposition",
            },
        )
    except Exception as e:
        traceback.print_exc()
        return jsonify({"detail": f"PDF 경량화 실패: {type(e).__name__}: {e}"}), 500
    finally:
        try:
            src.close()
        except Exception:
            pass
        out.close()


@preflight_bp.route("/fix", methods=["POST"])
@require_auth
def fix(uid):
    """Create a safer normalized PDF after preflight."""
    file, data, err = _read_pdf_from_request()
    if err:
        return err
    return fix_pdf_response(file.filename or "document.pdf", data)


@preflight_bp.route("/fix-storage", methods=["POST"])
@require_auth
def fix_storage(uid):
    filename, data, path, err = _read_pdf_from_storage(uid)
    try:
        if err:
            return err
        return fix_pdf_response(filename or "document.pdf", data)
    finally:
        _delete_storage_path(path)


@preflight_bp.route("/compress", methods=["POST"])
@require_auth
def compress(uid):
    file, data, err = _read_pdf_from_request()
    if err:
        return err
    return _compress_pdf_response(file.filename or "document.pdf", data)


@preflight_bp.route("/compress-storage", methods=["POST"])
@require_auth
def compress_storage(uid):
    filename, data, path, err = _read_pdf_from_storage(uid)
    try:
        if err:
            return err
        return _compress_pdf_response(filename or "document.pdf", data)
    finally:
        _delete_storage_path(path)
