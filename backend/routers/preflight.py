import io
import fitz
from flask import Blueprint, request, jsonify, Response

from models.schemas import PreflightReport
from services.preflight_svc import run_all_checks, compute_score
from utils.auth import require_auth

preflight_bp = Blueprint("preflight", __name__)


def _read_pdf_from_request():
    file = request.files.get("file")
    if not file:
        return None, None, (jsonify({"detail": "파일이 없습니다"}), 400)
    if not (file.filename or "").lower().endswith(".pdf"):
        return None, None, (jsonify({"detail": "PDF 파일만 업로드 가능합니다"}), 400)
    data = file.read()
    if len(data) > 100 * 1024 * 1024:
        return None, None, (jsonify({"detail": "파일이 100 MB 제한을 초과합니다"}), 413)
    return file, data, None


@preflight_bp.route("/check", methods=["POST"])
@require_auth
def check(uid):
    file, data, err = _read_pdf_from_request()
    if err:
        return err

    try:
        doc = fitz.open(stream=data, filetype="pdf")
    except Exception:
        return jsonify({"detail": "PDF 파일을 열 수 없습니다"}), 400

    try:
        try:
            checks = run_all_checks(doc)
            score = compute_score(checks)
        except Exception as e:
            import traceback; traceback.print_exc()
            return jsonify({"detail": f"검수 처리 실패: {type(e).__name__}: {e}"}), 500

        ai_feedback = None

        try:
            report = PreflightReport(
                filename=file.filename or "document.pdf",
                page_count=len(doc),
                checks=checks,
                ai_feedback=ai_feedback,
                score=score,
            )
            return jsonify(report.model_dump())
        except Exception as e:
            import traceback; traceback.print_exc()
            return jsonify({"detail": f"리포트 생성 실패: {type(e).__name__}: {e}"}), 500
    finally:
        doc.close()


@preflight_bp.route("/fix", methods=["POST"])
@require_auth
def fix(uid):
    """Create a safer normalized PDF after preflight.

    This is a rule-based free fixer. It can normalize page sizes and rebuild the file.
    It cannot magically restore low-resolution images or embed fonts that are not present.
    """
    file, data, err = _read_pdf_from_request()
    if err:
        return err

    try:
        src = fitz.open(stream=data, filetype="pdf")
    except Exception:
        return jsonify({"detail": "PDF 파일을 열 수 없습니다"}), 400

    out = fitz.open()
    try:
        if len(src) == 0:
            return jsonify({"detail": "페이지가 없습니다"}), 400

        # Normalize all pages to the first page size. Pages with different size are centered.
        target = src[0].rect
        target_w, target_h = target.width, target.height
        for i in range(len(src)):
            page = src[i]
            new_page = out.new_page(width=target_w, height=target_h)
            src_rect = page.rect
            scale = min(target_w / src_rect.width, target_h / src_rect.height)
            fit_w = src_rect.width * scale
            fit_h = src_rect.height * scale
            x0 = (target_w - fit_w) / 2
            y0 = (target_h - fit_h) / 2
            new_page.show_pdf_page(
                fitz.Rect(x0, y0, x0 + fit_w, y0 + fit_h),
                src,
                i,
                keep_proportion=True,
            )

        buf = io.BytesIO()
        out.save(buf, garbage=4, deflate=True, clean=True)
        fixed_name = (file.filename or "document.pdf").rsplit('.', 1)[0] + "_fixed.pdf"
        return Response(
            buf.getvalue(),
            status=200,
            mimetype="application/pdf",
            headers={
                "Content-Disposition": f"attachment; filename={fixed_name}",
                "X-Fix-Note": "page-size-normalized;rebuilt-clean"
            },
        )
    except Exception as e:
        return jsonify({"detail": f"PDF 보정 실패: {type(e).__name__}: {e}"}), 500
    finally:
        src.close()
        out.close()
