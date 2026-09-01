import json
from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]
FIREBASE = ROOT / "firebase.json"
REGISTER = ROOT / "js" / "sw-register.js"
CATALOG = ROOT / "js" / "admin-program-catalog-manager.js"
ICONS = ROOT / "js" / "admin-program-icon-palette.js"


def test_firebase_clean_urls_keep_admin_catalog_available():
    config = json.loads(FIREBASE.read_text(encoding="utf-8"))
    assert config["hosting"]["cleanUrls"] is True

    register = REGISTER.read_text(encoding="utf-8")
    assert "isPath('/admin','/admin.html')" in register
    assert "/js/admin-program-catalog-manager.js?v=20260808-1" in register
    assert "/js/admin-program-icon-palette.js?v=20260808-1" in register
    assert "admin-service-image-library" not in register


def test_admin_catalog_modules_accept_clean_and_html_routes():
    catalog = CATALOG.read_text(encoding="utf-8")
    assert "path !== '/admin'" in catalog
    assert "path !== '/admin.html'" in catalog
    assert "카테고리·프로그램" in catalog

    icons = ICONS.read_text(encoding="utf-8")
    assert "path !== '/admin'" in icons
    assert "path !== '/admin.html'" in icons
    assert "아이콘 선택" in icons
