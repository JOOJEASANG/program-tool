"""Unified Design Studio: AI generation, local PDF/image placement and print check."""

from pathlib import Path
import subprocess

ROOT = Path(__file__).resolve().parents[2]
PAGE = ROOT / 'ai-design-maker' / 'index.html'
EDITOR = ROOT / 'js' / 'ai-design-maker.js'
LAYERS = ROOT / 'js' / 'design-workspace-layers.js'
VECTOR = ROOT / 'js' / 'ai-design-print-export.js'
HOME = ROOT / 'index.html'
BEHAVIOR = ROOT / 'backend' / 'tests' / 'test_design_workspace_layers_behavior.cjs'


def test_single_design_workspace_home_keeps_ai_and_integrates_file_inspection():
    home = HOME.read_text(encoding='utf-8')
    page = PAGE.read_text(encoding='utf-8')
    assert "name:'디자인 제작'" in home
    assert "{id:'print-checker'" not in home
    assert "data-ai-design-maker" in page
    for control in ('generateBtn', 'designLayerUpload', 'designLayerTarget',
                    'designLayerInspector', 'designReviewResults', 'exportBtn',
                    'designLayerX', 'designLayerY', 'designLayerW', 'designLayerH',
                    'designPdfPage'):
        assert f'id="{control}"' in page
    assert '/print-checker/' in page  # old detailed route stays usable
    assert 'design-workspace-layers.js' in page


def test_print_export_can_start_without_ai_background_and_preserves_source_pdf():
    editor = EDITOR.read_text(encoding='utf-8')
    vector = VECTOR.read_text(encoding='utf-8')
    layers = LAYERS.read_text(encoding='utf-8')
    assert 'DesignWorkspaceLayers?.hasLayers()' in editor
    assert 'DesignWorkspaceLayers.drawForExport(ctx,spec,ppm)' in editor
    assert 'async function drawForExport(ctx,s,scale)' in layers
    assert 'placedLayers:window.DesignWorkspaceLayers' in editor
    assert 'if(placedLayers?.hasLayers?.())await placedLayers.drawVector' in vector
    assert 'doc.embedPdf(item.bytes,[item.pageNumber-1])' in layers
    assert 'page.drawPage(pdfPages[0]' in layers
    assert 'doc.embedPng(item.bytes)' in layers
    assert 'doc.embedJpg(item.bytes)' in layers
    assert 'if(background?.naturalWidth)' in vector
    assert 'sourceImageFormat(layer.bytes)' in layers
    assert "if(item.imageFormat==='jpeg')" in layers
    assert "if(item.imageFormat==='png')" in layers
    assert 'editor?.isTopElementAt?.(e)' in layers
    assert 'editor?.hasNativeSelection?.()' in layers
    assert 'centerX-halfW<-.01' in layers
    assert 'const ratio=item.sourceW/item.sourceH' in layers
    manual=(ROOT / 'js/program-manuals/ai-design-maker.js').read_text(encoding='utf-8')
    assert "updated: '2026-10-28'" in manual
    assert '직접 배치한 PDF·이미지 레이어' in manual
    assert 'page.drawRectangle({x:0,y:0,width,height,color:lib.rgb(1,1,1)})' in vector


def test_local_import_geometry_does_not_depend_on_ai_requests():
    source = LAYERS.read_text(encoding='utf-8')
    assert 'async function importFiles(files)' in source
    assert "fitToTarget(layer,currentTarget())" in source
    assert "function effectiveDpi(item)" in source
    assert "canvas.addEventListener('pointerdown'" in source
    assert "canvas.addEventListener('pointermove'" in source
    assert "'designLayerLockRatio'" in source
    assert "'designLayerAngle'" in source
    assert "'designPdfPage'" in source
    assert 'fetch(' not in source  # uploads stay local; PDF.js script is public
    assert 'localStorage' not in source  # do not silently persist uploaded files


def test_design_workspace_layer_behavior():
    result = subprocess.run(
        ['node', str(BEHAVIOR)], cwd=ROOT, text=True, capture_output=True, check=False
    )
    assert result.returncode == 0, result.stderr or result.stdout
    assert 'design workspace layer behavior passed' in result.stdout
