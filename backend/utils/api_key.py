"""Resolve AI API keys and provider preferences.

Keys (priority):
  1. Env vars (Firebase Secret): GOOGLE_API_KEY, OPENAI_API_KEY
  2. Firestore: settings/config.googleApiKey, settings/config.openaiApiKey
  3. Legacy: settings/config.openaiKey (treated as Google key for backward compat)

Provider preferences (per feature):
  Firestore: settings/config.aiProviders = { image, vision, ocr }
  Defaults to "google" when unset.
"""
import os
from firebase_admin import firestore


def _get_config() -> dict:
    try:
        db = firestore.client()
        doc = db.collection("settings").document("config").get()
        if not doc.exists:
            return {}
        return doc.to_dict() or {}
    except Exception:
        return {}


def get_google_api_key() -> str | None:
    key = os.getenv("GOOGLE_API_KEY")
    if key:
        return key
    data = _get_config()
    return data.get("googleApiKey") or data.get("openaiKey")  # legacy fallback


def get_openai_api_key() -> str | None:
    key = os.getenv("OPENAI_API_KEY")
    if key:
        return key
    data = _get_config()
    return data.get("openaiApiKey")


def get_ai_provider(feature: str) -> str:
    """feature: 'image' | 'vision' | 'ocr'. Returns 'google' or 'openai'."""
    data = _get_config()
    providers = data.get("aiProviders") or {}
    return (providers.get(feature) or "google").lower()
