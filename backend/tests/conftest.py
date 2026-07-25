"""Test-only compatibility for historical module imports.

Production code no longer exposes or registers the deleted layout patch module.
A few long-form regression suites still import its former path; map that path
only inside the pytest process until those suites are renamed independently.
"""
from __future__ import annotations

import sys

from services import pdf_layout_implementation

sys.modules.setdefault(
    "services.pdf_individual_margin_patch",
    pdf_layout_implementation,
)
