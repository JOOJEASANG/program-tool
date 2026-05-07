"""
Claude Vision-based pre-flight analysis.
Renders first N pages as images and asks Claude to evaluate print readiness.
"""
import base64
import io
import os
import fitz
import anthropic

RENDER_DPI = 150
MAX_PAGES_TO_ANALYZE = 3

SYSTEM_PROMPT = """당신은 인쇄 품질 전문가입니다. 제공된 PDF 페이지 이미지를 보고 인쇄 사전 검수(Pre-flight) 관점에서 분석해주세요.

다음 항목을 평가하고 간결하게 한국어로 답변해주세요:
1. 가독성: 텍스트가 명확하게 읽히는가?
2. 여백 균형: 여백이 충분하고 균형 잡혀 있는가?
3. 대비: 텍스트와 배경의 명암 대비가 적절한가?
4. 이미지 품질: 이미지가 흐리거나 픽셀화되지 않았는가?
5. 레이아웃: 전체적인 레이아웃이 인쇄에 적합한가?

각 항목에 대해 [양호/주의/불량] 중 하나를 표시하고 한 줄 설명을 제공하세요.
마지막에 종합 의견을 2-3문장으로 작성하세요."""


def _render_page_to_base64(page: fitz.Page, dpi: int = RENDER_DPI) -> str:
    zoom = dpi / 72
    mat = fitz.Matrix(zoom, zoom)
    pix = page.get_pixmap(matrix=mat, alpha=False)
    img_bytes = pix.tobytes("jpeg", jpg_quality=85)
    return base64.standard_b64encode(img_bytes).decode("utf-8")


async def analyze_with_vision(doc: fitz.Document) -> str:
    api_key = os.getenv("ANTHROPIC_API_KEY")
    if not api_key:
        return "AI 분석을 사용하려면 ANTHROPIC_API_KEY 환경변수를 설정해주세요."

    client = anthropic.AsyncAnthropic(api_key=api_key)
    pages_to_check = min(len(doc), MAX_PAGES_TO_ANALYZE)

    content: list[dict] = []
    for i in range(pages_to_check):
        page = doc[i]
        b64 = _render_page_to_base64(page)
        content.append({
            "type": "text",
            "text": f"=== 페이지 {i + 1} ==="
        })
        content.append({
            "type": "image",
            "source": {
                "type": "base64",
                "media_type": "image/jpeg",
                "data": b64,
            }
        })

    content.append({
        "type": "text",
        "text": f"총 {len(doc)}페이지 문서입니다. 위 {pages_to_check}개 페이지를 분석하여 인쇄 품질을 평가해주세요."
    })

    response = await client.messages.create(
        model="claude-haiku-4-5",
        max_tokens=1024,
        system=SYSTEM_PROMPT,
        messages=[{"role": "user", "content": content}],
    )

    return response.content[0].text
