import subprocess
from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]
ADMIN = ROOT / "js" / "admin-service-image-library.js"
COVER = ROOT / "js" / "cover-service-image-library.js"
PDF_DIVIDER = ROOT / "js" / "pdf-divider-service-image-library.js"
VERSION = ROOT / "js" / "app-version.js"
SW_REGISTER = ROOT / "js" / "sw-register.js"
SEPARATION = ROOT / "js" / "cover-template-admin-separation.js"
FIRESTORE = ROOT / "firestore.rules"
STORAGE = ROOT / "storage.rules"
BEHAVIOR = ROOT / "backend" / "tests" / "test_service_image_library_behavior.cjs"


def test_admin_console_manages_only_pdf_divider_and_cover_images_by_size():
    source = ADMIN.read_text(encoding="utf-8")
    for marker in (
        "서비스 이미지 관리",
        "PDF 편집 · 간지 이미지",
        "책표지 제작 · 표지 이미지",
        "A3 이상 · 펼침 표지용",
        "사용처",
        "규격",
        "책표지 적용 방식",
        "앞/뒤 개별 적용",
        "펼침 · 앞+책등+뒤 연결",
        "service-image-v2",
        "targets",
        "sizeCode",
        "widthMm",
        "heightMm",
        "coverMode",
        "cover_templates",
        "15 * 1024 * 1024",
    ):
        assert marker in source
    assert "PDF 검사" not in source


def test_service_image_replace_and_delete_keep_transaction_safe_order():
    source = ADMIN.read_text(encoding="utf-8")
    assert "function uniquePath" in source
    assert "service-${nonce}" in source
    metadata_write = source.index("await db.collection('cover_templates').doc(id).set(data, { merge: true })")
    old_cleanup = source.index("removeStorage(old.imagePath)", metadata_write)
    assert metadata_write < old_cleanup
    assert "if (fresh?.path) await removeStorage(fresh.path)" in source
    document_delete = source.index("await db.collection('cover_templates').doc(id).delete()")
    storage_cleanup = source.index("await removeStorage(path)", document_delete)
    assert document_delete < storage_cleanup


def test_cover_library_supports_individual_and_continuous_spread_images():
    source = COVER.read_text(encoding="utf-8")
    for marker in (
        "규격별 제공 이미지",
        "앞표지에 적용",
        "뒤표지에 적용",
        "앞+책등+뒤 펼침 적용",
        "펼침 이미지 직접 넣기",
        "state.__serviceSpreadImage",
        "drawImage(ctx,state.__serviceSpreadImage,{x:0,y:0,w,h:totalH}",
        "if(state.backImage)drawImage",
        "if(state.frontImage)drawImage",
        "service-image-v2",
        "sizeMatches",
        "CoverRecoveryCheckpoints",
    ):
        assert marker in source
    assert source.index("drawImage(ctx,state.__serviceSpreadImage") < source.index("if(state.backImage)drawImage")


def test_pdf_divider_library_filters_by_output_size_and_persists_secure_image_metadata():
    source = PDF_DIVIDER.read_text(encoding="utf-8")
    for marker in (
        "관리자 제공 간지 이미지",
        "currentPaper",
        "sizeMatches",
        "serviceImageId",
        "serviceImageUrl",
        "serviceImagePath",
        "pdf-divider",
        "service-image-v2",
        "renderServiceDivider",
        "window.renderDividerCanvas=patched",
        "window.getDividerContent=patched",
    ):
        assert marker in source


def test_secure_existing_rules_are_reused_for_service_images():
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


def test_runtime_loaders_use_new_service_image_surfaces_and_do_not_attach_images_to_pdf_checker():
    for source in (VERSION.read_text(encoding="utf-8"), SW_REGISTER.read_text(encoding="utf-8")):
        assert "/js/admin-service-image-library.js" in source
        assert "/js/cover-service-image-library.js" in source
        assert "/js/pdf-divider-service-image-library.js" in source
        assert "/js/admin-service-console.js" not in source
        assert "/js/cover-provided-image-library.js" not in source
    runtime = SW_REGISTER.read_text(encoding="utf-8")
    checker_block = runtime[runtime.index("if(isPath('/tools/pdf-Checker.html'"):runtime.index("if(isPath('/tools/perfect-binding-cover.html'")]
    assert "service-image" not in checker_block


def test_user_cover_maker_has_no_admin_crud_controls():
    source = SEPARATION.read_text(encoding="utf-8")
    assert "adminTemplateArea" in source
    assert "control.disabled = true" in source
    assert "관리자 페이지" not in source


def test_service_image_behavior_executes():
    result = subprocess.run(
        ["node", str(BEHAVIOR)],
        cwd=ROOT,
        text=True,
        capture_output=True,
        check=False,
    )
    assert result.returncode == 0, result.stderr or result.stdout
    assert "service image library behavior passed" in result.stdout
