from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]


def read(path: str) -> str:
    return (ROOT / path).read_text(encoding="utf-8")


def test_embedded_design_editor_delegates_access_gate_to_modular_parent():
    source = read("js/app-boot-guard.js")
    assert "function hasDelegatedModularParentGate()" in source
    assert "parentRoot?.dataset?.programStudioModularApp==='1'" in source
    assert "frame?.contentWindow===window" in source
    assert "root.dataset.parentAccessDelegated='true'" in source
    assert "if(delegatedParentGate){" in source
    assert "reveal();" in source


def test_embedded_design_editor_gets_stable_first_paint_layout_before_runtime_enhancement():
    source = read("js/app-boot-guard.js")
    assert "function installEmbeddedDesignFirstPaint()" in source
    assert "root.dataset.designEmbeddedFirstPaint='1'" in source
    assert "#propertiesPanel{display:none!important" in source
    assert "grid-template-columns:var(--design-focused-left) minmax(0,1fr)!important" in source
    assert "#designPhase2Tools" in source
    assert "#designCanvasQuickbar{display:none!important}" in source


def test_modular_shell_never_reveals_design_before_focused_project_is_painted():
    source = read("js/studio-app-shell.js")
    assert "const projectReady=doc.documentElement.dataset.designEmbeddedProjectReady==='1'" in source
    assert "win.DesignEditorApp?.project" in source
    assert "const focusedReady=doc.documentElement.dataset.designFocusedWorkspace==='1';" in source
    assert "const bootStable=!doc.documentElement.classList.contains('app-booting');" in source
    assert "Boolean(win.DesignEditorFocusedWorkspace)||" not in source
    assert "if(app?.kind==='design'){" in source
    assert "markFrameReady('load-stable-project')" in source
    assert "fastRevealStage:'modular-design-stable-project-reveal-v3'" in source


def test_deployment_version_busts_cached_boot_guard_after_embedded_fix():
    version = read("version.json")
    sw_register = read("js/sw-register.js")
    sw = read("sw.js")
    firebase = read("js/firebase-config.js")
    assert '"version": "2026.09.02.001"' in version
    assert '"label": "포스터·전단지 통합, 소책자 메인 제거, 디자인 로딩 최적화"' in version
    assert "const VERSION='2026.09.02.001'" in sw_register
    assert "const APP_VERSION='2026.09.02.001'" in sw
    assert "/js/sw-register.js?v=2026.09.02.001" in firebase
