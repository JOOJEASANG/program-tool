from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]
COMPONENTS = ROOT / "js" / "design-editor" / "phase17-component-blocks.js"
RECIPES = ROOT / "js" / "design-editor" / "phase23-design-recipes.js"
REGISTER = ROOT / "js" / "sw-register.js"


def test_component_blocks_run_on_the_real_general_editor_route():
    source = COMPONENTS.read_text(encoding="utf-8")
    assert "path!=='/design-editor/general'" in source
    assert "path!=='/design-editor/general.html'" in source
    assert "path.endsWith('/design-editor/general.html')" in source
    assert "path!=='/design-editor/index.html'" not in source
    assert "stage:'one-click-print-component-blocks'" in source


def test_design_recipes_are_loaded_after_component_blocks_and_style_themes():
    source = REGISTER.read_text(encoding="utf-8")
    assert "designEditorDesignRecipesScriptV1" in source
    assert "/js/design-editor/phase23-design-recipes.js?v=20260822-1" in source
    assert "/js/design-editor/phase17-component-blocks.js?v=20260822-2" in source
    assert source.index("designEditorComponentBlocksScriptV1") < source.index("designEditorDesignRecipesScriptV1")
    assert source.index("designEditorStyleThemesScriptV1") < source.index("designEditorDesignRecipesScriptV1")


def test_design_recipes_offer_mode_ready_non_destructive_starters():
    source = RECIPES.read_text(encoding="utf-8")
    for marker in (
        "publicNotice:{name:'공공 안내'",
        "eventPoster:{name:'행사 포스터'",
        "cleanFlyer:{name:'깔끔 전단'",
        "warmGuide:{name:'따뜻한 안내'",
        "DesignEditorComponentBlocks",
        "DesignEditorStyleThemes?.applyTheme?.(recipe.theme)",
        "기존 글자·사진·도형은 삭제하지 않고",
        "기존 내용은 삭제하지 않았습니다.",
        "stage:'non-destructive-mode-ready-starter-recipes'",
    ):
        assert marker in source
    assert ".elements=[]" not in source
    assert ".extras=[]" not in source
    assert "current.elements=current.elements.filter" not in source
    assert "current.extras=current.extras.filter" not in source


def test_design_recipe_duplicate_prevention_is_surface_scoped():
    source = RECIPES.read_text(encoding="utf-8")
    assert "surface.designRecipesApplied" in source
    assert "current.designRecipesApplied.includes(key)" in source
    assert "if(!surface.designRecipesApplied.includes(key))surface.designRecipesApplied.push(key)" in source
    assert "p.lastDesignRecipe=key" in source
    assert "DesignEditorDraftScope?.saveCurrent?.('design-recipe')" in source


def test_recipe_blocks_reuse_existing_component_apis_instead_of_duplicating_layout_logic():
    source = RECIPES.read_text(encoding="utf-8")
    for marker in (
        "api.insertTitleBlock?.()",
        "api.insertEventInfo?.()",
        "api.insertContactBlock?.()",
        "api.insertFooterBlock?.()",
        "recipe.blocks.forEach(applyBlock)",
    ):
        assert marker in source
    assert "function insertTitleBlock" not in source
    assert "function insertEventInfo" not in source


def test_design_recipes_use_bounded_event_driven_startup():
    source = RECIPES.read_text(encoding="utf-8")
    assert "MutationObserver" not in source
    assert "setInterval(" not in source
    assert "eval(" not in source
    assert "[250,550,950,1600,2600,3800]" in source
