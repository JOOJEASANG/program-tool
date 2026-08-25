from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]


def test_unified_design_shell_injects_fold_runtime():
    shell = (ROOT / "design-editor" / "index.html").read_text(encoding="utf-8")
    assert "print-fold-runtime-ensure.js?v=${FOLD_RUNTIME_VERSION}" in shell
    assert "ensureFoldRuntime" in shell
    assert "foldRuntime=20260825-2" in shell
    assert "single-sidebar-general-engine-shell-with-direct-fold-runtime" in shell


def test_fold_runtime_browser_smoke_is_part_of_quality_suite():
    runner = (ROOT / "scripts" / "run_design_editor_browser_smoke.sh").read_text(encoding="utf-8")
    smoke = (ROOT / "tests" / "browser" / "design-editor-fold-runtime-smoke.html").read_text(encoding="utf-8")
    assert "run_design_editor_fold_runtime_smoke.sh" in runner
    assert "data-fold-runtime-leaflet2='1'" in smoke or "dataset.foldRuntimeLeaflet2='1'" in smoke
    assert "dataset.foldRuntimeLeaflet3='2'" in smoke
    assert "dataset.foldRuntimePortrait='2'" in smoke
