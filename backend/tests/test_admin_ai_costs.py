from datetime import datetime, timezone
from pathlib import Path
from zoneinfo import ZoneInfo

import pytest

import main
from routers import admin_ai_usage
from services.openai_admin_usage import (
    OPENAI_COSTS_URL,
    OpenAIAdminUsageError,
    _fetch_pages,
    _report_window,
    summarize_cost_buckets,
    summarize_image_buckets,
)
from utils import auth as auth_utils


ROOT = Path(__file__).resolve().parents[2]
SEOUL = ZoneInfo("Asia/Seoul")
NOW = datetime(2026, 9, 22, 5, 0, tzinfo=timezone.utc)


def _stamp(year, month, day):
    return int(datetime(year, month, day, 0, 0, tzinfo=SEOUL).timestamp())


def test_openai_cost_summary_tracks_today_week_month_and_line_items():
    buckets = [
        {
            "start_time": _stamp(2026, 9, 21),
            "results": [
                {"amount": {"value": 0.04, "currency": "usd"}, "line_item": "image output"},
                {"amount": {"value": 0.02, "currency": "usd"}, "line_item": "input tokens"},
            ],
        },
        {
            "start_time": _stamp(2026, 9, 22),
            "results": [
                {"amount": {"value": 0.08, "currency": "usd"}, "line_item": "image output"},
            ],
        },
    ]

    summary = summarize_cost_buckets(buckets, now=NOW)

    assert summary["currency"] == "usd"
    assert summary["today"] == pytest.approx(0.08)
    assert summary["last_7_days"] == pytest.approx(0.14)
    assert summary["month_to_date"] == pytest.approx(0.14)
    assert summary["line_items"][0] == {"name": "image output", "amount": pytest.approx(0.12)}


def test_openai_cost_summary_keeps_week_and_month_correct_across_boundary():
    now = datetime(2026, 10, 3, 5, 0, tzinfo=timezone.utc)
    buckets = [
        {
            "start_time": _stamp(2026, 9, 30),
            "results": [
                {"amount": {"value": 0.10, "currency": "usd"}, "line_item": "previous month"},
            ],
        },
        {
            "start_time": _stamp(2026, 10, 1),
            "results": [
                {"amount": {"value": 0.20, "currency": "usd"}, "line_item": "image output"},
            ],
        },
        {
            "start_time": _stamp(2026, 10, 3),
            "results": [
                {"amount": {"value": 0.30, "currency": "usd"}, "line_item": "image output"},
            ],
        },
    ]

    summary = summarize_cost_buckets(buckets, now=now)
    query_start, month_start, _ = _report_window(now)

    assert query_start.astimezone(SEOUL).date().isoformat() == "2026-09-27"
    assert month_start.astimezone(SEOUL).date().isoformat() == "2026-10-01"
    assert summary["last_7_days"] == pytest.approx(0.60)
    assert summary["month_to_date"] == pytest.approx(0.50)
    assert [item["date"] for item in summary["daily"]] == ["2026-10-01", "2026-10-03"]
    assert summary["line_items"] == [{"name": "image output", "amount": pytest.approx(0.50)}]


def test_openai_image_usage_summary_tracks_model_request_counts():
    buckets = [
        {
            "start_time": _stamp(2026, 9, 22),
            "results": [
                {"model": "gpt-image-2", "num_model_requests": 3, "images": 3},
                {"model": "gpt-image-2.5-flare", "num_model_requests": 1, "images": 1},
            ],
        }
    ]

    summary = summarize_image_buckets(buckets, now=NOW)

    assert summary["today_requests"] == 4
    assert summary["month_requests"] == 4
    assert summary["month_images"] == 4
    assert summary["by_model"][0]["model"] == "gpt-image-2"
    assert summary["by_model"][0]["requests"] == 3


