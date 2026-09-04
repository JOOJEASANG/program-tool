"""Router package initialization."""

# Importing the PDF utility through this package gives us stable extension hooks
# while keeping the canonical public blueprint and shared limits in pdf_utility.py.
from . import pdf_utility as _pdf_utility
from .pdf_utility_background import install as _install_background_cleanup
from .pdf_utility_visual import install as _install_visual_organizer

_install_background_cleanup(_pdf_utility)
_install_visual_organizer(_pdf_utility)
