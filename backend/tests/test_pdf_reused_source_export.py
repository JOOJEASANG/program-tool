"""Repeated PDF layout exports reuse owner-scoped immutable inputs without deleting them."""
from __future__ import annotations

from pathlib import Path
from types import SimpleNamespace

import fitz
from flask import Flask, g

from routers import pdf


UID = "test-user"
DOC_ID = "sessionGood1"
SAVED = f"pdf_sessions/{UID}/previous123/src_0.pdf"
TEMP = f"pdf_temp/{UID}/cache1234/0.pdf"


class StoredBlob:
    def __init__(self, bucket, path, data):
        self.bucket = bucket
        self.path = path
        self.data = data
        self.size = len(data)

    def reload(self, **kwargs):
        if self.path not in self.bucket.objects:
            raise FileNotFoundError(self.path)

    def download_to_filename(self, output):
        Path(output).write_bytes(self.data)

    def delete(self):
        self.bucket.deleted.append(self.path)
        self.bucket.objects.pop(self.path, None)


class Bucket:
    def __init__(self, data):
        self.objects = {SAVED: data, TEMP: data}
        self.deleted = []

    def blob(self, path):
        return StoredBlob(self, path, self.objects[path])


class Firestore:
    def __init__(self, paths):
        self.paths = paths

    def collection(self, name):
        return self

    def document(self, name):
        return self

    def get(self):
        return SimpleNamespace(exists=True, to_dict=lambda: {"storagePaths": self.paths})


def fixture_env(monkeypatch):
    document = fitz.open()
    document.new_page()
    source = document.tobytes()
    document.close()
    bucket = Bucket(source)
    firestore = Firestore([SAVED])
    monkeypatch.setattr(pdf, "_bucket", lambda: bucket)
    monkeypatch.setattr(pdf.fa_firestore, "client", lambda: firestore)
    monkeypatch.setattr(pdf, "upload_pdf_result", lambda *args, **kwargs: {"delivery": "storage", "download_url": "https://example.test/file.pdf"})
    monkeypatch.setattr(pdf, "process_pdf_paths", lambda paths, req, output: Path(output).write_bytes(source))
    app = Flask(__name__)
    app.register_blueprint(pdf.pdf_bp, url_prefix="/api/pdf")

    @app.before_request
    def auth():
        g.uid = UID
        g.auth_user = {"uid": UID}

    return app.test_client(), bucket, firestore


def request_body(paths, **extra):
    return {
        "storage_paths": paths,
        "settings": {"pages": [{"file_index": index, "page_index": 0} for index in range(len(paths))]},
        **extra,
    }


def test_existing_saved_pdf_export_without_reupload_or_deletion(monkeypatch):
    client, bucket, _ = fixture_env(monkeypatch)
    payload = request_body([SAVED], source_session_doc=DOC_ID)
    first = client.post("/api/pdf/process-storage", json=payload)
    assert first.status_code == 200
    second = client.post("/api/pdf/process-storage", json=payload)
    assert second.status_code == 200
    assert bucket.deleted == []
    assert SAVED in bucket.objects


def test_cached_temp_and_saved_sources_stay_after_success(monkeypatch):
    client, bucket, _ = fixture_env(monkeypatch)
    payload = request_body([SAVED, TEMP], source_session_doc=DOC_ID, retain_temp_sources=True)
    resp = client.post("/api/pdf/process-storage", json=payload)
    assert resp.status_code == 200
    assert set(bucket.objects) == {SAVED, TEMP}
    assert not bucket.deleted


def test_legacy_one_shot_temp_upload_still_gets_deleted(monkeypatch):
    client, bucket, _ = fixture_env(monkeypatch)
    resp = client.post("/api/pdf/process-storage", json=request_body([TEMP]))
    assert resp.status_code == 200
    assert bucket.deleted == [TEMP]
    assert SAVED in bucket.objects


def test_saved_path_must_be_in_authenticated_owner_session(monkeypatch):
    client, bucket, firestore = fixture_env(monkeypatch)
    no_doc = client.post("/api/pdf/process-storage", json=request_body([SAVED]))
    assert no_doc.status_code == 403
    firestore.paths = [f"pdf_sessions/{UID}/otherrevision/src_0.pdf"]
    no_membership = client.post(
        "/api/pdf/process-storage", json=request_body([SAVED], source_session_doc=DOC_ID)
    )
    assert no_membership.status_code == 403
    other_user = client.post(
        "/api/pdf/process-storage",
        json=request_body(["pdf_sessions/other-user/previous123/src_0.pdf"], source_session_doc=DOC_ID),
    )
    assert other_user.status_code == 403
    assert not bucket.deleted


def test_revision_paths_are_owner_scoped():
    assert pdf._is_saved_source_path(UID, SAVED)
    assert pdf._is_saved_source_path(UID, f"pdf_sessions/{UID}/newer1234/src_49.pdf")
    assert not pdf._is_saved_source_path(UID, "pdf_sessions/another-user/previous123/src_0.pdf")
    assert not pdf._is_saved_source_path(UID, f"pdf_sessions/{UID}/../src_0.pdf")
    assert not pdf._is_saved_source_path(UID, f"pdf_sessions/{UID}/previous123/fake.txt")


def test_pdf_session_orphan_cleanup_keeps_owner_referenced_older_revisions():
    """Daily cleanup must not delete old source objects still referenced by a newer edit."""
    import main

    recorded = {
        "sessionId": "latest123",
        "storagePaths": [
            f"pdf_sessions/{UID}/previous123/src_0.pdf",
            f"pdf_sessions/{UID}/latest123/src_1.pdf",
            "pdf_sessions/other-user/previous123/src_9.pdf",
            f"pdf_sessions/{UID}/../src_0.pdf",
        ],
    }
    selected = main._normalize_document_paths(
        recorded, "storagePaths", uid=UID, collection_id="pdf_sessions"
    )
    assert selected == [
        f"pdf_sessions/{UID}/previous123/src_0.pdf",
        f"pdf_sessions/{UID}/latest123/src_1.pdf",
    ]
    # Other products keep their existing strict revision binding.
    advanced = main._normalize_document_paths(
        recorded, "storagePaths", uid=UID, collection_id="pdf_advanced_sessions"
    )
    assert advanced == [f"pdf_sessions/{UID}/latest123/src_1.pdf"]
