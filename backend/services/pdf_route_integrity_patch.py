"""Prevent the PDF route's legacy divider patch from replacing the current renderer."""
from __future__ import annotations

from routers import pdf as pdf_router
from services import pdf_divider_alignment_patch as divider_patch
from services import pdf_ops


def preserve_current_divider_renderer() -> None:
    """Re-assert the full CJK/alignment renderer before each PDF request."""
    pdf_ops._render_divider_page = divider_patch._render_divider_page
    pdf_ops._divider_renderer_patched_v2 = True
    pdf_ops._program_studio_divider_renderer = True


pdf_router._patch_divider_renderer = preserve_current_divider_renderer
