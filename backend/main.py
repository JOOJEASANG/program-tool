import firebase_admin
firebase_admin.initialize_app()

from flask import Flask
from routers.pdf import pdf_bp
from routers.pdf_tools import pdf_tools_bp
from routers.preflight import preflight_bp
from routers.report import report_bp
from routers.invoice import invoice_bp
from routers.writing import writing_bp
from firebase_functions import https_fn, options

flask_app = Flask(__name__)
flask_app.register_blueprint(pdf_bp, url_prefix="/api/pdf")
flask_app.register_blueprint(pdf_tools_bp, url_prefix="/api/pdf-tools")
flask_app.register_blueprint(preflight_bp, url_prefix="/api/preflight")
flask_app.register_blueprint(report_bp, url_prefix="/api/report")
flask_app.register_blueprint(invoice_bp, url_prefix="/api/invoice")
flask_app.register_blueprint(writing_bp, url_prefix="/api/writing")

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
