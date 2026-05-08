"""Vision-based pre-flight analysis. Supports Google Gemini and OpenAI GPT-4o."""
import base64
import fitz
from utils.api_key import get_google_api_key, get_openai_api_key, get_ai_provider

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


def _render_page_to_bytes(page: fitz.Page, dpi: int = RENDER_DPI) -> bytes:
    zoom = dpi / 72
    mat = fitz.Matrix(zoom, zoom)
    pix = page.get_pixmap(matrix=mat, alpha=False)
    return pix.tobytes("jpeg", jpg_quality=85)


def _analyze_with_google(doc: fitz.Document, pages_to_check: int) -> str:
    from google import genai
    from google.genai import types
    api_key = get_google_api_key()
    if not api_key:
        return "AI 분석을 사용하려면 관리자 페이지에서 Google API 키를 등록해주세요."
    client = genai.Client(api_key=api_key)
    contents: list = [SYSTEM_PROMPT]
    for i in range(pages_to_check):
        img_bytes = _render_page_to_bytes(doc[i])
        contents.append(f"=== 페이지 {i + 1} ===")
        contents.append(types.Part.from_bytes(data=img_bytes, mime_type="image/jpeg"))
    contents.append(
        f"총 {len(doc)}페이지 문서입니다. 위 {pages_to_check}개 페이지를 분석하여 인쇄 품질을 평가해주세요."
    )
    response = client.models.generate_content(
        model="gemini-2.5-flash",
        contents=contents,
    )
    return response.text


def _analyze_with_openai(doc: fitz.Document, pages_to_check: int) -> str:
    from openai import OpenAI
    api_key = get_openai_api_key()
    if not api_key:
        return "AI 분석을 사용하려면 관리자 페이지에서 OpenAI API 키를 등록해주세요."
    client = OpenAI(api_key=api_key)
    user_content: list[dict] = []
    for i in range(pages_to_check):
        img_bytes = _render_page_to_bytes(doc[i])
        b64 = base64.b64encode(img_bytes).decode("utf-8")
        user_content.append({"type": "text", "text": f"=== 페이지 {i + 1} ==="})
        user_content.append({
            "type": "image_url",
            "image_url": {"url": f"data:image/jpeg;base64,{b64}"},
        })
    user_content.append({
        "type": "text",
        "text": f"총 {len(doc)}페이지 문서입니다. 위 {pages_to_check}개 페이지를 분석하여 인쇄 품질을 평가해주세요.",
    })
    response = client.chat.completions.create(
        model="gpt-4o-mini",
        messages=[
            {"role": "system", "content": SYSTEM_PROMPT},
            {"role": "user", "content": user_content},
        ],
        max_tokens=1024,
    )
    return response.choices[0].message.content


def analyze_with_vision(doc: fitz.Document) -> str:
    pages_to_check = min(len(doc), MAX_PAGES_TO_ANALYZE)
    provider = get_ai_provider("vision")
    if provider == "openai":
        return _analyze_with_openai(doc, pages_to_check)
    return _analyze_with_google(doc, pages_to_check)
