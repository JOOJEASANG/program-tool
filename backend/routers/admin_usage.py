"""Administrator-only Firebase / Google Cloud usage dashboard.

The endpoint reads existing Cloud Monitoring metrics; it does not create custom
metrics or write usage counters, so observing quota health doesn't consume
Firestore write quota. Results are cached in-process for one minute.
"""
from __future__ import annotations

import os
import threading
import time
from datetime import datetime, timedelta, timezone
from zoneinfo import ZoneInfo

import google.auth
from google.auth.transport.requests import AuthorizedSession
from flask import Blueprint, jsonify

from utils.permissions import (
    AccessError,
    _has_admin_claim,
    _is_legacy_admin,
    _normalized_email,
    verify_bearer_token,
)
from firebase_admin import firestore


admin_usage_bp = Blueprint("admin_usage", __name__)
PROJECT_ID = os.environ.get("GCLOUD_PROJECT") or os.environ.get("GCP_PROJECT") or "program-tool"
MONITORING_SCOPE = "https://www.googleapis.com/auth/monitoring.read"
CACHE_SECONDS = 60
GIB = 1024 ** 3

_cache_lock = threading.Lock()
_cache: dict[str, object] = {"time": 0.0, "payload": None}


FREE_LIMITS = {
    "firestore_reads_day": 50_000,
    "firestore_writes_day": 20_000,
    "firestore_deletes_day": 20_000,
    "firestore_storage_bytes": 1 * GIB,
    "firestore_egress_month_bytes": 10 * GIB,
    "functions_invocations_month": 2_000_000,
    "functions_gb_seconds_month": 400_000,
    "functions_cpu_seconds_month": 200_000,
    "functions_egress_month_bytes": 5 * GIB,
    "storage_bytes": 5 * GIB,
    "storage_egress_month_bytes": 100 * GIB,
    "storage_upload_ops_month": 5_000,
    "storage_download_ops_month": 50_000,
}


def _require_admin() -> dict:
    decoded = verify_bearer_token()
    if _has_admin_claim(decoded):
        return decoded
    try:
        if _is_legacy_admin(firestore.client(), _normalized_email(decoded)):
            return decoded
    except Exception as exc:
        raise AccessError("관리자 권한을 확인할 수 없습니다.", 503) from exc
    raise AccessError("관리자 권한이 필요합니다.", 403)


def _iso(value: datetime) -> str:
    return value.astimezone(timezone.utc).isoformat().replace("+00:00", "Z")


def _periods(now: datetime) -> dict[str, tuple[datetime, datetime]]:
    pacific = now.astimezone(ZoneInfo("America/Los_Angeles"))
    day_start = pacific.replace(hour=0, minute=0, second=0, microsecond=0).astimezone(timezone.utc)
    month_start = now.astimezone(timezone.utc).replace(day=1, hour=0, minute=0, second=0, microsecond=0)
    # Gauge metrics only need recent samples; seven days covers delayed daily bucket-size reports.
    gauge_start = now - timedelta(days=7)
    return {
        "day": (day_start, now),
        "month": (month_start, now),
        "gauge": (gauge_start, now),
    }


def _numeric(point: dict) -> float:
    value = point.get("value") or {}
    for key in ("int64Value", "doubleValue"):
        if key in value:
            try:
                return float(value[key])
            except (TypeError, ValueError):
                return 0.0
    return 0.0


def _monitoring_series(session: AuthorizedSession, metric_type: str, start: datetime, end: datetime) -> list[dict]:
    url = f"https://monitoring.googleapis.com/v3/projects/{PROJECT_ID}/timeSeries"
    params = {
        "filter": f'metric.type="{metric_type}"',
        "interval.startTime": _iso(start),
        "interval.endTime": _iso(end),
        "view": "FULL",
        "pageSize": "1000",
    }
    series: list[dict] = []
    for _ in range(8):
        response = session.get(url, params=params, timeout=15)
        if response.status_code >= 400:
            detail = ""
            try:
                detail = (response.json().get("error") or {}).get("message") or ""
            except Exception:
                detail = response.text[:300]
            raise RuntimeError(f"Monitoring {metric_type}: {response.status_code} {detail}".strip())
        body = response.json() or {}
        series.extend(body.get("timeSeries") or [])
        token = body.get("nextPageToken")
        if not token:
            break
        params["pageToken"] = token
    return series


def _delta_total(series: list[dict]) -> int:
    return int(round(sum(_numeric(point) for item in series for point in (item.get("points") or []))))


def _latest_gauge_total(series: list[dict]) -> int:
    total = 0.0
    for item in series:
        points = item.get("points") or []
        if points:
            total += _numeric(points[0])
    return int(round(total))


def _storage_operations(series: list[dict]) -> tuple[int, int, int]:
    uploads = downloads = other = 0
    for item in series:
        method = str((item.get("metric") or {}).get("labels", {}).get("method") or "").lower()
        count = int(round(sum(_numeric(point) for point in (item.get("points") or []))))
        if any(token in method for token in ("insert", "create", "compose", "rewrite", "upload")):
            uploads += count
        elif any(token in method for token in ("get", "read", "download")) and "metadata" not in method:
            downloads += count
        else:
            other += count
    return uploads, downloads, other


def _metric(session: AuthorizedSession, metric_type: str, period: tuple[datetime, datetime], gauge: bool = False):
    try:
        series = _monitoring_series(session, metric_type, *period)
        return (_latest_gauge_total(series) if gauge else _delta_total(series)), None, series
    except Exception as exc:
        return None, str(exc), []


