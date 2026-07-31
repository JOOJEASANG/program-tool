from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
LOADER = ROOT / "js" / "pdf-editor" / "loader.js"


def test_preview_toolbar_controls_are_width_bounded():
    source = LOADER.read_text(encoding="utf-8")
    assert "__pdfEditorModuleLoaderV17" in source
    assert "#perRowSelect" in source
    assert "width: 86px !important" in source
    assert "min-width: 86px !important" in source
    assert "max-width: 86px !important" in source
    assert "flex: 0 0 86px !important" in source
    assert "#previewInfo" in source
    assert "#previewPages" in source
    assert "text-overflow: ellipsis !important" in source
    assert "overflow: hidden !important" in source
    assert "미리보기 한 줄당 페이지 수" in source


def test_stable_pdf_module_count_is_unchanged():
    source = LOADER.read_text(encoding="utf-8")
    assert source.count("'/js/pdf-editor/") == 8
    assert "preview-controller.js" not in source
    assert "runtime-integrity.js" not in source
