import io
import json
import unittest

import fitz

from models.schemas import HeaderFooterSettings, WatermarkSettings
from services import pdf_divider_alignment_patch
from services import pdf_text_font_patch
from services import pdf_ops


PAGE_WIDTH = 595.28
PAGE_HEIGHT = 841.89


def _pdf_bytes(document: fitz.Document) -> bytes:
    buffer = io.BytesIO()
    document.save(buffer)
    document.close()
    return buffer.getvalue()


def _render_divider(content: dict) -> fitz.Document:
    document = fitz.open()
    pdf_divider_alignment_patch._render_divider_page(
        document,
        json.dumps(content, ensure_ascii=False),
        content.get("style", "simple"),
        PAGE_WIDTH,
        PAGE_HEIGHT,
    )
    return fitz.open(stream=_pdf_bytes(document), filetype="pdf")


class DividerOutputTests(unittest.TestCase):
    def test_rich_divider_keeps_korean_and_extra_text(self):
        reopened = _render_divider({
            "title": "운영 계획서",
            "subtitle": "2026학년도",
            "note": "인쇄용 간지",
            "titleX": 10,
            "titleY": 35,
            "subtitleX": 50,
            "subtitleY": 48,
            "noteX": 90,
            "noteY": 88,
            "noBg": False,
            "bg": "#fef3c7",
            "fg": "#7c2d12",
            "style": "band",
            "extraTexts": [
                {
                    "text": "추가 문구",
                    "x": 80,
                    "y": 75,
                    "size": 18,
                    "color": "#12396d",
                    "opacity": 0.8,
                    "rotation": 12,
                    "align": "right",
                    "weight": 700,
                    "italic": True,
                }
            ],
        })
        try:
            text = reopened[0].get_text()
            drawings = reopened[0].get_drawings()
        finally:
            reopened.close()

        self.assertIn("운영 계획서", text)
        self.assertIn("2026학년도", text)
        self.assertIn("인쇄용 간지", text)
        self.assertIn("추가 문구", text)
        self.assertGreaterEqual(len(drawings), 2)

    def test_hidden_extra_text_is_omitted_and_long_text_is_fitted(self):
        long_text = "매우 긴 추가 안내 문구 " * 12
        fitted_size, fitted_width = pdf_divider_alignment_patch._fit_extra_text(
            long_text, 42, PAGE_WIDTH
        )
        self.assertLess(fitted_size, 42)
        self.assertLessEqual(
            fitted_width,
            PAGE_WIDTH * pdf_divider_alignment_patch.EXTRA_TEXT_MAX_WIDTH_RATIO + 1,
        )

        reopened = _render_divider({
            "title": "간지 출력 확인",
            "noBg": True,
            "extraTexts": [
                {"text": long_text, "x": 50, "y": 70, "size": 42},
                {"text": "숨김 문구", "hidden": True},
            ],
        })
        try:
            text = reopened[0].get_text()
        finally:
            reopened.close()

        self.assertIn("간지 출력 확인", text)
        self.assertIn("매우 긴 추가 안내 문구", text)
        self.assertNotIn("숨김 문구", text)

    def test_header_footer_and_watermark_use_korean_font(self):
        document = fitz.open()
        page = document.new_page(width=PAGE_WIDTH, height=PAGE_HEIGHT)
        header_footer = HeaderFooterSettings(
            enabled=True,
            header_center="한글 머리말 {n}/{total}",
            footer_center="출력 확인",
            font_size=10,
        )
        watermark = WatermarkSettings(
            enabled=True,
            text="내부용",
            opacity=0.15,
            angle=-35,
            color="#777777",
        )

        pdf_text_font_patch._apply_header_footer(
            page,
            header_footer,
            page.rect.width,
            page.rect.height,
            output_page_num=2,
            total_pages=5,
        )
        pdf_text_font_patch._apply_watermark(page, watermark)
        reopened = fitz.open(stream=_pdf_bytes(document), filetype="pdf")
        try:
            text = reopened[0].get_text()
        finally:
            reopened.close()

        self.assertIn("한글 머리말 2/5", text)
        self.assertIn("출력 확인", text)
        self.assertIn("내부용", text)

    def test_router_fallback_cannot_replace_rich_renderer(self):
        self.assertTrue(getattr(pdf_ops, "_divider_renderer_patched_v2", False))
        self.assertTrue(getattr(pdf_ops, "_program_studio_divider_renderer", False))
        self.assertIs(pdf_ops._render_divider_page, pdf_divider_alignment_patch._render_divider_page)


if __name__ == "__main__":
    unittest.main()
