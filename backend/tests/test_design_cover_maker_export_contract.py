from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]


def test_standalone_ai_design_maker_uses_300dpi_png_metadata_contract():
    source = (ROOT / "js/ai-design-maker.js").read_text(encoding="utf-8")
    assert "const EXPORT_DPI = 300" in source
    assert "type!=='pHYs'" in source
    assert "type==='IHDR'" in source
    assert "parts.push(phys)" in source
    assert "Math.round(dpi/0.0254)" in source
    assert "MAX_EXPORT_PIXELS" in source


def test_standalone_cover_export_keeps_print_typography_and_spine_rotation():
    source = (ROOT / "js/ai-design-maker.js").read_text(encoding="utf-8")
    assert "item.fontPt*EXPORT_DPI/72" in source
    assert "ctx.rotate(item.rotate*Math.PI/180)" in source
    assert "function vertical(" in source
    assert "spec.spine>=4" in source
    assert "spec.spine>=8" in source
    assert "spec.spine>=12" in source


def test_design_review_no_longer_loads_ai_maker_runtime():
    review = (ROOT / "print-checker/index.html").read_text(encoding="utf-8")
    maker = (ROOT / "ai-design-maker/index.html").read_text(encoding="utf-8")

    assert "design-cover-maker.js" not in review
    assert "design-cover-maker.css" not in review
    assert "디자인 검토/제작" not in review
    assert "<title>디자인 검토 · Program Studio</title>" in review

    assert 'data-ai-design-maker="cover-v1"' in maker
    assert 'id="previewCanvas"' in maker
    assert 'id="generateBtn"' in maker
    assert 'id="exportBtn"' in maker
    assert "/js/ai-design-maker.js?v=20260918-5" in maker


def test_ai_design_maker_has_easy_cover_workflow_and_diagnostics():
    page = (ROOT / "ai-design-maker/index.html").read_text(encoding="utf-8")
    source = (ROOT / "js/ai-design-maker.js").read_text(encoding="utf-8")

    for label in ("인쇄 규격", "표지 문구", "AI 디자인", "전체 펼침 미리보기", "AI 배경 생성", "300dpi PNG 저장"):
        assert label in page
    for field_id in ("trimW", "trimH", "spine", "bleed", "safeZone", "wingEnabled", "wingW"):
        assert f'id="{field_id}"' in page
    assert "localStorage.setItem(STORAGE_KEY" in source
    assert "request_id:" in source
    assert "AI 배경 생성 실패" in source
    assert "state.generatedSpecKey!==specKey(spec)" in source


def test_ai_design_preview_starts_transparent_and_fills_workspace():
    source = (ROOT / "js/ai-design-maker.js").read_text(encoding="utf-8")
    style = (ROOT / "css/ai-design-maker.css").read_text(encoding="utf-8")

    assert "ctx.clearRect(0,0,fit.width,fit.height)" in source
    assert "drawEmpty(" not in source
    assert "clientWidth || 1000) - 20" in source
    assert "clientHeight || 700) - 20" in source
    assert "background:transparent" in style
    assert "height:calc(100vh - 188px)" in style
    assert "padding:10px" in style
