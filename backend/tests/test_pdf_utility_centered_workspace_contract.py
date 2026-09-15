from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]


def test_centered_pdf_utility_contract():
    source = (ROOT / "js/pdf-suite/centered-workspace.js").read_text(encoding="utf-8")

    assert "const MAX_FILE_BYTES=500*MIB" in source
    assert "const MAX_TOTAL_BYTES=800*MIB" in source
    assert "CATEGORY_ORDER=['pages','convert','security','inspect']" in source
    assert "페이지 · 문서" in source
    assert "변환 · OCR" in source
    assert "편집 · 보안" in source
    assert "최적화 · 검사" in source
    assert "pdfUtilityCenteredUpload" in source
    assert "pdfUtilityCenteredCategories" in source
    assert "pdfUtilityCenteredModal" in source
    assert "pdfuc-categories{display:grid;grid-template-columns:repeat(4" in source
    assert "/api/pdf-utility/merge-storage" in source
    assert "/api/pdf-utility/extract-storage" in source
    assert "cloudfunctions.net/api" in source
    assert "SERVER_TIMEOUT_MS=9*60*1000" in source


def test_centered_workspace_is_loaded_by_pdf_suite_direct_hook():
    hook = (ROOT / "js/pdf-suite/direct-tool-hook.js").read_text(encoding="utf-8")

    assert "centered-workspace.js?v=20260915-1" in hook
    assert "ensureCenteredWorkspace" in hook
    assert "ProgramStudioPdfUtilityCentered" in hook


def test_backend_runtime_keeps_transient_utility_500_800_limits():
    main = (ROOT / "backend/main.py").read_text(encoding="utf-8")

    assert "PDF_UTILITY_FILE_BYTES = 500 * MIB" in main
    assert "PDF_UTILITY_TOTAL_BYTES = 800 * MIB" in main
    assert "timeout_sec=600" in main
    assert "memory=options.MemoryOption.GB_4" in main
