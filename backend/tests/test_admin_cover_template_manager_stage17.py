import subprocess
from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]
ADMIN_MODULE = ROOT / "js" / "admin-cover-template-manager.js"
SEPARATION_MODULE = ROOT / "js" / "cover-template-admin-separation.js"
APP_VERSION = ROOT / "js" / "app-version.js"
BEHAVIOR = ROOT / "backend" / "tests" / "test_admin_cover_template_manager_behavior.cjs"
FIRESTORE_RULES = ROOT / "firestore.rules"
STORAGE_RULES = ROOT / "storage.rules"


def test_legacy_manager_is_replaced_by_safe_service_console_on_relevant_surfaces():
    source = APP_VERSION.read_text(encoding="utf-8")
    assert "/js/admin-cover-template-manager.js" not in source
    assert "/js/admin-service-management.js" not in source
    assert source.count("/js/admin-service-console.js") == 1
    assert source.count("/js/cover-template-admin-separation.js") == 1
    assert source.count("/js/cover-provided-image-library.js") == 1
    assert "currentPath==='/admin.html'" in source
    assert "currentPath==='/tools/perfect-binding-cover.html'" in source
    assert "currentPath==='/perfect-binding-cover'" in source
    assert "currentPath.endsWith('/perfect-binding-cover/index.html')" in source


def test_legacy_admin_cover_template_manager_source_remains_compatible_for_existing_data():
    source = ADMIN_MODULE.read_text(encoding="utf-8")
    for marker in (
        "표지 제공 이미지 관리",
        "표지 템플릿",
        "회원 공개",
        "관리자 전용",
        "JPG·PNG·WEBP",
        "MAX_FILE_BYTES = 15 * 1024 * 1024",
        "db.collection('cover_templates')",
        "isPublic",
        "frontUrl",
        "backUrl",
        "frontPath",
        "backPath",
        "createdBy",
        "createdByEmail",
        "firebase.storage().ref(path)",
        "await ref.put(file",
        "await deleteStoragePath(item.frontPath)",
        "await deleteStoragePath(item.backPath)",
        "await db.collection('cover_templates').doc(item.id).delete()",
        "Promise.allSettled(uploaded.map((path) => deleteStoragePath(path)))",
        "ProgramAccess.isAdmin",
        "dedicated-admin-cover-template-management",
    ):
        assert marker in source
    for forbidden in ("setInterval(", "eval(", "innerHTML +="):
        assert forbidden not in source


def test_cover_editor_hides_legacy_admin_crud_without_showing_admin_instructions_to_members():
    source = SEPARATION_MODULE.read_text(encoding="utf-8")
    for marker in (
        "adminTemplateArea",
        "area.hidden = true",
        "area.style.display = 'none'",
        "control.disabled = true",
        "coverTemplateAdminConsoleNote')?.remove()",
        "admin-service-console-only-template-management",
    ):
        assert marker in source
    assert "관리자 페이지" not in source
    assert "saveCoverTemplate" not in source
    assert "deleteCoverTemplate" not in source


def test_existing_firebase_rules_still_support_template_management():
    firestore = FIRESTORE_RULES.read_text(encoding="utf-8")
    storage = STORAGE_RULES.read_text(encoding="utf-8")
    assert "match /cover_templates/{templateId}" in firestore
    assert "allow create: if isAdmin()" in firestore
    assert "allow update, delete: if isAdmin();" in firestore
    assert "resource.data.isPublic == true" in firestore
    assert "match /cover_templates/{templateId}/{fileName}" in storage
    assert "allow create, update: if isAdmin() && isCoverImage();" in storage
    assert "allow delete: if isAdmin();" in storage
    assert "request.resource.size <= 15728640" in storage


def test_legacy_admin_cover_template_manager_behavior_still_executes():
    result = subprocess.run(
        ["node", str(BEHAVIOR)],
        cwd=ROOT,
        text=True,
        capture_output=True,
        check=False,
    )
    assert result.returncode == 0, result.stderr or result.stdout
    assert "admin-cover-template-manager behavior passed" in result.stdout
