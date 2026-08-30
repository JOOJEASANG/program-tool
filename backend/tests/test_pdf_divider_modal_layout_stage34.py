from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]


def text(path: str) -> str:
    return (ROOT / path).read_text(encoding="utf-8")


def test_divider_modal_uses_narrow_controls_and_wide_preview():
    source = text("js/pdf-editor/divider-modal-layout.js")

    assert "grid-template-columns:264px minmax(0,1fr)" in source
    assert "width:min(1180px,calc(100vw - 32px))" in source
    assert "height:min(76vh,760px)" in source
    assert "pdfDividerStudioControlsV1" in source
    assert "pdfDividerStudioPreviewV1" in source


def test_divider_actions_move_into_left_controls_without_rebinding_events():
    source = text("js/pdf-editor/divider-modal-layout.js")

    assert "controls.appendChild(child)" in source
    assert "previewPane.appendChild(child)" in source
    assert "#${CONTROLS_ID} .modal-footer" in source
    assert "position:sticky" in source
    assert "addEventListener('click'" not in source


def test_divider_layout_waits_for_existing_image_layer_panel():
    source = text("js/pdf-editor/divider-modal-layout.js")

    assert "pdfDividerLocalImagePanel" in source
    assert "MutationObserver" in source
    assert "pdfDividerWidePreview='1'" in source
