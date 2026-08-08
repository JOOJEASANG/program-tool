import subprocess
from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]
ADMIN = ROOT / "js" / "admin-service-management.js"
USER = ROOT / "js" / "cover-provided-image-library.js"
VERSION = ROOT / "js" / "app-version.js"
SEPARATION = ROOT / "js" / "cover-template-admin-separation.js"
FIRESTORE = ROOT / "firestore.rules"
STORAGE = ROOT / "storage.rules"
BEHAVIOR = ROOT / "backend" / "tests" / "test_admin_service_management_behavior.cjs"


def test_admin_console_is_service_oriented_and_cover_library_is_single_image():
    source = ADMIN.read_text(encoding="utf-8")
    for marker in (
        "서비스 운영 관리",
        "서비스 관리",
        "책표지 제작",
        "PDF 편집",
        "PDF 검사",
        "책표지 제공 이미지 등록",
        "이미지 한 장씩 등록합니다",
        "회원 공개",
        "관리자 전용",
        "kind: KIND",
        "imageUrl",
        "imagePath",
        "cover_templates",
        "library-image",
        "15 * 1024 * 1024",
    ):
        assert marker in source
    assert "frontFile" not in source
    assert "backFile" not in source
    assert "앞표지 이미지</strong><input" not in source
    assert "뒤표지 이미지</strong><input" not in source


def test_user_cover_maker_gets_gallery_with_front_and_back_apply_actions():
    source = USER.read_text(encoding="utf-8")
    for marker in (
        "관리자 제공 이미지",
        "앞표지에 적용",
        "뒤표지에 적용",
        ".where('isPublic', '==', true)",
        "item.kind === KIND",
        "state.frontImage = image",
        "state.backImage = image",
        "cover-template-applied",
        "CoverRecoveryCheckpoints",
        "user-selectable-admin-image-library",
    ):
        assert marker in source
    assert "saveCoverTemplate" not in source
    assert "deleteCoverTemplate" not in source


def test_admin_write_and_user_read_use_existing_secure_cover_template_rules():
    firestore = FIRESTORE.read_text(encoding="utf-8")
    storage = STORAGE.read_text(encoding="utf-8")
    assert "match /cover_templates/{templateId}" in firestore
    assert "allow read: if signedIn() && (isAdmin() || (approved(request.auth.uid) && resource.data.isPublic == true));" in firestore
    assert "allow create: if isAdmin()" in firestore
    assert "allow update, delete: if isAdmin();" in firestore
    assert "match /cover_templates/{templateId}/{fileName}" in storage
    assert "allow read: if isAdmin() || (isApproved() && isPublicCoverTemplate(templateId));" in storage
    assert "allow create, update: if isAdmin() && isCoverImage();" in storage
    assert "allow delete: if isAdmin();" in storage


def test_scoped_loader_uses_service_console_and_user_library_only_on_relevant_pages():
    source = VERSION.read_text(encoding="utf-8")
    assert "adminServiceManagementScriptV1" in source
    assert "/js/admin-service-management.js" in source
    assert "coverProvidedImageLibraryScriptV1" in source
    assert "/js/cover-provided-image-library.js" in source
    assert "adminCoverTemplateManagerScriptV1" not in source
    assert "currentPath==='/admin.html'" in source
    assert "perfect-binding-cover" in source


def test_user_cover_maker_has_no_admin_crud_controls():
    source = SEPARATION.read_text(encoding="utf-8")
    assert "adminTemplateArea" in source
    assert "control.disabled = true" in source
    assert "coverTemplateAdminConsoleNote')?.remove()" in source
    assert "관리자 페이지" not in source


def test_service_console_behavior_executes():
    result = subprocess.run(
        ["node", str(BEHAVIOR)],
        cwd=ROOT,
        text=True,
        capture_output=True,
        check=False,
    )
    assert result.returncode == 0, result.stderr or result.stdout
    assert "admin service management behavior passed" in result.stdout
