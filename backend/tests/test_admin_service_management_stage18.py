from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]
VERSION = ROOT / "js" / "app-version.js"
SW_REGISTER = ROOT / "js" / "sw-register.js"
COVER_LOCAL = ROOT / "js" / "cover-local-image-upload.js"
PDF_LOCAL = ROOT / "js" / "pdf-divider-local-image-upload.js"
SEPARATION = ROOT / "js" / "cover-template-admin-separation.js"
FIRESTORE = ROOT / "firestore.rules"
STORAGE = ROOT / "storage.rules"


RETIRED_SCRIPTS = (
    "admin-service-image-library.js",
    "admin-service-console.js",
    "admin-cover-template-manager.js",
    "cover-service-image-library.js",
    "cover-provided-image-library.js",
    "pdf-divider-service-image-library.js",
)


def test_admin_provided_image_scripts_are_removed_and_not_loaded():
    for filename in RETIRED_SCRIPTS:
        assert not (ROOT / "js" / filename).exists(), filename

    for source in (VERSION.read_text(encoding="utf-8"), SW_REGISTER.read_text(encoding="utf-8")):
        assert "admin-service-image-library" not in source
        assert "admin-service-console" not in source
        assert "admin-cover-template-manager" not in source
        assert "cover-service-image-library" not in source
        assert "cover-provided-image-library" not in source
        assert "pdf-divider-service-image-library" not in source
        assert "/js/cover-local-image-upload.js?v=20260818-1" in source
        assert "/js/pdf-divider-local-image-upload.js?v=20260818-1" in source


def test_cover_uses_only_user_selected_front_back_or_spread_images():
    source = COVER_LOCAL.read_text(encoding="utf-8")
    for marker in (
        "펼침 이미지 직접 업로드",
        "사용 권한이 있는 이미지만 업로드",
        "state.__localSpreadImage",
        "state.__localSpreadName",
        "loadImageFile(file)",
        "drawImage(ctx, state.__localSpreadImage",
        "if (state.backImage) drawImage",
        "if (state.frontImage) drawImage",
        "user-local-cover-images-only",
    ):
        assert marker in source
    assert "cover_templates" not in source
    assert "service-image" not in source
    assert "제공 이미지" not in source


def test_pdf_divider_uses_inline_user_upload_and_no_remote_library():
    source = PDF_LOCAL.read_text(encoding="utf-8")
    for marker in (
        "간지 배경 이미지 직접 업로드",
        "사용 권한이 있는 이미지만 업로드",
        "image/jpeg",
        "image/png",
        "image/webp",
        "MAX_BYTES = 5 * 1024 * 1024",
        "localImageDataUrl",
        "localImageName",
        "FileReader",
        "user-local-pdf-divider-image-only",
    ):
        assert marker in source
    assert "cover_templates" not in source
    assert "serviceImage" not in source
    assert "관리자 제공" not in source


def test_legacy_cover_provider_controls_stay_hidden():
    source = SEPARATION.read_text(encoding="utf-8")
    for marker in (
        "adminTemplateArea",
        "coverTemplateSelect",
        "coverProvidedImageLibraryPanel",
        "coverServiceImagePanel",
        "legacy-provided-cover-images-disabled",
    ):
        assert marker in source


def test_firebase_blocks_member_access_and_new_provider_uploads():
    firestore = FIRESTORE.read_text(encoding="utf-8")
    storage = STORAGE.read_text(encoding="utf-8")

    assert "match /cover_templates/{templateId}" in firestore
    assert "allow read, delete: if isAdmin();" in firestore
    assert "allow create, update: if false;" in firestore
    assert "resource.data.isPublic == true" not in firestore

    assert "match /cover_templates/{templateId}/{fileName}" in storage
    assert "allow read, delete: if isAdmin();" in storage
    assert "allow create, update: if false;" in storage
    assert "isPublicCoverTemplate" not in storage
