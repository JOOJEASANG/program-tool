"""Lightweight AI usage logger — increments counters on user_permissions docs."""
from firebase_admin import firestore


def log_ai_usage(uid: str, op_type: str) -> None:
    """Increment aiUsage counters on user_permissions/{uid}. Never raises."""
    try:
        db = firestore.client()
        db.collection("user_permissions").document(uid).update({
            f"aiUsage.{op_type}": firestore.Increment(1),
            "aiUsage.total": firestore.Increment(1),
        })
    except Exception:
        pass
