"""Resolve Google AI API key.

Priority:
  1. Env var GOOGLE_API_KEY (Firebase Secret)
  2. Firestore: settings/config.googleApiKey
  3. Firestore: settings/config.openaiKey (legacy field; kept for backward compat)
"""
import os
from firebase_admin import firestore


def get_google_api_key() -> str | None:
    key = os.getenv("GOOGLE_API_KEY")
    if key:
        return key
    try:
        db = firestore.client()
        doc = db.collection("settings").document("config").get()
        if not doc.exists:
            return None
        data = doc.to_dict() or {}
        return data.get("googleApiKey") or data.get("openaiKey")
    except Exception:
        return None
