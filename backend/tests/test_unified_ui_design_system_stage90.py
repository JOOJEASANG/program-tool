from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]


def read(path: str) -> str:
    return (ROOT / path).read_text(encoding="utf-8")


def test_global_design_system_covers_every_product_surface():
    css = read("css/program-studio-ui-v2.css")
    ui = read("js/program-studio-ui-v2.js")

    for token in (
        "--ps-control-h:40px",
        "--ps-font-ui:13px",
        "--ps-font-help:11.5px",
        "--ps-focus-ring",
        "--ps-success-soft",
        "--ps-warning-soft",
        "--ps-danger-soft",
    ):
        assert token in css

    for surface in (
        "home",
        "auth",
        "approval",
        "admin",
        "pdf-editor",
        "pdf-preflight",
        "design-editor",
        "document-editor",
        "image-editor",
        "legal",
    ):
        assert f'data-program-surface="{surface}"' in css

    assert "classList.add('ps-ui-v2','ps-ui-v3')" in ui
    assert "programDesignSystem='unified-v3'" in ui
    assert "designSystem:'unified-v3'" in ui


def test_shared_controls_have_accessible_states_and_landmarks():
    css = read("css/program-studio-ui-v2.css")
    ui = read("js/program-studio-ui-v2.js")

    for marker in (
        ".ps-global-skip-link",
        'data-ps-action="primary"',
        'data-ps-action="danger"',
        ":focus-visible",
        "prefers-reduced-motion:reduce",
    ):
        assert marker in css

    for marker in (
        "function mountSkipLink()",
        "function enhanceControl(node)",
        "function observeNewControls()",
        "본문으로 바로가기",
        "requestAnimationFrame(flush)",
    ):
        assert marker in ui

    assert "setInterval(" not in ui


def test_standalone_app_shell_uses_the_same_readability_floor():
    css = read("css/studio-app-shell.css")
    html = read("apps/index.html")

    for marker in (
        "--header-h:110px",
        ".product-quick-actions button{height:34px",
        ".product-context-copy strong{font-size:12px}",
        ".product-context-copy small{margin-top:3px;font-size:10px",
        ".workspace-error button{min-height:40px",
    ):
        assert marker in css

    assert "/css/studio-app-shell.css?v=20260901-3" in html


def test_visual_release_version_is_synchronized():
    config = read("js/firebase-config.js")
    injector = read("scripts/inject_boot_guard.py")
    assert "const UI_VERSION = '20260902-01'" in config
    assert "/js/sw-register.js?v=2026.09.02.001" in config
    assert "UI_STYLE_MARKER = \"data-program-studio-ui\"" in injector
    assert "link[data-program-studio-ui]" in config
