from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]
SEPARATION_MODULE = ROOT / "js" / "cover-template-admin-separation.js"
COVER_LOCAL = ROOT / "js" / "cover-local-image-upload.js"
TEMPLATE_MANAGER = ROOT / "js" / "cover-template-manager.js"
APP_VERSION = ROOT / "js" / "app-version.js"


def test_legacy_admin_cover_image_manager_is_removed():
    assert not (ROOT / "js" / "admin-cover-template-manager.js").exists()
    assert not (ROOT / "backend" / "tests" / "test_admin_cover_template_manager_behavior.cjs").exists()

    source = APP_VERSION.read_text(encoding="utf-8")
    assert "/js/admin-cover-template-manager.js" not in source
    assert "/js/admin-service-image-library.js" not in source
    assert "/js/cover-service-image-library.js" not in source
    assert "/js/cover-provided-image-library.js" not in source
    assert source.count("/js/cover-template-admin-separation.js") == 1
    assert source.count("/js/cover-local-image-upload.js") == 1


def test_cover_template_sidebar_is_fully_retired():
    source = TEMPLATE_MANAGER.read_text(encoding="utf-8")
    for forbidden in (
        "기본 스타일 프리셋",
        "내 작업 템플릿",
        "관리자 제공 이미지 템플릿",
        "firebase.storage",
        "db.collection",
        "localStorage",
        "saveTemplate",
        "applyTemplate",
    ):
        assert forbidden not in source
    for marker in (
        "templateCard",
        "표지 템플릿",
        "제공 이미지 템플릿",
        "removeTemplateUi",
        "template-ui-retired",
    ):
        assert marker in source


def test_cover_editor_removes_stale_legacy_provider_controls_from_dom():
    source = SEPARATION_MODULE.read_text(encoding="utf-8")
    for marker in (
        "removeLegacyProviderUi",
        "coverTemplateSelect",
        "coverProvidedImageLibraryPanel",
        "coverServiceImagePanel",
        "providerBlock.remove()",
        "MutationObserver",
        "legacy-provided-cover-images-removed",
    ):
        assert marker in source
    assert "control.disabled = true" not in source


def test_cover_local_upload_has_copyright_notice_and_no_firebase_image_library():
    source = COVER_LOCAL.read_text(encoding="utf-8")
    for marker in (
        "펼침 이미지 직접 업로드",
        "frontInput",
        "state.__localSpreadImage",
        "loadImageFile(file)",
        "coverImageCopyrightNotice",
        "makeCopyrightNotice",
        "이미지 저작권에 대해 저희는 책임을 지지 않습니다.",
        "사용자가 직접 사용 권한을 확인한 이미지만 업로드해 주세요.",
    ):
        assert marker in source
    assert "cover_templates" not in source
    assert "firebase.storage" not in source
    assert "db.collection" not in source
