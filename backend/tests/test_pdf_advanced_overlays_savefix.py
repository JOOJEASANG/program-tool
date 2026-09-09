from __future__ import annotations

import base64
from pathlib import Path

import fitz

from models.advanced_schemas import AdvancedPageInfo, AdvancedPageOverlay, PdfAdvancedProcessRequest
from services.pdf_advanced_engine import process_advanced_pdf_bytes


ROOT = Path(__file__).resolve().parents[2]
ADVANCED_HTML = ROOT / "pdf-editor-advanced" / "index.html"
FIREBASE_BOOTSTRAP = ROOT / "js" / "pdf-editor-advanced" / "firebase-bootstrap.js"
OVERLAYS = ROOT / "js" / "pdf-editor-advanced" / "page-overlays.js"
OVERLAY_RESTORE = ROOT / "js" / "pdf-editor-advanced" / "page-overlay-session-restore.js"
ADVANCED_STATE = ROOT / "js" / "pdf-editor-advanced" / "state.js"
ADVANCED_SESSION = ROOT / "js" / "pdf-editor-advanced" / "session-persistence.js"
BACKEND_MAIN = ROOT / "backend" / "main.py"


def text(path: Path) -> str:
    return path.read_text(encoding="utf-8")


def _source_pdf() -> bytes:
    doc = fitz.open()
    page = doc.new_page(width=300, height=400)
    page.insert_text((30, 42), "SOURCE", fontsize=14)
    data = doc.tobytes(garbage=4, deflate=True)
    doc.close()
    return data


def _tiny_png_data_url() -> str:
    # Valid 1x1 PNG. Keeping this tiny makes the rendering test deterministic.
    encoded = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII="
    return "data:image/png;base64," + encoded


def test_advanced_standalone_bootstraps_auth_firestore_and_storage_for_edit_save():
    html = text(ADVANCED_HTML)
    bootstrap = text(FIREBASE_BOOTSTRAP)

    for marker in (
        "firebase-app-compat.js",
        "firebase-auth-compat.js",
        "firebase-firestore-compat.js",
        "firebase-storage-compat.js",
        "/js/pdf-editor-advanced/firebase-bootstrap.js?v=20260909-1",
    ):
        assert marker in html

    assert "window.auth=auth" in bootstrap
    assert "window.db=db" in bootstrap
    assert "window.ProgramAccessReady" in bootstrap
    assert "auth.setPersistence(firebase.auth.Auth.Persistence.LOCAL)" in bootstrap
    assert "user_permissions" in bootstrap
    assert "location.replace('/login.html')" in bootstrap


def test_advanced_text_image_tools_are_selected_page_only_and_bounded_for_performance():
    html = text(ADVANCED_HTML)
    overlays = text(OVERLAYS)

    assert "page-overlays.js?v=20260909-1" in html
    for marker in (
        "T 텍스트 추가",
        "▧ 이미지 추가",
        "MAX_OVERLAYS_PER_PAGE = 20",
        "MAX_IMAGE_DATA_CHARS = 550000",
        "MAX_SINGLE_IMAGE_CHARS = 340000",
        "const page = selectedPage()",
        "layer.replaceChildren()",
        "compressImage(file)",
        "checkpoint('텍스트 추가')",
        "checkpoint('이미지 추가')",
    ):
        assert marker in overlays

    # No polling loop or all-page overlay DOM is allowed in the lightweight path.
    assert "setInterval(" not in overlays
    assert "MutationObserver(" not in overlays


def test_inserted_overlays_participate_in_download_undo_and_saved_session_restore():
    state = text(ADVANCED_STATE)
    session = text(ADVANCED_SESSION)
    overlays = text(OVERLAYS)
    restore = text(OVERLAY_RESTORE)

    assert "overlays: clone(page.overlays || [])" in state
    assert "snapshotEditableState" in state
    assert "orientationSource: String(page.orientationSource || '')" in session
    assert "__PS_OVERLAYS_V1__" in overlays
    assert "reason||'')==='session-load'" in restore
    assert "page.overlays=saved.slice(0,20)" in restore


def test_persistent_cleanup_keeps_advanced_session_source_pdfs():
    backend = text(BACKEND_MAIN)
    assert '"pdf_advanced_sessions"' in backend
    assert "advanced_session_paths = _trim_firestore_group(" in backend
    assert "session_paths.update(advanced_session_paths)" in backend
    assert '_delete_old_orphans(bucket, "pdf_sessions/", session_paths, cutoff)' in backend


def test_advanced_overlay_contract_allows_blank_text_draft_but_rejects_invalid_image():
    draft = AdvancedPageOverlay(type="text", x=0.1, y=0.1, width=0.4, height=0.1, text="")
    assert draft.text == ""

    try:
        AdvancedPageOverlay(
            type="image",
            x=0.1,
            y=0.1,
            width=0.2,
            height=0.2,
            dataUrl="data:text/plain;base64,SGVsbG8=",
        )
    except ValueError as exc:
        assert "PNG" in str(exc) or "JPEG" in str(exc)
    else:
        raise AssertionError("invalid inserted image data must be rejected")


def test_advanced_engine_renders_text_and_image_overlays_into_final_pdf():
    request = PdfAdvancedProcessRequest(
        pages=[
            AdvancedPageInfo(
                file_index=0,
                page_index=0,
                overlays=[
                    AdvancedPageOverlay(
                        type="text",
                        x=0.10,
                        y=0.20,
                        width=0.70,
                        height=0.12,
                        text="OVERLAY TEST",
                        fontSize=18,
                        color="#111111",
                        align="left",
                    ),
                    AdvancedPageOverlay(
                        type="image",
                        x=0.65,
                        y=0.55,
                        width=0.15,
                        height=0.15,
                        dataUrl=_tiny_png_data_url(),
                        name="dot.png",
                    ),
                ],
            )
        ]
    )

    result = process_advanced_pdf_bytes([_source_pdf()], request)
    output = fitz.open(stream=result, filetype="pdf")
    try:
        page = output[0]
        assert "OVERLAY TEST" in page.get_text()
        assert len(page.get_images(full=True)) >= 1
    finally:
        output.close()


def test_overlay_image_example_remains_below_backend_binary_limit():
    payload = _tiny_png_data_url().split(",", 1)[1]
    assert len(base64.b64decode(payload)) < 300_000
