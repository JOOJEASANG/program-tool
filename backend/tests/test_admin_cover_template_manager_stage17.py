from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]
SEPARATION_MODULE = ROOT / "js" / "cover-template-admin-separation.js"
COVER_LOCAL = ROOT / "js" / "cover-local-image-upload.js"
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


def test_cover_editor_hides_all_legacy_provided_image_controls():
    source = SEPARATION_MODULE.read_text(encoding="utf-8")
    for marker in (
        "adminTemplateArea",
        "coverTemplateSelect",
        "coverProvidedImageLibraryPanel",
        "coverServiceImagePanel",
        "control.disabled = true",
        "legacy-provided-cover-images-disabled",
    ):
        assert marker in source
    assert "관리자 페이지" not in source


def test_cover_local_upload_does_not_use_firebase_image_library():
    source = COVER_LOCAL.read_text(encoding="utf-8")
    assert "펼침 이미지 직접 업로드" in source
    assert "frontInput" in source
    assert "state.__localSpreadImage" in source
    assert "loadImageFile(file)" in source
    assert "cover_templates" not in source
    assert "firebase.storage" not in source
    assert "db.collection" not in source
