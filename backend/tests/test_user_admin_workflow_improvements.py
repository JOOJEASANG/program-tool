from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]


def read(path: str) -> str:
    return (ROOT / path).read_text(encoding="utf-8")


def test_runtime_boot_loads_print_workflow_modules():
    runtime = read("js/sw-register.js")
    app_version = read("js/app-version.js")

    for asset in (
        "/js/home-print-workflow.js",
        "/js/admin-operations-overview.js",
        "/js/pdf-editor-final-check.js",
        "/js/pdf-print-readiness.js",
    ):
        assert asset in runtime
        assert asset in app_version

    assert "const VERSION='2026.08.24.009'" in runtime


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


def test_home_explains_the_print_workflow_and_keeps_secondary_tools_secondary():
    workflow = read("js/home-print-workflow.js")
    suite = read("js/home-professional-suite.js")

    assert "인쇄 작업 빠른 시작" in workflow
    assert "PDF 편집 · 인쇄배치" in workflow
    assert "인쇄 전 검사" in workflow
    assert "검사 후 PDF 저장" in workflow
    assert 'href="/pdf-editor/"' in workflow
    assert 'href="/pdf-preflight/"' in workflow

    assert "id:'document-editor'" not in suite
    assert "conversion-ocr" not in suite
    assert "print-production-home-v3" in suite
    assert "HOME_PROGRAM_ORDER=['design-editor','pdf-editor','pdf-utility','image-editor']" in suite
    assert "for(const item of source)" in suite
    assert "status:item?.status==='active'?'active':'coming'" in suite
    assert "return safeUrl(raw,base.url)" in suite


def test_admin_operations_overview_is_explicit_and_non_destructive():
    source = read("js/admin-operations-overview.js")

    for route in (
        "pdf-editor/",
        "pdf-preflight/",
        "image-editor/",
        "design-editor/",
        "document-editor/",
    ):
        assert route in source

    assert "professional_program_suite" in source
    assert "완성 도구 상태 정리" in source
    assert "if(!confirm(" in source
    assert "visible:true" in source  # only used when a canonical tool is missing
    assert "source[index]={...source[index],url:tool.url,status:'active'}" in source
    assert "window.AdminProfessionalProgramManager?.reload?.()" in source
    assert "$('aopSync').addEventListener('click',syncCanonical)" in source


def test_release_version_is_synchronized_for_new_workflow():
    version = read("version.json")
    sw = read("sw.js")
    firebase = read("js/firebase-config.js")

    assert '"version": "2026.08.24.009"' in version
    assert "APP_VERSION='2026.08.24.009'" in sw
    assert "/js/sw-register.js?v=2026.08.24.009" in firebase
