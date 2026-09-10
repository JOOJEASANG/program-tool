from __future__ import annotations

import re

import main
from flask import g
from utils.permissions import AccessError
from utils.storage import get_request_id
from werkzeug.exceptions import InternalServerError, RequestEntityTooLarge


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


def test_nested_pdf_routes_are_registered_in_the_real_flask_app():
    routes = {rule.rule for rule in main.flask_app.url_map.iter_rules()}

    assert "/api/pdf/advanced/process" in routes
    assert "/api/pdf/advanced/process-storage" in routes
    assert "/api/pdf/smart-layout" in routes


def test_persistent_pdf_cleanup_accepts_only_owner_session_source_paths():
    data = {
        "sessionId": "session_ab12",
        "storagePaths": [
            "pdf_sessions/owner-1/session_ab12/src_0.pdf",
            "pdf_sessions/owner-1/session_ab12/src_12.pdf",
            "pdf_sessions/other-user/session_ab12/src_0.pdf",
            "pdf_sessions/owner-1/other_session/src_0.pdf",
            "pdf_sessions/owner-1/session_ab12/not-source.pdf",
            "design_projects/owner-1/project/rev.design.json",
        ],
    }

    safe = main._normalize_document_paths(
        data,
        "storagePaths",
        uid="owner-1",
        collection_id="pdf_advanced_sessions",
    )

    assert safe == [
        "pdf_sessions/owner-1/session_ab12/src_0.pdf",
        "pdf_sessions/owner-1/session_ab12/src_12.pdf",
    ]


def test_persistent_pdf_cleanup_rejects_invalid_session_metadata():
    data = {
        "sessionId": "../other-user",
        "storagePaths": ["pdf_sessions/owner-1/session_ab12/src_0.pdf"],
    }

    assert main._normalize_document_paths(
        data,
        "storagePaths",
        uid="owner-1",
        collection_id="pdf_sessions",
    ) == []


def test_non_pdf_persistent_cleanup_paths_keep_existing_behavior():
    data = {"storagePath": "design_projects/owner-1/project/rev.design.json"}

    assert main._normalize_document_paths(
        data,
        "storagePath",
        uid="owner-1",
        collection_id="design_projects",
    ) == ["design_projects/owner-1/project/rev.design.json"]


def test_invalid_request_id_is_replaced():
    client = main.flask_app.test_client()
    response = client.get(
        "/api/health",
        headers={"X-Request-ID": "bad request id"},
    )

    request_id = response.headers["X-Request-ID"]
    assert request_id != "bad request id"
    assert REQUEST_ID_RE.fullmatch(request_id)


def test_request_id_is_shared_between_main_and_storage_helpers():
    with main.flask_app.test_request_context("/api/pdf/process"):
        primary = main._request_id()
        assert get_request_id() == primary
        assert g.api_request_id == primary
        assert g._shared_request_id == primary

    with main.flask_app.test_request_context("/api/pdf/process-storage"):
        shared = get_request_id()
        assert main._request_id() == shared
        assert g.api_request_id == shared
        assert g._shared_request_id == shared


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


def test_unhandled_api_error_is_json_and_does_not_leak_exception_text():
    with main.flask_app.test_request_context(
        "/api/pdf/process",
        method="POST",
        headers={"X-Request-ID": "error-test-123"},
    ):
        error = InternalServerError(
            original_exception=RuntimeError("sensitive internal failure")
        )
        response = main.handle_internal_server_error(error)
        response = main.apply_api_response_contract(response)

    payload = response.get_json()
    assert response.status_code == 500
    assert payload == {
        "detail": "요청 처리 중 오류가 발생했습니다.",
        "code": "INTERNAL_ERROR",
        "request_id": "error-test-123",
    }
    assert response.headers["X-Request-ID"] == "error-test-123"
    assert "sensitive internal failure" not in response.get_data(as_text=True)
