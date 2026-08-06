import subprocess
from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]
LOCK = ROOT / "js" / "cover-layout-lock.js"
REGISTER = ROOT / "js" / "sw-register.js"
BEHAVIOR = ROOT / "backend" / "tests" / "test_cover_layout_lock_behavior.cjs"


def test_cover_layout_lock_loads_after_confirm_before_dock():
    source = REGISTER.read_text(encoding="utf-8")
    confirm = source.index("/js/cover-final-output-confirm.js")
    lock = source.index("/js/cover-layout-lock.js")
    dock = source.index("/js/cover-floating-action-dock.js")
    assert confirm < lock < dock
    assert source.count("coverLayoutLockScriptV1") == 1


def test_cover_layout_lock_disables_only_placement_controls():
    source = LOCK.read_text(encoding="utf-8")
    for marker in (
        "'#posX', '#posY', '#itemScale'",
        "'#resetTargetBtn', '#centerTargetBtn', '#resetAllLayoutBtn'",
        "'.preset-btn[data-preset]'",
        "'#spinePartX', '#spinePartY', '#spinePartScale'",
        "'#spinePartCenter', '#spinePartReset'",
        "canvas.style.pointerEvents = locked ? 'none' : ''",
        "element.disabled = true",
        "data-cover-layout-lock-was-disabled",
    ):
        assert marker in source
    for editable_marker in (
        "#frontTitle",
        "#frontSubtitle",
        "#publisher",
        "#backText",
        "#textColor",
        "#coverImageBrightness",
        "#coverImageContrast",
        "#coverImageSaturation",
    ):
        assert editable_marker not in source


def test_cover_layout_lock_blocks_keyboard_movement_and_preserves_inputs():
    source = LOCK.read_text(encoding="utf-8")
    for marker in (
        "['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(event.key)",
        "['INPUT', 'TEXTAREA', 'SELECT'].includes(tag)",
        "event.stopImmediatePropagation()",
        "배치가 잠겨 있습니다",
    ):
        assert marker in source


def test_cover_layout_lock_is_persistent_and_accessible():
    source = LOCK.read_text(encoding="utf-8")
    for marker in (
        "programTool.coverEditor.layoutLock.v1",
        "aria-pressed",
        "표지 요소 배치 잠금",
        "표지 요소 배치 잠금 해제",
        "배치 잠금됨",
        "aria-disabled",
        "@media(max-width:620px)",
        "cover-layout-lock-change",
    ):
        assert marker in source
    assert "setInterval(" not in source
    assert "eval(" not in source


def test_cover_layout_lock_behavior_executes():
    result = subprocess.run(
        ["node", str(BEHAVIOR)],
        cwd=ROOT,
        text=True,
        capture_output=True,
        check=False,
    )
    assert result.returncode == 0, result.stderr or result.stdout
    assert "cover-layout-lock behavior passed" in result.stdout
