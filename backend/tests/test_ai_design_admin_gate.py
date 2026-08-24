from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]


def read(path: str) -> str:
    return (ROOT / path).read_text(encoding="utf-8")


def test_ai_design_gate_is_loaded_on_admin_and_design_routes():
    app_version = read("js/app-version.js")
    assert "/js/ai-design-feature-gate.js?v=20260824-1" in app_version
    assert "currentPath==='/admin'" in app_version
    assert "currentPath==='/design-editor/general'" in app_version


def test_ai_design_browser_gate_defaults_off_and_fails_closed():
    source = read("js/ai-design-feature-gate.js")
    assert "let enabled=false" in source
    assert "featureFlags" in source
    assert "aiDesignEnabled" in source
    assert "data-ai-design-control" in source
    assert "node.hidden=!enabled" in source
    assert "requireEnabled" in source
    assert "AI_DESIGN_DISABLED" in source
    assert "setState(false,true,'설정을 읽지 못해 안전하게 OFF 상태로 유지합니다.')" in source


def test_admin_can_explicitly_toggle_ai_design_mode():
    source = read("js/ai-design-feature-gate.js")
    assert "AI 디자인 생성" in source
    assert "기본값은 OFF입니다" in source
    assert "모드 켜기" in source
    assert "모드 끄기" in source
    assert "featureFlags:{[FEATURE_KEY]:desired}" in source
    assert ".set({" in source
    assert "{merge:true}" in source


def test_server_feature_flag_helper_also_fails_closed():
    source = read("backend/services/feature_flags.py")
    assert 'AI_DESIGN_KEY = "aiDesignEnabled"' in source
    assert "return flags.get(AI_DESIGN_KEY) is True" in source
    assert "except Exception:" in source
    assert "return False" in source
    assert "def require_ai_design_enabled()" in source
    assert "AI 디자인 생성 기능이 관리자 설정에서 비활성화되어 있습니다." in source
