from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]


def text(path: str) -> str:
    return (ROOT / path).read_text(encoding="utf-8")


def test_phase6_surface_polish_contracts():
    source = text("js/surface-polish-v3.js")
    assert "aria-selected" in source
    assert "ps-password-toggle" in source
    assert "aria-live" in source
    assert "ps-legal-toc" in source
    assert "ps-skip-link" in source
    assert "auth-approval-legal-mobile-accessibility-v3" in source
    assert "setInterval(" not in source
    assert "beforeunload" not in source


def test_common_loader_routes_auth_approval_and_legal_surfaces():
    source = text("js/program-studio-ui-v2.js")
    assert "return 'legal'" in source
    assert "'/terms.html'" in source
    assert "'/privacy.html'" in source
    assert "'/guide.html'" in source
    assert "['auth','approval','legal'].includes(surface)" in source
    assert "/js/surface-polish-v3.js?v=20260828-1" in source


def test_design_shell_preserves_initial_route_parameters_without_breaking_stage_contract():
    source = text("design-editor/index.html")
    assert "function incomingDetail()" in source
    assert "_query:query" in source
    assert "const initialRoute=route(incomingDetail())" in source
    assert "routingStage:'query-aware-initial-route-v3-invitation'" in source
    assert "stage:'single-sidebar-general-engine-shell-no-legacy-fallback'" in source
    assert "if(mode==='cover')return '/design-editor/general?embed=1&mode=cover&preset=cover-a4'" in source
    assert "invitation:{mode:'invitation',preset:'invitation-a4'" in source
    for token in ["preset", "paper", "orientation", "fold", "w", "h"]:
        assert token in source


def test_legacy_redirects_remain_accessible_without_duplicate_preflight_html():
    redirect_paths = [
        "perfect-binding-cover/index.html",
        "tools/perfect-binding-cover.html",
        "tools/pdf-editor.html",
    ]
    for path in redirect_paths:
        source = text(path)
        assert 'name="robots" content="noindex"' in source
        assert 'aria-live="polite"' in source
        assert "location.replace(" in source

    cover = text("perfect-binding-cover/index.html")
    legacy_cover = text("tools/perfect-binding-cover.html")
    for source in [cover, legacy_cover]:
        assert "new URLSearchParams(location.search)" in source
        assert "target.searchParams.set('mode','cover')" in source
        assert "if(!target.searchParams.has('preset'))" in source
        assert "location.hash" in source

    pdf_editor = text("tools/pdf-editor.html")
    assert "location.search+location.hash" in pdf_editor

    assert not (ROOT / "tools" / "preflight.html").exists()
    assert not (ROOT / "tools" / "pdf-Checker.html").exists()
    firebase = text("firebase.json")
    for source in ("/tools/preflight", "/tools/preflight.html", "/tools/pdf-Checker", "/tools/pdf-Checker.html"):
        assert f'"source": "{source}"' in firebase
    assert firebase.count('"destination": "/pdf-preflight"') >= 4
    assert firebase.count('"type": 301') >= 4
