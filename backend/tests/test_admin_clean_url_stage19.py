import json
from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]
FIREBASE = ROOT / "firebase.json"
REGISTER = ROOT / "js" / "sw-register.js"
VERSION = ROOT / "js" / "app-version.js"
CONSOLE = ROOT / "js" / "admin-service-console.js"


def test_firebase_clean_urls_requires_admin_route_alias_support():
    config = json.loads(FIREBASE.read_text(encoding="utf-8"))
    assert config["hosting"]["cleanUrls"] is True

    register = REGISTER.read_text(encoding="utf-8")
    assert "isPath('/admin','/admin.html')" in register
    assert "/js/admin-service-console.js?v=20260808-3" in register

    version = VERSION.read_text(encoding="utf-8")
    assert "currentPath==='/admin'" in version
    assert "currentPath==='/admin.html'" in version
    assert "/js/admin-service-console.js?v=20260808-3" in version


def test_admin_service_console_accepts_clean_and_html_routes():
    source = CONSOLE.read_text(encoding="utf-8")
    assert "^\\/admin(?:\\.html)?\\/?$" in source
    assert "서비스 관리" in source
    assert "책표지 제공 이미지 등록" in source
    assert "adminServiceConsoleNav" in source
