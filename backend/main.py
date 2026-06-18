import os
import firebase_admin

firebase_admin.initialize_app(options={
    "storageBucket": os.environ.get("FIREBASE_STORAGE_BUCKET", "program-tool.firebasestorage.app"),
})

from flask import Flask, jsonify
from routers.pdf import pdf_bp
from routers.pdf_tools import pdf_tools_bp
from routers.preflight import preflight_bp
from routers.report import report_bp
from routers.invoice import invoice_bp
from routers.writing import writing_bp
from firebase_functions import https_fn, options
from utils.permissions import AccessError, require_program_access_for_request

flask_app = Flask(__name__)
flask_app.config["MAX_CONTENT_LENGTH"] = 210 * 1024 * 1024
flask_app.register_blueprint(pdf_bp, url_prefix="/api/pdf")
flask_app.register_blueprint(pdf_tools_bp, url_prefix="/api/pdf-tools")
flask_app.register_blueprint(preflight_bp, url_prefix="/api/preflight")
flask_app.register_blueprint(report_bp, url_prefix="/api/report")
flask_app.register_blueprint(invoice_bp, url_prefix="/api/invoice")
flask_app.register_blueprint(writing_bp, url_prefix="/api/writing")


@flask_app.before_request
def enforce_program_permissions():
    try:
        require_program_access_for_request()
    except AccessError as e:
        return jsonify({"detail": str(e)}), e.status_code


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
