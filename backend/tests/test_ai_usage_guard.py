from datetime import datetime, timedelta, timezone
from contextlib import contextmanager
from unittest.mock import Mock

import pytest
from flask import g

import main
from routers import preflight_ai_design
from services.ai_usage_guard import (
    POLICIES,
    AiUsageGuardError,
    _document_id,
    _reservation_update,
)


NOW = datetime(2026, 9, 21, 12, 0, tzinfo=timezone.utc)


def test_first_image_request_creates_bounded_lease_and_counter():
    update = _reservation_update(
        {}, now=NOW, policy=POLICIES["image"], token="token-1"
    )

    assert update["request_count"] == 1
    assert update["window_started_at"] == NOW
    assert update["active_token"] == "token-1"
    assert update["active_until"] == NOW + timedelta(minutes=6)


def test_concurrent_request_is_rejected_without_incrementing():
    state = {
        "window_started_at": NOW - timedelta(minutes=1),
        "request_count": 1,
        "active_until": NOW + timedelta(seconds=45),
    }

    with pytest.raises(AiUsageGuardError) as exc_info:
        _reservation_update(
            state, now=NOW, policy=POLICIES["image"], token="token-2"
        )

    assert exc_info.value.code == "AI_REQUEST_IN_PROGRESS"
    assert exc_info.value.status_code == 409
    assert exc_info.value.retry_after == 45


def test_sixth_image_request_in_ten_minutes_is_rate_limited():
    state = {
        "window_started_at": NOW - timedelta(minutes=4),
        "request_count": 5,
        "active_until": None,
    }

    with pytest.raises(AiUsageGuardError) as exc_info:
        _reservation_update(
            state, now=NOW, policy=POLICIES["image"], token="token-6"
        )

    assert exc_info.value.code == "AI_REQUEST_RATE_LIMITED"
    assert exc_info.value.status_code == 429
    assert exc_info.value.retry_after == 360


def test_expired_window_resets_request_counter():
    state = {
        "window_started_at": NOW - timedelta(minutes=11),
        "request_count": 99,
        "active_until": NOW - timedelta(seconds=1),
    }

    update = _reservation_update(
        state, now=NOW, policy=POLICIES["layout"], token="fresh-token"
    )

    assert update["request_count"] == 1
    assert update["window_started_at"] == NOW


def test_guard_document_id_does_not_expose_uid():
    uid = "private-user-id"
    document_id = _document_id(uid, "image")

    assert uid not in document_id
    assert len(document_id) == 64


def test_image_route_returns_retry_after_without_calling_provider(monkeypatch):
    def allow_request():
        g.uid = "approved-user"

    @contextmanager
    def blocked_guard(uid, kind):
        assert uid == "approved-user"
        assert kind == "image"
        raise AiUsageGuardError(
            "AI_REQUEST_RATE_LIMITED",
            status_code=429,
            retry_after=90,
        )
        yield

    provider = Mock()
    monkeypatch.setattr(main, "require_program_access_for_request", allow_request)
    monkeypatch.setattr(preflight_ai_design, "guard_ai_usage", blocked_guard)
    monkeypatch.setattr(preflight_ai_design, "generate_cover_image", provider)

    response = main.flask_app.test_client().post(
        "/api/preflight/ai-design/cover-image",
        json={"style_request": "clean report cover"},
        headers={"X-Request-ID": "guard-test-123"},
    )

    assert response.status_code == 429
    assert response.headers["Retry-After"] == "90"
    assert response.get_json() == {
        "detail": "짧은 시간에 AI 요청이 너무 많습니다. 잠시 후 다시 시도해 주세요.",
        "code": "AI_REQUEST_RATE_LIMITED",
        "request_id": "guard-test-123",
    }
    provider.assert_not_called()
