from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]


def read(path: str) -> str:
    return (ROOT / path).read_text(encoding="utf-8")


def test_general_editor_loads_stability_bootstrap_before_firebase_and_editor_runtime():
    html = read("design-editor/general.html")
    bootstrap = '../js/design-editor/embedded-stability-bootstrap.js?v=20260901-1'
    firebase = 'https://www.gstatic.com/firebasejs/9.23.0/firebase-app-compat.js'
    app = '../js/design-editor/app.js?v=20260821-1'
    assert bootstrap in html
    assert html.index(bootstrap) < html.index(firebase) < html.index(app)


def test_stability_bootstrap_starts_requested_project_before_heavy_runtime_chain():
    source = read("js/design-editor/embedded-stability-bootstrap.js")
    assert "function startRequestedProjectEarly()" in source
    assert "function probeEarlyProject()" in source
    assert "app.startProject(preset);" in source
    assert "root.dataset.designEarlyProject='started'" in source
    assert "if(mode==='cover'&&!ensureEarlyCoverPreset())return false;" in source
    assert "stage:'embedded-design-stable-canvas-bootstrap-v3-direct-entry-safe-resize'" in source


def test_stability_bootstrap_coalesces_only_unchanged_startup_synthetic_resizes():
    source = read("js/design-editor/embedded-stability-bootstrap.js")
    assert "const syntheticCoalesceDeadline=Date.now()+4200;" in source
    assert "event.isTrusted!==false" in source
    assert "if(Date.now()>syntheticCoalesceDeadline)" in source
    assert "event.stopImmediatePropagation();" in source
    assert "signature===lastSyntheticResizeSignature" in source
    assert "function surfaceContentSignature(surface)" in source
    assert "surfaceContentSignature(surface)" in source
    assert "project.cover?.spineDirection" in source


def test_stability_bootstrap_forwards_one_real_resize_for_changed_project_state():
    source = read("js/design-editor/embedded-stability-bootstrap.js")
    assert "let forwardingSyntheticResize=false;" in source
    assert "if(forwardingSyntheticResize)return;" in source
    assert "forwardingSyntheticResize=true;" in source
    assert "window.dispatchEvent(new Event('resize'))" in source
    assert "finally{forwardingSyntheticResize=false;}" in source
    assert "viewport.fit({center:false})" in source
    assert "designSyntheticResizeCoalesced='1'" in source


def test_stability_bootstrap_keeps_parent_authorized_iframe_visible_for_legacy_routes():
    source = read("js/design-editor/embedded-stability-bootstrap.js")
    assert "function delegatedParent()" in source
    assert "parentRoot?.dataset?.programStudioModularApp==='1'" in source
    assert "frame?.contentWindow===window" in source
    assert "root.style.visibility==='hidden'" in source
    assert "root.style.removeProperty('visibility')" in source
    assert "byId('authLoading')?.classList.add('hidden')" in source


def test_stability_bootstrap_marks_only_painted_project_as_ready():
    source = read("js/design-editor/embedded-stability-bootstrap.js")
    assert "function projectIsPaintReady()" in source
    assert "shell.classList.contains('hidden')" in source
    assert "rect.width>20&&rect.height>20" in source
    assert "root.dataset.designEmbeddedProjectReady='1'" in source
    assert "root.dataset.designEmbeddedCanvasStable='1'" in source
