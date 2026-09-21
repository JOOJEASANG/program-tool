"""Firestore-backed abuse guard for cost-bearing AI endpoints."""
from __future__ import annotations

import hashlib
import logging
import math
import uuid
from contextlib import contextmanager
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from typing import Mapping

from firebase_admin import firestore

logger = logging.getLogger(__name__)

_COLLECTION = "_system_ai_usage_guards"


@dataclass(frozen=True)
class AiUsagePolicy:
    max_requests: int
    window: timedelta
    lease: timedelta


POLICIES = {
    "image": AiUsagePolicy(
        max_requests=5,
        window=timedelta(minutes=10),
        lease=timedelta(minutes=6),
    ),
    "layout": AiUsagePolicy(
        max_requests=15,
        window=timedelta(minutes=10),
        lease=timedelta(minutes=2),
    ),
}


class AiUsageGuardError(RuntimeError):
    def __init__(self, code: str, *, status_code: int, retry_after: int = 0):
        super().__init__(code)
        self.code = code
        self.status_code = status_code
        self.retry_after = max(0, int(retry_after))


def _utc_datetime(value) -> datetime | None:
    if not isinstance(value, datetime):
        return None
    if value.tzinfo is None:
        return value.replace(tzinfo=timezone.utc)
    return value.astimezone(timezone.utc)


def _retry_seconds(until: datetime, now: datetime) -> int:
    return max(1, math.ceil((until - now).total_seconds()))


def _reservation_update(
    state: Mapping[str, object],
    *,
    now: datetime,
    policy: AiUsagePolicy,
    token: str,
) -> dict[str, object]:
    """Return an atomic reservation update or raise a public guard error."""
    active_until = _utc_datetime(state.get("active_until"))
    if active_until is not None and active_until > now:
        raise AiUsageGuardError(
            "AI_REQUEST_IN_PROGRESS",
            status_code=409,
            retry_after=_retry_seconds(active_until, now),
        )

    window_started_at = _utc_datetime(state.get("window_started_at"))
    window_expired = (
        window_started_at is None
        or now >= window_started_at + policy.window
    )
    if window_expired:
        window_started_at = now
        request_count = 0
    else:
        raw_count = state.get("request_count", 0)
        request_count = raw_count if isinstance(raw_count, int) and raw_count >= 0 else 0

    if request_count >= policy.max_requests:
        reset_at = window_started_at + policy.window
        raise AiUsageGuardError(
            "AI_REQUEST_RATE_LIMITED",
            status_code=429,
            retry_after=_retry_seconds(reset_at, now),
        )

    return {
        "window_started_at": window_started_at,
        "request_count": request_count + 1,
        "active_token": token,
        "active_until": now + policy.lease,
        "updated_at": now,
    }


def _document_id(uid: str, kind: str) -> str:
    # Do not expose a Firebase UID in an operational collection name.
    return hashlib.sha256(f"{kind}:{uid}".encode("utf-8")).hexdigest()


def _reserve(uid: str, kind: str) -> tuple[object, str]:
    policy = POLICIES.get(kind)
    if policy is None:
        raise ValueError(f"Unsupported AI usage kind: {kind}")

    token = uuid.uuid4().hex
    reference = firestore.client().collection(_COLLECTION).document(_document_id(uid, kind))
    transaction = firestore.client().transaction()

    @firestore.transactional
    def reserve_in_transaction(current_transaction):
        snapshot = reference.get(transaction=current_transaction)
        state = snapshot.to_dict() if snapshot.exists else {}
        now = datetime.now(timezone.utc)
        update = _reservation_update(
            state or {},
            now=now,
            policy=policy,
            token=token,
        )
        update["kind"] = kind
        current_transaction.set(reference, update, merge=True)

    try:
        reserve_in_transaction(transaction)
    except AiUsageGuardError:
        raise
    except Exception as exc:
        logger.exception("AI usage guard reservation failed kind=%s", kind)
        raise AiUsageGuardError(
            "AI_GUARD_UNAVAILABLE",
            status_code=503,
            retry_after=30,
        ) from exc
    return reference, token


def _release(reference, token: str) -> None:
    transaction = firestore.client().transaction()

    @firestore.transactional
    def release_in_transaction(current_transaction):
        snapshot = reference.get(transaction=current_transaction)
        state = snapshot.to_dict() if snapshot.exists else {}
        if (state or {}).get("active_token") != token:
            return
        current_transaction.update(reference, {
            "active_token": None,
            "active_until": None,
            "updated_at": datetime.now(timezone.utc),
        })

    try:
        release_in_transaction(transaction)
    except Exception:
        # A bounded lease still releases the request if Firestore is transiently
        # unavailable. Never mask a successful provider response here.
        logger.warning("AI usage guard release failed", exc_info=True)


@contextmanager
def guard_ai_usage(uid: str, kind: str):
    """Reserve one user AI request and always release its concurrency lease."""
    reference, token = _reserve(uid, kind)
    try:
        yield
    finally:
        _release(reference, token)
