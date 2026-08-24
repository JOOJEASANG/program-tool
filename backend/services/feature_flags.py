"""Server-side feature flags for optional Program Studio capabilities.

AI design must be checked on the server as well as in the browser. The browser
control is only UX; this helper is the enforcement hook future AI endpoints must
call before invoking a model or consuming billable API capacity.
"""
from __future__ import annotations

import logging

from firebase_admin import firestore

logger = logging.getLogger(__name__)
SETTINGS_COLLECTION = "settings"
PROGRAM_SUITE_DOCUMENT = "professional_program_suite"
AI_DESIGN_KEY = "aiDesignEnabled"


def ai_design_enabled() -> bool:
    """Return True only when the administrator explicitly enabled AI design.

    Missing documents, missing fields, malformed values, and Firestore failures
    all fail closed to False.
    """
    try:
        snapshot = (
            firestore.client()
            .collection(SETTINGS_COLLECTION)
            .document(PROGRAM_SUITE_DOCUMENT)
            .get()
        )
        if not snapshot.exists:
            return False
        data = snapshot.to_dict() or {}
        flags = data.get("featureFlags")
        if not isinstance(flags, dict):
            return False
        return flags.get(AI_DESIGN_KEY) is True
    except Exception:
        logger.warning("AI design feature flag read failed; keeping feature disabled", exc_info=True)
        return False


def require_ai_design_enabled() -> None:
    """Raise a stable validation error when AI design is administratively OFF."""
    if not ai_design_enabled():
        raise ValueError("AI 디자인 생성 기능이 관리자 설정에서 비활성화되어 있습니다.")
