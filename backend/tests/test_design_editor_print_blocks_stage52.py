from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]
BLOCKS = ROOT / "js" / "design-editor" / "phase20-print-blocks.js"
REGISTER = ROOT / "js" / "sw-register.js"


def test_print_blocks_load_after_smart_snap():
    source = REGISTER.read_text(encoding="utf-8")
    assert "designEditorPrintBlocksScriptV1" in source
    assert "/js/design-editor/phase20-print-blocks.js?v=20260822-1" in source
    assert source.index("designEditorSmartSnapScriptV1") < source.index("designEditorPrintBlocksScriptV1")


def test_print_blocks_extend_existing_component_card_instead_of_adding_sidebar_clutter():
    source = BLOCKS.read_text(encoding="utf-8")
    assert "designComponentBlocksTools" in source
    assert "designPrintBlocksMore" in source
    assert "더 많은 전문 구성" in source
    assert "card.appendChild(details)" in source


def test_print_blocks_offer_high_value_one_click_components():
    source = BLOCKS.read_text(encoding="utf-8")
    for marker in (
        "강조 안내",
        "핵심 3정보",
        "사진 설명",
        "하단 기관 바",
        "insertHighlight",
        "insertKeyFacts",
        "insertPhotoCaption",
        "insertBrandBar",
        "cornerRadius",
        "titleStyle:'bar'",
        "icon:'calendar'",
        "icon:'pin'",
        "icon:'people'",
    ):
        assert marker in source


def test_photo_caption_requires_selected_image_and_blocks_remain_print_native():
    source = BLOCKS.read_text(encoding="utf-8")
    assert ".phase2-extra-object.selected" in source
    assert "item.type==='image'" in source
    assert "사진을 먼저 선택" in source
    assert "current.extras.push(shape" in source
    assert "current.elements.push" in source
    assert "DesignEditorDraftScope?.saveCurrent?.('professional-print-block')" in source
    assert "stage:'professional-one-click-print-block-presets'" in source
    assert "MutationObserver" not in source
    assert "setInterval(" not in source
    assert "eval(" not in source
