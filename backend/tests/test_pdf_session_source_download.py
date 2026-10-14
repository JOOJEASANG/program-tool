"""Authenticated, owner-scoped and size-bounded CORS-free session downloads."""
from __future__ import annotations

from types import SimpleNamespace
from unittest.mock import Mock

import pytest
from flask import Flask, g

from routers import pdf


class Document:
    def __init__(self, payload, exists=True):
        self.payload = payload
        self.exists = exists

    def to_dict(self):
        return self.payload


class Firestore:
    def __init__(self, document):
        self.document_value = document

    def collection(self, key):
        assert key in ("users", "pdf_sessions")
        return self

    def document(self, key):
        assert key in ("test-user", "goodDoc123")
        return self

    def get(self):
        return self.document_value


class Bucket:
    def __init__(self, body):
        self.body = body
        self.asked_paths = []

    def blob(self, path):
        self.asked_paths.append(path)
        parent = self

        class Blob:
            size = len(parent.body)

            def reload(self, timeout):
                assert timeout > 0

            def download_as_bytes(self, *, start, end, timeout):
                assert timeout > 0
                assert end - start + 1 <= 4 * 1024 * 1024
                return parent.body[start:end + 1]
        return Blob()


@pytest.fixture()
def env(monkeypatch):
    app = Flask(__name__)
    app.register_blueprint(pdf.pdf_bp, url_prefix="/api/pdf")

    @app.before_request
    def fake_verified_firebase_user():
        # The real backend main.py hook already verifies ID tokens, account
        # approval and UID. Flask.g mimics that trusted result in this test.
        g.uid = "test-user"
        g.auth_user = {"uid": "test-user"}

    state = {
        "sessionId": "session_1234",
        "storagePaths": ["pdf_sessions/test-user/session_1234/src_0.pdf"],
    }
    body = b"%PDF-1.7" + b"0" * (4 * 1024 * 1024 + 5)
    bucket = Bucket(body)
    document = Document(state)
    monkeypatch.setattr(pdf, "fa_firestore", SimpleNamespace(client=lambda: Firestore(document)))
    monkeypatch.setattr(pdf, "_bucket", lambda: bucket)
    return app.test_client(), state, document, bucket, body


def test_source_download_is_in_authenticated_4mb_parts(env):
    client, _, _, bucket, body = env
    url = "/api/pdf/session-source?session=goodDoc123&index=0&offset="
    first = client.get(url + "0")
    assert first.status_code == 200
    assert first.headers["X-Session-File-Size"] == str(len(body))
    assert first.headers["X-Session-Offset"] == "0"
    assert len(first.data) == 4 * 1024 * 1024
    second = client.get(url + str(len(first.data)))
    assert second.status_code == 200
    assert second.headers["X-Session-Offset"] == str(4 * 1024 * 1024)
    assert first.data + second.data == body
    assert set(bucket.asked_paths) == {"pdf_sessions/test-user/session_1234/src_0.pdf"}


@pytest.mark.parametrize("args,code", [
    ("?session=../../x&index=0&offset=0", 400),
    ("?session=goodDoc123&index=oops&offset=0", 400),
    ("?session=goodDoc123&index=50&offset=0", 400),
    ("?session=goodDoc123&index=0&offset=-1", 400),
    ("?session=goodDoc123&index=0&offset=99999999999", 400),
    ("?session=goodDoc123&index=2&offset=0", 404),
])
def test_invalid_requests_do_not_reach_bucket(env, args, code):
    client, _, _, bucket, _ = env
    result = client.get("/api/pdf/session-source" + args)
    assert result.status_code == code
    assert not bucket.asked_paths


def test_cross_user_or_tampered_session_path_is_blocked(env):
    client, state, _, bucket, _ = env
    state["storagePaths"] = ["pdf_sessions/someone-else/session_1234/src_0.pdf"]
    result = client.get("/api/pdf/session-source?session=goodDoc123&index=0&offset=0")
    assert result.status_code == 403
    assert not bucket.asked_paths


def test_missing_session_returns_not_found(env):
    client, _, doc, bucket, _ = env
    doc.exists = False
    result = client.get("/api/pdf/session-source?session=goodDoc123&index=0&offset=0")
    assert result.status_code == 404
    assert not bucket.asked_paths


def test_file_limit_is_enforced_before_transfer(env, monkeypatch):
    client, _, _, bucket, _ = env
    class Oversized:
        size = 201 * 1024 * 1024
        def reload(self, timeout):
            pass
    monkeypatch.setattr(bucket, "blob", lambda path: Oversized())
    result = client.get("/api/pdf/session-source?session=goodDoc123&index=0&offset=0")
    assert result.status_code == 413


def test_loader_contract_uses_same_origin_fallback_and_preserves_prior_work():
    from pathlib import Path
    source = (Path(__file__).resolve().parents[2] / "pdf-editor/index.html").read_text(encoding="utf-8")
    for snippet in (
        "async function fetchOwnedSessionPdfInChunks(docId, sourceIndex)",
        "Authorization: 'Bearer ' + token",
        "'/api/pdf/session-source?'",
        "return new Blob(blocks, { type: 'application/pdf' })",
        "blob = await downloadSavedEditorSessionPdf(d.storagePaths[i], docId, i)",
        "parsedPages = prevParsedPages",
    ):
        assert snippet in source
