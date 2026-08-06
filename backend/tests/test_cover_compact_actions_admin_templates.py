import subprocess
from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]
DOCK = ROOT / "js" / "cover-floating-action-dock.js"
SURFACE = ROOT / "js" / "cover-template-surface-cleanup.js"
REGISTER = ROOT / "js" / "sw-register.js"
BEHAVIOR = ROOT / "backend" / "tests" / "test_cover_template_surface_cleanup_behavior.cjs"


def test_cover_action_dock_uses_compact_three_item_secondary_row():
    source = DOCK.read_text(encoding="utf-8")
    assert "grid-template-columns:minmax(0,1fr) minmax(0,1fr) 38px" in source
    assert "#pdfBtn{grid-column:1/-1" in source
    assert "reset.textContent = '↻'" in source
    assert "reset.setAttribute('aria-label', '표지 제작 초기화')" in source
    assert "#coverResetBtn" in source
    assert "> .card-note{display:none" in source
    assert ".status:empty{display:none" in source
    assert "padding-bottom:146px" in source
    assert "padding-bottom:190px" not in source


def test_cover_template_surface_keeps_admin_images_only():
    source = SURFACE.read_text(encoding="utf-8")
    assert "제공 이미지 템플릿" in source
    assert "coverTemplateSelect" in source
    assert "adminTemplateArea" not in source or "관리자" in source
    for marker in (
        "coverBuiltinPreset",
        "userCoverTemplate",
        "userCoverTemplateName",
        "saveUserCoverTemplate",
        "applyUserCoverTemplate",
        "deleteUserCoverTemplate",
    ):
        assert marker in source
    assert "card.replaceChildren(makeHeader(), adminBlock)" in source
    assert "stage: 'admin-image-template-only'" in source


def test_cover_runtime_loads_template_cleanup_before_compact_dock():
    source = REGISTER.read_text(encoding="utf-8")
    cleanup = source.index("/js/cover-template-surface-cleanup.js")
    dock = source.index("/js/cover-floating-action-dock.js")
    normalizer = source.index("/js/cover-ui-runtime-normalizer.js")
    assert cleanup < dock < normalizer
    assert source.count("coverTemplateSurfaceCleanupScriptV1") == 1
    assert source.count("coverFloatingActionDockScriptV2") == 1


def test_cover_template_surface_behavior_executes():
    result = subprocess.run(
        ["node", str(BEHAVIOR)],
        cwd=ROOT,
        text=True,
        capture_output=True,
        check=False,
    )
    assert result.returncode == 0, result.stderr or result.stdout
    assert "cover-template-surface-cleanup behavior passed" in result.stdout
