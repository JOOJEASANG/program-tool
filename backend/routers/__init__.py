"""Router package initialization."""

# Importing the PDF utility through this package gives us stable extension hooks
# while keeping the canonical public blueprint and shared limits in pdf_utility.py.
from . import pdf_utility as _pdf_utility
from .pdf_utility_background import install as _install_background_cleanup
from .pdf_utility_visual import install as _install_visual_organizer

_install_background_cleanup(_pdf_utility)
_install_visual_organizer(_pdf_utility)

# The advanced editor owns a separate blueprint and rendering engine, but it is
# nested under /api/pdf/advanced so it reuses only the shared authentication
# boundary. It does not register routes on the N-up/booklet implementation.
from .pdf import pdf_bp as _pdf_bp
from .pdf_advanced import pdf_advanced_bp as _pdf_advanced_bp

_pdf_bp.register_blueprint(_pdf_advanced_bp, url_prefix="/advanced")
