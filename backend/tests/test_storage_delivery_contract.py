from datetime import datetime

from utils.storage_delivery import (
    MAX_RESULT_BYTES,
    RESULT_TTL_HOURS,
    upload_pdf_result,
)


class FakeBlob:
    def __init__(self, path: str):
        self.path = path
        self.size = 0
        self.metadata = {}
        self.content_type = None

    def upload_from_string(self, data: bytes, content_type: str):
        self.size = len(data)
        self.content_type = content_type

    def upload_from_filename(self, path: str, content_type: str):
        self.size = 123
        self.content_type = content_type


class FakeBucket:
    name = "test-bucket"

    def __init__(self):
        self.created = []

    def blob(self, path: str):
        blob = FakeBlob(path)
        self.created.append(blob)
        return blob


def test_generated_pdf_is_delivered_from_private_temporary_storage() -> None:
    bucket = FakeBucket()
    payload = upload_pdf_result(
        bucket,
        "user-123",
        filename="../../unsafe name.pdf",
        data=b"%PDF-test",
    )

    assert payload["delivery"] == "storage"
    assert payload["storage_path"].startswith("pdf_results/user-123/")
    assert ".." not in payload["storage_path"]
    assert payload["download_url"].startswith(
        "https://firebasestorage.googleapis.com/"
    )
    assert payload["expiration_mode"] == "scheduled-delete"
    assert bucket.created[0].content_type == "application/pdf"
    assert bucket.created[0].metadata["temporary"] == "true"
    assert bucket.created[0].metadata["cleanupAfter"] == payload["expires_at"]
    assert datetime.fromisoformat(payload["expires_at"])


def test_result_retention_and_size_are_cost_bounded() -> None:
    assert RESULT_TTL_HOURS == 1
    assert MAX_RESULT_BYTES == 300 * 1024 * 1024
