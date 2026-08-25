from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]


def test_unified_design_shell_injects_fold_and_product_runtimes_without_changing_route_contract():
    shell = (ROOT / "design-editor" / "index.html").read_text(encoding="utf-8")
    assert 'src="/design-editor/general?embed=1&mode=cover&preset=cover-a4"' in shell
    assert "const FOLD_RUNTIME_VERSION='20260825-5'" in shell
    assert "const PRODUCT_RUNTIME_VERSION='20260825-1'" in shell
    assert "const PRODUCT_STATE_VERSION='20260825-1'" in shell
    assert "print-fold-runtime-ensure.js?v=${FOLD_RUNTIME_VERSION}" in shell
    assert "print-product-menu.js?v=${PRODUCT_RUNTIME_VERSION}" in shell
    assert "print-product-state-restore.js?v=${PRODUCT_STATE_VERSION}" in shell
    assert "ensureFoldRuntime" in shell
    assert "ensureProductRuntime" in shell
    assert "ensureProductStateRuntime" in shell
    assert "foldRuntimeStage:'direct-fold-runtime-loader-and-verifier'" in shell
    assert "productRuntimeStage:'print-product-menu-loader'" in shell
    assert "stage:'single-sidebar-general-engine-shell-no-legacy-fallback'" in shell


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
