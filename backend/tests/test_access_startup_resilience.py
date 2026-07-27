from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]


def source(relative: str) -> str:
    return (ROOT / relative).read_text(encoding="utf-8")


def test_navigation_failure_never_substitutes_home_for_tool_page() -> None:
    worker = source("sw.js")
    assert "matchNavigationFallback" in worker
    assert "url.pathname==='/'||url.pathname==='/index.html'" in worker
    assert "caches.match('/index.html'))||" not in worker
    assert "/tools/pdf-editor.html" in worker
    assert "/tools/preflight.html" in worker
    assert "/tools/perfect-binding-cover.html" in worker


def test_old_cache_is_removed_only_after_new_worker_installs() -> None:
    worker = source("sw.js")
    install_block = worker.split("self.addEventListener('install'", 1)[1].split(
        "self.addEventListener('activate'", 1
    )[0]
    activate_block = worker.split("self.addEventListener('activate'", 1)[1].split(
        "self.addEventListener('message'", 1
    )[0]
    assert "precacheCore" in install_block
    assert "clearOldCaches" not in install_block
    assert "clearOldCaches" in activate_block
    assert "Promise.all(CORE_ASSETS" in worker


def test_optional_boot_helpers_do_not_block_page_for_five_seconds() -> None:
    register = source("js/sw-register.js")
    guard = source("js/app-boot-guard.js")
    assert "Promise.race([helpersPromise,delay(900)])" in register
    assert "setTimeout(reveal,1800)" in register
    assert "clearLegacyCaches" not in register
    assert "opacity:0" not in guard
    assert "setTimeout(reveal,1800)" in guard


def test_access_guard_has_timeout_parallel_reads_and_visibility_watchdog() -> None:
    firebase = source("js/firebase-config.js")
    assert "Promise.all([adminPromise,profilePromise])" in firebase
    assert "const timeoutMs=Math.max(3000,Number(options.timeoutMs)||8000)" in firebase
    assert "status=timeout" in firebase
    assert "const watchdog=setTimeout" in firebase
    assert "root.style.visibility=''" in firebase
