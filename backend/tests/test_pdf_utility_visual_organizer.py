from pathlib import Path

import fitz
import pytest

from routers.pdf_utility_visual import _normalize_visual_plan, _organize_pdf_bytes


ROOT = Path(__file__).resolve().parents[2]
FRONTEND = ROOT / "js" / "pdf-utility" / "page-visual-organizer.js"
RUNTIME = ROOT / "js" / "pdf-preflight" / "route-runtime.js"
ROUTER_INIT = ROOT / "backend" / "routers" / "__init__.py"
SERVER = ROOT / "backend" / "routers" / "pdf_utility_visual.py"


def _pdf_bytes(page_count: int = 4) -> bytes:
    doc = fitz.open()
    try:
        for index in range(page_count):
            page = doc.new_page(width=180, height=240)
            page.insert_text((24, 50), f"VISUAL SOURCE {index + 1}", fontsize=14)
        return doc.tobytes(garbage=4, deflate=True)
    finally:
        doc.close()


def test_visual_plan_preserves_order_and_normalizes_rotations():
    pages, rotations = _normalize_visual_plan([4, 1, 3], {"4": 90, "1": -90, "3": 360}, 4)
    assert pages == [4, 1, 3]
    assert rotations == {4: 90, 1: 270}


@pytest.mark.parametrize(
    "order,rotations,message",
    [
        ([], {}, "순서"),
        ([1, 1], {}, "두 번"),
        ([5], {}, "전체 4페이지"),
        ([1], {"2": 90}, "현재 페이지 순서"),
        ([1], {"1": 45}, "90도 단위"),
    ],
)
def test_visual_plan_rejects_invalid_requests(order, rotations, message):
    with pytest.raises(ValueError, match=message):
        _normalize_visual_plan(order, rotations, 4)


def test_visual_organizer_applies_order_delete_and_rotation():
    output, count = _organize_pdf_bytes(_pdf_bytes(4), [4, 1, 3], {"4": 90, "1": 180})
    assert count == 3
    doc = fitz.open(stream=output, filetype="pdf")
    try:
        assert doc.page_count == 3
        assert "VISUAL SOURCE 4" in doc[0].get_text()
        assert "VISUAL SOURCE 1" in doc[1].get_text()
        assert "VISUAL SOURCE 3" in doc[2].get_text()
        assert doc[0].rotation % 360 == 90
        assert doc[1].rotation % 360 == 180
        assert doc[2].rotation % 360 == 0
    finally:
        doc.close()


def test_visual_frontend_is_thumbnail_local_first_and_accessible():
    source = FRONTEND.read_text(encoding="utf-8")
    for marker in (
        "thumbnail-local-first-with-server-fallback",
        "pdfjs-dist@${PDFJS_VERSION}",
        "pdf.worker.min.js",
        "draggable=true",
        "movePage",
        "rotatePage",
        "deletePage",
        "왼쪽 90도 회전",
        "오른쪽 90도 회전",
        "서버 업로드 없이",
        "/api/pdf-utility/organize-storage",
        "MAX_VISUAL_PAGES=300",
    ):
        assert marker in source


def test_visual_runtime_loads_after_text_page_organizer_without_changing_contract():
    runtime = RUNTIME.read_text(encoding="utf-8")
    text_pos = runtime.index("pdfUtilityPageOrganizeScriptV1")
    visual_pos = runtime.index("pdfUtilityVisualPageOrganizerScriptV1")
    assert text_pos < visual_pos
    assert "/js/pdf-utility/page-visual-organizer.js?v=20260904-1" in runtime
    assert "canonical-preflight-runtime-v1" in runtime


def test_visual_server_route_is_installed_on_canonical_blueprint_and_storage_scoped():
    init_source = ROUTER_INIT.read_text(encoding="utf-8")
    server = SERVER.read_text(encoding="utf-8")
    assert "_install_visual_organizer(_pdf_utility)" in init_source
    assert 'bp.add_url_rule(' in server
    assert '"/organize-storage"' in server
    assert "_validate_storage_path(uid, raw_path)" in server
    assert "_download_storage_pdf_to_path" in server
    assert "MAX_TOTAL_PAGES" in server
    assert "_delete_storage_paths([path])" in server
