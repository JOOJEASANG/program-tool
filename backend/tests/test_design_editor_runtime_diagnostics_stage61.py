from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]
DIAGNOSTICS = ROOT / "js" / "design-editor" / "runtime-diagnostics.js"
REGISTER = ROOT / "js" / "sw-register.js"


def test_runtime_diagnostics_loads_first_and_stays_on_general_editor():
    register = REGISTER.read_text(encoding="utf-8")
    source = DIAGNOSTICS.read_text(encoding="utf-8")
    assert "designEditorRuntimeDiagnosticsScriptV1" in register
    assert "/js/design-editor/runtime-diagnostics.js?v=20260823-1" in register
    assert register.index("designEditorRuntimeDiagnosticsScriptV1") < register.index("designEditorDraftScopeScriptV1")
    assert "path!=='/design-editor/general'" in source
    assert "path!=='/design-editor/general.html'" in source
    assert "path.endsWith('/design-editor/general.html')" in source


def test_runtime_diagnostics_captures_browser_and_loader_failures_locally():
    source = DIAGNOSTICS.read_text(encoding="utf-8")
    for marker in (
        "window.addEventListener('error'",
        "window.addEventListener('unhandledrejection'",
        "window.addEventListener('programstudio:runtime-script-result'",
        "sessionStorage.setItem(STORAGE_KEY",
        "const MAX_RECORDS=40",
        "runtime-error",
        "runtime-timeout",
        "stage:'local-runtime-qa-diagnostics'",
    ):
        assert marker in source
    assert "fetch(" not in source
    assert "XMLHttpRequest" not in source
    assert "sendBeacon" not in source


def test_runtime_diagnostics_redacts_content_and_exports_only_technical_summary():
    source = DIAGNOSTICS.read_text(encoding="utf-8")
    for marker in (
        "'[email]'",
        "'[data-url]'",
        "'[blob-url]'",
        "program-studio-design-runtime-diagnostics",
        "projectSummary()",
        "textElements:textCount",
        "images:imageCount",
        "shapes:shapeCount",
        "navigator.clipboard?.writeText",
        "진단 정보 복사",
        "기록 지우기",
    ):
        assert marker in source
    assert "project.name" not in source
    assert "project.title" not in source
    assert "textContent:item" not in source
    assert "item.src" in source  # presence check only; src value is never exported


def test_runtime_diagnostics_checks_storage_project_and_manifest_health_without_polling():
    source = DIAGNOSTICS.read_text(encoding="utf-8")
    for marker in (
        "window.ProgramStudioDesignEditorRuntimeManifest",
        "dataset?.failed",
        "storageCheck('localStorage')",
        "storageCheck('indexedDB')",
        "activeSurfaceExists",
        "missingImages",
        "designDiagnosticsButton",
        "편집기 진단",
    ):
        assert marker in source
    assert "MutationObserver" not in source
    assert "setInterval(" not in source
    assert "eval(" not in source
