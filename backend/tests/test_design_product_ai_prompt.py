"""Product-specific AI design backgrounds should not inherit book-cover geometry."""
from services.ai_cover_image import build_cover_prompt, normalize_cover_request


def test_ai_flyer_prompt_is_not_a_book_cover():
    req=normalize_cover_request({
        "product_type":"flyer","cover_mode":"front",
        "trim_width_mm":210,"trim_height_mm":297,"style_request":"modern event poster"
    })
    prompt=build_cover_prompt(req)
    assert req.product_type=="flyer"
    assert "PROMOTIONAL FLYER" in prompt
    assert "NEVER a book mockup" in prompt
    assert "BACKGROUND ARTWORK ONLY" in prompt
    assert "Single flat FRONT face" in prompt


def test_ai_invitation_prompt_targets_two_card_faces():
    req=normalize_cover_request({
        "product_type":"invitation","cover_mode":"front_back",
        "trim_width_mm":148,"trim_height_mm":210,"style_request":"elegant invitation"
    })
    prompt=build_cover_prompt(req)
    assert "INVITATION CARD" in prompt
    assert "Two adjacent flat sides" in prompt
    assert req.spine_mm==0
    assert req.work_width_mm==302


def test_ai_trifold_prompt_uses_three_fold_panels_and_side():
    req=normalize_cover_request({
        "product_type":"leaflet","leaflet_side":"inside","cover_mode":"spread",
        "trim_width_mm":148,"trim_height_mm":210,"spine_mm":148,
        "bleed_mm":3,"style_request":"educational leaflet"
    })
    assert req.product_type=="leaflet"
    assert req.leaflet_side=="inside"
    assert req.spine_mm==148  # center fold is a full panel, not a book spine
    assert req.work_width_mm==450
    prompt=build_cover_prompt(req)
    assert "TRIFOLD PRINT BROCHURE" in prompt
    assert "INSIDE face" in prompt
    assert "NOT a book spine" in prompt
    assert "Three adjacent vertical panels" in prompt
    assert "148.00 mm" in prompt


def test_existing_cover_prompt_stays_spine_specific():
    req=normalize_cover_request({
        "product_type":"cover","cover_mode":"spread","trim_width_mm":210,
        "trim_height_mm":297,"spine_mm":10,"style_request":"report"
    })
    prompt=build_cover_prompt(req)
    assert "Exact center spine: 10.00 mm" in prompt
    assert "FULL SPREAD PRINT COVER" in prompt
