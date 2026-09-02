from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]


def test_shell_loads_product_specific_workspace_only_for_standalone_apps():
    shell = (ROOT / "js" / "design-editor" / "shell-runtime.js").read_text(encoding="utf-8")
    assert "async function loadProductSpecificWorkspace()" in shell
    assert "if(!standalone)return true;" in shell
    assert "designProductSpecificWorkspaceScriptV1" in shell
    assert "/js/design-editor/product-specific-workspace.js?v=20260901-1" in shell
    assert "DesignEditorProductSpecificWorkspace?.sync?.()" in shell
    assert "loadProductSpecificWorkspace()" in shell
    assert "sync();" in shell


def test_product_specific_workspace_keeps_each_design_app_inside_its_own_settings():
    source = (ROOT / "js" / "design-editor" / "product-specific-workspace.js").read_text(encoding="utf-8")
    assert "data-design-product-workspace" in source
    assert "#designEmbeddedModeCard .design-mode-grid{display:none!important}" in source
    assert "cover:Object.freeze({title:'표지 디자인'" in source
    assert "const combinedPosterFlyer=params.get('surface')==='poster-flyer';" in source
    assert "title:'포스터 · 전단지 디자인'" in source
    assert "title:'포스터 디자인'" in source
    assert "flyer:Object.freeze({title:'전단지 디자인'" in source
    assert "invitation:Object.freeze({title:params.get('surface')==='notice'?'안내장 디자인':'초대장 · 안내장'" in source
    assert "leaflet:Object.freeze({title:'리플렛 디자인'" in source
    assert "완성 규격·도련·책등을 설정합니다." in source
    assert "단면 용지 규격과 방향만 설정합니다." in source
    assert "용지 규격과 접지 방향·위치를 설정합니다." in source
    assert "페이지 수·접지 방식·용지 규격을 설정합니다." in source
    assert "html[data-design-product-workspace=\"cover\"] #designEmbeddedModeCard .design-mode-options{display:none!important}" in source
    assert "button.textContent='규격 변경'" not in source
    assert "setText(button,'규격 변경')" in source


def test_product_specific_workspace_does_not_replace_common_canvas_editing():
    source = (ROOT / "js" / "design-editor" / "product-specific-workspace.js").read_text(encoding="utf-8")
    assert "propertiesPanel" not in source
    assert "designSelectionContextbar" not in source
    assert "DesignEditorFocusedWorkspace" not in source
    assert "DesignEditorProductSpecificWorkspace={sync,product:app,stage:'standalone-product-specific-workspace-v1'}" in source