def test_openai_image_usage_month_total_excludes_previous_month():
    now = datetime(2026, 10, 3, 5, 0, tzinfo=timezone.utc)
    buckets = [
        {
            "start_time": _stamp(2026, 9, 30),
            "results": [{"model": "gpt-image-2", "num_model_requests": 2, "images": 2}],
        },
        {
            "start_time": _stamp(2026, 10, 3),
            "results": [{"model": "gpt-image-2", "num_model_requests": 3, "images": 3}],
        },
    ]

    summary = summarize_image_buckets(buckets, now=now)

    assert summary["today_requests"] == 3
    assert summary["month_requests"] == 3
    assert summary["month_images"] == 3
    assert summary["by_model"] == [{"model": "gpt-image-2", "requests": 3, "images": 3}]


def test_openai_cost_fetch_requires_admin_key(monkeypatch):
    monkeypatch.delenv("OPENAI_ADMIN_KEY", raising=False)

    with pytest.raises(OpenAIAdminUsageError) as exc_info:
        _fetch_pages(OPENAI_COSTS_URL, {"start_time": 0})

    assert exc_info.value.code == "OPENAI_ADMIN_KEY_MISSING"
    assert exc_info.value.status_code == 503


def test_admin_ai_cost_route_rejects_non_admin_claim(monkeypatch):
    monkeypatch.setattr(
        auth_utils.auth,
        "verify_id_token",
        lambda token: {"uid": "approved-but-not-admin", "admin": False},
    )

    response = main.flask_app.test_client().get(
        "/api/admin/ai-costs",
        headers={"Authorization": "Bearer test-token"},
    )

    assert response.status_code == 403
    assert response.get_json()["detail"] == "관리자 권한이 필요합니다."


def test_admin_ai_cost_route_returns_exact_and_internal_summaries(monkeypatch):
    monkeypatch.setattr(
        auth_utils.auth,
        "verify_id_token",
        lambda token: {"uid": "admin-user", "admin": True},
    )
    monkeypatch.setattr(
        admin_ai_usage,
        "load_program_studio_image_summary",
        lambda: {"month_requests": 12, "today_requests": 2},
    )
    monkeypatch.setattr(
        admin_ai_usage,
        "fetch_openai_billing_summary",
        lambda: {
            "available": True,
            "scope": "project",
            "costs": {"month_to_date": 1.25, "currency": "usd"},
        },
    )

    response = main.flask_app.test_client().get(
        "/api/admin/ai-costs",
        headers={"Authorization": "Bearer admin-token"},
    )
    payload = response.get_json()

    assert response.status_code == 200
    assert payload["available"] is True
    assert payload["costs"]["month_to_date"] == 1.25
    assert payload["program_studio"]["month_requests"] == 12


def test_admin_ai_cost_dashboard_contract():
    html = (ROOT / "admin.html").read_text(encoding="utf-8")
    client = (ROOT / "js" / "admin-ai-costs.js").read_text(encoding="utf-8")
    router = (ROOT / "backend" / "routers" / "admin_ai_usage.py").read_text(encoding="utf-8")
    auth = (ROOT / "backend" / "utils" / "auth.py").read_text(encoding="utf-8")
    preflight = (ROOT / "backend" / "routers" / "preflight_ai_design.py").read_text(encoding="utf-8")
    env = (ROOT / "backend" / ".env.example").read_text(encoding="utf-8")

    for marker in (
        'data-tab="aiCosts"',
        'id="aiCostToday"',
        'id="aiCostWeek"',
        'id="aiCostMonth"',
        'id="aiProgramMonth"',
        'id="aiCostDaily"',
        'id="aiCostLineItems"',
        'id="aiCostModels"',
        '/js/admin-ai-costs.js?v=20260922-1',
    ):
        assert marker in html

    assert "const API_PATH='/api/admin/ai-costs'" in client
    assert "getIdToken()" in client
    assert "OpenAI Costs API" in html
    assert "@require_admin" in router
    assert "_PUBLIC_OPENAI_ADMIN_ERRORS" in router
    assert '"detail": str(exc)' not in router
    assert "def require_admin" in auth
    assert 'decoded.get("admin") is not True' in auth
    assert preflight.count("record_image_generation(result)") == 2
    assert "OPENAI_ADMIN_KEY=" in env
    assert "OPENAI_PROJECT_ID=" in env
