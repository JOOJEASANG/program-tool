import subprocess
from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]
MODULE = ROOT / "js" / "cover-template-project-safety.js"
REGISTER = ROOT / "js" / "sw-register.js"
TEMPLATE_MANAGER = ROOT / "js" / "cover-template-manager.js"
PROJECT_MODULE = ROOT / "js" / "cover-editor-preflight-project.js"
BEHAVIOR = ROOT / "backend" / "tests" / "test_cover_template_project_safety_behavior_stage2.cjs"


def test_current_user_template_captures_extended_editor_state():
    source = MODULE.read_text(encoding="utf-8")
    for marker in (
        "templateVersion: 2",
        "extended: clone(bridge()?.snapshot?.() || null)",
        "bridge()?.restore?.(sanitizeExtended(item.extended))",
        "현재 글자 레이어와 이미지 효과를 포함해 템플릿으로 저장했습니다.",
        "bindCapture('saveUserCoverTemplate', saveUserTemplate)",
        "bindCapture('applyUserCoverTemplate', applyUserTemplate)",
    ):
        assert marker in source


def test_project_import_is_size_version_and_shape_bounded():
    source = MODULE.read_text(encoding="utf-8")
    for marker in (
        "MAX_PROJECT_BYTES = 2 * 1024 * 1024",
        "MAX_LAYOUT_ITEMS = 300",
        "MAX_TEXT_ITEMS = 60",
        "MAX_TEXT_LENGTH = 2000",
        "version < 1 || version > PROJECT_VERSION",
        "if (file.size > MAX_PROJECT_BYTES)",
        "sanitizeValues(source.values)",
        "sanitizeLayout(source.layout)",
        "rawExtended ? sanitizeExtended(rawExtended) : null",
        "input.onchange = async (event)",
    ):
        assert marker in source


def test_imported_text_and_image_effect_values_are_clamped():
    source = MODULE.read_text(encoding="utf-8")
    for marker in (
        "text: String(raw.text || '').slice(0, MAX_TEXT_LENGTH)",
        "size: clamp(finite(raw.size",
        "color: sanitizeColor(raw.color",
        "weight: clamp(Math.round(finite(raw.weight",
        "scale: clamp(finite(raw.scale, 100), 50, 200)",
        "rotation: clamp(finite(raw.rotation",
        "brightness: clamp(finite(raw.brightness",
        "contrast: clamp(finite(raw.contrast",
        "saturation: clamp(finite(raw.saturation",
    ):
        assert marker in source


def test_admin_template_upload_has_permission_check_and_failure_cleanup():
    source = MODULE.read_text(encoding="utf-8")
    for marker in (
        "await isConfirmedAdmin(user)",
        "IMAGE_MIMES.has(file.type)",
        "cleanupPaths.push(path)",
        "let committed = false",
        "committed = true",
        "Promise.allSettled(cleanupPaths.map(deleteStoragePath))",
        "storage/object-not-found",
        "if (committed)",
    ):
        assert marker in source
    assert source.index("await documentRef.set") < source.index("committed = true")


def test_admin_template_delete_preserves_document_when_storage_cleanup_fails():
    source = MODULE.read_text(encoding="utf-8")
    delete_start = source.index("async function deleteAdminTemplate")
    delete_source = source[delete_start:]
    assert delete_source.index("await deleteStoragePath(option.dataset.frontPath") < delete_source.index(
        "await database.collection('cover_templates').doc(option.value).delete()"
    )
    assert "삭제 중단 · 원본 파일 또는 권한을 확인하세요" in delete_source


def test_template_project_safety_loads_between_bridge_and_final_runtime_guard():
    source = REGISTER.read_text(encoding="utf-8")
    bridge = "/js/cover-project-state-bridge.js"
    template = "/js/cover-template-project-safety.js?v=20260805-1"
    dock = "/js/cover-floating-action-dock.js"
    final_guard = "/js/cover-runtime-safety.js"
    assert source.count("coverTemplateProjectSafetyScriptV2") == 1
    assert source.count(template) == 1
    assert source.index(bridge) < source.index(template) < source.index(dock) < source.index(final_guard)


def test_retired_sidebar_template_manager_no_longer_owns_project_state():
    templates = TEMPLATE_MANAGER.read_text(encoding="utf-8")
    project = PROJECT_MODULE.read_text(encoding="utf-8")
    assert "template-ui-retired" in templates
    assert "snapshotCurrent" not in templates
    assert "localStorage" not in templates
    assert "if (data.layout && typeof state" in project
    assert "PROJECT_VERSION = 2" in project


def test_template_project_safety_is_bounded_and_executes():
    source = MODULE.read_text(encoding="utf-8")
    assert "INSTALL_DELAYS = [0, 220, 520, 900, 1500, 2400]" in source
    assert "for (const delay of INSTALL_DELAYS) setTimeout(install, delay)" in source
    assert "setInterval(" not in source
    assert "eval(" not in source
    assert "stage: 'template-project-storage-validation'" in source

    result = subprocess.run(
        ["node", str(BEHAVIOR)],
        cwd=ROOT,
        text=True,
        capture_output=True,
        check=False,
    )
    assert result.returncode == 0, result.stderr or result.stdout
    assert "cover-template-project-safety behavior passed" in result.stdout
