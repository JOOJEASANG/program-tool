from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]
MODULE = ROOT / "js" / "pdf-print-readiness.js"
APP_VERSION = ROOT / "js" / "app-version.js"


def test_print_readiness_module_is_loaded_only_for_pdf_utility():
    source = APP_VERSION.read_text(encoding="utf-8")
    assert "pdfPrintReadinessScriptV1" in source
    assert "/js/pdf-print-readiness.js?v=20260824-1" in source
    assert "currentPath==='/pdf-preflight'" in source


def test_print_readiness_covers_real_print_room_decisions():
    source = MODULE.read_text(encoding="utf-8")
    for marker in (
        "인쇄 실무 판정",
        "일반 인쇄",
        "양면 출력",
        "중철 · 소책자",
        "중철 시 빈 페이지",
        "PDF 편집기에서 페이지 정리",
        "font_embed",
        "dpi",
        "page_size",
        "bleed",
        "safe_margin",
        "color_mode",
        "transparency",
    ):
        assert marker in source


def test_booklet_padding_uses_four_page_signature_math():
    source = MODULE.read_text(encoding="utf-8")
    assert "const add = (4 - (pageCount % 4)) % 4;" in source
    assert "pageCount + add" in source


def test_readiness_does_not_change_backend_preflight_score_contract():
    source = MODULE.read_text(encoding="utf-8")
    assert "compute_score" not in source
    assert "apiPreflightCheck" not in source
    assert "utility.state?.reports" in source
    assert "stage: 'print-ops-stage1'" in source
