from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]


def text(path: str) -> str:
    return (ROOT / path).read_text(encoding="utf-8")


def test_divider_modal_uses_narrow_controls_and_wide_preview():
    source = text("js/pdf-editor/divider-modal-layout.js")

    assert "grid-template-columns:264px minmax(0,1fr)!important" in source
    assert "width:min(1180px,calc(100vw - 28px))!important" in source
    assert "height:min(76vh,760px)!important" in source
    assert "pdfDividerStudioControlsV1" in source
    assert "pdfDividerStudioPreviewV1" in source


def test_divider_actions_move_into_existing_studio_controls_without_rebinding_events():
    source = text("js/pdf-editor/divider-modal-layout.js")

    assert "controls.appendChild(localPanel)" in source
    assert "controls.appendChild(footer)" in source
    assert ">.modal-footer" in source
    assert "position:sticky!important" in source
    assert "addEventListener('click'" not in source


def test_divider_layout_waits_for_studio_structure_before_moving_dom():
    source = text("js/pdf-editor/divider-modal-layout.js")

    assert "divider-studio-body" in source
    assert "divider-studio-controls" in source
    assert "divider-studio-preview" in source
    assert "pdfDividerLocalImagePanel" in source
    assert "if(!modal||!box||!body||!controls||!preview||!footer||!localPanel)return false;" in source
    assert "MutationObserver" in source
    assert "pdfDividerWidePreview='2'" in source
    assert "Array.from(box.children)" not in source
    assert "previewPane.appendChild" not in source
    assert "head.insertAdjacentElement" not in source


def test_route_uses_hotfix_cache_revision():
    route = text("js/pdf-editor/route-runtime.js")

    assert "/js/pdf-editor/divider-modal-layout.js?v=20260830-2" in route
