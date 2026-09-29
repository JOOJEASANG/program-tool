"""Small server-side USD/KRW exchange-rate helper for the admin dashboard."""
from __future__ import annotations

import json
import logging
import time
import urllib.error
import urllib.request
from datetime import datetime, timezone
from typing import Any

logger = logging.getLogger(__name__)

_CACHE_TTL_SECONDS = 900
_OPEN_ER_API_URL = "https://open.er-api.com/v6/latest/USD"
_FRANKFURTER_URL = "https://api.frankfurter.app/latest?from=USD&to=KRW"
_cache: dict[str, Any] = {}


def _number(value: Any) -> float:
    try:
        return float(value or 0)
    except (TypeError, ValueError):
        return 0.0


def _iso_from_unix(value: Any) -> str:
    try:
        stamp = int(value)
    except (TypeError, ValueError):
        return ""
    return datetime.fromtimestamp(stamp, tz=timezone.utc).isoformat().replace("+00:00", "Z")


def _fetch_json(url: str) -> dict[str, Any]:
    request = urllib.request.Request(
        url,
        headers={"Accept": "application/json", "User-Agent": "Program-Studio/1.0"},
        method="GET",
    )
    with urllib.request.urlopen(request, timeout=5) as response:
        payload = json.loads(response.read().decode("utf-8"))
    return payload if isinstance(payload, dict) else {}


def _from_open_er_api() -> dict[str, Any]:
    payload = _fetch_json(_OPEN_ER_API_URL)
    rates = payload.get("rates") if isinstance(payload.get("rates"), dict) else {}
    rate = _number(rates.get("KRW"))
    if str(payload.get("result") or "").lower() != "success" or rate <= 0:
        raise ValueError("open.er-api returned no USD/KRW rate")
    return {
        "available": True,
        "base": "USD",
        "quote": "KRW",
        "rate": rate,
        "provider": "open.er-api.com",
        "provider_updated_at": _iso_from_unix(payload.get("time_last_update_unix")),
    }


def _from_frankfurter() -> dict[str, Any]:
    payload = _fetch_json(_FRANKFURTER_URL)
    rates = payload.get("rates") if isinstance(payload.get("rates"), dict) else {}
    rate = _number(rates.get("KRW"))
    if rate <= 0:
        raise ValueError("frankfurter returned no USD/KRW rate")
    updated = str(payload.get("date") or "").strip()
    if updated:
        updated = f"{updated}T00:00:00Z"
    return {
        "available": True,
        "base": "USD",
        "quote": "KRW",
        "rate": rate,
        "provider": "frankfurter.app",
        "provider_updated_at": updated,
    }


def fetch_usd_krw_rate(*, force: bool = False) -> dict[str, Any]:
    """Return a recent USD/KRW rate with a 15-minute in-process cache.

    The admin endpoint is intentionally resilient: if both public providers fail,
    the last known rate in the warm function instance is returned as stale. If no
    rate has ever been fetched, callers receive available=False and can keep USD
    as the fallback display currency.
    """
    now = time.time()
    cached_rate = _number(_cache.get("rate"))
    fetched_at = _number(_cache.get("fetched_at_unix"))
    if not force and cached_rate > 0 and fetched_at > 0 and now - fetched_at < _CACHE_TTL_SECONDS:
        result = dict(_cache.get("payload") or {})
        result["cached"] = True
        result["stale"] = False
        return result

    last_error = ""
    for loader in (_from_open_er_api, _from_frankfurter):
        try:
            result = loader()
            result.update(
                {
                    "fetched_at": datetime.now(timezone.utc).isoformat().replace("+00:00", "Z"),
                    "cache_ttl_seconds": _CACHE_TTL_SECONDS,
                    "cached": False,
                    "stale": False,
                }
            )
            _cache.clear()
            _cache.update(
                {
                    "rate": result["rate"],
                    "fetched_at_unix": now,
                    "payload": dict(result),
                }
            )
            return result
        except (urllib.error.URLError, TimeoutError, json.JSONDecodeError, ValueError) as exc:
            last_error = str(exc)
            logger.warning("USD/KRW exchange-rate provider failed: %s", exc)
        except Exception as exc:  # pragma: no cover - defensive provider isolation
            last_error = str(exc)
            logger.warning("Unexpected USD/KRW exchange-rate failure", exc_info=True)

    if cached_rate > 0:
        result = dict(_cache.get("payload") or {})
        result["cached"] = True
        result["stale"] = True
        result["detail"] = "최신 환율 조회에 실패해 마지막 정상 환율을 사용합니다."
        return result

    return {
        "available": False,
        "base": "USD",
        "quote": "KRW",
        "rate": None,
        "provider": "",
        "provider_updated_at": "",
        "fetched_at": datetime.now(timezone.utc).isoformat().replace("+00:00", "Z"),
        "cache_ttl_seconds": _CACHE_TTL_SECONDS,
        "cached": False,
        "stale": False,
        "detail": last_error or "USD/KRW 환율을 불러오지 못했습니다.",
    }
