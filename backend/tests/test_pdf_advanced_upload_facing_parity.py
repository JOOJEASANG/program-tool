from __future__ import annotations

from pathlib import Path

from models.advanced_schemas import AdvancedPageInfo, PdfAdvancedProcessRequest
from services import pdf_ops
from services.pdf_advanced_engine import _content_box


ROOT = Path(__file__).resolve().parents[2]


def test_advanced_upload_matches_layout_dropzone_contract():
    html = (ROOT / "pdf-editor-advanced" / "index.html").read_text(encoding="utf-8")
    css = (ROOT / "css" / "pdf-editor-advanced-parity.css").read_text(encoding="utf-8")
    helper = (ROOT / "js" / "pdf-editor-advanced" / "facing-upload.js").read_text(encoding="utf-8")

    assert 'id="uploadBtn" class="upload-zone"' in html
    assert "PDF 파일 클릭 또는 드래그" in html
    assert "여러 파일을 연속으로 추가할 수 있습니다" in html
    assert ".upload-zone" in css and "dashed" in css and ".drag-over" in css
    assert "dataTransfer" in helper and "dispatchEvent(new Event('change'" in helper


def test_advanced_facing_pages_swaps_even_page_margins():
    request = PdfAdvancedProcessRequest(
        pages=[
            AdvancedPageInfo(file_index=0, page_index=0),
            AdvancedPageInfo(file_index=0, page_index=1),
        ],
        margins={
            "left_mm": 10,
            "right_mm": 30,
            "top_mm": 4,
            "bottom_mm": 6,
            "facing_pages": True,
        },
    )

    odd = _content_box(400, 500, request, 0)
    even = _content_box(400, 500, request, 1)
    mm = pdf_ops.MM_TO_PT

    assert abs(odd.x0 - 10 * mm) < 1e-6
    assert abs((400 - odd.x1) - 30 * mm) < 1e-6
    assert abs(even.x0 - 30 * mm) < 1e-6
    assert abs((400 - even.x1) - 10 * mm) < 1e-6
    assert abs(odd.y0 - 4 * mm) < 1e-6
    assert abs((500 - even.y1) - 6 * mm) < 1e-6


def test_advanced_facing_contract_reaches_preview_and_final_output():
    html = (ROOT / "pdf-editor-advanced" / "index.html").read_text(encoding="utf-8")
    state = (ROOT / "js" / "pdf-editor-advanced" / "state.js").read_text(encoding="utf-8")
    preview = (ROOT / "js" / "pdf-editor-advanced" / "preview.js").read_text(encoding="utf-8")
    engine = (ROOT / "backend" / "services" / "pdf_advanced_engine.py").read_text(encoding="utf-8")

    assert 'id="facingPages"' in html
    assert "facing_pages: !!advancedState.margins.facingPages" in state
    assert "effectiveMargins(page)" in preview
    assert "mirroredPosition(pn.position, page)" in preview
    assert "headerLeft = facingEven ? hf.headerRight : hf.headerLeft" in preview
    assert "facing_pages = bool(request.margins.facing_pages)" in engine
    assert "apply_header_footer(" in engine and "facing_pages," in engine
    assert "apply_page_numbers(" in engine


def test_layout_sidebar_title_is_removed_by_route_runtime():
    runtime = (ROOT / "js" / "pdf-editor" / "route-runtime.js").read_text(encoding="utf-8")
    assert "removeStandardSidebarTitle" in runtime
    assert "PDF 문서 편집기" in runtime
    assert "title.remove()" in runtime
    assert "pdfLayoutSidebarTitleRemoved" in runtime
