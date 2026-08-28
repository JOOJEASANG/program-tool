from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]


def source(relative: str) -> str:
    return (ROOT / relative).read_text(encoding="utf-8")


def test_recovery_worker_never_intercepts_page_requests() -> None:
    worker = source("sw.js")
    assert "self.addEventListener('fetch'" not in worker
    assert "respondWith" not in worker
    assert "purgeProgramStudioCaches" in worker
    assert "CACHE_PREFIX='program-studio-'" in worker
    assert "self.registration.unregister()" in worker


def test_recovery_worker_purges_cache_before_unregistering() -> None:
    worker = source("sw.js")
    install_block = worker.split("self.addEventListener('install'", 1)[1].split(
        "self.addEventListener('activate'", 1
    )[0]
    activate_block = worker.split("self.addEventListener('activate'", 1)[1].split(
        "self.addEventListener('message'", 1
    )[0]
    disable_block = worker.split("async function disableServiceWorker()", 1)[1].split(
        "self.addEventListener('install'", 1
    )[0]
    assert "self.skipWaiting()" in install_block
    assert "self.clients.claim()" in activate_block
    assert "disableServiceWorker" in activate_block
    assert disable_block.index("purgeProgramStudioCaches") < disable_block.index(
        "self.registration.unregister()"
    )


def test_optional_boot_helpers_preserve_public_first_paint_and_protected_gate() -> None:
    register = source("js/sw-register.js")
    guard = source("js/app-boot-guard.js")

    assert "const protectedPage=isProtectedRuntimePage();" in register
    assert "const helpersPromise=protectedPage?helpers():nextPaint().then(helpers);" in register
    assert "if(isProtectedRuntimePage())return false;" in register
    assert "await Promise.race([helpersPromise,delay(1000)])" in register
    assert "setTimeout(()=>{if(!isProtectedRuntimePage())reveal()},600)" in register
    assert "cleanupLegacyRuntime" in register
    assert "navigator.serviceWorker.getRegistrations" in register
    assert "registration.unregister()" in register
    assert "navigator.serviceWorker.register" not in register
    assert "location.reload()" not in register
    assert "location.replace(" not in register

    assert "opacity:0" not in guard
    assert "if(!protectedProgram){" in guard
    assert "window.ProgramStudioBoot={...(window.ProgramStudioBoot||{}),reveal,protectedProgram};" in guard
    assert "setTimeout(reveal,1800)" not in guard


def test_access_guard_has_timeout_parallel_reads_and_visibility_watchdog() -> None:
    firebase = source("js/firebase-config.js")
    assert "Promise.all([adminPromise, profilePromise])" in firebase
    assert "const timeoutMs = Math.max(3000, Number(options.timeoutMs) || 8000)" in firebase
    assert "status=timeout" in firebase
    assert "const watchdog = setTimeout" in firebase
    assert "root.style.visibility = ''" in firebase
