import json
import unittest

import fitz

import services.pdf_ops as pdf_ops
from routers import pdf as pdf_router


class DividerRendererTest(unittest.TestCase):
    def setUp(self):
        pdf_router._patch_divider_renderer()

    def render(self, content):
        document = fitz.open()
        pdf_ops._render_divider_page(
            document,
            json.dumps(content, ensure_ascii=False),
            content.get("style", "simple"),
            595,
            842,
        )
        data = document.tobytes()
        document.close()
        return fitz.open(stream=data, filetype="pdf")

    def test_korean_and_extra_text_are_exported(self):
        document = self.render({
            "title": "운영 계획서",
            "subtitle": "한글 부제목",
            "note": "하단 메모",
            "titleX": 10,
            "titleY": 40,
            "subtitleX": 90,
            "subtitleY": 55,
            "noteX": 50,
            "noteY": 88,
            "fg": "#12396d",
            "style": "lines",
            "extraTexts": [
                {
                    "text": "추가 안내 문구",
                    "x": 50,
                    "y": 70,
                    "size": 24,
                    "color": "#b91c1c",
                    "weight": 700,
                    "italic": True,
                    "align": "center",
                    "opacity": 0.7,
                    "rotation": 12,
                },
                {"text": "숨김 문구", "hidden": True},
            ],
        })
        try:
            self.assertEqual(document.page_count, 1)
            text = document[0].get_text()
            self.assertIn("운영 계획서", text)
            self.assertIn("한글 부제목", text)
            self.assertIn("하단 메모", text)
            self.assertIn("추가 안내 문구", text)
            self.assertNotIn("숨김 문구", text)
        finally:
            document.close()

    def test_background_and_band_are_drawn(self):
        document = self.render({
            "title": "컬러 간지",
            "noBg": False,
            "bg": "#fef3c7",
            "fg": "#7c2d12",
            "style": "band",
        })
        try:
            drawings = document[0].get_drawings()
            self.assertGreaterEqual(len(drawings), 2)
        finally:
            document.close()


if __name__ == "__main__":
    unittest.main()
