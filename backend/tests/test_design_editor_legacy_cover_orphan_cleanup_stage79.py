import re
from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]
REGISTER = ROOT / "js" / "sw-register.js"
OUTPUT = ROOT / "js" / "design-editor" / "output.js"
LEGACY = ROOT / "perfect-binding-cover" / "index.html"
TOOL_ALIAS = ROOT / "tools" / "perfect-binding-cover.html"

DELETED_ROOT_COVER_MODULES = (
    "cmyk-color-control.js",
    "cover-edit-history.js",
    "cover-editor-image-tools.js",
    "cover-editor-layer-style.js",
    "cover-editor-multiselect.js",
    "cover-editor-preflight-project.js",
    "cover-editor-text-zones-v2.js",
    "cover-editor-ux-upgrade.js",
    "cover-final-output-confirm.js",
    "cover-floating-action-dock.js",
    "cover-image-print-quality.js",
    "cover-large-file-policy.js",
    "cover-layout-lock.js",
    "cover-local-image-upload.js",
    "cover-output-performance-safety.js",
    "cover-preview-text-inspector.js",
    "cover-preview-transparency.js",
    "cover-preview-workspace.js",
    "cover-project-state-bridge.js",
    "cover-recovery-checkpoints.js",
    "cover-render-pipeline-contract.js",
    "cover-runtime-safety.js",
    "cover-spine-orientation-controls.js",
    "cover-spine-print-safety.js",
    "cover-template-admin-separation.js",
    "cover-template-manager.js",
    "cover-template-project-safety.js",
    "cover-template-surface-cleanup.js",
    "cover-text-canvas-controls.js",
    "cover-text-ui-refine.js",
    "cover-ui-runtime-normalizer.js",
    "perfect-binding-cover-fine-controls.js",
)


def manifest_entries(source: str):
    block = re.search(r"const DESIGN_EDITOR_RUNTIME_SCRIPTS=Object\.freeze\(\[(.*?)\]\);", source, re.S)
    assert block
    return re.findall(r"\['([^']+)','([^']+)'\]", block.group(1))


def test_stage79_retired_cover_urls_only_redirect_to_integrated_editor():
    legacy = LEGACY.read_text(encoding="utf-8")
    alias = TOOL_ALIAS.read_text(encoding="utf-8")
    for source in (legacy, alias):
        assert "/design-editor/?mode=cover" in source
        assert "perfect-binding-cover/?embed=1" not in source
    assert "location.replace" in legacy
    assert "<canvas" not in legacy
    assert 'id="pdfBtn"' not in legacy


def test_stage79_old_root_cover_runtime_modules_are_physically_removed():
    for name in DELETED_ROOT_COVER_MODULES:
        assert not (ROOT / "js" / name).exists(), name


def test_stage79_shared_pdf_loader_and_integrated_cover_modules_remain():
    assert (ROOT / "js" / "cover-jspdf-loader.js").exists()
    output = OUTPUT.read_text(encoding="utf-8")
    assert "/js/cover-jspdf-loader.js?v=20260806-1" in output
    assert "await loader.ensure()" in output
    for name in (
        "cover-model.js",
        "cover-mode-bridge.js",
        "cover-settings.js",
        "cover-spine-tools.js",
        "cover-preview-zones.js",
    ):
        assert (ROOT / "js" / "design-editor" / name).exists(), name


def test_stage79_runtime_loader_no_longer_contains_retired_cover_route_or_modules():
    source = REGISTER.read_text(encoding="utf-8")
    assert "perfectBindingCover" not in source
    assert "perfect-binding-cover-fine-controls.js" not in source
    assert "coverRuntimeSafetyScriptV1" not in source
    assert "coverOutputPerformanceSafetyScriptV1" not in source
    for name in DELETED_ROOT_COVER_MODULES:
        assert f"/js/{name}" not in source
    entries = manifest_entries(source)
    assert len(entries) == 32
    assert len({entry[0] for entry in entries}) == 32
    assert len({entry[1] for entry in entries}) == 32


def test_stage79_real_browser_suite_keeps_unified_cover_and_output_paths():
    suite = (ROOT / "scripts" / "run_design_editor_browser_smoke.sh").read_text(encoding="utf-8")
    for runner in (
        "run_design_editor_cover_smoke.sh",
        "run_design_editor_cover_project_smoke.sh",
        "run_design_editor_mode_shape_smoke.sh",
        "run_design_editor_pdf_smoke.sh",
    ):
        assert runner in suite
    pdf_runner = (ROOT / "scripts" / "run_design_editor_pdf_smoke.sh").read_text(encoding="utf-8")
    assert "run_design_editor_pdf_lossless_smoke.sh" in pdf_runner
