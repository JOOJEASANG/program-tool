"""Paid AI vision analysis is intentionally disabled."""

AI_DISABLED_MESSAGE = (
    "AI 시각 분석 기능은 현재 비활성화되어 있습니다. "
    "인쇄 사전 검수기는 무료 규칙 기반 검사만 사용합니다."
)


def analyze_with_vision(doc) -> str:
    """Do not call Google/OpenAI vision models.

    Kept as a safe compatibility function so accidental imports do not create costs.
    """
    return AI_DISABLED_MESSAGE
