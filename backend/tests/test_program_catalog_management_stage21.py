import subprocess
from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]
CORE = ROOT / "js" / "program-catalog-core.js"
ADMIN = ROOT / "js" / "admin-program-catalog-manager.js"
HOME = ROOT / "js" / "home-program-catalog.js"
REGISTER = ROOT / "js" / "sw-register.js"
VERSION = ROOT / "js" / "app-version.js"
RULES = ROOT / "firestore.rules"
BEHAVIOR = ROOT / "backend" / "tests" / "test_program_catalog_behavior.cjs"


def test_catalog_core_keeps_current_home_as_safe_default_and_supports_free_names():
    source = CORE.read_text(encoding="utf-8")
    for marker in (
        "PDF·인쇄",
        "단체·행사",
        "사무 자동화",
        "AI 도우미",
        "PDF 편집기",
        "PDF유틸리티",
        "PDF 인쇄 검수",
        "책표지제작",
        "const originalName = text(item.name, 80) || '새 프로그램'",
        "const name = id === 'pdf-preflight'",
        "name,",
        "visible: bool(item.visible, true)",
        "MAX_CATEGORIES = 30",
        "MAX_PROGRAMS_PER_CATEGORY = 60",
    ):
        assert marker in source


def test_admin_catalog_manager_supports_edit_reorder_drag_cross_category_and_visibility():
    source = ADMIN.read_text(encoding="utf-8")
    for marker in (
        "홈 카테고리·프로그램 관리",
        "카테고리명",
        "프로그램명",
        "data-cat-up",
        "data-cat-down",
        "data-prog-up",
        "data-prog-down",
        "application/x-pcat-category",
        "application/x-pcat-program",
        "moveProgramToCategory",
        "소속 카테고리",
        "홈에 공개",
        "숨김",
        "사용 가능",
        "준비 중",
        "프로그램 주소",
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
    result = subprocess.run(
        ["node", str(BEHAVIOR)],
        cwd=ROOT,
        text=True,
        capture_output=True,
        check=False,
    )
    assert result.returncode == 0, result.stderr or result.stdout
    assert "program catalog behavior passed" in result.stdout