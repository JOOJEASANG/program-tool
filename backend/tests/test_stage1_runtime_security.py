from pathlib import Path

import pytest
from flask import Flask, g

from models.schemas import PdfProcessRequest
from routers import pdf as pdf_router
from utils import auth as auth_utils


ROOT = Path(__file__).resolve().parents[2]
PDF_ROUTER = ROOT / "backend" / "routers" / "pdf.py"
PERMISSIONS = ROOT / "backend" / "utils" / "permissions.py"
MAIN = ROOT / "backend" / "main.py"


def test_route_auth_reuses_before_request_identity(monkeypatch):
    app = Flask(__name__)
    calls = {"verify": 0}

    def unexpected_verify(_token):
        calls["verify"] += 1
        raise AssertionError("Firebase token must not be verified twice")

    monkeypatch.setattr(auth_utils.auth, "verify_id_token", unexpected_verify)

    @auth_utils.require_auth
    def protected(uid):
        return uid

    with app.test_request_context("/api/pdf/process"):
        g.uid = "verified-user"
        assert protected() == "verified-user"

    assert calls["verify"] == 0


def test_invalid_pdf_bytes_are_reported_as_client_input_error():
    request_model = PdfProcessRequest.model_validate({
        "pages": [{"file_index": 0, "page_index": 0}],
    })

    with pytest.raises(ValueError, match="유효한 PDF 파일이 아닙니다"):
        pdf_router._validate_pdf_request(request_model, [b"not-a-pdf"])


def test_direct_and_storage_aggregate_limits_are_explicit():
    main = MAIN.read_text(encoding="utf-8")
    assert pdf_router.MAX_DIRECT_TOTAL_PDF_BYTES == 20 * 1024 * 1024
    assert "MIB = 1024 * 1024" in main
    assert "PDF_STORAGE_FILE_BYTES = 200 * MIB" in main
    assert "PDF_STORAGE_TOTAL_BYTES = 300 * MIB" in main
    assert "pdf_router.MAX_PDF_FILE_BYTES = PDF_STORAGE_FILE_BYTES" in main
    assert "pdf_router.MAX_TOTAL_PDF_BYTES = PDF_STORAGE_TOTAL_BYTES" in main
    assert pdf_router.MAX_DIRECT_TOTAL_PDF_BYTES < 300 * 1024 * 1024


def test_internal_exception_details_are_not_returned_to_clients():
    text = PDF_ROUTER.read_text(encoding="utf-8")
    assert '"request_id": request_id' in text
    assert '"PDF_INTERNAL_ERROR"' in text
    assert '"PDF 처리 중 오류가 발생했습니다."' in text
    assert "PDF processing failed: {e}" not in text
    assert "PDF 처리 실패: {e}" not in text


def test_verified_identity_is_saved_on_flask_g():
    text = PERMISSIONS.read_text(encoding="utf-8")
    assert "g.auth_user = decoded" in text
    assert "g.uid = uid" in text
    assert "g.program_id = program_id" in text


def test_firebase_default_app_initialization_is_idempotent():
    text = MAIN.read_text(encoding="utf-8")
    assert "if not firebase_admin._apps:" in text
