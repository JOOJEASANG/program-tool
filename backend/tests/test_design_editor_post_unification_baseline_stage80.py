import re
from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]
SHELL = ROOT / "design-editor" / "index.html"
REGISTER = ROOT / "js" / "sw-register.js"
LEGACY_COVER = ROOT / "perfect-binding-cover" / "index.html"
TOOL_ALIAS = ROOT / "tools" / "perfect-binding-cover.html"
BROWSER_SUITE = ROOT / "scripts" / "run_design_editor_browser_smoke.sh"
QUALITY_GATE = ROOT / ".github" / "workflows" / "quality-gate.yml"


def runtime_entries(source: str):
    block = re.search(
        r"const DESIGN_EDITOR_RUNTIME_SCRIPTS=Object\.freeze\(\[(.*?)\]\);",
        source,
        re.S,
    )
    assert block, "통합 Design Editor runtime manifest를 찾을 수 없습니다."
    return re.findall(r"\['([^']+)','([^']+)'\]", block.group(1))


def test_stage80_all_design_modes_converge_on_single_general_engine():
    source = SHELL.read_text(encoding="utf-8")
    assert 'src="/design-editor/general?embed=1&mode=cover&preset=cover-a4"' in source
    assert "if(mode==='cover')return '/design-editor/general?embed=1&mode=cover&preset=cover-a4'" in source
    assert "return `/design-editor/general?${query.toString()}`" in source
    for mode in ("cover", "poster", "flyer", "leaflet2", "leaflet3", "custom"):
        assert f"{mode}:{{mode:'{mode}'" in source
    assert "legacyCoverFallback:" not in source
    assert "single-sidebar-general-engine-shell-no-legacy-fallback" in source


def test_stage80_runtime_manifest_is_unique_complete_and_resolves_to_real_files():
    source = REGISTER.read_text(encoding="utf-8")
    entries = runtime_entries(source)
    assert len(entries) == 32
    ids = [entry[0] for entry in entries]
    paths = [entry[1].split("?", 1)[0] for entry in entries]
    assert len(set(ids)) == len(ids)
    assert len(set(paths)) == len(paths)
    for path in paths:
        assert path.startswith("/js/design-editor/")
        assert (ROOT / path.lstrip("/")).exists(), path


def test_stage80_common_runtime_owns_cover_assets_projects_and_output():
    source = REGISTER.read_text(encoding="utf-8")
    required = (
        "/js/design-editor/asset-store.js",
        "/js/design-editor/phase2.js",
        "/js/design-editor/output.js",
        "/js/design-editor/phase11-project-file.js",
        "/js/design-editor/phase24-cloud-projects.js",
        "/js/design-editor/cover-model.js",
        "/js/design-editor/cover-mode-bridge.js",
        "/js/design-editor/cover-settings.js",
        "/js/design-editor/cover-spine-tools.js",
        "/js/design-editor/cover-preview-zones.js",
    )
    for marker in required:
        assert marker in source
    assert "perfectBindingCover" not in source
    assert "/js/cover-local-image-upload.js" not in source
    assert "/js/cover-project-state-bridge.js" not in source


def test_stage80_retired_cover_urls_remain_redirect_only_compatibility_stubs():
    for path in (LEGACY_COVER, TOOL_ALIAS):
        source = path.read_text(encoding="utf-8")
        assert "/design-editor/?mode=cover" in source
        assert "<canvas" not in source
        assert 'id="pdfBtn"' not in source
        assert "cover-editor-" not in source
    assert "location.replace" in LEGACY_COVER.read_text(encoding="utf-8")


def test_stage80_browser_smoke_suite_keeps_core_user_paths_chained():
    source = BROWSER_SUITE.read_text(encoding="utf-8")
    runners = (
        "run_design_editor_cover_smoke.sh",
        "run_design_editor_cover_project_smoke.sh",
        "run_design_editor_mode_shape_smoke.sh",
        "run_design_editor_pdf_smoke.sh",
    )
    for runner in runners:
        assert runner in source
    assert source.index(runners[0]) < source.index(runners[1]) < source.index(runners[3])


def test_stage80_pull_requests_keep_full_quality_gate():
    source = QUALITY_GATE.read_text(encoding="utf-8")
    for marker in (
        "pull_request:",
        "backend-tests:",
        "frontend-static:",
        "design-editor-browser-smoke:",
        "firebase-rules:",
        "python -m pytest -q --tb=short",
        "bash scripts/run_design_editor_browser_smoke.sh",
        "firebase emulators:exec --only firestore,storage",
    ):
        assert marker in source
