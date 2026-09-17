"""Router package initialization."""

from firebase_functions import options as _function_options

# AI cover generation reads OPENAI_API_KEY only from Cloud Secret Manager. The
# current backend is deployed as one shared HTTP API function, so the secret must
# be available to that function at deployment/runtime and is never shipped to the
# browser or committed to source control.
_function_options.set_global_options(secrets=["OPENAI_API_KEY"])

# Importing the PDF utility through this package gives us stable extension hooks
# while keeping the canonical public blueprint and shared limits in pdf_utility.py.
from . import pdf_utility as _pdf_utility
from .pdf_utility_background import install as _install_background_cleanup
from .pdf_utility_visual import install as _install_visual_organizer

_install_background_cleanup(_pdf_utility)
_install_visual_organizer(_pdf_utility)

# Print design features extend the canonical preflight blueprint so they inherit
# the same authentication/program-access boundary and remain removable as one module.
from . import preflight as _preflight
from .preflight_ai_design import install as _install_preflight_ai_design

_install_preflight_ai_design(_preflight)

# The advanced editor owns a separate blueprint and rendering engine, but it is
# nested under /api/pdf/advanced so it reuses only the shared authentication
# boundary. It does not register routes on the N-up/booklet implementation.
from .pdf import pdf_bp as _pdf_bp
from .pdf_advanced import pdf_advanced_bp as _pdf_advanced_bp
from .pdf_smart_layout import pdf_smart_layout_bp as _pdf_smart_layout_bp

_pdf_bp.register_blueprint(_pdf_advanced_bp, url_prefix="/advanced")
_pdf_bp.register_blueprint(_pdf_smart_layout_bp)
