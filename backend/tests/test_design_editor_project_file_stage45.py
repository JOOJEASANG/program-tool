from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]
MODULE = ROOT / "js" / "design-editor" / "phase11-project-file.js"
REGISTER = ROOT / "js" / "sw-register.js"


def test_project_file_module_loads_after_clipboard_stage():
    register = REGISTER.read_text(encoding="utf-8")
    assert "designEditorProjectFileScriptV1" in register
    assert "/js/design-editor/phase11-project-file.js?v=20260822-2" in register
    assert register.index("designEditorElementClipboardScriptV1") < register.index("designEditorProjectFileScriptV1")


def test_project_file_exports_portable_versioned_json():
    source = MODULE.read_text(encoding="utf-8")
    for marker in (
        "const FORMAT='program-studio-design-project'",
        "const FORMAT_VERSION=1",
        "savedAt:new Date().toISOString()",
        "JSON.stringify(payload)",
        "`${safeName(current.name)}.design.json`",
        "application/json;charset=utf-8",
    ):
        assert marker in source


def test_project_file_import_validates_size_structure_and_embedded_images():
    source = MODULE.read_text(encoding="utf-8")
    for marker in (
        "const MAX_FILE_BYTES=30*1024*1024",
        "const MAX_SURFACES=12",
        "const MAX_ITEMS_PER_SURFACE=500",
        "validateProject(parsed.project)",
        "data:image\\/(?:png|jpeg|webp);base64",
        "file.size>MAX_FILE_BYTES",
        "JSON.parse(await file.text())",
    ):
        assert marker in source


def test_project_file_import_restores_editor_and_scoped_draft():
    source = MODULE.read_text(encoding="utf-8")
    for marker in (
        "localStorage.setItem(DRAFT_KEY,JSON.stringify(incoming))",
        "window.DesignEditorApp?.resumeDraft?.()",
        "window.DesignEditorPhase2?.sync?.()",
        "window.DesignEditorDraftScope?.saveCurrent?.('project-file-import')",
        "window.dispatchEvent(new Event('resize'))",
        "stage:'portable-design-project-save-load'",
    ):
        assert marker in source


def test_project_file_module_uses_bounded_event_driven_boot():
    source = MODULE.read_text(encoding="utf-8")
    assert "MutationObserver" not in source
    assert "setInterval(" not in source
    assert "eval(" not in source
    assert "[180,420,800,1300,2200,3200]" in source
