import logging
import os
import re
import uuid
from datetime import datetime, timedelta, timezone

import firebase_admin
import firebase_admin.storage as fa_storage

if not firebase_admin._apps:
    firebase_admin.initialize_app(options={
        "storageBucket": os.environ.get(
            "FIREBASE_STORAGE_BUCKET",
            "program-tool.firebasestorage.app",
        ),
    })

from firebase_functions import https_fn, options, scheduler_fn
from flask import Flask, g, jsonify, request
from werkzeug.exceptions import MethodNotAllowed, NotFound, RequestEntityTooLarge

import routers.pdf as pdf_router
import routers.pdf_utility as pdf_utility_router
import routers.preflight as preflight_router
from routers.pdf import pdf_bp
from routers.pdf_large_security import pdf_large_security_bp
from routers.pdf_tools import pdf_tools_bp
from routers.pdf_utility import pdf_utility_bp
from routers.pdf_utility_margin_crop import pdf_utility_margin_crop_bp
from routers.pdf_utility_tiling import pdf_utility_tiling_bp
from routers.preflight import preflight_bp
from routers.preflight_auto_fix import preflight_auto_fix_bp
from utils.permissions import AccessError, require_program_access_for_request


flask_app = Flask(__name__)
logger = logging.getLogger(__name__)
REQUEST_ID_PATTERN = re.compile(r"^[A-Za-z0-9._-]{8,64}$")
MIB = 1024 * 1024
PDF_STORAGE_FILE_BYTES = 200 * MIB
PDF_STORAGE_TOTAL_BYTES = 300 * MIB

# Storage and backend limits intentionally match. This avoids paying to accept a
# 500 MiB client object that a downstream PDF route should never need to process.
pdf_router.MAX_PDF_FILE_BYTES = PDF_STORAGE_FILE_BYTES
pdf_router.MAX_TOTAL_PDF_BYTES = PDF_STORAGE_TOTAL_BYTES
preflight_router.MAX_STORAGE_PDF_BYTES = PDF_STORAGE_FILE_BYTES
pdf_utility_router.MAX_FILE_BYTES = PDF_STORAGE_FILE_BYTES
pdf_utility_router.MAX_TOTAL_BYTES = PDF_STORAGE_TOTAL_BYTES

# Background raster work is intentionally more conservative than simple
# transfer/merge work because every page consumes CPU and memory.
pdf_utility_router.MAX_BACKGROUND_PAGES = 100
pdf_utility_router.MAX_BACKGROUND_PIXELS = 90_000_000
pdf_utility_router.BACKGROUND_DPI = 160

# Large PDFs use Firebase Storage. Direct multipart requests remain below the
# Cloud Functions request/response quota with a small boundary allowance.
flask_app.config["MAX_CONTENT_LENGTH"] = 25 * MIB
flask_app.register_blueprint(pdf_bp, url_prefix="/api/pdf")
flask_app.register_blueprint(pdf_tools_bp, url_prefix="/api/pdf-tools")
flask_app.register_blueprint(pdf_utility_bp, url_prefix="/api/pdf-utility")
flask_app.register_blueprint(pdf_large_security_bp, url_prefix="/api/pdf-utility")
flask_app.register_blueprint(pdf_utility_margin_crop_bp, url_prefix="/api/pdf-utility")
flask_app.register_blueprint(pdf_utility_tiling_bp, url_prefix="/api/pdf-utility")
flask_app.register_blueprint(preflight_bp, url_prefix="/api/preflight")
flask_app.register_blueprint(preflight_auto_fix_bp, url_prefix="/api/preflight")


def _request_id() -> str:
    cached = getattr(g, "api_request_id", None)
    if isinstance(cached, str) and cached:
        return cached
    supplied = (request.headers.get("X-Request-ID") or "").strip()
    request_id = (
        supplied
        if REQUEST_ID_PATTERN.fullmatch(supplied)
        else uuid.uuid4().hex[:16]
    )
    g.api_request_id = request_id
    return request_id


def _api_error(detail: str, status: int, code: str):
    response = jsonify({
        "detail": detail,
        "code": code,
        "request_id": _request_id(),
    })
    response.status_code = status
    return response


@flask_app.before_request
def enforce_program_permissions():
    _request_id()
    try:
        require_program_access_for_request()
    except AccessError as error:
        return _api_error(str(error), error.status_code, "ACCESS_DENIED")
    return None


@flask_app.after_request
def apply_api_response_contract(response):
    response.headers.setdefault("X-Request-ID", _request_id())
    response.headers.setdefault("X-Content-Type-Options", "nosniff")
    if request.path.startswith("/api/") or request.path == "/health":
        response.headers["Cache-Control"] = "no-store, max-age=0"
    return response


@flask_app.errorhandler(RequestEntityTooLarge)
def handle_request_too_large(error: RequestEntityTooLarge):
    del error
    return _api_error(
        "요청 용량이 허용 한도를 초과했습니다. 대용량 PDF는 임시 저장 방식으로 다시 시도해 주세요.",
        413,
        "REQUEST_TOO_LARGE",
    )


@flask_app.errorhandler(NotFound)
def handle_not_found(error: NotFound):
    if not request.path.startswith("/api/"):
        return error
    return _api_error("요청한 API 경로를 찾을 수 없습니다.", 404, "API_NOT_FOUND")


@flask_app.errorhandler(MethodNotAllowed)
def handle_method_not_allowed(error: MethodNotAllowed):
    if not request.path.startswith("/api/"):
        return error
    return _api_error(
        "이 API 경로에서 허용되지 않은 요청 방식입니다.",
        405,
        "METHOD_NOT_ALLOWED",
    )


@flask_app.route("/health")
@flask_app.route("/api/health")
def health():
    return {"status": "ok"}


@https_fn.on_request(
    memory=options.MemoryOption.GB_2,
    timeout_sec=300,
    min_instances=0,
    max_instances=2,
)
def api(req: https_fn.Request) -> https_fn.Response:
    with flask_app.request_context(req.environ):
        return flask_app.full_dispatch_request()


@scheduler_fn.on_schedule(schedule="every 1 hours")
def cleanup_temporary_pdfs(event: scheduler_fn.ScheduledEvent) -> None:
    """Delete abandoned PDF staging objects and generated results after 1 hour."""
    del event
    cutoff = datetime.now(timezone.utc) - timedelta(hours=1)
    bucket = fa_storage.bucket(
        os.environ.get(
            "FIREBASE_STORAGE_BUCKET",
            "program-tool.firebasestorage.app",
        )
    )
    for prefix in ("pdf_temp/", "preflight_temp/", "pdf_results/"):
        try:
            blobs = bucket.list_blobs(prefix=prefix)
            for blob in blobs:
                try:
                    updated = blob.updated
                    if updated is not None and updated <= cutoff:
                        blob.delete()
                except Exception:
                    logger.warning(
                        "Temporary object cleanup failed path=%s",
                        getattr(blob, "name", "unknown"),
                        exc_info=True,
                    )
        except Exception:
            logger.warning(
                "Temporary prefix cleanup failed prefix=%s",
                prefix,
                exc_info=True,
            )
