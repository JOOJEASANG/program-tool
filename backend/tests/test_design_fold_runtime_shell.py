from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]


def test_unified_design_shell_injects_fold_runtime_without_changing_route_contract():
    shell = (ROOT / "design-editor" / "index.html").read_text(encoding="utf-8")
    assert 'src="/design-editor/general?embed=1&mode=cover&preset=cover-a4"' in shell
    assert "const FOLD_RUNTIME_VERSION='20260825-4'" in shell
    assert "print-fold-runtime-ensure.js?v=${FOLD_RUNTIME_VERSION}" in shell
    assert "ensureFoldRuntime" in shell
    assert "foldRuntimeStage:'direct-fold-runtime-loader-and-verifier'" in shell
    assert "stage:'single-sidebar-general-engine-shell-no-legacy-fallback'" in shell


def test_fold_runtime_normalizes_leaflet2_and_leaflet3_orientation_before_apply():
    runtime = (ROOT / "js" / "design-editor" / "print-fold-runtime-ensure.js").read_text(encoding="utf-8")
    assert "function normalizeOrientationFields()" in runtime
    assert "const isLeaflet=p=>isLeaflet2(p)||isLeaflet3(p);" in runtime
    assert "if(!isLeaflet(p))return false;" in runtime
    assert "if(event.target?.closest?.('.design-mode-apply'))normalizeOrientationFields();" in runtime
    assert "PAPER_MM" in runtime
    assert "dataset.leafletOrientationApply" in runtime
    assert "dataset.leafletOrientationMode=isLeaflet3(p)?'leaflet3':'leaflet2'" in runtime


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
