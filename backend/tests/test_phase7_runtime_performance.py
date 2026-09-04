from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]


def read(path: str) -> str:
    return (ROOT / path).read_text(encoding="utf-8")


def test_public_boot_guard_has_no_artificial_timeout_or_loading_curtain():
    source = read("js/app-boot-guard.js")
    public_block = source.split("if(!protectedProgram){", 1)[1].split("root.classList.add('app-booting')", 1)[0]

    assert "reveal('public');" in public_block
    assert "setTimeout" not in public_block
    assert "programStudioBootGuardStyle" not in public_block
    assert "setTimeout(reveal,1800)" not in source
    assert "protectedProgram" in source


def test_runtime_loader_defers_public_helpers_but_never_unlocks_protected_tools():
    source = read("js/sw-register.js")
    reveal_block = source.split("const reveal=()=>{", 1)[1].split("};", 1)[0]
    boot_block = source.split("async function boot(){", 1)[1]

    assert "if(isProtectedRuntimePage())return false;" in reveal_block
    assert "const protectedPage=isProtectedRuntimePage();" in boot_block
    assert "const helpersPromise=protectedPage?helpers():nextPaint().then(helpers);" in boot_block
    assert "bootStrategy:protectedPage?'approval-gated-runtime':'public-first-paint'" in boot_block
    assert "if(!protectedPage){" in boot_block
    assert "await Promise.race([helpersPromise,delay(1000)])" in boot_block
    assert "if(!protectedPage){reveal();" in boot_block
    assert "if(isProtectedRuntimePage())return false;" in source


def test_historical_runtime_filename_does_not_register_a_service_worker():
    source = read("js/sw-register.js")
    assert "Historical filename" in source
    assert "navigator.serviceWorker.register" not in source
    assert "navigator.serviceWorker.getRegistrations" in source
    assert "registration.unregister()" in source
