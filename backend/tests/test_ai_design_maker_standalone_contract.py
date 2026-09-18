from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]


def test_ai_design_maker_is_separate_from_review_ui():
    review_html = (ROOT / "print-checker" / "index.html").read_text(encoding="utf-8")
    maker_html = (ROOT / "ai-design-maker" / "index.html").read_text(encoding="utf-8")
    maker_js = (ROOT / "js" / "ai-design-maker.js").read_text(encoding="utf-8")

    assert "<title>디자인 검토 · Program Studio</title>" in review_html
    assert "design-cover-maker.js" not in review_html
    assert "design-cover-maker.css" not in review_html
    assert "<title>AI 디자인 제작 · Program Studio</title>" in maker_html
    assert "/api/preflight/ai-design-maker/cover-background" in maker_js
    assert "https://api-7a5qpwzezq-uc.a.run.app" in maker_js
    assert "resolveApiUrl" in maker_js
    assert "X-Request-ID" in maker_js
    assert "program-sidebar-actions.js?v=20260918-1" in maker_html
    assert "/api/preflight/ai-design/cover-image" not in maker_js


def test_standalone_cover_endpoint_is_registered():
    router = (ROOT / "backend" / "routers" / "preflight_ai_design.py").read_text(encoding="utf-8")
    assert '@blueprint.route("/ai-design-maker/cover-background", methods=["POST"])' in router
    assert "Standalone AI design maker cover generation failed" in router


def test_home_exposes_review_and_ai_design_as_two_programs():
    launcher = (ROOT / "js" / "pdf-suite-home-launcher.js").read_text(encoding="utf-8")
    assert "name:'디자인 검토'" in launcher
    assert "name:'AI 디자인 제작'" in launcher
    assert "url:'print-checker/'" in launcher
    assert "url:'ai-design-maker/'" in launcher


def test_ai_design_maker_bypasses_hosting_timeout_and_uses_shared_sidebar_actions():
    maker_js = (ROOT / "js" / "ai-design-maker.js").read_text(encoding="utf-8")
    sidebar_js = (ROOT / "js" / "program-sidebar-actions.js").read_text(encoding="utf-8")
    firebase = (ROOT / "firebase.json").read_text(encoding="utf-8")
    main_py = (ROOT / "backend" / "main.py").read_text(encoding="utf-8")

    assert "AI_DIRECT_API_ORIGIN" in maker_js
    assert "fetch(target" in maker_js
    assert "AI_GATEWAY_ERROR" in maker_js
    assert "AI_DIRECT_API_NETWORK" in maker_js
    assert "return 'ai-design-maker'" in sidebar_js
    assert "function mountAiDesignMaker()" in sidebar_js
    assert "aiDesignSessionSaveBtn" in sidebar_js
    assert "aiDesignSessionLoadBtn" in sidebar_js
    assert "https://*.a.run.app" in firebase
    assert "timeout_sec=600" in main_py
