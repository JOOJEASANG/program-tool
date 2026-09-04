import subprocess
from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]
CORE = ROOT / "js" / "program-catalog-core.js"
ADMIN = ROOT / "js" / "admin-program-catalog-manager.js"
REGISTER = ROOT / "js" / "sw-register.js"
RULES = ROOT / "firestore.rules"
BEHAVIOR = ROOT / "backend" / "tests" / "test_program_catalog_behavior.cjs"
INDEX = ROOT / "index.html"


def test_catalog_core_still_supports_admin_catalog_data_safely():
    source = CORE.read_text(encoding="utf-8")
    for marker in (
        "const originalName = text(item.name, 80) || '새 프로그램'",
        "visible: bool(item.visible, true)",
        "MAX_CATEGORIES = 30",
        "MAX_PROGRAMS_PER_CATEGORY = 60",
    ):
        assert marker in source


def test_admin_catalog_manager_supports_edit_reorder_and_visibility():
    source = ADMIN.read_text(encoding="utf-8")
    for marker in (
        "홈 카테고리·프로그램 관리",
        "카테고리명",
        "프로그램명",
        "moveProgramToCategory",
        "홈에 공개",
        "ProgramAccess.isAdmin",
        "public_program_catalog",
    ):
        assert marker in source


def test_public_home_is_static_and_does_not_load_catalog_overlay():
    index = INDEX.read_text(encoding="utf-8")
    register = REGISTER.read_text(encoding="utf-8")
    assert 'data-home-static-professional="1"' in index
    assert not (ROOT / "js" / "home-program-catalog.js").exists()
    assert "/js/home-program-catalog.js" not in register
    assert "if(isHome())" not in register


def test_catalog_is_public_read_admin_write_without_changing_member_program_permissions():
    source = RULES.read_text(encoding="utf-8")
    assert "match /settings/public_program_catalog { allow read: if true; allow write: if isAdmin(); }" in source
    assert "match /settings/programs { allow read: if signedIn(); allow write: if isAdmin(); }" in source
    assert "match /user_permissions/{uid}" in source


def test_catalog_scripts_are_admin_scoped_and_not_pdf_tools():
    register = REGISTER.read_text(encoding="utf-8")
    assert "/js/program-catalog-core.js" in register
    assert "/js/admin-program-catalog-manager.js" in register
    assert "isPath('/admin','/admin.html')" in register
    pdf_block = register[register.index("if(isPath('/tools/pdf-editor.html'"):]
    assert "adminProgramCatalogManagerScriptV1" not in pdf_block


def test_program_catalog_behavior_executes():
    result = subprocess.run(["node", str(BEHAVIOR)], cwd=ROOT, text=True, capture_output=True, check=False)
    assert result.returncode == 0, result.stderr or result.stdout
    assert "program catalog behavior passed" in result.stdout
