import os

import firebase_admin
from firebase_functions import https_fn, options
from flask import Flask, jsonify

firebase_admin.initialize_app(options={
    "storageBucket": os.environ.get("FIREBASE_STORAGE_BUCKET", "program-tool.firebasestorage.app"),
})

from routers.access import access_bp
from routers.admin import admin_bp
from routers.pdf import pdf_bp
from routers.pdf_tools import pdf_tools_bp
from routers.preflight import preflight_bp
from utils.permissions import AccessError, require_program_access_for_request

flask_app = Flask(__name__)
flask_app.config["MAX_CONTENT_LENGTH"] = 210 * 1024 * 1024
flask_app.register_blueprint(access_bp, url_prefix="/api/access")
flask_app.register_blueprint(admin_bp, url_prefix="/api/admin")
flask_app.register_blueprint(pdf_bp, url_prefix="/api/pdf")
flask_app.register_blueprint(pdf_tools_bp, url_prefix="/api/pdf-tools")
flask_app.register_blueprint(preflight_bp, url_prefix="/api/preflight")


@flask_app.before_request
def enforce_program_permissions():
    try:
        require_program_access_for_request()
    except AccessError as exc:
        return jsonify({"detail": str(exc)}), exc.status_code


@flask_app.after_request
def add_security_headers(response):
    response.headers.setdefault("Cache-Control", "no-store")
    response.headers.setdefault("X-Content-Type-Options", "nosniff")
    return response


def _health_payload():
    return {
        "status": "ok",
        "service": "program-tool-api",
        "maxRequestMb": flask_app.config["MAX_CONTENT_LENGTH"] // (1024 * 1024),
    }


@flask_app.route("/health")
@flask_app.route("/api/health")
def health():
    return _health_payload()


@https_fn.on_request(
    memory=options.MemoryOption.GB_2,
    timeout_sec=300,
    max_instances=10,
)
def api(req: https_fn.Request) -> https_fn.Response:
    with flask_app.request_context(req.environ):
        return flask_app.full_dispatch_request()
