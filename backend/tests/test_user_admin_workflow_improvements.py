from pathlib import Path
import json


ROOT = Path(__file__).resolve().parents[2]


def read(path: str) -> str:
    return (ROOT / path).read_text(encoding="utf-8")


def release_version() -> str:
    return str(json.loads(read("version.json"))["version"]).strip()


def test_runtime_boot_uses_canonical_owners_for_live_workflow_modules():
    runtime = read("js/sw-register.js")
    app_version = read("js/app-version.js")
    pdf_editor = read("js/pdf-editor/route-runtime.js")
    preflight = read("js/pdf-preflight/route-runtime.js")

    assert "/js/admin-operations-overview.js" in runtime
    assert "home-print-workflow.js" not in runtime
    for asset in ("/js/pdf-editor-final-check.js", "/js/pdf-editor/spread-split.js", "/js/pdf-editor/booklet-sheet-preview.js"):
        assert asset in pdf_editor
    assert "/js/pdf-print-readiness.js" in preflight
    executable_app = app_version.split("/*", 1)[0] + app_version.rsplit("*/", 1)[-1]
    for asset in ("/js/pdf-editor-final-check.js", "/js/pdf-print-readiness.js", "/js/pdf-editor/spread-split.js", "/js/pdf-editor/booklet-sheet-preview.js"):
        assert asset not in executable_app
    assert f"const VERSION='{release_version()}'" in runtime


def test_pdf_editor_final_check_reuses_generated_output_without_manual_reupload():
    source = read("js/pdf-editor-final-check.js")
    assert "인쇄 전 검사 후 저장" in source
    assert "바로 PDF 저장" in source
    assert "apiProcessPdf(sources,settings" in source
    assert "apiPreflightCheck(file" in source
    assert "checkedBlob=blob" in source
    assert "downloadBlob(checkedBlob" in source
    assert "검사 완료 PDF 저장" in source
    assert "문제 있어도 PDF 저장" in source


def test_static_home_keeps_current_programs_only():
    home = read("index.html")
    for label in ("인쇄물 사전 검토", "PDF 편집기", "PDF 검사 · 유틸리티"):
        assert label in home
    for retired in ("디자인 편집기", "문서 편집기", "이미지 편집기"):
        assert retired not in home


def test_admin_operations_overview_remains_explicit_and_non_destructive():
    source = read("js/admin-operations-overview.js")
    assert "professional_program_suite" in source
    assert "완성 도구 상태 정리" in source
    assert "if(!confirm(" in source
    assert "window.AdminProfessionalProgramManager?.reload?.()" in source
    assert "$('aopSync').addEventListener('click',syncCanonical)" in source


def test_release_version_is_synchronized_for_new_workflow():
    version = json.loads(read("version.json"))
    expected = str(version["version"]).strip()
    sw = read("sw.js")
    firebase = read("js/firebase-config.js")
    assert expected
    assert f"APP_VERSION='{expected}'" in sw
    assert f"/js/sw-register.js?v={expected}" in firebase
