"""Daily aggregate telemetry for successful Program Studio AI image generations."""
from __future__ import annotations

import logging
from collections import defaultdict
from datetime import date, datetime, timedelta, timezone
from typing import Any
from zoneinfo import ZoneInfo

from firebase_admin import firestore

logger = logging.getLogger(__name__)
COLLECTION = "_system_ai_usage_daily"
SEOUL = ZoneInfo("Asia/Seoul")


def _local_day(now: datetime | None = None) -> date:
    current = now or datetime.now(timezone.utc)
    if current.tzinfo is None:
        current = current.replace(tzinfo=timezone.utc)
    return current.astimezone(SEOUL).date()


def _safe_int(value: Any) -> int:
    try:
        return max(0, int(value or 0))
    except (TypeError, ValueError):
        return 0


def record_image_generation(result: dict[str, Any], *, now: datetime | None = None) -> None:
    """Best-effort aggregate recording. Telemetry failure never breaks generation."""
    day = _local_day(now)
    geometry = result.get("geometry") if isinstance(result, dict) else {}
    geometry = geometry if isinstance(geometry, dict) else {}
    quality = "high" if str(geometry.get("quality_mode") or "").lower() == "high" else "standard"
    model = str(result.get("model") or "unknown").strip() or "unknown"
    try:
        db = firestore.client()
        reference = db.collection(COLLECTION).document(day.isoformat())
        transaction = db.transaction()

        @firestore.transactional
        def update_in_transaction(current_transaction):
            snapshot = reference.get(transaction=current_transaction)
            state = snapshot.to_dict() if snapshot.exists else {}
            state = state or {}
            model_counts = state.get("model_counts")
            model_counts = dict(model_counts) if isinstance(model_counts, dict) else {}
            model_counts[model] = _safe_int(model_counts.get(model)) + 1
            payload = {
                "date": day.isoformat(),
                "image_requests": _safe_int(state.get("image_requests")) + 1,
                "standard_requests": _safe_int(state.get("standard_requests")) + (1 if quality == "standard" else 0),
                "high_requests": _safe_int(state.get("high_requests")) + (1 if quality == "high" else 0),
                "model_counts": model_counts,
                "last_generated_at": now or datetime.now(timezone.utc),
            }
            current_transaction.set(reference, payload, merge=True)

        update_in_transaction(transaction)
    except Exception:
        logger.warning("AI image usage telemetry write failed", exc_info=True)


def _report_dates(today: date) -> list[date]:
    month_start = today.replace(day=1)
    week_start = today - timedelta(days=6)
    cursor = min(month_start, week_start)
    dates: list[date] = []
    while cursor <= today:
        dates.append(cursor)
        cursor += timedelta(days=1)
    return dates


def load_program_studio_image_summary(*, now: datetime | None = None) -> dict[str, Any]:
    today = _local_day(now)
    dates = _report_dates(today)
    db = firestore.client()
    references = [db.collection(COLLECTION).document(day.isoformat()) for day in dates]
    snapshots = list(db.get_all(references)) if references else []
    records: dict[str, dict[str, Any]] = {}
    for snapshot in snapshots:
        if getattr(snapshot, "exists", False):
            records[snapshot.id] = snapshot.to_dict() or {}

    daily = []
    model_counts: dict[str, int] = defaultdict(int)
    month_requests = 0
    month_standard = 0
    month_high = 0
    for day in dates:
        state = records.get(day.isoformat(), {})
        requests = _safe_int(state.get("image_requests"))
        standard = _safe_int(state.get("standard_requests"))
        high = _safe_int(state.get("high_requests"))
        if day.year == today.year and day.month == today.month:
            month_requests += requests
            month_standard += standard
            month_high += high
            raw_models = state.get("model_counts")
            if isinstance(raw_models, dict):
                for model, count in raw_models.items():
                    model_counts[str(model)] += _safe_int(count)
        daily.append(
            {
                "date": day.isoformat(),
                "requests": requests,
                "standard": standard,
                "high": high,
            }
        )

    week_start = today - timedelta(days=6)
    last_7_days = sum(
        item["requests"]
        for item in daily
        if date.fromisoformat(item["date"]) >= week_start
    )
    return {
        "tracked_from": "2026-09-22",
        "today_requests": daily[-1]["requests"] if daily else 0,
        "last_7_days_requests": last_7_days,
        "month_requests": month_requests,
        "standard_requests": month_standard,
        "high_requests": month_high,
        "by_model": [
            {"model": model, "requests": count}
            for model, count in sorted(model_counts.items(), key=lambda pair: pair[1], reverse=True)
        ],
        "daily": daily,
    }
