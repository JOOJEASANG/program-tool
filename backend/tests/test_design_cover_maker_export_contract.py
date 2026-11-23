"""The former AI cover creator was replaced with upload-first print finishing."""
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]


def read(path):
    return (ROOT / path).read_text(encoding="utf-8")


def test_active_program_contains_no_ai_generation_controls():
    html=read("ai-design-maker/index.html")
    for old in ('id="generateBtn"','id="additionalPrompt"','id="generationQuality"',
                'id="galleryBtn"','src="/js/ai-design-maker.js'):
        assert old not in html
    assert "인쇄 디자인 보완" in html
    assert 'src="/js/design-bleed-enhancer.js' in html


def test_upload_pdf_and_images_before_bleed_generation():
    html=read("ai-design-maker/index.html")
    js=read("js/design-bleed-enhancer.js")
    for marker in ('id="fileInput"','accept=".pdf,.png,.jpg,.jpeg,.webp',
                   'id="processBtn" disabled','id="fileInfo"','id="uploadZone"'):
        assert marker in html
    for marker in ("async function receiveFile(file)","function isValid()",
                   "if(!isValid()||state.preparing||state.loading)return",
                   "async function requestBleed(file, params)"):
        assert marker in js


def test_bleed_extends_outside_trim_not_inside_native_pdf():
    html=read("ai-design-maker/index.html")
    js=read("js/design-bleed-enhancer.js")
    svc=read("backend/services/design_bleed_extension.py")
    for marker in ('id="trimWidth"','id="trimHeight"','id="bleedMm"',
                   'id="edgeMode"','id="beforeCanvas"','id="afterCanvas"',
                   'id="confirmCheck"','id="saveBtn"'):
        assert marker in html
    assert "if(!state.resultBlob||!$('confirmCheck').checked" in js
    assert "page.set_trimbox(trim)" in svc
    assert "page.set_bleedbox(page.mediabox)" in svc
    assert "BORDER_RENDER_DPI = 300" in svc
    assert "show_pdf_page(trim, pdf, i" in svc


def test_guide_options_support_leaflet_invitation_and_cover_without_ai():
    html=read("ai-design-maker/index.html")
    js=read("js/design-bleed-enhancer.js")
    for key in ("cover","invitation","notice","flyer","leaflet2","leaflet3","other"):
        assert f'<option value="{key}">' in html
    assert "const divisions=type==='leaflet2'?2:type==='leaflet3'?3:0;" in js
    assert "AI 아웃페인팅이 아니므로" in html
    assert "id=\\"generateBtn\\"" not in html


def test_legacy_creator_runtime_not_loaded_even_if_preserved_as_archived_code():
    html=read("ai-design-maker/index.html")
    assert "design-workspace-layers.js" not in html
    assert "ai-design-print-export.js" not in html
    assert "design-workshop-modes.js" not in html
    assert read("js/ai-design-maker.js").startswith("/* Standalone AI Design Maker")
