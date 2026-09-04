from __future__ import annotations
import importlib.util
from pathlib import Path
ROOT=Path(__file__).resolve().parents[2]
def read(path:str)->str:return (ROOT/path).read_text(encoding="utf-8")
def test_main_home_is_static_and_business_name_only():
 index=read("index.html"); firebase=read("js/firebase-config.js")
 assert 'data-home-static-professional="1"' in index
 for label in ("인쇄물 사전 검토","PDF 편집 · 인쇄배치","PDF 도구 모음"): assert label in index
 assert "대표 " not in firebase and "사업자등록번호 " not in firebase and "business.bizName" in firebase
def test_version_badge_is_not_rendered():
 source=read("js/app-version.js"); assert "appVersionBadge" not in source; assert "버전 ${currentVersion}" not in source; assert "programStudioVersion" in source
def test_preflight_uses_left_tools_right_results_task_flow():
 source=read("js/pdf-preflight-panel-balance.js")
 for marker in ("left-tools-right-results-v1","grid-template-columns:minmax(350px,420px) minmax(0,1fr)!important","pdf-preflight-input-panel","pdf-preflight-output-panel","PDF 파일 업로드","검사 · PDF 유틸리티","작업 진행 · 결과","인쇄 전 검사","인쇄 전 확인 항목"): assert marker in source
def _injector():
 path=ROOT/"scripts"/"inject_boot_guard.py"; spec=importlib.util.spec_from_file_location("inject_boot_guard",path); assert spec and spec.loader; module=importlib.util.module_from_spec(spec); spec.loader.exec_module(module); return module
def test_boot_guard_is_injected_only_into_dynamic_pages():
 module=_injector(); index_path=ROOT/"index.html"; source='<html><head><title>x</title></head><body><script src="js/firebase-config.js"></script></body></html>'; updated=module.inject_guard(source,"2026.07.24.006",favicon=module.requires_favicon(index_path),metadata=module.page_metadata(index_path)); assert module.MARKER in updated; assert updated.index(module.MARKER)<updated.index(module.META_MARKER); assert module.should_inject(index_path,source); assert not module.should_inject(ROOT/"plain.html","<html><head></head><body></body></html>"); assert not module.should_inject(index_path,updated)
def test_inline_boot_guard_is_injected_for_protected_pages():
 module=_injector(); path=ROOT/"pdf-preflight"/"index.html"; source='<html><head></head><body></body></html>'; updated=module.inject_guard(source,"2026.07.24.006",approval_required=True,favicon=module.requires_favicon(path),metadata=module.page_metadata(path)); assert module.INLINE_BOOT_GUARD_MARKER in updated; assert module.MARKER in updated; assert updated.index(module.INLINE_BOOT_GUARD_MARKER)<updated.index('src="/js/app-boot-guard.js'); assert not module.should_inject(path,updated)
def test_preview_and_production_deploy_run_boot_guard_injection():
 preview=read(".github/workflows/firebase-preview.yml"); deploy=read(".github/workflows/firebase-deploy.yml"); command="python3 scripts/inject_boot_guard.py"; assert command in preview and command in deploy; assert preview.index(command)<preview.index("bash scripts/firebase_ci.sh hosting:channel:deploy"); assert deploy.index(command)<deploy.index("bash scripts/firebase_ci.sh deploy")
def test_optional_helpers_do_not_block_public_first_paint():
 register=read("js/sw-register.js"); boot=register[register.index("async function boot()"):]
 for marker in ("const protectedPage=isProtectedRuntimePage();","const helpersPromise=protectedPage?helpers():nextPaint().then(helpers);","window.ProgramStudioRuntimeReady=helpersPromise","cleanupLegacyRuntime()","if(!protectedPage){","await Promise.race([helpersPromise,delay(1000)])","setTimeout(()=>{if(!isProtectedRuntimePage())reveal()},600)"): assert marker in boot or marker in register
 assert boot.index("if(!protectedPage){")<boot.index("await Promise.race([helpersPromise,delay(1000)])"); assert "location.reload()" not in register; assert "location.replace(" not in register
def test_static_home_has_no_retired_overlay_helpers():
 register=read("js/sw-register.js")
 for marker in ("home-dashboard-v2.js","home-header-footer-refine.js","home-hero-upgrade.js","home-pdf-utility-name-sync.js","home-print-workflow.js","home-professional-suite.js","home-program-catalog.js","if(isHome())"): assert marker not in register
