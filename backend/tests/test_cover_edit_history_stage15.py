import subprocess
from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]
MODULE = ROOT / "js" / "cover-edit-history.js"
REGISTER = ROOT / "js" / "sw-register.js"
BEHAVIOR = ROOT / "backend" / "tests" / "test_cover_edit_history_behavior.cjs"


def test_cover_edit_history_loads_after_canvas_controls_before_final_renderer():
    source = REGISTER.read_text(encoding="utf-8")
    canvas_controls = source.index("coverTextCanvasControlsScriptV1")
    edit_history = source.index("coverEditHistoryScriptV1")
    final_owner = source.index("coverRenderPipelineContractScriptV1")
    assert canvas_controls < edit_history < final_owner
    assert source.count("/js/cover-edit-history.js") == 1


def test_cover_edit_history_is_bounded_and_transaction_safe():
    source = MODULE.read_text(encoding="utf-8")
    for marker in (
        "const MAX_HISTORY = 40",
        "function trimPast()",
        "function applySnapshotTransaction(target, fallback)",
        "applyRawSnapshot(target)",
        "applyRawSnapshot(fallback)",
        "if (applied.signature !== target.signature)",
        "편집 상태가 완전히 복원되지 않았습니다.",
        "future.length = 0",
    ):
        assert marker in source
    assert "setInterval(" not in source
    assert "eval(" not in source
    assert "innerHTML +=" not in source


def test_cover_edit_history_captures_complete_cover_state_without_copying_image_bytes():
    source = MODULE.read_text(encoding="utf-8")
    for marker in (
        "fields: currentFields()",
        "selectIndexes: currentSelectIndexes()",
        "layout: currentLayout()",
        "extended: currentExtended()",
        "window.CoverProjectStateBridge?.snapshot?.()",
        "images,",
        "imageToken(images.front)",
        "imageToken(images.back)",
        "const imageIds = new WeakMap()",
        "window.CoverProjectStateBridge?.restore?.(clone(snapshot.extended))",
        "restoreImages(snapshot.images || {}, snapshot.imageNames || {})",
    ):
        assert marker in source


def test_cover_edit_history_offers_clear_buttons_and_keyboard_shortcuts():
    source = MODULE.read_text(encoding="utf-8")
    for marker in (
        "id=\"coverUndoBtn\"",
        "id=\"coverRedoBtn\"",
        "실행 취소",
        "다시 실행",
        "aria-keyshortcuts=\"Control+Z Meta+Z\"",
        "aria-keyshortcuts=\"Control+Y Meta+Shift+Z\"",
        "const undoKey = key === 'z' && !event.shiftKey",
        "const redoKey = (key === 'z' && event.shiftKey) || key === 'y'",
    ):
        assert marker in source


def test_cover_edit_history_coalesces_continuous_edits_and_integrates_with_recovery():
    source = MODULE.read_text(encoding="utf-8")
    for marker in (
        "INPUT_COMMIT_DELAY_MS = 320",
        "COALESCED_COMMIT_DELAY_MS = 220",
        "window.addEventListener('pointerup'",
        "window.addEventListener('wheel'",
        "window.addEventListener('keyup'",
        "document.addEventListener('cover-image-effects-change'",
        "document.addEventListener('cover-recovery-restored'",
        "window.CoverRecoveryCheckpoints?.queueSave?.({ force: true })",
        "new MutationObserver",
        "표지 이미지 변경",
    ):
        assert marker in source


def test_cover_edit_history_ignores_selection_only_changes_in_signatures():
    source = MODULE.read_text(encoding="utf-8")
    assert "delete signatureSource.active" in source
    assert "delete signatureSource.showGuides" in source


def test_cover_edit_history_behavior_executes():
    result = subprocess.run(
        ["node", str(BEHAVIOR)],
        cwd=ROOT,
        text=True,
        capture_output=True,
        check=False,
    )
    assert result.returncode == 0, result.stderr or result.stdout
    assert "cover-edit-history behavior passed" in result.stdout
