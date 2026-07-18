import unittest

from pydantic import ValidationError

from models.schemas import PdfProcessRequest
from utils.permissions import DEFAULT_PUBLIC_PROGRAMS, program_for_path


class PdfSchemaTests(unittest.TestCase):
    def test_minimal_request_is_valid(self):
        request = PdfProcessRequest.model_validate({
            "pages": [{"file_index": 0, "page_index": 0}],
        })
        self.assertEqual(len(request.pages), 1)
        self.assertEqual(request.paper.width_mm, 210.0)

    def test_invalid_rotation_is_rejected(self):
        with self.assertRaises(ValidationError):
            PdfProcessRequest.model_validate({
                "pages": [{"file_index": 0, "page_index": 0, "rotation": 45}],
            })

    def test_oversized_paper_is_rejected(self):
        with self.assertRaises(ValidationError):
            PdfProcessRequest.model_validate({
                "pages": [{"file_index": 0, "page_index": 0}],
                "paper": {"width_mm": 5000, "height_mm": 297},
            })

    def test_excessive_watermark_text_is_rejected(self):
        with self.assertRaises(ValidationError):
            PdfProcessRequest.model_validate({
                "pages": [{"file_index": 0, "page_index": 0}],
                "watermark": {"enabled": True, "text": "가" * 201},
            })


class PermissionMappingTests(unittest.TestCase):
    def test_api_paths_map_to_expected_programs(self):
        self.assertEqual(program_for_path("/api/pdf/process"), "pdf-editor")
        self.assertEqual(program_for_path("/api/pdf-tools/encrypt"), "preflight")
        self.assertEqual(program_for_path("/api/preflight/check"), "preflight")
        self.assertIsNone(program_for_path("/api/admin/me"))

    def test_default_public_policy_preserves_current_site_behavior(self):
        self.assertFalse(DEFAULT_PUBLIC_PROGRAMS["pdf-editor"])
        self.assertTrue(DEFAULT_PUBLIC_PROGRAMS["preflight"])
        self.assertTrue(DEFAULT_PUBLIC_PROGRAMS["perfect-binding-cover"])


if __name__ == "__main__":
    unittest.main()
