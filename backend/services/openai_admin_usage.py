"""Server-only OpenAI billing and image-usage reporting for administrators."""
from __future__ import annotations

import json
import os
import urllib.error
import urllib.parse
import urllib.request
from collections import defaultdict
from datetime import date, datetime, timedelta, timezone
from typing import Any
from zoneinfo import ZoneInfo

OPENAI_COSTS_URL = "https://api.openai.com/v1/organization/costs"
OPENAI_IMAGES_USAGE_URL = "https://api.openai.com/v1/organization/usage/images"
SEOUL = ZoneInfo("Asia/Seoul")


class OpenAIAdminUsageError(RuntimeError):
    def __init__(self, message: str, *, code: str, status_code: int = 502):
        super().__init__(message)
        self.code = code
        self.status_code = status_code


def _number(value: Any) -> float:
    try:
        return float(value or 0)
    except (TypeError, ValueError):
        return 0.0


def _integer(value: Any) -> int:
    try:
        return max(0, int(value or 0))
    except (TypeError, ValueError):
        return 0


def _admin_key() -> str:
    return str(os.environ.get("OPENAI_ADMIN_KEY") or "").strip()


def _project_id() -> str:
    return str(os.environ.get("OPENAI_PROJECT_ID") or "").strip()


def _timeout_seconds() -> int:
    try:
        value = int(os.environ.get("OPENAI_ADMIN_USAGE_TIMEOUT_SECONDS") or 20)
    except (TypeError, ValueError):
        value = 20
    return max(5, min(60, value))


def _report_window(now: datetime | None = None) -> tuple[datetime, datetime, datetime]:
    current = now or datetime.now(timezone.utc)
    if current.tzinfo is None:
        current = current.replace(tzinfo=timezone.utc)
    local = current.astimezone(SEOUL)
    month_start_local = local.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
    week_start_local = (local - timedelta(days=6)).replace(hour=0, minute=0, second=0, microsecond=0)
    query_start_local = min(month_start_local, week_start_local)
    return (
        query_start_local.astimezone(timezone.utc),
        month_start_local.astimezone(timezone.utc),
        current.astimezone(timezone.utc),
    )


def _query_pairs(params: dict[str, Any]) -> list[tuple[str, str]]:
    pairs: list[tuple[str, str]] = []
    for key, value in params.items():
        if value is None or value == "":
            continue
        if isinstance(value, (list, tuple)):
            for item in value:
                pairs.append((key, str(item)))
        else:
            pairs.append((key, str(value)))
    return pairs


def _read_http_error(exc: urllib.error.HTTPError) -> str:
    try:
        payload = json.loads(exc.read().decode("utf-8"))
        error = payload.get("error") if isinstance(payload, dict) else None
        if isinstance(error, dict):
            return str(error.get("message") or "")
    except Exception:
        pass
    return ""


def _provider_error(exc: urllib.error.HTTPError) -> OpenAIAdminUsageError:
    detail = _read_http_error(exc)
    if exc.code in {401, 403}:
        return OpenAIAdminUsageError(
            "OpenAI Admin API 키 권한을 확인해 주세요.",
            code="OPENAI_ADMIN_AUTH_FAILED",
            status_code=503,
        )
    if exc.code == 429:
        return OpenAIAdminUsageError(
            "OpenAI 비용 조회 한도에 도달했습니다. 잠시 후 다시 확인해 주세요.",
            code="OPENAI_ADMIN_RATE_LIMIT",
            status_code=429,
        )
    return OpenAIAdminUsageError(
        detail or "OpenAI 실제 비용을 조회하지 못했습니다.",
        code="OPENAI_ADMIN_USAGE_FAILED",
        status_code=502,
    )


def _fetch_pages(url: str, params: dict[str, Any]) -> list[dict[str, Any]]:
    key = _admin_key()
    if not key:
        raise OpenAIAdminUsageError(
            "OpenAI Admin API 키가 설정되지 않아 실제 청구액을 조회할 수 없습니다.",
            code="OPENAI_ADMIN_KEY_MISSING",
            status_code=503,
        )

    data: list[dict[str, Any]] = []
    page = ""
    for _ in range(20):
        current = dict(params)
        if page:
            current["page"] = page
        query = urllib.parse.urlencode(_query_pairs(current))
        request = urllib.request.Request(
            f"{url}?{query}",
            headers={
                "Authorization": f"Bearer {key}",
                "Accept": "application/json",
            },
            method="GET",
        )
        try:
            with urllib.request.urlopen(request, timeout=_timeout_seconds()) as response:
                payload = json.loads(response.read().decode("utf-8"))
        except urllib.error.HTTPError as exc:
            raise _provider_error(exc) from exc
        except (urllib.error.URLError, TimeoutError) as exc:
            raise OpenAIAdminUsageError(
                "OpenAI 비용 조회 서버의 응답이 지연되고 있습니다.",
                code="OPENAI_ADMIN_USAGE_TIMEOUT",
                status_code=504,
            ) from exc
        except json.JSONDecodeError as exc:
            raise OpenAIAdminUsageError(
                "OpenAI 비용 조회 응답을 해석하지 못했습니다.",
                code="OPENAI_ADMIN_USAGE_INVALID_RESPONSE",
                status_code=502,
            ) from exc

        buckets = payload.get("data") if isinstance(payload, dict) else None
        if isinstance(buckets, list):
            data.extend(item for item in buckets if isinstance(item, dict))
        if not bool(payload.get("has_more")):
            break
        page = str(payload.get("next_page") or "")
        if not page:
            break
    return data


def _bucket_date(bucket: dict[str, Any]) -> date | None:
    try:
        stamp = int(bucket.get("start_time"))
    except (TypeError, ValueError):
        return None
    return datetime.fromtimestamp(stamp, tz=timezone.utc).astimezone(SEOUL).date()


