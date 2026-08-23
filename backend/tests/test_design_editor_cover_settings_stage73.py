from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]
SETTINGS = ROOT / "js" / "design-editor" / "cover-settings.js"
DRAFT = ROOT / "js" / "design-editor" / "phase5-draft-scope.js"
REGISTER = ROOT / "js" / "sw-register.js"
HARNESS = ROOT / "tests" / "browser" / "design-editor-cover-smoke.html"
RUNNER = ROOT / "scripts" / "run_design_editor_cover_smoke.sh"


def test_stage73_cover_settings_exposes_trim_binding_and_manual_spine_controls():
    source = SETTINGS.read_text(encoding="utf-8")
    for marker in (
        "coverPaperPreset",
        "coverTrimWidth",
        "coverTrimHeight",
        "coverBleed",
        "coverSafe",
        "coverPageCount",
        "coverPaperCaliper",
        "coverBindingAdjust",
        "coverManualSpine",
        "coverSpineManual",
        "표지 규격 적용",
    ):
        assert marker in source
    for paper in ("A4 · 210×297", "B5 JIS · 182×257", "B5 ISO · 176×250", "A5 · 148×210", "직접 입력"):
        assert paper in source


def test_stage73_cover_geometry_changes_preserve_existing_common_editor_elements():
    source = SETTINGS.read_text(encoding="utf-8")
    assert "const elementIds=elements.map(item=>item.id).join('|')" in source
    assert "const extraIds=extras.map(item=>item.id).join('|')" in source
    assert "표지 규격 변경 중 편집 요소 보존 계약이 깨졌습니다." in source
    assert "root.DesignEditorDraftScope?.saveCurrent?.(source)" in source
    assert "programstudio:cover-geometry-change" in source


def test_stage73_cover_draft_scope_is_stable_across_spine_only_changes():
    source = DRAFT.read_text(encoding="utf-8")
    assert "function scopeDimensions(project)" in source
    assert "project?.designMode==='cover'&&project?.cover" in source
    assert "project.cover.trimWidth" in source
    assert "project.cover.trimHeight" in source
    assert "function legacyGeometryDraftKey(project)" in source
    assert "if(legacyKey&&legacyKey!==key)return envelopeAt(legacyKey)" in source


def test_stage73_runtime_manifest_loads_cover_settings_after_cover_bridge():
    source = REGISTER.read_text(encoding="utf-8")
    assert "/js/design-editor/phase5-draft-scope.js?v=20260823-4" in source
    assert "/js/design-editor/cover-settings.js?v=20260823-1" in source
    assert source.index("designEditorCoverModeBridgeScriptV1") < source.index("designEditorCoverSettingsScriptV1")


def test_stage73_browser_smoke_resizes_spine_preserves_content_and_scope():
    source = HARNESS.read_text(encoding="utf-8")
    assert "pageCount.value='200'" in source
    assert "applied?.spine===10.5" in source
    assert "project.width===430.5&&project.height===297" in source
    assert "project.surfaces[0].folds?.[0]===210&&project.surfaces[0].folds?.[1]===220.5" in source
    assert "project.surfaces[0].elements?.[0]?.id===titleId" in source
    assert "window.DesignEditorDraftScope.scopeForProject(project)===initialScope" in source
    assert "initialScope==='cover-a4.210x297'" in source


def test_stage73_cover_runner_requires_geometry_content_and_scope_markers():
    source = RUNNER.read_text(encoding="utf-8")
    for marker in (
        'data-cover-width="430.5"',
        'data-cover-height="297"',
        'data-cover-spine="10.5"',
        'data-cover-folds="210,220.5"',
        'data-cover-runtime="32"',
        'data-cover-page-count="200"',
        'data-cover-element-preserved="true"',
        'data-cover-draft-scope="cover-a4.210x297"',
    ):
        assert marker in source
    assert "PASS: unified cover preview zones, settings, spine direction, safety and real render" in source