def _usage_item(value, limit, unit: str, period: str, *, approximate: bool = False, error: str | None = None):
    percent = None
    if value is not None and limit:
        percent = min(999.0, max(0.0, float(value) / float(limit) * 100.0))
    return {
        "value": value,
        "limit": limit,
        "unit": unit,
        "period": period,
        "percent": round(percent, 2) if percent is not None else None,
        "approximate": approximate,
        "available": value is not None,
        "error": error,
    }


def _build_payload() -> dict:
    now = datetime.now(timezone.utc)
    periods = _periods(now)
    credentials, _ = google.auth.default(scopes=[MONITORING_SCOPE])
    session = AuthorizedSession(credentials)

    fs_reads, er1, _ = _metric(session, "firestore.googleapis.com/document/read_count", periods["day"])
    fs_writes, er2, _ = _metric(session, "firestore.googleapis.com/document/write_count", periods["day"])
    fs_deletes, er3, _ = _metric(session, "firestore.googleapis.com/document/delete_count", periods["day"])

    run_requests, er4, _ = _metric(session, "run.googleapis.com/request_count", periods["month"])
    run_billable_seconds, er5, _ = _metric(session, "run.googleapis.com/container/billable_instance_time", periods["month"])

    storage_ops_total, er6, storage_series = _metric(session, "storage.googleapis.com/api/request_count", periods["month"])
    storage_uploads = storage_downloads = storage_other = None
    if storage_ops_total is not None:
        storage_uploads, storage_downloads, storage_other = _storage_operations(storage_series)
    storage_egress, er7, _ = _metric(session, "storage.googleapis.com/network/sent_bytes_count", periods["month"])
    storage_bytes, er8, _ = _metric(session, "storage.googleapis.com/storage/v2/total_bytes", periods["gauge"], gauge=True)

    # This project's main API function is configured for 2 GiB. Multiplying Cloud
    # Run billable instance-seconds by two gives a conservative project-level
    # approximation, not the billing-account-level Functions free-tier ledger.
    approx_gb_seconds = int(run_billable_seconds * 2) if run_billable_seconds is not None else None

    return {
        "projectId": PROJECT_ID,
        "updatedAt": _iso(now),
        "monitoringDelay": "Cloud Monitoring 지표는 보통 1분 단위로 수집되며 서비스에 따라 약 2~4분 늦게 보일 수 있습니다.",
        "quotaScopeNote": "Cloud Functions 무료 할당량은 결제 계정 단위이므로 아래 Functions 값은 이 프로젝트 Cloud Run 사용량을 기준으로 한 근사치입니다.",
        "optimization": {
            "usageCountersRetired": True,
            "memberApprovalOnly": True,
            "monitorCacheSeconds": CACHE_SECONDS,
            "note": "프로그램 실행마다 Firestore 사용횟수를 쓰지 않고 관리자 권한 변경 시에만 권한 문서를 기록합니다.",
        },
        "firestore": {
            "reads": _usage_item(fs_reads, FREE_LIMITS["firestore_reads_day"], "documents", "Pacific day", error=er1),
            "writes": _usage_item(fs_writes, FREE_LIMITS["firestore_writes_day"], "documents", "Pacific day", error=er2),
            "deletes": _usage_item(fs_deletes, FREE_LIMITS["firestore_deletes_day"], "documents", "Pacific day", error=er3),
        },
        "functions": {
            "requests": _usage_item(run_requests, FREE_LIMITS["functions_invocations_month"], "requests", "month", approximate=True, error=er4),
            "gbSecondsApprox": _usage_item(approx_gb_seconds, FREE_LIMITS["functions_gb_seconds_month"], "GB-s", "month", approximate=True, error=er5),
        },
        "storage": {
            "storedBytes": _usage_item(storage_bytes, FREE_LIMITS["storage_bytes"], "bytes", "current", approximate=True, error=er8),
            "uploadOps": _usage_item(storage_uploads, FREE_LIMITS["storage_upload_ops_month"], "operations", "month", approximate=True, error=er6),
            "downloadOps": _usage_item(storage_downloads, FREE_LIMITS["storage_download_ops_month"], "operations", "month", approximate=True, error=er6),
            "egressBytes": _usage_item(storage_egress, FREE_LIMITS["storage_egress_month_bytes"], "bytes", "month", approximate=True, error=er7),
            "otherOps": storage_other,
        },
    }


def _cached_payload(force: bool = False) -> dict:
    now = time.monotonic()
    with _cache_lock:
        payload = _cache.get("payload")
        age = now - float(_cache.get("time") or 0.0)
        if not force and isinstance(payload, dict) and age < CACHE_SECONDS:
            return {**payload, "cacheAgeSeconds": round(max(0.0, age), 1)}
    payload = _build_payload()
    with _cache_lock:
        _cache["time"] = time.monotonic()
        _cache["payload"] = payload
    return {**payload, "cacheAgeSeconds": 0}


@admin_usage_bp.route("/firebase-usage", methods=["GET"])
def firebase_usage():
    try:
        _require_admin()
        return jsonify(_cached_payload())
    except AccessError as exc:
        return jsonify({"detail": str(exc)}), exc.status_code
    except Exception as exc:
        # Admin UI should stay usable even if Monitoring API/IAM isn't available.
        return jsonify({
            "detail": "Cloud Monitoring 사용량을 불러오지 못했습니다.",
            "monitoringAvailable": False,
            "error": str(exc)[:500],
        }), 503
