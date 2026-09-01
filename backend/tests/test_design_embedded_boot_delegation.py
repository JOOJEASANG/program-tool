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


def test_deployment_version_busts_cached_boot_guard_after_embedded_fix():
    version = read("version.json")
    assert '"version": "2026.09.01.021"' in version
    assert '"label": "디자인 프로그램 임베드 로딩 안정화"' in version
