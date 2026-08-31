import json
import re
from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]
PLATFORM_HEALTH = ROOT / "js" / "platform-health.js"
RUNTIME = ROOT / "js" / "sw-register.js"
APP_VERSION = ROOT / "js" / "app-version.js"
FIREBASE_CONFIG = ROOT / "js" / "firebase-config.js"
SERVICE_WORKER = ROOT / "sw.js"
VERSION_JSON = ROOT / "version.json"


def test_platform_health_is_local_privacy_minimized_and_actionable():
    source = PLATFORM_HEALTH.read_text(encoding="utf-8")

    assert "sessionStorage.setItem(STORAGE_KEY" in source
    assert "const MAX_EVENTS=30" in source
    assert "program-studio-version-changed" in source
    assert "programstudio:runtime-script-result" in source
    assert "programstudio:runtime-ready" in source
    assert "unhandledrejection" in source
    assert "navigator.onLine===false" in source
    assert "actionLabel:'새로고침'" in source
    assert "fetch(" not in source
    assert "sendBeacon" not in source


def test_runtime_loader_fails_dependencies_closed_without_short_network_timeout():
    source = RUNTIME.read_text(encoding="utf-8")

    assert "const SCRIPT_TIMEOUT_MS=8000" in source
    assert "const loadPromises=new Map()" in source
    assert "reject(runtimeLoadError(id,src,status))" in source
    assert "script.remove()" in source
    assert "window.ProgramStudioRuntimeReady=helpersPromise" in source
    assert "programstudio:runtime-ready" in source
    assert "programStudioPlatformHealthScriptV1" in source
    assert "await load('programStudioPlatformHealthScriptV1'" not in source
    assert "setTimeout(()=>done('timeout'),1200)" not in source


def test_version_observer_rechecks_long_running_sessions_without_forced_refresh():
    source = APP_VERSION.read_text(encoding="utf-8")

    assert "const CHECK_INTERVAL_MS=10*60*1000" in source
    assert "setInterval(checkWhenActive,CHECK_INTERVAL_MS)" in source
    assert "window.addEventListener('focus',checkWhenActive)" in source
    assert "document.addEventListener('visibilitychange',checkWhenActive)" in source
    assert "window.ProgramStudioVersionCheck=()=>check({force:true})" in source
    assert "program-studio-version-changed" in source
    assert "location.reload()" not in source


def test_version_observer_marks_its_scripts_for_runtime_loader_interop():
    source = APP_VERSION.read_text(encoding="utf-8")

    assert "script.dataset.runtimeOwner='app-version'" in source
    assert "script.dataset.loaded='true'" in source
    assert "delete script.dataset.failed" in source
    assert "script.dataset.failed='error'" in source
    assert "script.addEventListener('load'" in source
    assert "script.addEventListener('error'" in source
    assert "const existing=document.getElementById(id)" in source
    assert "if(existing)return existing" in source


def test_platform_release_version_is_synchronized():
    version = json.loads(VERSION_JSON.read_text(encoding="utf-8"))["version"]
    runtime = RUNTIME.read_text(encoding="utf-8")
    firebase_config = FIREBASE_CONFIG.read_text(encoding="utf-8")
    service_worker = SERVICE_WORKER.read_text(encoding="utf-8")

    runtime_version = re.search(r"const VERSION='([^']+)'", runtime)
    sw_version = re.search(r"const APP_VERSION='([^']+)'", service_worker)

    assert runtime_version and runtime_version.group(1) == version
    assert sw_version and sw_version.group(1) == version
    assert f"/js/sw-register.js?v={version}" in firebase_config
