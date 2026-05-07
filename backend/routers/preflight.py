import fitz
from flask import Blueprint, request, jsonify

from models.schemas import PreflightReport
from services.preflight_svc import run_all_checks, compute_score
from services.ai_vision import analyze_with_vision
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
        checks = run_all_checks(doc)
        score = compute_score(checks)

        use_ai = request.form.get("use_ai", "false").lower() == "true"
        ai_feedback = None
        if use_ai:
            try:
                ai_feedback = analyze_with_vision(doc)
            except Exception as e:
                ai_feedback = f"AI 분석 중 오류: {str(e)}"

        report = PreflightReport(
            filename=file.filename or "document.pdf",
            page_count=len(doc),
            checks=checks,
            ai_feedback=ai_feedback,
            score=score,
        )
        return jsonify(report.model_dump())
    finally:
        doc.close()
