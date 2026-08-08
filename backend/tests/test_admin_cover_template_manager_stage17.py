import subprocess
from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]
ADMIN_MODULE = ROOT / "js" / "admin-cover-template-manager.js"
SEPARATION_MODULE = ROOT / "js" / "cover-template-admin-separation.js"
APP_VERSION = ROOT / "js" / "app-version.js"
BEHAVIOR = ROOT / "backend" / "tests" / "test_admin_cover_template_manager_behavior.cjs"
FIRESTORE_RULES = ROOT / "firestore.rules"
STORAGE_RULES = ROOT / "storage.rules"


def test_admin_cover_template_manager_is_loaded_only_on_relevant_surfaces():
    source = APP_VERSION.read_text(encoding="utf-8")
    assert source.count("/js/admin-cover-template-manager.js") == 1
    assert source.count("/js/cover-template-admin-separation.js") == 1
    assert "currentPath==='/admin.html'" in source
    assert "currentPath==='/tools/perfect-binding-cover.html'" in source
    assert "currentPath==='/perfect-binding-cover'" in source
    assert "currentPath.endsWith('/perfect-binding-cover/index.html')" in source


def test_admin_cover_template_manager_has_dedicated_crud_and_safe_upload_contract():
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


def test_cover_editor_keeps_only_user_facing_template_controls():
    source = SEPARATION_MODULE.read_text(encoding="utf-8")
    for marker in (
        "adminTemplateArea",
        "area.hidden = true",
        "area.style.display = 'none'",
        "control.disabled = true",
        "관리자 페이지의 “표지 템플릿” 메뉴에서 관리합니다.",
        "admin-console-only-template-management",
    ):
        assert marker in source
    assert "coverTemplateSelect" not in source
    assert "applyCoverTemplate" not in source
    assert "refreshCoverTemplates" in source


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


def test_admin_cover_template_manager_behavior_executes():
    result = subprocess.run(
        ["node", str(BEHAVIOR)],
        cwd=ROOT,
        text=True,
        capture_output=True,
        check=False,
    )
    assert result.returncode == 0, result.stderr or result.stdout
    assert "admin-cover-template-manager behavior passed" in result.stdout
