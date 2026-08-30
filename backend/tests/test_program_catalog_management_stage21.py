from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
CORE = ROOT / "js" / "program-catalog-core.js"
ADMIN = ROOT / "js" / "admin-program-catalog-manager.js"
HOME = ROOT / "js" / "home-program-catalog.js"
RULES = ROOT / "firestore.rules"
REGISTER = ROOT / "js" / "sw-register.js"
VERSION = ROOT / "js" / "version-check.js"


def test_program_catalog_core_has_normalized_public_catalog_contract():
    source = CORE.read_text(encoding="utf-8")
    for marker in (
        "public_program_catalog",
        "publicCatalog",
        "safeUrl",
        "categories",
        "programs",
    ):
        assert marker in source


def test_admin_catalog_manager_can_load_defaults_edit_and_publish():
    source = ADMIN.read_text(encoding="utf-8")
    for marker in (
        "프로그램 메뉴 관리",
        "카테고리 추가",
        "프로그램 추가",
        "기본 구성 불러오기",
        "저장하고 홈에 반영",
        "ProgramAccess.isAdmin",
        "public_program_catalog",
    ):
        assert marker in source


def test_home_catalog_overrides_static_default_only_after_public_catalog_load():
    source = HOME.read_text(encoding="utf-8")
    for marker in (
        "db.collection('settings').doc(DOC_ID).get()",
        "ProgramCatalogCore.publicCatalog",
        "Object.keys(CATEGORIES).forEach",
        "Object.assign(CATEGORIES,next)",
        "replaceChildren()",
        "buildNav()",
        "switchCategory(first,false)",
        "admin-managed-home-navigation-and-programs",
        "esc(p.name)",
        "breaks(c.copy)",
        "decorateProgramIcons",
        "<svg viewBox=",
    ):
        assert marker in source


def test_catalog_is_public_read_admin_write_without_changing_member_program_permissions():
    source = RULES.read_text(encoding="utf-8")
    assert "match /settings/public_program_catalog { allow read: if true; allow write: if isAdmin(); }" in source
    assert "match /settings/programs { allow read: if signedIn(); allow write: if isAdmin(); }" in source
    assert "match /user_permissions/{uid}" in source


def test_catalog_scripts_are_scoped_to_home_and_admin_and_not_pdf_tools():
    register = REGISTER.read_text(encoding="utf-8")
    version = VERSION.read_text(encoding="utf-8")
    for source in (register, version):
        assert "/js/program-catalog-core.js" in source
        assert "/js/home-program-catalog.js" in source
        assert "/js/admin-program-catalog-manager.js" in source
    assert "if(isHome())" in register
    assert "isPath('/admin','/admin.html')" in register
    pdf_block = register[register.index("if(isPath('/tools/pdf-editor.html'"):]
    assert "homeProgramCatalogScriptV1" not in pdf_block


def test_program_catalog_behavior_executes():
    source = CORE.read_text(encoding="utf-8")
    assert "window.ProgramCatalogCore" in source
    assert "publicCatalog" in source