from datetime import datetime

from utils.storage_delivery import (
    MAX_RESULT_BYTES,
    RESULT_TTL_HOURS,
    SIGNED_URL_TTL_MINUTES,
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


class FakeSignedBlob(FakeBlob):
    def __init__(self, path: str):
        super().__init__(path)
        self.signed_url_args = None

    def generate_signed_url(self, **kwargs):
        self.signed_url_args = kwargs
        return "https://storage.googleapis.com/test-bucket/signed-result.pdf?X-Goog-Signature=test"


class FakeBucket:
    name = "test-bucket"

    def __init__(self, blob_type=FakeBlob):
        self.created = []
        self.blob_type = blob_type

    def blob(self, path: str):
        blob = self.blob_type(path)
        self.created.append(blob)
        return blob


def test_generated_pdf_falls_back_to_private_temporary_storage_token() -> None:
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
    assert payload["cleanup_at"] == payload["expires_at"]
    assert bucket.created[0].content_type == "application/pdf"
    assert bucket.created[0].metadata["temporary"] == "true"
    assert bucket.created[0].metadata["cleanupAfter"] == payload["cleanup_at"]
    assert datetime.fromisoformat(payload["expires_at"])


def test_generated_pdf_prefers_short_lived_v4_signed_url() -> None:
    bucket = FakeBucket(FakeSignedBlob)
    payload = upload_pdf_result(
        bucket,
        "user-123",
        filename="result.pdf",
        data=b"%PDF-test",
    )

    assert payload["download_url"].startswith("https://storage.googleapis.com/")
    assert payload["expiration_mode"] == "signed-url-v4"
    assert datetime.fromisoformat(payload["expires_at"]) < datetime.fromisoformat(payload["cleanup_at"])

    signed_args = bucket.created[0].signed_url_args
    assert signed_args["version"] == "v4"
    assert signed_args["method"] == "GET"
    assert signed_args["expiration"].total_seconds() == SIGNED_URL_TTL_MINUTES * 60
    assert signed_args["response_disposition"] == 'attachment; filename="result.pdf"'
    assert bucket.created[0].metadata["cleanupAfter"] == payload["cleanup_at"]


def test_result_retention_and_size_are_cost_bounded() -> None:
    assert RESULT_TTL_HOURS == 1
    assert SIGNED_URL_TTL_MINUTES == 15
    assert MAX_RESULT_BYTES == 800 * 1024 * 1024
