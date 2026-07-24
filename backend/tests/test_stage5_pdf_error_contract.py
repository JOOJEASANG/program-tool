from flask import Flask, Response

from routers import pdf as pdf_router


def _app() -> Flask:
    app = Flask(__name__)
    app.config["TESTING"] = True
    return app


def test_error_response_has_stable_code_and_request_id():
    app = _app()
    with app.test_request_context(
        "/api/pdf/process",
        headers={"X-Request-ID": "client-request-123"},
    ):
        response = pdf_router._error_response(
            "잘못된 요청입니다.",
            400,
            "PDF_INVALID_REQUEST",
        )

        assert response.status_code == 400
        assert response.get_json() == {
            "detail": "잘못된 요청입니다.",
            "code": "PDF_INVALID_REQUEST",
            "request_id": "client-request-123",
        }
        assert response.headers["X-Request-ID"] == "client-request-123"


def test_invalid_external_request_id_is_replaced():
    app = _app()
    with app.test_request_context(
        "/api/pdf/process",
        headers={"X-Request-ID": "bad id with spaces"},
    ):
        request_id = pdf_router._request_id()

        assert request_id != "bad id with spaces"
        assert len(request_id) == 16
        assert request_id.isalnum()


def test_request_id_is_reused_for_entire_request():
    app = _app()
    with app.test_request_context("/api/pdf/process"):
        first = pdf_router._request_id()
        second = pdf_router._request_id()

        assert first == second


def test_success_response_receives_request_id_header():
    app = _app()
    with app.test_request_context(
        "/api/pdf/process",
        headers={"X-Request-ID": "success-request-123"},
    ):
        response = pdf_router._attach_request_id(Response(b"%PDF", status=200))

        assert response.status_code == 200
        assert response.headers["X-Request-ID"] == "success-request-123"


def test_pdf_router_uses_structured_error_contract():
    source = open(pdf_router.__file__, encoding="utf-8").read()

    assert '"code": code' in source
    assert '"request_id": request_id' in source
    assert 'response.headers["X-Request-ID"]' in source
    assert "PDF_INTERNAL_ERROR" in source
    assert "Invalid settings:" not in source
    assert "Invalid request:" not in source
