import io
import json

import fitz

from models.schemas import HeaderFooterSettings
from services import pdf_divider_alignment_patch
from services import pdf_text_font_patch
from services import preflight_reliability_patch
from services import preflight_repair_patch


def _pdf_bytes(document: fitz.Document) -> bytes:
    buffer = io.BytesIO()
    document.save(buffer)
    document.close()
    return buffer.getvalue()


def test_divider_export_keeps_korean_and_extra_text():
    document = fitz.open()
    content = {
        "title": "운영 계획서",
        "subtitle": "2026학년도",
        "titleX": 10,
        "titleY": 35,
        "noBg": True,
        "fg": "#111827",
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
            }
        ],
    }
    pdf_divider_alignment_patch._render_divider_page(
        document,
        json.dumps(content, ensure_ascii=False),
        "simple",
        595.28,
        841.89,
    )

    reopened = fitz.open(stream=_pdf_bytes(document), filetype="pdf")
    text = reopened[0].get_text()
    reopened.close()

    assert "운영 계획서" in text
    assert "2026학년도" in text
    assert "추가 문구" in text


def test_header_footer_uses_korean_capable_font():
    document = fitz.open()
    page = document.new_page(width=595.28, height=841.89)
    settings = HeaderFooterSettings(
        enabled=True,
        header_center="한글 머리말 {n}/{total}",
        footer_center="출력 확인",
        font_size=10,
    )
    pdf_text_font_patch._apply_header_footer(
        page,
        settings,
        page.rect.width,
        page.rect.height,
        output_page_num=2,
        total_pages=5,
    )

    reopened = fitz.open(stream=_pdf_bytes(document), filetype="pdf")
    text = reopened[0].get_text()
    reopened.close()

    assert "한글 머리말 2/5" in text
    assert "출력 확인" in text


def test_sampled_pass_is_changed_to_warning():
    from models.schemas import CheckItem, CheckSeverity

    item = CheckItem(
        id="dpi",
        label="이미지 해상도",
        severity=CheckSeverity.pass_,
        detail="문제가 발견되지 않았습니다. (앞 8페이지 검사, 전체 100p)",
    )
    patched = preflight_reliability_patch._mark_partial(item)

    assert patched.severity == CheckSeverity.warning
    assert "전체 문서 통과를 의미하지 않습니다" in patched.detail


def test_pdf_repair_preserves_mixed_page_sizes():
    source = fitz.open()
    source.new_page(width=595.28, height=841.89)
    source.new_page(width=841.89, height=1190.55)
    source_bytes = _pdf_bytes(source)

    response = preflight_repair_patch._fix_pdf_response_preserve_sizes(
        "mixed.pdf", source_bytes
    )
    assert response.status_code == 200

    repaired = fitz.open(stream=response.get_data(), filetype="pdf")
    sizes = [(round(page.rect.width, 1), round(page.rect.height, 1)) for page in repaired]
    repaired.close()

    assert sizes == [(595.3, 841.9), (841.9, 1190.6)]
