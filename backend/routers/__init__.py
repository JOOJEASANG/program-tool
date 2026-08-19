"""Router package initialization."""

# Importing the PDF utility through this package gives us one stable hook to
# replace only its raster background-cleaning implementation. The public API,
# routes, limits and Storage handling remain in pdf_utility.py.
from . import pdf_utility as _pdf_utility
from .pdf_utility_background import install as _install_background_cleanup

_install_background_cleanup(_pdf_utility)
