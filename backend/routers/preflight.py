import fitz
from flask import Blueprint, request, jsonify

from models.schemas import PreflightReport
from services.preflight_svc import run_all_checks, compute_score
from utils.auth import require_auth

preflight_bp = Blueprint("preflight", __name__)


@preflight_bp.route("/check", methods=["POST"])
@require_auth
def check(uid):
    file = request.files.get("file")
    if not file:
        return jsonify({"detail": "파일이 없습니다"}), 400
    if not (file.filename or "").lower().endswith(".pdf"):
        return jsonify({"detail": "PDF 파일만 업로드 가능합니다"}), 400

    data = file.read()
    if len(data) > 200 * 1024 * 1024:
        return jsonify({"detail": "파일이 200 MB 제한을 초과합니다"}), 413

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

        # AI vision analysis has been intentionally removed so PDF preflight can run free.
        # The frontend may still send use_ai=true from older cached pages, but it is ignored.
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
