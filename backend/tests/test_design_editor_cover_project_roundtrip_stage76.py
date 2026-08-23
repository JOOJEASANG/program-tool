from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]
PROJECT_FILE = ROOT / "js" / "design-editor" / "phase11-project-file.js"
CLOUD = ROOT / "js" / "design-editor" / "phase24-cloud-projects.js"
HARNESS = ROOT / "tests" / "browser" / "design-editor-cover-project-smoke.html"
RUNNER = ROOT / "scripts" / "run_design_editor_cover_project_smoke.sh"
SUITE = ROOT / "scripts" / "run_design_editor_browser_smoke.sh"


def test_stage76_project_file_validates_and_canonicalizes_cover_metadata():
    source = PROJECT_FILE.read_text(encoding="utf-8")
    for marker in (
        "const SPINE_DIRECTIONS=new Set(['bottomToTop','vertical','topToBottom'])",
        "function isCoverProject(value)",
        "function validateCoverProject(value)",
        "function canonicalizeCoverProject(value)",
        "표지는 뒤표지·책등·앞표지 단일 펼침면이어야 합니다.",
        "model.applyToProject(value,value.cover)",
        "validateProject(snapshot);canonicalizeCoverProject(snapshot)",
        "canonicalizeCoverProject(incoming)",
        "DesignEditorCoverSpineTools?.placeAll?.()",
        "DesignEditorCoverPreviewZones?.render?.()",
        "stage:'portable-design-project-save-load-cover-aware'",
    ):
        assert marker in source


def test_stage76_cover_project_validation_rejects_corrupt_spine_semantics():
    source = PROJECT_FILE.read_text(encoding="utf-8")
    for marker in (
        "cover.spineDirection",
        "item?.coverRole!=='spine-title'",
        "item.spineDirection",
        "item.spineZone",
        "item.spineYPercent",
        "책등 글자 방향 정보가 손상되었습니다.",
        "책등 글자 위치 정보가 손상되었습니다.",
        "책등 글자 세로 위치 정보가 손상되었습니다.",
    ):
        assert marker in source


def test_stage76_cloud_projects_reuse_same_portable_cover_contract():
    source = CLOUD.read_text(encoding="utf-8")
    assert "projectFile.buildPortablePayload(current)" in source
    assert "projectFile.restorePortablePayload(parsed,'cloud-project-load')" in source
    assert "owner-scoped-revisioned-firestore-storage-cloud-projects" in source


def test_stage76_real_browser_roundtrip_checks_canonical_geometry_and_spine_metadata():
    source = HARNESS.read_text(encoding="utf-8")
    for marker in (
        "ids.size===32&&latest.size===32",
        "DesignEditorProjectFile.buildPortablePayload(project)",
        "altered.project.width=999",
        "altered.project.cover.spine=99",
        "altered.project.surfaces[0].folds=[1,2]",
        "DesignEditorProjectFile.restorePortablePayload(altered",
        "restored.width===430.5&&restored.height===297",
        "restored.cover.spine===10.5&&restored.cover.pageCount===200",
        "restored.surfaces[0].folds.join(',')==='210,220.5'",
        "restoredSpine?.spineDirection==='topToBottom'&&restoredSpine?.spineYPercent===63",
        "broken.project.cover.spineDirection='diagonal'",
        "assert(rejected",
    ):
        assert marker in source


def test_stage76_runner_is_isolated_and_chained_before_pdf_export_smokes():
    runner = RUNNER.read_text(encoding="utf-8")
    suite = SUITE.read_text(encoding="utf-8")
    assert 'PROFILE_DIR="$(mktemp -d)"' in runner
    assert '--user-data-dir="$PROFILE_DIR"' in runner
    assert '--virtual-time-budget=30000' in runner
    for marker in (
        'data-cover-project-runtime="32"',
        'data-cover-project-width="430.5"',
        'data-cover-project-spine="10.5"',
        'data-cover-project-folds="210,220.5"',
        'data-cover-project-direction="topToBottom"',
        'data-cover-project-y="63"',
        'data-cover-project-rejected="true"',
    ):
        assert marker in runner
    assert 'bash "$ROOT_DIR/scripts/run_design_editor_cover_project_smoke.sh"' in suite
    assert suite.index("run_design_editor_cover_smoke.sh") < suite.index("run_design_editor_cover_project_smoke.sh") < suite.index("run_design_editor_pdf_smoke.sh")
