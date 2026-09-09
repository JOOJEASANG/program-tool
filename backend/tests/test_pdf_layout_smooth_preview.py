from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]
SMOOTH = ROOT / "js" / "pdf-editor" / "layout-smooth-preview.js"
RUNTIME = ROOT / "js" / "pdf-editor" / "route-runtime.js"


def text(path: Path) -> str:
    return path.read_text(encoding="utf-8")


def test_standard_layout_loads_focused_preview_helper_only_for_layout_route():
    runtime = text(RUNTIME)
    smooth = text(SMOOTH)

    assert "pdfLayoutSmoothPreviewScriptV1" in runtime
    assert "/js/pdf-editor/layout-smooth-preview.js?v=20260909-1" in runtime
    assert "'pdfLayoutSmoothPreviewScriptV1'" in runtime
    assert "path.endsWith('/pdf-editor-advanced')" in smooth
    assert "if(advanced||!path.includes('/pdf-editor'))return;" in smooth


def test_layout_switches_to_windowed_preview_for_normal_multi_page_jobs():
    smooth = text(SMOOTH)

    for marker in (
        "const MIN_FOCUSED_PAGE_COUNT=8",
        "window.__pdfEditorFastMode=true",
        "PdfUploadOptimization",
        "syncAggregateMode",
        "pdf-import-committed",
        "PdfViewportLazyPreview",
        "lazy.requestRender(index)",
        "빠른 배치 미리보기 ON",
        "현재 출력면 주변만 표시",
        "layout-focused-window-preview-v1",
    ):
        assert marker in smooth


def test_layout_focused_preview_does_not_replace_export_or_document_state():
    smooth = text(SMOOTH)

    assert "downloadBtn.addEventListener" not in smooth
    assert "buildAllPages" not in smooth
    assert "parsedPages =" not in smooth
    assert "uploadedFiles =" not in smooth
    assert "setInterval(" not in smooth
    assert "eval(" not in smooth
