"""Cover-only design studio contract and spine calculator regression tests."""
from pathlib import Path
import subprocess

ROOT = Path(__file__).resolve().parents[2]

def read(path):
    return (ROOT / path).read_text(encoding='utf-8')

def run_node(path):
    result = subprocess.run(
        ['node', str(ROOT / path)],
        cwd=ROOT, text=True, capture_output=True, check=False,
    )
    assert result.returncode == 0, result.stdout + result.stderr
    return result.stdout

def test_cover_only_ui_and_home_description():
    page = read('ai-design-maker/index.html')
    home = read('js/pdf-suite-home-launcher.js')
    manual = read('js/program-manuals/ai-design-maker.js')
    css = read('css/ai-design-maker.css')
    assert '<title>표지 디자인 · Program Studio</title>' in page
    assert '<strong>표지 디자인</strong>' in page
    assert 'id="coverScopeCard"' in page
    assert 'id="spineCalculator"' in page
    for mode in ('front', 'back', 'frontBack', 'spread'):
        assert f'name="coverMode" value="{mode}"' in page
    assert 'data-studio=' not in page
    assert 'leafletSidePicker' not in page
    assert 'designDuplexNotice' not in page
    assert 'design-duplex-output.js' not in page
    assert '.product-tabs' not in css
    assert '.leaflet-side-picker' not in css
    assert "catLabel:'디자인 제작 · 표지 전용'" in home
    assert "name:'디자인 제작'" in home
    assert '책표지 디자인 전용 작업실' in manual
    for removed in ('전단지', '초대장', '리플렛'):
        assert removed not in manual

def test_runtime_restricts_legacy_product_urls_and_retains_cover_storage_key():
    editor = read('js/ai-design-maker.js')
    modes = read('js/design-workshop-modes.js')
    page = read('ai-design-maker/index.html')
    assert "const WORKSHOP = 'cover'" in editor
    assert "program-studio:ai-design-maker:'+WORKSHOP+':v2'" in editor
    assert "const LEGACY_STORAGE_KEY = 'program-studio:ai-design-maker:cover:v1'" in editor
    assert "product_type:WORKSHOP" in editor
    assert "window.DesignWorkshopModes?.normalizeMode?.(WORKSHOP,state.coverMode)" in editor
    assert "const normalizeMode=(_studio,mode)=>COVER_MODES.has(mode)?mode:'spread'" in modes
    assert "const width = Math.round(((pages/2)*thickness+allowance)*10)/10;" in modes
    assert '/js/design-workshop-modes.js?v=20261028-3' in page
    assert '/js/ai-design-maker.js?v=20261028-3' in page
    for removed in ("WORKSHOP==='flyer'", "WORKSHOP==='invitation'",
                    "WORKSHOP==='leaflet'", "DesignDuplexOutput", "LEAFLET_SIDE"):
        assert removed not in editor

def test_cover_spine_and_preview_modes_behave():
    assert 'calculator behavior passed' in run_node('backend/tests/design_workshop_calculator.cjs')
    assert 'cover-only design studio behavior passed' in run_node('backend/tests/design_workshop_preview_behavior.cjs')

def test_preview_keeps_guides_and_removes_fake_decorative_bars():
    editor = read('js/ai-design-maker.js')
    scaffold = editor.split('function drawProductPreviewScaffold(ctx,spec,scale)')[1].split('function renderPreview()')[0]
    assert 'ctx.fillRect(x,b,w,th);' in scaffold
    assert 'ctx.fillText(label' in scaffold
    assert 'ctx.fillRect(x+inset' not in scaffold
    assert "if (!$('guideToggle')?.checked) return;" in editor
    assert 'drawGuides(ctx,spec,fit.scale)' in editor
    assert 'state.generatedSpecKey===specKey(spec)' in editor

def test_existing_cover_pdf_and_image_exports_are_kept():
    editor=read('js/ai-design-maker.js')
    assert "DesignWorkspaceLayers?.hasLayers()" in editor
    assert "window.ProgramStudioPrintExport.create(" in editor
    assert "function exportPng()" in editor
    assert "async function exportPdf(vector=true)" in editor
    assert "WORKSHOP==='flyer'" not in editor
    assert "WORKSHOP==='invitation'" not in editor
    assert "imageModel" in editor
