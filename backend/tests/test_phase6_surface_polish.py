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


