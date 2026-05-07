import firebase_admin
firebase_admin.initialize_app()

from flask import Flask
from routers.pdf import pdf_bp
from routers.preflight import preflight_bp
from firebase_functions import https_fn, options

flask_app = Flask(__name__)
flask_app.register_blueprint(pdf_bp, url_prefix="/api/pdf")
flask_app.register_blueprint(preflight_bp, url_prefix="/api/preflight")

@flask_app.route("/health")
def health():
    return {"status": "ok"}


@https_fn.on_request(
    memory=options.MemoryOption.GB_1,
    timeout_sec=300,
    max_instances=10,
)
def api(req: https_fn.Request) -> https_fn.Response:
    with flask_app.request_context(req.environ):
        return flask_app.full_dispatch_request()
