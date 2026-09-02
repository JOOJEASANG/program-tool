from __future__ import annotations

import importlib.util
from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]


def read(path: str) -> str:
    return (ROOT / path).read_text(encoding="utf-8")


def test_main_profile_control_is_compact_and_business_name_only():
    refine = read("js/home-header-footer-refine.js")
    firebase = read("js/firebase-config.js")
    assert "width:28px!important" in refine
    assert "border-radius:8px!important" in refine
    assert "footer-business-name" in refine
    assert "대표 " not in firebase
    assert "사업자등록번호 " not in firebase
    assert "business.bizName" in firebase


def test_version_badge_is_not_rendered():
    version_helper = read("js/app-version.js")
    assert "appVersionBadge" not in version_helper
    assert "버전 ${currentVersion}" not in version_helper
    assert "programStudioVersion" in version_helper


def test_preflight_uses_single_column_task_flow():
    balance = read("js/pdf-preflight-panel-balance.js")
    assert "grid-template-columns:1fr!important" in balance
    assert ".workspace>.panel" in balance
    assert "height:auto!important" in balance
    assert "display:block!important" in balance
    assert "PDF 선택" in balance
    assert "인쇄 전 검사" in balance
    assert "인쇄 전 확인 항목" in balance


def test_boot_guard_is_injected_only_into_dynamic_pages():
    script_path = ROOT / "scripts" / "inject_boot_guard.py"
    spec = importlib.util.spec_from_file_location("inject_boot_guard", script_path)
    assert spec and spec.loader
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)

    index_path = ROOT / "index.html"
    source = '<html><head><title>x</title></head><body><script src="js/firebase-config.js"></script></body></html>'
    updated = module.inject_guard(
        source,
        "2026.07.24.006",
        favicon=module.requires_favicon(index_path),
        metadata=module.page_metadata(index_path),
    )
    assert module.MARKER in updated
    assert updated.index(module.MARKER) < updated.index(module.META_MARKER)
    assert module.should_inject(index_path, source)
    assert not module.should_inject(ROOT / "plain.html", "<html><head></head><body></body></html>")
    assert not module.should_inject(index_path, updated)


def test_inline_boot_guard_is_injected_for_protected_pages():
    script_path = ROOT / "scripts" / "inject_boot_guard.py"
    spec = importlib.util.spec_from_file_location("inject_boot_guard", script_path)
    assert spec and spec.loader
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)

    preflight_path = ROOT / "pdf-preflight" / "index.html"
    source = '<html><head></head><body></body></html>'
    updated = module.inject_guard(
        source,
        "2026.07.24.006",
        approval_required=True,
        favicon=module.requires_favicon(preflight_path),
        metadata=module.page_metadata(preflight_path),
    )
    assert module.INLINE_BOOT_GUARD_MARKER in updated
    assert module.MARKER in updated
    assert updated.index(module.INLINE_BOOT_GUARD_MARKER) < updated.index('src="/js/app-boot-guard.js')
    assert not module.should_inject(preflight_path, updated)


def test_preview_and_production_deploy_run_boot_guard_injection():
    preview = read(".github/workflows/firebase-preview.yml")
    deploy = read(".github/workflows/firebase-deploy.yml")
    command = "python3 scripts/inject_boot_guard.py"
    preview_deploy = "bash scripts/firebase_ci.sh hosting:channel:deploy"
    production_deploy = "bash scripts/firebase_ci.sh deploy"
    assert command in preview
    assert command in deploy
    assert preview.index(command) < preview.index(preview_deploy)
    assert deploy.index(command) < deploy.index(production_deploy)


def test_optional_helpers_do_not_block_public_first_paint():
    register = read("js/sw-register.js")
    boot = register[register.index("async function boot()") :]
    assert "const protectedPage=isProtectedRuntimePage();" in boot
    assert "const helpersPromise=protectedPage?helpers():nextPaint().then(helpers);" in boot
    assert "window.ProgramStudioRuntimeReady=helpersPromise" in boot
    assert "cleanupLegacyRuntime()" in boot
    assert "if(!protectedPage){" in boot
    assert "await Promise.race([helpersPromise,delay(1000)])" in boot
    assert boot.index("if(!protectedPage){") < boot.index("await Promise.race([helpersPromise,delay(1000)])")
    assert "location.reload()" not in register
    assert "location.replace(" not in register
    assert "setTimeout(()=>{if(!isProtectedRuntimePage())reveal()},600)" in register


def test_home_helpers_run_only_on_the_root_home_page():
    register = read("js/sw-register.js")
    assert "function isHome(){return currentPath==='/'||currentPath==='/index.html'}" in register
    assert "location.pathname.endsWith('/index.html')" not in register
    assert "if(isHome())" in register
