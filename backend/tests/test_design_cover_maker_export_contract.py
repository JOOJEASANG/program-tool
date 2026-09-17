from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]


def test_cover_maker_uses_single_300dpi_png_metadata_contract():
    source = (ROOT / "js/print-checker/design-cover-maker.js").read_text(encoding="utf-8")
    assert "const EXPORT_DPI = 300" in source
    assert "type !== 'pHYs'" in source
    assert "type === 'IHDR'" in source
    assert "parts.push(phys)" in source
    assert "Math.round(dpi / 0.0254)" in source
    assert "shared-preview-canvas-v3" in source


def test_cover_export_keeps_exact_print_typography_and_spine_rotation():
    source = (ROOT / "js/print-checker/design-cover-maker.js").read_text(encoding="utf-8")
    assert "item.fontPt * EXPORT_DPI / 72" in source
    assert "ctx.rotate(item.rotate * Math.PI / 180)" in source
    assert "drawVerticalText" in source
    assert "spec.spine >= 4" in source
    assert "spec.spine >= 8" in source
    assert "spec.spine >= 12" in source


def test_ai_cover_reuses_review_canvas_and_review_spec_inputs():
    page = (ROOT / "print-checker/index.html").read_text(encoding="utf-8")
    source = (ROOT / "js/print-checker/design-cover-maker.js").read_text(encoding="utf-8")

    assert '<canvas id="previewCanvas"></canvas>' in page
    assert "$('previewCanvas')" in source
    assert "cmStage" not in source
    assert "coverMakerWorkspace" not in source

    # Review form is the single source of truth for AI cover geometry.
    for field_id in ("trimW", "trimH", "spine", "bleed", "safeZone", "hasWing", "wingW"):
        assert f"'{field_id}'" in source

    assert "cover-maker-dialog" in source
    assert "현재 검토 옵션으로 AI 배경 생성" in source
    assert "검토에서 설정한 완성사이즈, 책등, 도련, 안전영역, 날개 폭을 그대로 사용합니다." in source


def test_legacy_beta_and_split_workspace_runtime_are_not_loaded():
    page = (ROOT / "print-checker/index.html").read_text(encoding="utf-8")
    geometry = (ROOT / "js/print-checker/design-review-step1.js").read_text(encoding="utf-8")
    assert "ai-design-beta.js" not in page
    assert "print-checker-ai-design.css" not in page
    assert "design-review-step1.js?v=20260917-3" in page
    assert "design-cover-maker.js?v=20260917-3" in page
    assert "design-cover-maker.css?v=20260917-2" in page
    assert "aiDesignLaunch" not in geometry
    assert "aiExportPng" not in geometry