def summarize_cost_buckets(
    buckets: list[dict[str, Any]],
    *,
    now: datetime | None = None,
) -> dict[str, Any]:
    current = now or datetime.now(timezone.utc)
    if current.tzinfo is None:
        current = current.replace(tzinfo=timezone.utc)
    today = current.astimezone(SEOUL).date()
    week_start = today - timedelta(days=6)
    daily: dict[date, float] = defaultdict(float)
    currency = "usd"

    for bucket in buckets:
        bucket_day = _bucket_date(bucket)
        if bucket_day is None:
            continue
        results = bucket.get("results")
        if not isinstance(results, list):
            continue
        for result in results:
            if not isinstance(result, dict):
                continue
            amount = result.get("amount")
            if not isinstance(amount, dict):
                continue
            value = _number(amount.get("value"))
            currency = str(amount.get("currency") or currency).lower()
            daily[bucket_day] += value

    ordered_daily = [
        {"date": item.isoformat(), "amount": round(daily[item], 8)}
        for item in sorted(daily)
    ]
    month_daily = {
        item: value
        for item, value in daily.items()
        if item.year == today.year and item.month == today.month
    }
    month_line_items: dict[str, float] = defaultdict(float)
    for bucket in buckets:
        bucket_day = _bucket_date(bucket)
        if bucket_day is None or bucket_day.year != today.year or bucket_day.month != today.month:
            continue
        results = bucket.get("results")
        if not isinstance(results, list):
            continue
        for result in results:
            if not isinstance(result, dict):
                continue
            amount = result.get("amount")
            if not isinstance(amount, dict):
                continue
            label = str(result.get("line_item") or "기타").strip() or "기타"
            month_line_items[label] += _number(amount.get("value"))
    ordered_lines = [
        {"name": name, "amount": round(value, 8)}
        for name, value in sorted(month_line_items.items(), key=lambda pair: pair[1], reverse=True)
    ]
    return {
        "currency": currency,
        "today": round(daily.get(today, 0.0), 8),
        "last_7_days": round(
            sum(value for item, value in daily.items() if week_start <= item <= today),
            8,
        ),
        "month_to_date": round(sum(month_daily.values()), 8),
        "daily": [
            item for item in ordered_daily
            if date.fromisoformat(item["date"]).year == today.year
            and date.fromisoformat(item["date"]).month == today.month
        ],
        "line_items": ordered_lines,
    }


def summarize_image_buckets(
    buckets: list[dict[str, Any]],
    *,
    now: datetime | None = None,
) -> dict[str, Any]:
    current = now or datetime.now(timezone.utc)
    if current.tzinfo is None:
        current = current.replace(tzinfo=timezone.utc)
    today = current.astimezone(SEOUL).date()
    daily_requests: dict[date, int] = defaultdict(int)
    daily_images: dict[date, int] = defaultdict(int)

    for bucket in buckets:
        bucket_day = _bucket_date(bucket)
        if bucket_day is None:
            continue
        results = bucket.get("results")
        if not isinstance(results, list):
            continue
        for result in results:
            if not isinstance(result, dict):
                continue
            requests = _integer(result.get("num_model_requests"))
            images = _integer(result.get("images"))
            daily_requests[bucket_day] += requests
            daily_images[bucket_day] += images

    month_requests = sum(
        value for item, value in daily_requests.items()
        if item.year == today.year and item.month == today.month
    )
    month_images = sum(
        value for item, value in daily_images.items()
        if item.year == today.year and item.month == today.month
    )
    month_models: dict[str, dict[str, int]] = defaultdict(lambda: {"requests": 0, "images": 0})
    for bucket in buckets:
        bucket_day = _bucket_date(bucket)
        if bucket_day is None or bucket_day.year != today.year or bucket_day.month != today.month:
            continue
        results = bucket.get("results")
        if not isinstance(results, list):
            continue
        for result in results:
            if not isinstance(result, dict):
                continue
            model = str(result.get("model") or "미지정").strip() or "미지정"
            month_models[model]["requests"] += _integer(result.get("num_model_requests"))
            month_models[model]["images"] += _integer(result.get("images"))
    return {
        "today_requests": daily_requests.get(today, 0),
        "month_requests": month_requests,
        "month_images": month_images,
        "by_model": [
            {"model": model, **values}
            for model, values in sorted(
                month_models.items(),
                key=lambda pair: pair[1]["requests"],
                reverse=True,
            )
        ],
    }


def fetch_openai_billing_summary(*, now: datetime | None = None) -> dict[str, Any]:
    start, month_start, end = _report_window(now)
    project_id = _project_id()
    shared = {
        "start_time": int(start.timestamp()),
        "end_time": int(end.timestamp()) + 1,
        "bucket_width": "1d",
    }
    if project_id:
        shared["project_ids"] = [project_id]

    costs = _fetch_pages(
        OPENAI_COSTS_URL,
        {
            **shared,
            "group_by": ["line_item"],
            "limit": 31,
        },
    )
    images = _fetch_pages(
        OPENAI_IMAGES_USAGE_URL,
        {
            **shared,
            "group_by": ["model"],
            "limit": 31,
        },
    )
    current = end.astimezone(SEOUL)
    return {
        "available": True,
        "source": "openai_costs_api",
        "scope": "project" if project_id else "organization",
        "scope_label": "Program Studio OpenAI 프로젝트" if project_id else "OpenAI 조직 전체",
        "period": {
            "start": month_start.astimezone(SEOUL).date().isoformat(),
            "end": current.date().isoformat(),
            "timezone": "Asia/Seoul",
        },
        "costs": summarize_cost_buckets(costs, now=end),
        "openai_images": summarize_image_buckets(images, now=end),
    }
