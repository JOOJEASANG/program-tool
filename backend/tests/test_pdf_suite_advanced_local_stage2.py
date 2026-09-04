from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]
ADVANCED = ROOT / "js" / "pdf-suite" / "advanced-tools.js"
HOSTING = ROOT / "scripts" / "prepare_hosting_dist.py"
SMOKE = ROOT / "tests" / "browser" / "pdf-suite-advanced-smoke.html"
RUNNER = ROOT / "scripts" / "run_phase5_browser_smoke.sh"


def test_advanced_pdf_suite_promotes_real_browser_local_capabilities():
    source = ADVANCED.read_text(encoding="utf-8")

    for marker in (
        "PDFJS_VERSION='3.11.174'",
        "MAX_COMPARE_PAGES=80",
        "MAX_REDACT_PAGES=80",
        "extractText",
        "getTextContent",
        "runCompare",
        "visualDifference",
        "getImageData",
        "영구 마스킹 · Redaction",
        "ctx.fillRect",
        "output.embedJpg",
        "output.addPage([base.width,base.height])",
        "getAttachments",
        "getMarkInfo",
        "getStructTree",
        "getOutline",
        "getPageLabels",
        "본문 텍스트 추출 · TXT",
        "접근성·태그 기본 검사",
        "책갈피·페이지 라벨 분석",
    ):
        assert marker in source

    assert "fetch(" not in source
    assert "XMLHttpRequest" not in source


def test_permanent_redaction_rebuilds_pages_from_raster_images_instead_of_copying_source_pages():
    source = ADVANCED.read_text(encoding="utf-8")

    assert "REDACTION_SCALE=2" in source
    assert "page.render({canvasContext:ctx,viewport,background:'#FFFFFF'})" in source
    assert "output.embedJpg" in source
    assert "out.drawImage(jpg" in source
    assert "copyPages(" not in source
    assert "원본 콘텐츠를 버린 래스터 PDF" in source
    assert "텍스트·벡터·링크·폼·첨부·메타데이터를 제거" in source


def test_hosting_injects_advanced_pdf_suite_runtime_and_phase5_runs_browser_smoke():
    hosting = HOSTING.read_text(encoding="utf-8")
    runner = RUNNER.read_text(encoding="utf-8")
    smoke = SMOKE.read_text(encoding="utf-8")

    for marker in (
        'PDF_SUITE_ADVANCED_MARKER = "data-pdf-suite-advanced-tools"',
        "/js/pdf-suite/advanced-tools.js?v=20260905-1",
        "PDF_SUITE_ADVANCED_SNIPPET",
        "_inject_before(suite, PDF_SUITE_ADVANCED_MARKER",
    ):
        assert marker in hosting

    assert "pdf-suite-advanced-smoke.html" in runner
    assert "dataset.pdfSuiteAdvancedSmoke='pass'" in smoke
