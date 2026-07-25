import os
import firebase_admin

if not firebase_admin._apps:
    firebase_admin.initialize_app(options={
        "storageBucket": os.environ.get("FIREBASE_STORAGE_BUCKET", "program-tool.firebasestorage.app"),
    })

# Apply PDF text renderers and result guards before route imports.
from services import pdf_divider_alignment_patch  # noqa: F401,E402
from services import pdf_text_font_patch  # noqa: F401,E402
from services import pdf_individual_margin_patch  # noqa: F401,E402
from services import pdf_page_number_reserve_patch  # noqa: F401,E402
from services import pdf_range_guard_patch  # noqa: F401,E402
from services import preflight_reliability_patch  # noqa: F401,E402

from flask import Flask, jsonify
from routers.pdf import pdf_bp
from routers.pdf_tools import pdf_tools_bp
from routers.preflight import preflight_bp
# Route modules are loaded now; prevent legacy request hooks from replacing the
# Korean-capable divider renderer installed above.
from services import pdf_route_integrity_patch  # noqa: F401,E402
# The repair patch replaces the route module's normalizer after that module is loaded.
from services import preflight_repair_patch  # noqa: F401,E402
# Legacy PDF patch modules may replace pdf_ops.process_pdf while importing. Reapply
# the common engine only after all patches and routes have completed initialization.
from services import install_common_engine_entrypoint  # noqa: E402

install_common_engine_entrypoint()

from firebase_functions import https_fn, options
from utils.permissions import AccessError, require_program_access_for_request

flask_app = Flask(__name__)
# Multipart direct uploads are intentionally limited below the Storage-based
# processing ceiling. The PDF router enforces a 200 MB aggregate direct-upload
# limit, while this small allowance covers multipart boundaries and settings.
flask_app.config["MAX_CONTENT_LENGTH"] = 210 * 1024 * 1024
flask_app.register_blueprint(pdf_bp, url_prefix="/api/pdf")
flask_app.register_blueprint(pdf_tools_bp, url_prefix="/api/pdf-tools")
flask_app.register_blueprint(preflight_bp, url_prefix="/api/preflight")


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
