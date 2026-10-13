"""Print production must reflect per-product physical canvas, fold dimensions and orientation."""
from pathlib import Path
import subprocess
from services.ai_cover_image import build_cover_prompt, normalize_cover_request

ROOT=Path(__file__).resolve().parents[2]


def source(path):
    return (ROOT/path).read_text(encoding='utf-8')


def test_product_geometry_behavior():
    r=subprocess.run(['node',str(ROOT/'backend/tests/design_product_geometry.cjs')],cwd=ROOT,text=True,capture_output=True)
    assert r.returncode==0,r.stdout+r.stderr
    assert 'product geometry behavior passed' in r.stdout


def test_four_production_settings_have_real_canvas_and_folds():
    page=source('ai-design-maker/index.html')
    js=source('js/ai-design-maker.js')
    geometry=source('js/design-product-geometry.js')
    controls=source('js/design-professional-controls.js')
    for key in ('flyerFormat','flyerOrientation','flyerPurpose','flyerStock','invitationFormat',
                'invitationOrientation','invitationFoldType','invitationFoldPosition',
                'leafletFormat','leafletFoldType','leafletPanelLeft','leafletPanelCenter',
                'leafletPanelRight','productCanvasBanner','productLiveMeasure'):
        assert f'id="{key}"' in page
        assert f"'{key}'" in js or f"'{key}'" in geometry or f"'{key}'" in controls
    assert "DesignProductGeometry?.adapt?.(base,WORKSHOP)" in js
    assert "DesignProductGeometry?.render?.(ctx,spec,scale" in js
    assert "s.panels.forEach(p=>{result[p.id]" in source('js/design-workspace-layers.js')
    assert "'folded'" in page and "'flat'" in page or 'value="folded"' in page
    assert 'roll-left' in page and 'roll-right' in page and 'accordion' in page
    assert 'spec.panels?.find(p=>p.id===surface)' in js
    assert "WORKSHOP==='invitation'" in js
    assert 'window.DesignProfessionalControls?.setup?.(options)' in source('js/design-workshop-modes.js')


def test_ai_generation_knows_asymmetric_panels_and_folds():
    leaflet=normalize_cover_request({
        'product_type':'leaflet','cover_mode':'spread','trim_width_mm':98,
        'trim_height_mm':210,'spine_mm':99.5,'panel_right_mm':99.5,
        'product_fold_type':'roll-left','bleed_mm':3,'style_request':'trifold print'
    })
    assert abs(leaflet.work_width_mm-303)<.001
    prompt=build_cover_prompt(leaflet)
    assert 'LEFT 98.00 mm' in prompt
    assert 'CENTER 99.50 mm' in prompt
    assert 'RIGHT 99.50 mm' in prompt
    assert 'roll-left' in prompt
    invitation=normalize_cover_request({
        'product_type':'invitation','cover_mode':'front_back','trim_width_mm':148,
        'trim_height_mm':210,'fold_position_mm':143,
        'product_fold_type':'half-fold','style_request':'event invite'
    })
    assert 'Fold the card at 143.00 mm' in build_cover_prompt(invitation)


def test_folded_invitation_keeps_one_spread_pdf_not_duplex_split():
    js=source('js/ai-design-maker.js')
    assert "WORKSHOP==='invitation'&&$('invitationFoldType')?.value==='flat'" in js
    assert 'window.DesignDuplexOutput.splitPdf(pdf,spec)' in js
    assert 'window.DesignDuplexOutput.pngZip(canvas,spec' in js
    assert 'spec.foldType' in js


def test_print_controls_persist_between_sessions():
    js=source('js/ai-design-maker.js')
    for key in ('flyerFormat','flyerOrientation','invitationFoldPosition',
                'leafletPanelCenter','leafletPanelRight'):
        assert f"'{key}'" in js
    assert "WORKSHOP==='invitation'" in js
    assert "LEAFLET_SIDE" in js
