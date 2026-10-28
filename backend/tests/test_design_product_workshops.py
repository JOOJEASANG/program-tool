"""Production design studio: separate product workspaces and spine thickness."""
from pathlib import Path
import subprocess

ROOT = Path(__file__).resolve().parents[2]


def read(path):
    return (ROOT / path).read_text(encoding='utf-8')


def test_workspaces_are_enabled_and_use_shared_editor():
    page=read('ai-design-maker/index.html')
    editor=read('js/ai-design-maker.js')
    workshop=read('js/design-workshop-modes.js')
    home=read('js/pdf-suite-home-launcher.js')
    for studio in ('cover','flyer','invitation','leaflet'):
        assert f'data-studio="{studio}"' in page
        assert f"{studio}:" in workshop
    assert 'product-tab" type="button" disabled' not in page
    assert '/js/design-workshop-modes.js' in page
    assert "program-studio:ai-design-maker:'+WORKSHOP" in editor
    assert "WORKSHOP==='leaflet'?trimW" in editor
    assert 'leafletSidePicker' in page
    assert 'data-leaflet-side="inside"' in page
    assert "LEAFLET_SIDE" in editor
    assert '독립' not in home or "전단지" in home
    assert "AI_COVER_PATH" in editor
    assert "DesignWorkspaceLayers" in editor


def test_spine_auto_manual_controls_and_persisted_fields():
    page=read('ai-design-maker/index.html')
    editor=read('js/ai-design-maker.js')
    module=read('js/design-workshop-modes.js')
    for control in ('spine','spinePages','spineSheetThickness','spineAllowance','spineCalcResult','spineCalcFields'):
        assert f'id="{control}"' in page
    assert 'value="200"' in page
    assert 'value="0.10"' in page
    assert 'value="0"' in page
    assert 'value="auto" checked' in page
    assert 'value="manual"' in page
    assert 'spineCalcMode:' in editor
    assert "'spinePages','spineSheetThickness','spineAllowance'" in editor
    assert "const width = Math.round(((pages/2)*thickness+allowance)*10)/10;" in module
    assert 'if(recalc())change()' in module
    assert 'ctx.updateGeometry?.()' in module
    assert 'STORAGE_KEY_PREFIX' in editor


def test_spine_math_behavior():
    proc=subprocess.run(['node',str(ROOT/'backend/tests/design_workshop_calculator.cjs')],
                        cwd=ROOT,text=True,capture_output=True,check=False)
    assert proc.returncode==0,proc.stdout+proc.stderr
    assert 'calculator behavior passed' in proc.stdout


def test_duplex_output_is_two_pages_and_gallery_is_scoped():
    editor=read('js/ai-design-maker.js')
    output=read('js/design-duplex-output.js')
    page=read('ai-design-maker/index.html')
    for symbol in ('DesignDuplexOutput.splitPdf(pdf,spec)', 'DesignDuplexOutput.pngZip(canvas,spec', 'workshop:WORKSHOP', 'leafletSide:LEAFLET_SIDE'):
        assert symbol in editor
    assert "for(const sourceX of [shift,0])" in output
    assert "['front','back'].entries()" in output
    assert 'doc.addPage([sideWidth,height])' in output
    assert '01-front' in output and '02-back' in output
    assert 'design-duplex-output.js' in page
    assert 'designDuplexNotice' in page
    assert "item.workshop||'cover'" in editor
    assert "(privateData.workshop||'cover')!==WORKSHOP" in editor


def test_duplex_print_behavior():
    proc=subprocess.run(['node',str(ROOT/'backend/tests/design_duplex_output.cjs')],
                        cwd=ROOT,text=True,capture_output=True,check=False)
    assert proc.returncode==0,proc.stdout+proc.stderr
    assert 'duplex export behavior passed' in proc.stdout


def test_design_manual_documents_new_workflows():
    manual=read('js/program-manuals/ai-design-maker.js')
    assert "updated: '2026-10-28'" in manual
    for word in ('책표지','전단지','초대장','리플렛','200페이지','10.0mm','책등 자동 계산','책등 직접 입력'):
        assert word in manual


def test_product_preview_defaults_and_restored_modes():
    proc=subprocess.run(['node',str(ROOT/'backend/tests/design_workshop_preview_behavior.cjs')],
                        cwd=ROOT,text=True,capture_output=True,check=False)
    assert proc.returncode==0,proc.stdout+proc.stderr
    assert 'design workshop preview behavior passed' in proc.stdout


def test_design_canvas_tracks_product_scope_and_keeps_mockup_out_of_exports():
    editor=read('js/ai-design-maker.js')
    page=read('ai-design-maker/index.html')
    workshop=read('js/design-workshop-modes.js')
    scope=editor.split('function syncCoverMode()')[1].split('function syncSizeMode()')[0]
    assert 'DesignWorkshopModes?.normalizeMode?.(WORKSHOP,state.coverMode)' in scope
    assert 'querySelector(\'input[name="coverMode"]:checked\')' not in scope
    assert 'function surfaceName(side)' in editor
    assert 'drawProductPreviewScaffold(ctx,spec,fit.scale)' in editor
    assert '레이아웃 예시 · AI 배경 미생성' in editor
    assert 'state.generatedSpecKey===specKey(spec)' in editor
    assert 'state.background && state.generatedSpecKey !== specKey(spec)' in editor
    assert 'function normalizeMode(studio, mode)' in workshop
    assert '/js/design-workshop-modes.js?v=20261028-2' in page
    assert '/js/ai-design-maker.js?v=20261028-2' in page


def test_leaflet_side_selector_is_styled_and_nonredundant():
    page=read('ai-design-maker/index.html')
    css=read('css/ai-design-maker.css')
    mode=read('js/design-workshop-modes.js')
    assert 'id="leafletSideTitle">작업 면 선택' in page
    assert 'aria-label="리플렛 작업 면 전환"' in page
    assert 'aria-label="리플렛 겉면 3패널 편집"' in page
    assert 'aria-label="리플렛 안쪽면 3패널 편집"' in page
    assert 'class="leaflet-side-check"' in page
    assert 'id="coverScopeCard"' in page
    assert ".leaflet-side-options a.active{" in css
    assert ".leaflet-side-options a:focus-visible{" in css
    assert ".leaflet-side-options{display:grid" in css
    assert "$('coverScopeCard').hidden=studio==='leaflet'" in mode
    assert "link.classList.toggle('active',active)" in mode


def test_placeholder_bars_are_removed_without_hiding_print_guides():
    editor=read('js/ai-design-maker.js')
    page=read('ai-design-maker/index.html')
    scaffold=editor.split('function drawProductPreviewScaffold(ctx,spec,scale)')[1].split('function renderPreview()')[0]
    assert 'ctx.fillRect(x,b,w,th);' in scaffold
    assert 'ctx.fillRect(x+inset' not in scaffold
    assert 'ctx.fillRect(x+w*.68' not in scaffold
    assert 'ctx.fillRect(x+inset,b+inset' not in scaffold
    assert 'ctx.fillText(label' in scaffold
    assert 'line(ctx,spineX,b,spineX,b+th' in editor
    assert "if (!$('guideToggle')?.checked) return;" in editor
    assert '<i class="red"></i>도련' in page
