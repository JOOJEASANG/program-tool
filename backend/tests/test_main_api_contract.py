from __future__ import annotations

import re

import main
from utils.permissions import AccessError
from werkzeug.exceptions import RequestEntityTooLarge


REQUEST_ID_RE = re.compile(r"^[A-Za-z0-9._-]{8,64}$")


def test_health_response_has_trace_and_security_contract():
    client = main.flask_app.test_client()
    response = client.get(
        "/api/health",
        headers={"X-Request-ID": "health-test-123"},
    )

    assert response.status_code == 200
    assert response.get_json() == {"status": "ok"}
    assert response.headers["X-Request-ID"] == "health-test-123"
    assert response.headers["X-Content-Type-Options"] == "nosniff"
    assert response.headers["Cache-Control"] == "no-store, max-age=0"


def test_invalid_request_id_is_replaced():
    client = main.flask_app.test_client()
    response = client.get(
        "/api/health",
        headers={"X-Request-ID": "bad request id"},
    )

    request_id = response.headers["X-Request-ID"]
    assert request_id != "bad request id"
    assert REQUEST_ID_RE.fullmatch(request_id)


def test_permission_error_is_json_and_keeps_request_id(monkeypatch):
    def deny():
        raise AccessError("로그인이 필요합니다.", 401)

    monkeypatch.setattr(main, "require_program_access_for_request", deny)
    client = main.flask_app.test_client()
    response = client.post(
        "/api/pdf/process",
        headers={"X-Request-ID": "access-test-123"},
    )

    payload = response.get_json()
    assert response.status_code == 401
    assert payload == {
        "detail": "로그인이 필요합니다.",
        "code": "ACCESS_DENIED",
        "request_id": "access-test-123",
    }
    assert response.headers["X-Request-ID"] == "access-test-123"


def test_unknown_api_path_is_json():
    client = main.flask_app.test_client()
    response = client.get("/api/does-not-exist")

    payload = response.get_json()
    assert response.status_code == 404
    assert payload["code"] == "API_NOT_FOUND"
    assert payload["detail"] == "요청한 API 경로를 찾을 수 없습니다."
    assert payload["request_id"] == response.headers["X-Request-ID"]


def test_wrong_method_is_json(monkeypatch):
    monkeypatch.setattr(main, "require_program_access_for_request", lambda: None)
    client = main.flask_app.test_client()
    response = client.get("/api/pdf/process")

    payload = response.get_json()
    assert response.status_code == 405
    assert payload["code"] == "METHOD_NOT_ALLOWED"
    assert payload["request_id"] == response.headers["X-Request-ID"]


def test_oversized_request_handler_is_json():
    with main.flask_app.test_request_context(
        "/api/pdf/process",
        method="POST",
        headers={"X-Request-ID": "size-test-123"},
    ):
        response = main.handle_request_too_large(RequestEntityTooLarge())
        response = main.apply_api_response_contract(response)

    payload = response.get_json()
    assert response.status_code == 413
    assert payload["code"] == "REQUEST_TOO_LARGE"
    assert payload["request_id"] == "size-test-123"
    assert response.headers["X-Request-ID"] == "size-test-123"
    assert response.headers["Cache-Control"] == "no-store, max-age=0"
