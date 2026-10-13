"""Design studio: product-specific workspaces and sheet-count spine calculation."""

from pathlib import Path

import pytest

from services.ai_cover_image import build_cover_prompt, normalize_cover_request

ROOT = Path(__file__).resolve().parents[2]
PAGE = (ROOT / "ai-design-maker/index.html").read_text(encoding="utf-8")
SCRIPT = (ROOT / "js/ai-design-maker.js").read_text(encoding="utf-8")
CSS = (ROOT / "css/ai-design-maker.css").read_text(encoding="utf-8")
MANUAL = (ROOT / "js/program-manuals/ai-design-maker.js").read_text(encoding="utf-8")


@pytest.mark.parametrize("product", ("cover", "flyer", "invitation", "leaflet"))
def test_each_design_workspace_is_selectable_and_preserved(product: str):
    assert f'data-design-product="{product}"' in PAGE
    assert f"state.productType==='{product}'" in SCRIPT or (
        product in ("flyer", "invitation") and
        "state.productType==='flyer'||state.productType==='invitation'" in SCRIPT
    )
    assert "next.searchParams.set('product',target)" in SCRIPT
    assert 'id="designPrintFace"' in PAGE
    assert 'data-print-face="inside"' in PAGE
    assert 'data-print-face="outside"' in PAGE
    assert "next.searchParams.set('face',target)" in SCRIPT
    assert "state.designFace==='inside'?':inside':''" in SCRIPT
    assert "state.productType==='cover'?'':':'+state.productType" in SCRIPT
    assert "product_type:spec.productType" in SCRIPT
    assert f"{product}:" in SCRIPT


def test_design_workspaces_have_real_geometry_and_editing():
    assert "name=\"coverMode\" value=\"frontBack\"" in PAGE
    assert "name=\"coverMode\" value=\"spread\"" in PAGE
    assert "id=\"middleText\"" in PAGE
    assert "id=\"middlePanelFields\"" in PAGE
    assert "id=\"designLayerUpload\"" in PAGE
    assert "id=\"designReviewResults\"" in PAGE
    assert "id=\"exportBtn\"" in PAGE
    assert "productType==='leaflet' ? trimW" in SCRIPT
    assert "3단 접지 리플렛" in SCRIPT
    assert "2단 접이식 초대장" in SCRIPT
    assert "function drawGuides(ctx,spec,scale)" in SCRIPT
    assert "surface:'middle'" in SCRIPT
    assert "html[data-design-product=\"flyer\"] #spineFields" in CSS
    assert "직접 배치한 PDF·이미지 레이어" in MANUAL


def test_spine_auto_calculation_is_default_and_manual_is_preserved():
    for id_, value in (
        ("spinePageCount", 'value="200"'),
        ("spinePaperThickness", 'value="0.10"'),
        ("spineBindingAllowance", 'value="0"'),
    ):
        assert f'id="{id_}"' in PAGE
        assert value in PAGE
    assert 'name="spineInputMode" value="auto" checked' in PAGE
    assert 'name="spineInputMode" value="manual"' in PAGE
    assert "Math.ceil(rawPages/2)" in SCRIPT
    assert "leaves*rawPaper+rawAllowance" in SCRIPT
    assert "spine.value=result.toFixed(1)" in SCRIPT
    assert "spine.readOnly=auto" in SCRIPT
    assert "state.spineCalculationMode=data.spineCalculationMode==='manual'" in SCRIPT
    assert "state.spineManualValue=clamp(data.spineManualValue ?? data.spine ?? 10" in SCRIPT
    assert "syncSpineCalculator();saveLocal();updateGeometry();scheduleRender()" in SCRIPT
    assert "200쪽" in MANUAL and "10.0mm" in MANUAL
    assert "겉면과 안쪽면을 각각 작업" in MANUAL
    assert "종이 두께는 실측값" in PAGE
    assert "id=\"spineAutoResult\"" in PAGE


@pytest.mark.parametrize("product,mode,panels", (
    ("flyer", "front", 1),
    ("flyer", "front_back", 2),
    ("invitation", "front_back", 2),
    ("leaflet", "front_back", 2),
    ("leaflet", "spread", 3),
))
def test_product_ai_prompt_has_correct_flat_print_panels(product, mode, panels):
    req = normalize_cover_request({
        "product_type": product,
        "cover_mode": mode,
        "trim_width_mm": 99,
        "trim_height_mm": 210,
        "spine_mm": 99,
        "wing_mm": 80,
        "bleed_mm": 3,
        "style_request": "Warm editorial graphic art",
    })
    assert req.product_type == product
    assert req.wing_mm == 0
    assert req.work_width_mm == panels * 99 + 6
    if product == "leaflet" and panels == 3:
        assert req.spine_mm == 99
    else:
        assert req.spine_mm == 0
    text = build_cover_prompt(req)
    assert "NOT a book cover" in text
    assert f"{panels} panel(s)" in text
    assert "BACKGROUND ARTWORK ONLY" in text
    assert "mm" in text


def test_cover_ai_prompt_remains_backward_compatible():
    req = normalize_cover_request({
        "cover_mode": "spread", "trim_width_mm": 210,
        "trim_height_mm": 297, "spine_mm": 10,
        "style_request": "Classic book",
    })
    assert req.product_type == "cover"
    assert req.spine_mm == 10
    assert req.work_width_mm == 436
    assert "Exact center spine: 10.00 mm" in build_cover_prompt(req)
