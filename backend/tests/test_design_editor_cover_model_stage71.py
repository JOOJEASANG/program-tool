from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]
MODEL = ROOT / "js" / "design-editor" / "cover-model.js"


def test_stage71_cover_model_keeps_back_spine_front_as_one_print_spread():
    source = MODEL.read_text(encoding="utf-8")
    for marker in (
        "trimWidth:210",
        "trimHeight:297",
        "pageCount:160",
        "paperCaliper:0.1",
        "bindingAdjust:0.5",
        "const sheets=Math.ceil(config.pageCount/2)",
        "sheets*config.paperCaliper+config.bindingAdjust",
        "const spreadWidth=round1(config.trimWidth*2+spine)",
        "folds:[round1(config.trimWidth),round1(config.trimWidth+spine)]",
        "panels:['뒤표지',`책등 ${spine.toFixed(1)}mm`,'앞표지']",
    ):
        assert marker in source


def test_stage71_default_cover_geometry_matches_legacy_a4_example():
    source = MODEL.read_text(encoding="utf-8")
    assert "spineManual:8.5" in source
    assert "id:'cover-a4'" in source
    assert "group:'표지'" in source
    assert "designMode:'cover'" in source
    assert 80 * 0.1 + 0.5 == 8.5
    assert 210 * 2 + 8.5 == 428.5


def test_stage71_cover_project_adapter_preserves_existing_cover_content_when_geometry_changes():
    source = MODEL.read_text(encoding="utf-8")
    for marker in (
        "function applyToProject(project,options={})",
        "project.designMode='cover'",
        "project.width=spec.spreadWidth",
        "project.height=spec.trimHeight",
        "project.activeSurface='cover'",
        "project.cover={...spec}",
        "elements:Array.isArray(existing?.elements)?existing.elements:[]",
        "extras:Array.isArray(existing?.extras)?existing.extras:[]",
    ):
        assert marker in source


def test_stage71_capability_contract_names_integrated_owners_not_retired_files():
    source = MODEL.read_text(encoding="utf-8")
    for marker in (
        "const CAPABILITIES=Object.freeze({",
        "common:Object.freeze([",
        "coverSpecific:Object.freeze([",
        "owner:'common'",
        "owner:'cover-model + cover-settings'",
        "owner:'cover-spine-tools'",
        "owner:'project-file + draft-scope + cloud-projects'",
        "owner:'cover-preview-zones'",
        "const LEGACY_CAPABILITIES=CAPABILITIES",
    ):
        assert marker in source
    for retired in (
        "cover-editor-text-zones-v2.js",
        "cover-local-image-upload.js",
        "cover-runtime-safety.js",
        "cover-spine-orientation-controls.js",
        "cover-template-manager.js",
    ):
        assert retired not in source
        assert not (ROOT / "js" / retired).exists()


def test_stage71_contract_explicitly_separates_common_and_cover_specific_features():
    source = MODEL.read_text(encoding="utf-8")
    for capability in (
        "text-editing",
        "image-editing",
        "selection-layout-history",
        "project-recovery",
        "output-preflight",
        "spread-geometry",
        "spine-orientation",
        "spine-print-safety",
        "cover-project",
        "cover-preview-zones",
    ):
        assert f"capability:'{capability}'" in source
    assert "stage:'cover-spread-model-integrated-capability-contract'" in source
