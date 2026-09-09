from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]
QUICKBAR = ROOT / "js" / "pdf-editor" / "direct-page-edit-quickbar.js"
RUNTIME = ROOT / "js" / "pdf-editor" / "advanced-runtime.js"


def source(path: Path) -> str:
    return path.read_text(encoding="utf-8")


def test_advanced_editor_exposes_output_size_picker_and_custom_dimensions():
    js = source(QUICKBAR)

    assert 'id="pdfAdvancedSizeSelectV2"' in js
    for value in ("a4", "a5", "a3", "b4", "b5", "letter", "custom"):
        assert f'<option value="{value}">' in js
    assert 'id="pdfAdvancedCustomWV2"' in js
    assert 'id="pdfAdvancedCustomHV2"' in js
    assert "const A5_SIZE={width:148,height:210};" in js
    assert "emit(paper,'change')" in js


def test_advanced_intro_is_replaced_and_hidden_when_preview_pages_are_laid_out():
    js = source(QUICKBAR)

    assert "PDF 고급 편집" in js
    assert "왼쪽에서 PDF 파일을 불러와 주세요." in js
    assert "const hasPreview=Boolean(scroll.querySelector('.page-preview'));" in js
    assert "const hide=hasPreview||hasPages;" in js
    assert "pdfAdvancedPreviewIntro" in js


def test_advanced_preview_autofit_uses_real_workspace_and_larger_page_gap():
    js = source(QUICKBAR)

    assert '#previewScroll .preview-row{gap:14px!important}' in js
    assert "const availableWidth=Math.max(80,scroll.clientWidth-24);" in js
    assert "const availableHeight=Math.max(80,scroll.clientHeight-24);" in js
    assert "const pairGap=14;" in js
    assert "const fit=Math.min(widthZoom,heightZoom)*.985;" in js
    assert "scheduleAutoFit([100,260,520,900]);" in js
    assert "window.addEventListener('resize'" in js


def test_advanced_runtime_busts_cache_for_preview_polish_script():
    runtime = source(RUNTIME)

    assert "/js/pdf-editor/direct-page-edit-quickbar.js?v=20260909-2" in runtime
    assert ".then(()=>loadAdvancedWorkspaceUx())" in runtime
    assert ".then(()=>loadDirectPageEditQuickbar())" in runtime
