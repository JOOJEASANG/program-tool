from __future__ import annotations

import json
from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]
ADVANCED_HTML = ROOT / "pdf-editor-advanced" / "index.html"
ADVANCED_JS = ROOT / "js" / "pdf-editor-advanced"
ADVANCED_CSS = ROOT / "css" / "pdf-editor-advanced.css"
FIREBASE = ROOT / "firebase.json"
BOOT_INJECTOR = ROOT / "scripts" / "inject_boot_guard.py"
ROUTER_INIT = ROOT / "backend" / "routers" / "__init__.py"
ADVANCED_ROUTER = ROOT / "backend" / "routers" / "pdf_advanced.py"


def test_advanced_editor_has_its_own_html_route_not_general_editor_rewrite():
    config = json.loads(FIREBASE.read_text(encoding="utf-8"))
    rewrites = config["hosting"]["rewrites"]
    advanced = next(item for item in rewrites if item.get("source") == "/pdf-editor-advanced")
    assert advanced["destination"] == "/pdf-editor-advanced/index.html"
    assert advanced["destination"] != "/pdf-editor/index.html"
    assert ADVANCED_HTML.is_file()


def test_standalone_advanced_html_never_boots_general_or_profile_runtimes():
    source = ADVANCED_HTML.read_text(encoding="utf-8").lower()
    assert "/js/pdf-editor-advanced/app.js" in source
    for forbidden in (
        "/js/pdf-editor/core-runtime.js",
        "/js/pdf-editor/advanced-runtime.js",
        "advanced-profile-scope",
        "n-up",
        "nup",
        "booklet",
        "소책자",
        "간지",
    ):
        assert forbidden not in source


def test_standalone_frontend_state_has_no_nup_booklet_or_layout_dependency():
    assert ADVANCED_JS.is_dir()
    source = "\n".join(
        path.read_text(encoding="utf-8").lower()
        for path in sorted(ADVANCED_JS.glob("*.js"))
    )
    for forbidden in (
        "nupscale",
        "nupoffset",
        "pdfnup",
        "booklet",
        "/js/pdf-editor/",
    ):
        assert forbidden not in source


def test_standalone_sidebar_owns_required_direct_edit_and_document_features():
    source = ADVANCED_HTML.read_text(encoding="utf-8")
    for marker in (
        'id="uploadBtn"',
        'id="pageList"',
        'id="scaleRange"',
        'id="offsetXRange"',
        'id="offsetYRange"',
        'id="cropLeft"',
        'id="cropTop"',
        'id="cropRight"',
        'id="cropBottom"',
        'id="eraseModeBtn"',
        'id="marginLeft"',
        'id="marginTop"',
        'id="marginRight"',
        'id="marginBottom"',
        'id="hfEnabled"',
        'id="headerLeft"',
        'id="footerRight"',
        'id="pnEnabled"',
        'id="pnPosition"',
        'id="pnFormat"',
        'id="downloadBtn"',
    ):
        assert marker in source


def test_standalone_layout_is_headerless_by_construction():
    html = ADVANCED_HTML.read_text(encoding="utf-8")
    css = ADVANCED_CSS.read_text(encoding="utf-8")
    assert '<div class="advanced-app"' in html
    assert '<aside class="advanced-sidebar"' in html
    assert '<main class="advanced-workspace"' in html
    assert "top-nav" not in html
    assert "padding-top:var(--nav-h)" not in css
    assert "height:100vh" in css


def test_standalone_advanced_html_is_protected_but_not_booklet_injected():
    source = BOOT_INJECTOR.read_text(encoding="utf-8")
    assert '"pdf-editor-advanced/index.html"' in source
    protected_block = source.split("PROTECTED_HTML =", 1)[1].split("PUBLIC_HTML =", 1)[0]
    booklet_block = source.split("PDF_BOOKLET_HTML =", 1)[1].split("PAGE_METADATA =", 1)[0]
    assert '"pdf-editor-advanced/index.html"' in protected_block
    assert '"pdf-editor-advanced/index.html"' not in booklet_block


def test_standalone_backend_uses_separate_advanced_blueprint_and_endpoints():
    router_init = ROUTER_INIT.read_text(encoding="utf-8")
    router = ADVANCED_ROUTER.read_text(encoding="utf-8")
    assert 'from .pdf_advanced import pdf_advanced_bp' in router_init
    assert 'register_blueprint(_pdf_advanced_bp, url_prefix="/advanced")' in router_init
    assert '@pdf_advanced_bp.route("/process", methods=["POST"])' in router
    assert '@pdf_advanced_bp.route("/process-storage", methods=["POST"])' in router
    assert "process_advanced_pdf_bytes" in router
    assert "process_advanced_pdf_paths" in router
