import json
from pathlib import Path

from models.schemas import PageInfo

ROOT = Path(__file__).resolve().parents[2]
PDF_JS = ROOT / "js" / "pdf-editor"
HELPER = PDF_JS / "divider-helper.js"
STUDIO = PDF_JS / "divider-studio.js"
LOADER = PDF_JS / "loader.js"
BACKEND = ROOT / "backend" / "services" / "pdf_divider_renderer.py"


def source(path: Path) -> str:
    return path.read_text(encoding="utf-8")


def test_advanced_divider_studio_is_single_initialized_without_polling():
    helper = source(HELPER)
    studio = source(STUDIO)
    assert "__pdfEditorDividerHelperV4" in helper
    assert "__pdfDividerStudioV2" in studio
    assert "data-divider-studio" in helper
    assert "divider-studio.js?v=20260731-2" in helper
    assert "setInterval(" not in helper
    assert "setInterval(" not in studio
    assert "attempt < 16" in studio


def test_full_screen_divider_studio_restores_dynamic_text_layers():
    studio = source(STUDIO)
    for marker in (
        "divider-studio-modal",
        "divider-studio-body",
        "MAX_EXTRAS = 30",
        "MAX_TEXT_LENGTH = 500",
        "추가 텍스트 레이어",
        "data-action=\"up\"",
        "data-action=\"down\"",
        "data-action=\"hide\"",
        "data-action=\"lock\"",
        "data-action=\"delete\"",
        "data-key=\"rotation\"",
        "data-key=\"opacity\"",
    ):
        assert marker in studio


def test_divider_background_and_styles_are_not_forced_to_white():
    helper = source(HELPER)
    studio = source(STUDIO)
    assert "patched.noBg = patched.noBg !== false" in helper
    assert "ctx.fillStyle = source.noBg ? '#ffffff' : source.bg" in helper
    assert "source.style === 'band'" in helper
    assert "source.style === 'lines'" in helper
    assert "content.noBg = $('dividerNoBg') ? $('dividerNoBg').checked" in studio
    assert "content.extraTexts = collectExtras()" in studio
    assert "#dividerBg,label[for=\"dividerBg\"]{display:none" not in helper


def test_backend_explicit_renderer_supports_restored_studio_fields():
    backend = source(BACKEND)
    for marker in (
        "MAX_EXTRA_TEXTS = 30",
        "MAX_TEXT_LENGTH = 500",
        "extraTexts",
        "rotation",
        "italic",
        "opacity",
        "weight",
        'resolved_style == "band"',
        'resolved_style == "lines"',
    ):
        assert marker in backend


def test_maximum_bounded_layer_payload_fits_request_schema():
    payload = {
        "title": "제목",
        "subtitle": "부제목",
        "note": "메모",
        "extraTexts": [
            {
                "id": f"extra_{index}",
                "text": "가" * 500,
                "size": 18,
                "color": "#111827",
                "weight": 400,
                "italic": False,
                "align": "center",
                "x": 50,
                "y": 70,
                "opacity": 1,
                "rotation": 0,
                "hidden": False,
                "locked": False,
            }
            for index in range(30)
        ],
    }
    serialized = json.dumps(payload, ensure_ascii=False, separators=(",", ":"))
    assert 20_000 < len(serialized) < 50_000
    page = PageInfo(file_index=0, page_index=0, page_type="divider", divider_content=serialized)
    assert page.divider_content == serialized


def test_magnetic_hit_testing_uses_the_visible_vertical_offset():
    helper = source(HELPER)
    assert "const offset = n('dividerVOffset', 0);" in helper
    assert "['title', shifted(n('dividerTitleY', 45))]" in helper
    assert "['subtitle', shifted(n('dividerSubtitleY', 55))]" in helper
    assert "['note', shifted(n('dividerNoteY', 88))]" in helper


def test_loader_keeps_eight_direct_modules():
    loader = source(LOADER)
    assert "__pdfEditorModuleLoaderV18" in loader
    assert loader.count("'/js/pdf-editor/") == 8
    assert "divider-studio.js" not in loader
