import subprocess
from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]
ADMIN = ROOT / "js" / "admin-service-console.js"
USER = ROOT / "js" / "cover-provided-image-library.js"
VERSION = ROOT / "js" / "app-version.js"
SW_REGISTER = ROOT / "js" / "sw-register.js"
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
        "kind:KIND",
        "imageUrl",
        "imagePath",
        "cover_templates",
        "library-image",
        "15 * 1024 * 1024",
    ):
        assert marker in source
    assert "frontFile" not in source
    assert "backFile" not in source


def test_replacement_upload_is_unique_and_old_object_is_cleaned_only_after_metadata_switch():
    source = ADMIN.read_text(encoding="utf-8")
    assert "function uniquePath" in source
    assert "library-${nonce}" in source
    assert "const path=uniquePath(id,value)" in source
    metadata_write = source.index("await db.collection('cover_templates').doc(id).set(data,{merge:true})")
    old_cleanup = source.index("removeStorage(old.imagePath)")
    assert metadata_write < old_cleanup
    assert "if(fresh?.path)await removeStorage(fresh.path)" in source


def test_delete_removes_live_metadata_before_storage_cleanup():
    source = ADMIN.read_text(encoding="utf-8")
    document_delete = source.index("await db.collection('cover_templates').doc(id).delete()")
    storage_cleanup = source.index("await removeStorage(path)", document_delete)
    assert document_delete < storage_cleanup
    assert "cleanupFailed=true" in source


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


def test_scoped_loaders_use_safe_service_console_and_user_library():
    version = VERSION.read_text(encoding="utf-8")
    runtime = SW_REGISTER.read_text(encoding="utf-8")
    for source in (version, runtime):
        assert "adminServiceConsoleScriptV1" in source
        assert "/js/admin-service-console.js" in source
        assert "coverProvidedImageLibraryScriptV1" in source
        assert "/js/cover-provided-image-library.js" in source
        assert "/js/admin-service-management.js" not in source
    assert "currentPath==='/admin.html'" in version
    assert "perfect-binding-cover" in version


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
