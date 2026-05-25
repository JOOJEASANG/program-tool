"""Lightweight AI usage logger — increments counters on user_permissions docs."""
from firebase_admin import firestore


def log_ai_usage(uid: str, op_type: str) -> None:
    """Increment aiUsage counters on user_permissions/{uid}. Never raises."""
    try:
        db = firestore.client()
        ref = db.collection("user_permissions").document(uid)
        try:
            ref.update({
                f"aiUsage.{op_type}": firestore.Increment(1),
                "aiUsage.total": firestore.Increment(1),
            })
        except Exception:
            # Document may not exist yet — seed it, then retry the increment.
            ref.set({"uid": uid, "programs": {}, "aiUsage": {}}, merge=True)
            ref.update({
                f"aiUsage.{op_type}": firestore.Increment(1),
                "aiUsage.total": firestore.Increment(1),
            })
    except Exception:
        pass
