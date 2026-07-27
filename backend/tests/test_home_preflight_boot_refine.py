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


def test_preflight_panels_stretch_to_the_same_height():
    balance = read("js/pdf-preflight-panel-balance.js")
    assert ".workspace{align-items:stretch!important}" in balance
    assert ".workspace>.panel" in balance
    assert "height:100%!important" in balance
    assert "margin-top:auto!important" in balance


def test_boot_guard_is_injected_only_into_dynamic_pages():
    script_path = ROOT / "scripts" / "inject_boot_guard.py"
    spec = importlib.util.spec_from_file_location("inject_boot_guard", script_path)
    assert spec and spec.loader
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)

    source = '<html><head><title>x</title></head><body><script src="js/firebase-config.js"></script></body></html>'
    updated = module.inject_guard(source, "2026.07.24.006")
    assert module.MARKER in updated
    assert updated.index(module.MARKER) < updated.index("<title>")
    assert module.should_inject(Path("index.html"), source)
    assert not module.should_inject(Path("plain.html"), "<html><head></head><body></body></html>")
    assert not module.should_inject(Path("index.html"), updated)


def test_preview_and_production_deploy_run_boot_guard_injection():
    preview = read(".github/workflows/firebase-preview.yml")
    deploy = read(".github/workflows/firebase-deploy.yml")
    command = "python3 scripts/inject_boot_guard.py"
    assert command in preview
    assert command in deploy
    assert preview.index(command) < preview.index("firebase hosting:channel:deploy")
    assert deploy.index(command) < deploy.index("firebase deploy")


def test_optional_helpers_do_not_block_layout_reveal():
    register = read("js/sw-register.js")
    boot = register[register.index("async function boot()") :]
    assert "const helpersPromise=helpers();" in boot
    assert "Promise.race([helpersPromise,delay(900)])" in boot
    assert "await nextPaint();" in boot
    assert boot.index("Promise.race([helpersPromise,delay(900)])") < boot.index("reveal();")
    assert "Promise.allSettled([helpersPromise,register()])" in boot
    assert "clearLegacyCaches" not in register
    assert "setTimeout(reveal,1800)" in register


def test_home_helpers_run_only_on_the_root_home_page():
    register = read("js/sw-register.js")
    assert "function isHome(){return currentPath==='/'||currentPath==='/index.html'}" in register
    assert "location.pathname.endsWith('/index.html')" not in register
    assert "if(isHome())" in register
