from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]
VERSION = ROOT / "js" / "app-version.js"
SW_REGISTER = ROOT / "js" / "sw-register.js"
PHASE2 = ROOT / "js" / "design-editor" / "phase2.js"
ASSET_STORE = ROOT / "js" / "design-editor" / "asset-store.js"
LEGACY_COVER = ROOT / "perfect-binding-cover" / "index.html"
PDF_LOCAL = ROOT / "js" / "pdf-divider-local-image-upload.js"
FIRESTORE = ROOT / "firestore.rules"
STORAGE = ROOT / "storage.rules"


RETIRED_SCRIPTS = (
    "admin-service-image-library.js",
    "admin-service-console.js",
    "admin-cover-template-manager.js",
    "cover-service-image-library.js",
    "cover-provided-image-library.js",
    "cover-local-image-upload.js",
    "cover-template-admin-separation.js",
)


def test_admin_provided_image_and_legacy_cover_provider_scripts_are_removed_and_not_loaded():
    for filename in RETIRED_SCRIPTS:
        assert not (ROOT / "js" / filename).exists(), filename

    for source in (VERSION.read_text(encoding="utf-8"), SW_REGISTER.read_text(encoding="utf-8")):
        for token in (
            "admin-service-image-library",
            "admin-service-console",
            "admin-cover-template-manager",
            "cover-service-image-library",
            "cover-provided-image-library",
            "cover-local-image-upload",
            "cover-template-admin-separation",
        ):
            assert token not in source
    register = SW_REGISTER.read_text(encoding="utf-8")
    assert "designEditorAssetStoreScriptV1" in register
    assert "designEditorPhase2ScriptV1" in register
    assert "/js/pdf-divider-local-image-upload.js?v=20260818-2" in register


def test_cover_uses_common_user_selected_image_pipeline_without_provider_library():
    phase2 = PHASE2.read_text(encoding="utf-8")
    store = ASSET_STORE.read_text(encoding="utf-8")
    for marker in (
        'accept="image/jpeg,image/png,image/webp"',
        "handleImageInput",
        "prepareImage(file)",
        "storePreparedImage",
        "assetStore.storeBlob",
        "file.size>12*1024*1024",
        "image.naturalWidth*image.naturalHeight>50000000",
    ):
        assert marker in phase2
    assert "IndexedDB" in store or "indexedDB" in store
    for forbidden in ("cover_templates", "service-image", "제공 이미지", "관리자 제공"):
        assert forbidden not in phase2


def test_pdf_divider_uses_500mb_user_source_with_bounded_inline_embedding():
    source = PDF_LOCAL.read_text(encoding="utf-8")
    for marker in (
        "간지 이미지 레이어",
        "이미지를 여러 번 추가하면 레이어로 쌓입니다",
        "image/jpeg",
        "image/png",
        "image/webp",
        "MAX_SOURCE_BYTES = 500 * 1024 * 1024",
        "MAX_EMBED_BYTES = 5 * 1024 * 1024",
        "MAX_TOTAL_EMBED_BYTES = 15 * 1024 * 1024",
        "localImageDataUrl",
        "localImageName",
        "localImageLayers",
        "createImageBitmap",
        "optimizeFile",
        "user-local-pdf-divider-source-500mb-auto-optimized",
    ):
        assert marker in source
    assert "readAsDataURL(file)" not in source
    assert "cover_templates" not in source
    assert "serviceImage" not in source
    assert "관리자 제공" not in source


def test_retired_cover_redirect_contains_no_stale_provider_controls():
    source = LEGACY_COVER.read_text(encoding="utf-8")
    for marker in (
        "adminTemplateArea",
        "coverTemplateSelect",
        "coverProvidedImageLibraryPanel",
        "coverServiceImagePanel",
    ):
        assert marker not in source
    assert "/design-editor/?mode=cover" in source


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
