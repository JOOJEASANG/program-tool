import json
from flask import Blueprint, request, jsonify, Response

from models.schemas import PdfProcessRequest
from services.pdf_ops import process_pdf
from utils.auth import require_auth

pdf_bp = Blueprint("pdf", __name__)


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
        output_bytes = process_pdf(file_bytes_list, req)
    except Exception as e:
        return jsonify({"detail": f"PDF processing failed: {e}"}), 500

    return Response(
        output_bytes,
        status=200,
        mimetype="application/pdf",
        headers={"Content-Disposition": "attachment; filename=output.pdf"},
    )
