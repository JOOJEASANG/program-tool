import unittest
from unittest.mock import patch

from routers import pdf as pdf_router
from routers import preflight as preflight_router


class _Blob:
    def __init__(self, path, deleted, fail=False):
        self.path = path
        self.deleted = deleted
        self.fail = fail

    def delete(self):
        if self.fail:
            raise RuntimeError("delete failed")
        self.deleted.append(self.path)


class _Bucket:
    def __init__(self, fail_path=None):
        self.deleted = []
        self.fail_path = fail_path

    def blob(self, path):
        return _Blob(path, self.deleted, path == self.fail_path)


class TempCleanupTests(unittest.TestCase):
    def test_pdf_cleanup_attempts_all_paths(self):
        bucket = _Bucket(fail_path="pdf_temp/u/b.pdf")
        pdf_router._cleanup_storage_paths(
            bucket,
            ["pdf_temp/u/a.pdf", "pdf_temp/u/b.pdf", "pdf_temp/u/c.pdf"],
        )
        self.assertEqual(bucket.deleted, ["pdf_temp/u/a.pdf", "pdf_temp/u/c.pdf"])

    def test_preflight_cleanup_uses_configured_bucket(self):
        bucket = _Bucket()
        with patch.object(preflight_router, "_bucket", return_value=bucket):
            preflight_router._delete_storage_path("preflight_temp/u/a.pdf")
        self.assertEqual(bucket.deleted, ["preflight_temp/u/a.pdf"])


if __name__ == "__main__":
    unittest.main()
