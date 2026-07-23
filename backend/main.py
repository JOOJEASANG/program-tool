import os

import firebase_admin

firebase_admin.initialize_app(options={
    "storageBucket": os.environ.get(
        "FIREBASE_STORAGE_BUCKET", "program-tool.firebasestorage.app"
    ),
})

# Install shared PDF output behavior before route modules bind their function imports.
from services import pdf_divider_alignment_patch  # noqa: F401,E402
from services import pdf_text_font_patch  # noqa: F401,E402
from services import preflight_reliability_patch  # noqa: F401,E402

from flask import Flask, jsonify
from routers.pdf import pdf_bp
from routers.pdf_tools import pdf_tools_bp
from routers.preflight import preflight_bp

# This patch replaces a route-module helper and therefore runs after router import.
from services import preflight_repair_patch  # noqa: F401,E402

from firebase_functions import https_fn, options
from utils.permissions import AccessError, require_program_access_for_request


flask_app = Flask(__name__)
flask_app.config["MAX_CONTENT_LENGTH"] = 210 * 1024 * 1024
flask_app.register_blueprint(pdf_bp, url_prefix="/api/pdf")
flask_app.register_blueprint(pdf_tools_bp, url_prefix="/api/pdf-tools")
flask_app.register_blueprint(preflight_bp, url_prefix="/api/preflight")


@flask_app.before_request
def enforce_program_permissions():
    try:
        require_program_access_for_request()
    except AccessError as exc:
        return jsonify({"detail": str(exc)}), exc.status_code


@flask_app.route("/health")
def health():
    return {"status": "ok"}


@https_fn.on_request(
    memory=options.MemoryOption.GB_2,
    timeout_sec=300,
    max_instances=10,
)
def api(req: https_fn.Request) -> https_fn.Response:
    with flask_app.request_context(req.environ):
        return flask_app.full_dispatch_request()
