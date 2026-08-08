import json
from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]
FIREBASE = ROOT / "firebase.json"
REGISTER = ROOT / "js" / "sw-register.js"
VERSION = ROOT / "js" / "app-version.js"
CONSOLE = ROOT / "js" / "admin-service-image-library.js"


def test_firebase_clean_urls_requires_admin_route_alias_support():
    config = json.loads(FIREBASE.read_text(encoding="utf-8"))
    assert config["hosting"]["cleanUrls"] is True

    register = REGISTER.read_text(encoding="utf-8")
    assert "isPath('/admin','/admin.html')" in register
    assert "/js/admin-service-image-library.js?v=20260808-1" in register

    version = VERSION.read_text(encoding="utf-8")
    assert "currentPath==='/admin'" in version
    assert "currentPath==='/admin.html'" in version
    assert "/js/admin-service-image-library.js?v=20260808-1" in version


def test_admin_service_image_console_accepts_clean_and_html_routes():
    source = CONSOLE.read_text(encoding="utf-8")
    assert "path !== '/admin'" in source
    assert "path !== '/admin.html'" in source
    assert "서비스 이미지 관리" in source
    assert "PDF 편집 · 간지 이미지" in source
    assert "책표지 제작 · 표지 이미지" in source
    assert "adminServiceImageNav" in source
