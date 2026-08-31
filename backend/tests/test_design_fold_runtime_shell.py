from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]


def test_unified_design_shell_uses_one_manifest_loader_without_changing_route_contract():
    shell = (ROOT / "design-editor" / "index.html").read_text(encoding="utf-8")
    runtime = (ROOT / "js" / "design-editor" / "shell-runtime.js").read_text(encoding="utf-8")
    assert 'src="/design-editor/general?embed=1&mode=cover&preset=cover-a4"' in shell
    assert "const SHELL_RUNTIME_VERSION='20260831-2'" in shell
    assert "invitation:{mode:'invitation',preset:'invitation-a4'" in shell
    assert "shell-runtime.js?v=${SHELL_RUNTIME_VERSION}" in shell
    assert "injectRuntime('designShellRuntimeScriptV1'" in shell
    assert "const ensureFoldRuntime=ensurePrintRuntimes" in shell
    assert "const ensureProfessionalUi=ensurePrintRuntimes" in shell
    assert "runtimeManifestStage:'design-shell-runtime-manifest-v1'" in shell
    assert "foldRuntimeStage:'direct-fold-runtime-loader-and-verifier'" in shell
    assert "documentStateStage:'canonical-document-type-state-v1'" in shell
    assert "productRuntimeStage:'print-product-menu-loader'" in shell
    assert "professionalUiStage:'professional-workspace-visual-system-v1'" in shell
    assert "firstPaintStage:'approved-base-shell-reveal-v2'" in shell
    assert "Date.now()-baseReadyAt>=1200" in shell
    assert "stage:'single-sidebar-general-engine-shell-no-legacy-fallback'" in shell
    for marker in (
        "print-fold-runtime-ensure.js?v=20260825-5",
        "document-type-state.js?v=20260828-1",
        "print-product-menu.js?v=20260828-3",
        "print-product-state-restore.js?v=20260825-1",
        "print-product-topbar.js?v=20260828-2",
        "selection-contextbar.js?v=20260828-1",
        "multi-selection-context.js?v=20260828-1",
        "multi-selection-smart-guides.js?v=20260828-1",
        "simple-result-workflow.js?v=20260828-1",
        "professional-ui.js?v=20260828-2",
        "preview-fit-refresh.js?v=20260831-1",
        "design-shell-runtime-manifest-v1",
    ):
        assert marker in runtime
    assert runtime.index("designPreviewFitRefreshScriptV1") > runtime.index("designProfessionalUiScriptV1")
    assert "print-product-menu.js?v=${PRODUCT_RUNTIME_VERSION}" not in shell
    assert "professional-ui.js?v=${PROFESSIONAL_UI_VERSION}" not in shell


def test_invitation_is_a_first_class_preset_and_product_mode_not_a_leaflet_alias():
    presets = (ROOT / "js" / "design-editor" / "presets.js").read_text(encoding="utf-8")
    runtime = (ROOT / "js" / "design-editor" / "embedded-runtime.js").read_text(encoding="utf-8")
    menu = (ROOT / "js" / "design-editor" / "print-product-menu.js").read_text(encoding="utf-8")
    assert "'invitation-a4':{" in presets
    assert "group:'초대장·안내장'" in presets
    assert "invitation:{label:'초대장·안내장'" in runtime
    assert "if(preset.startsWith('invitation-'))return 'invitation';" in runtime
    assert "if(mode==='invitation')return{mode:'invitation'" in runtime
    assert "if(config.mode==='invitation')return'invitation-a4';" in runtime
    assert "if(p?.designMode==='invitation')return'invitation';" in menu
    assert "switchBase('invitation',state.invitation" in menu
    invitation_apply = menu[menu.index("function applyInvitation(card)"):menu.index("function applyLeaflet(card)")]
    invitation_activate = menu[menu.index("if(product==='invitation'){"):menu.index("if(product==='leaflet'){")]
    assert "leaflet2" not in invitation_apply
    assert "leaflet2" not in invitation_activate


def test_fold_runtime_normalizes_leaflet2_leaflet3_and_product_orientation_before_apply():
    runtime = (ROOT / "js" / "design-editor" / "print-fold-runtime-ensure.js").read_text(encoding="utf-8")
    assert "function normalizeOrientationFields()" in runtime
    assert "const isLeaflet=p=>isLeaflet2(p)||isLeaflet3(p);" in runtime
    assert "if(!isLeaflet(p))return false;" in runtime
    assert "if(event.target?.closest?.('.design-mode-apply,.design-product-apply'))normalizeOrientationFields();" in runtime
    assert "PAPER_MM" in runtime
    assert "dataset.leafletOrientationApply" in runtime
    assert "p?.printProductMode|| (isLeaflet3(p)?'leaflet3':'leaflet2')" in runtime
    assert "printProductPages" in runtime


def test_fold_runtime_browser_smoke_is_part_of_quality_suite():
    runner = (ROOT / "scripts" / "run_design_editor_browser_smoke.sh").read_text(encoding="utf-8")
    smoke = (ROOT / "tests" / "browser" / "design-editor-fold-runtime-smoke.html").read_text(encoding="utf-8")
    assert "run_design_editor_fold_runtime_smoke.sh" in runner
    assert "dataset.foldRuntimeLeaflet2='1'" in smoke
    assert "dataset.foldRuntimeLeaflet3='2'" in smoke
    assert "dataset.foldRuntimePortrait='2'" in smoke
    assert "dataset.foldRuntimeOrientationApply='portrait'" in smoke
    assert "dataset.foldRuntimeLeaflet3OrientationApply='portrait'" in smoke
    assert "dataset.foldRuntimeLeaflet3FoldPreserved=fold.value" in smoke
    assert "leaflet3 portrait apply normalization" in smoke
    assert "3단 방향 적용 중 선택한 접지 방식이 변경되었습니다." in smoke
