from pathlib import Path
from unittest.mock import Mock

import pytest
from flask import Flask, g

from routers import pdf


ORIGIN = "https://program-tool.web.app"


@pytest.fixture
def app(monkeypatch):
    application = Flask(__name__)
    application.register_blueprint(pdf.pdf_bp, url_prefix="/api/pdf")
    @application.before_request
    def approved():
        g.uid = "approved-user"
        if not __import__("flask").request.headers.get("X-Test-Deny"):
            g.program_id = "pdf-editor"
    bucket = Mock()
    bucket.blob.return_value.create_resumable_upload_session.return_value = "https://storage.googleapis.com/upload/session"
    monkeypatch.setattr(pdf, "_bucket", lambda: bucket)
    return application.test_client(), bucket


def test_approved_owner_scoped_bounded_immutable_session(app):
    client, bucket = app
    response = client.post("/api/pdf/stage-upload", json={"size_bytes": 500 * 1024 * 1024, "path": "other-user/private.pdf"}, headers={"Origin": ORIGIN})
    assert response.status_code == 200
    assert response.json["storage_path"].startswith("pdf_temp/approved-user/")
    assert response.json["storage_path"].endswith("/source.pdf")
    bucket.blob.assert_called_once_with(response.json["storage_path"])
    bucket.blob.return_value.create_resumable_upload_session.assert_called_once_with(
        content_type="application/pdf", size=500 * 1024 * 1024, origin=ORIGIN,
        if_generation_match=0, timeout=30,
    )
    assert response.headers["Cache-Control"] == "no-store"


@pytest.mark.parametrize("size", [0, -1, True, "25", 500 * 1024 * 1024 + 1])
def test_bad_size_never_issues_session(app, size):
    client, bucket = app
    response = client.post("/api/pdf/stage-upload", json={"size_bytes": size}, headers={"Origin": ORIGIN})
    assert response.status_code == 413
    bucket.blob.assert_not_called()


@pytest.mark.parametrize("headers", [{"Origin": "https://evil.example"}, {"Origin": ORIGIN, "X-Test-Deny": "1"}, {}])
def test_unapproved_or_untrusted_origin_never_issues_session(app, headers):
    client, bucket = app
    response = client.post("/api/pdf/stage-upload", json={"size_bytes": 100}, headers=headers)
    assert response.status_code == 403
    bucket.blob.assert_not_called()


def test_stage_error_is_traceable_and_does_not_disclose_credentials(app):
    client, bucket = app
    bucket.blob.return_value.create_resumable_upload_session.side_effect = RuntimeError("private session URI")
    response = client.post("/api/pdf/stage-upload", json={"size_bytes": 100}, headers={"Origin": ORIGIN})
    assert response.status_code == 503
    assert response.json["code"] == "PDF_STAGE_SESSION_FAILED"
    assert response.json["request_id"]
    assert "private session URI" not in response.get_data(as_text=True)


def test_client_only_falls_back_on_storage_permission_failure():
    source = (Path(__file__).resolve().parents[2] / "js/api.js").read_text(encoding="utf-8")
    assert "error?.code !== 'storage/unauthorized'" in source
    assert "_uploadPdfViaAuthorizedSession(files[i], user" in source
    assert "body: JSON.stringify({ size_bytes: file.size })" in source
    assert "body: file, signal, credentials: 'omit'" in source
    assert "storagePaths[storagePaths.length - 1] = actualPath" in source
