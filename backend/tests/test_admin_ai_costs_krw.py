import json
from datetime import datetime, timezone
from pathlib import Path
from zoneinfo import ZoneInfo

import pytest

from services import exchange_rate, openai_admin_usage
from services.openai_admin_usage import OpenAIAdminUsageError, _total_report_start, sum_cost_buckets


ROOT = Path(__file__).resolve().parents[2]
SEOUL = ZoneInfo("Asia/Seoul")


def test_sum_cost_buckets_returns_cumulative_amount():
    buckets = [
        {
            "results": [
                {"amount": {"value": 1.25, "currency": "usd"}},
                {"amount": {"value": 0.75, "currency": "usd"}},
            ]
        },
        {"results": [{"amount": {"value": 2.50, "currency": "usd"}}]},
    ]

    assert sum_cost_buckets(buckets) == pytest.approx(4.50)


def test_total_report_start_defaults_to_current_year(monkeypatch):
    monkeypatch.delenv("OPENAI_COST_TOTAL_START_DATE", raising=False)
    now = datetime(2026, 9, 29, 7, 0, tzinfo=timezone.utc)

    start = _total_report_start(now)

    assert start.astimezone(SEOUL).date().isoformat() == "2026-01-01"


def test_total_report_start_accepts_configured_date(monkeypatch):
    monkeypatch.setenv("OPENAI_COST_TOTAL_START_DATE", "2026-07-15")
    now = datetime(2026, 9, 29, 7, 0, tzinfo=timezone.utc)

    start = _total_report_start(now)

    assert start.astimezone(SEOUL).date().isoformat() == "2026-07-15"


def test_exchange_rate_uses_primary_provider_and_cache(monkeypatch):
    exchange_rate._cache.clear()
    calls = []

    def fake_fetch(url):
        calls.append(url)
        return {
            "result": "success",
            "rates": {"KRW": 1382.45},
            "time_last_update_unix": 1790640000,
        }

    monkeypatch.setattr(exchange_rate, "_fetch_json", fake_fetch)

    first = exchange_rate.fetch_usd_krw_rate()
    second = exchange_rate.fetch_usd_krw_rate()

    assert first["available"] is True
    assert first["rate"] == pytest.approx(1382.45)
    assert first["provider"] == "open.er-api.com"
    assert first["cached"] is False
    assert second["cached"] is True
    assert second["rate"] == pytest.approx(1382.45)
    assert len(calls) == 1


def test_exchange_rate_falls_back_to_frankfurter(monkeypatch):
    exchange_rate._cache.clear()

    def fake_fetch(url):
        if url == exchange_rate._OPEN_ER_API_URL:
            raise ValueError("primary unavailable")
        return {"date": "2026-09-29", "rates": {"KRW": 1380.10}}

    monkeypatch.setattr(exchange_rate, "_fetch_json", fake_fetch)

    result = exchange_rate.fetch_usd_krw_rate(force=True)

    assert result["available"] is True
    assert result["provider"] == "frankfurter.app"
    assert result["rate"] == pytest.approx(1380.10)


def test_openai_pagination_cap_never_returns_partial_costs(monkeypatch):
    monkeypatch.setenv("OPENAI_ADMIN_KEY", "test-admin-key")

    class FakeResponse:
        def __enter__(self):
            return self

        def __exit__(self, exc_type, exc, tb):
            return False

        def read(self):
            return json.dumps({"data": [], "has_more": True, "next_page": "next"}).encode("utf-8")

    monkeypatch.setattr(
        openai_admin_usage.urllib.request,
        "urlopen",
        lambda request, timeout: FakeResponse(),
    )

    with pytest.raises(OpenAIAdminUsageError) as exc_info:
        openai_admin_usage._fetch_pages(
            openai_admin_usage.OPENAI_COSTS_URL,
            {"start_time": 1, "end_time": 2, "bucket_width": "1d", "limit": 180},
        )

    assert exc_info.value.code == "OPENAI_ADMIN_USAGE_INCOMPLETE"


def test_admin_ai_cost_client_contains_krw_and_total_contract():
    client = (ROOT / "js" / "admin-ai-costs.js").read_text(encoding="utf-8")

    for marker in (
        "AI 사용 합계금액",
        "exchange_rate",
        "total_to_date",
        "total_period",
        "1 USD = ₩",
        "최신 환율",
    ):
        assert marker in client
