import subprocess
from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]
RECOVERY = ROOT / "js" / "cover-recovery-checkpoints.js"
REGISTER = ROOT / "js" / "sw-register.js"
BEHAVIOR = ROOT / "backend" / "tests" / "test_cover_recovery_checkpoints_behavior.cjs"


def test_cover_recovery_loads_after_layout_lock_before_dock():
    source = REGISTER.read_text(encoding="utf-8")
    lock = source.index("/js/cover-layout-lock.js")
    recovery = source.index("/js/cover-recovery-checkpoints.js")
    dock = source.index("/js/cover-floating-action-dock.js")
    assert lock < recovery < dock
    assert source.count("coverRecoveryCheckpointsScriptV1") == 1


def test_cover_recovery_uses_indexeddb_with_bounded_history_and_assets():
    source = RECOVERY.read_text(encoding="utf-8")
    for marker in (
        "const DB_NAME = 'programToolCoverRecovery'",
        "const CHECKPOINT_STORE = 'checkpoints'",
        "const ASSET_STORE = 'assets'",
        "const WORKING_ID = 'working'",
        "const MAX_ROLLING = 5",
        "const MIN_ROLLING_INTERVAL_MS = 3 * 60 * 1000",
        "db.createObjectStore(CHECKPOINT_STORE, { keyPath: 'id' })",
        "checkpoints.createIndex('savedAt', 'savedAt')",
        "db.createObjectStore(ASSET_STORE, { keyPath: 'id' })",
        "sourceFingerprint(source)",
        "cleanupUnusedAssets()",
        "trimOldCheckpoints()",
    ):
        assert marker in source
    assert "localStorage.setItem" not in source


def test_cover_recovery_captures_complete_current_work_and_source_images():
    source = RECOVERY.read_text(encoding="utf-8")
    for marker in (
        "state.frontImage",
        "state.backImage",
        "state.layout ? clone(state.layout) : {}",
        "window.CoverProjectStateBridge?.snapshot?.()",
        "fields: currentFields()",
        "layout: currentLayout()",
        "extended",
        "images: { front, back }",
        "showGuides",
        "data:image\\/(?:jpeg|png|webp);base64",
        "https?:\\/\\/",
    ):
        assert marker in source


def test_cover_recovery_preserves_current_work_before_explicit_restore():
    source = RECOVERY.read_text(encoding="utf-8")
    restore_start = source.index("async function restoreCheckpoint")
    restore_end = source.index("async function removeCheckpoint", restore_start)
    restore = source[restore_start:restore_end]
    preserve = restore.index("await queueSave({ manual: true, force: true })")
    begin_restore = restore.index("activeRestore = true")
    assert preserve < begin_restore
    for marker in (
        "loadAssetImage(record.snapshot.images?.front)",
        "loadAssetImage(record.snapshot.images?.back)",
        "applyFields(record.snapshot.fields)",
        "applyLayout(record.snapshot.layout)",
        "window.CoverProjectStateBridge?.restore?.(clone(record.snapshot.extended))",
        "applyImage('front', front, record.snapshot.images?.front)",
        "applyImage('back', back, record.snapshot.images?.back)",
        "window.syncControls?.()",
        "window.updateCalculation?.()",
        "window.requestRender?.()",
        "cover-recovery-restored",
    ):
        assert marker in restore


def test_cover_recovery_never_restores_automatically_on_page_load():
    source = RECOVERY.read_text(encoding="utf-8")
    initialize_start = source.index("async function initializeStorage")
    install_start = source.index("function install()", initialize_start)
    export_start = source.index("window.CoverRecoveryCheckpoints", install_start)
    startup = source[initialize_start:export_start]
    assert "restoreCheckpoint(" not in startup
    assert "initializeStorage()" in startup
    assert "queueSave({ force: false })" in startup


def test_cover_recovery_has_accessible_explicit_management_ui():
    source = RECOVERY.read_text(encoding="utf-8")
    for marker in (
        "최근 작업 복구",
        "현재 상태를 복구 지점으로 저장",
        "복구본 모두 삭제",
        "role', 'dialog'",
        "aria-modal', 'true'",
        "aria-labelledby', 'coverRecoveryTitle'",
        "event.key !== 'Escape'",
        "원본 이미지 2개 포함",
        "QuotaExceededError",
        "@media(max-width:520px)",
    ):
        assert marker in source
    assert "setInterval(" not in source
    assert "eval(" not in source


def test_cover_recovery_registers_transaction_completion_before_read_request():
    source = RECOVERY.read_text(encoding="utf-8")
    assert source.count("const completion = transactionPromise(transaction);") == 2
    assert source.count("await completion;") == 2
    assert "request.onblocked = () => { dbPromise = null;" in source


def test_cover_recovery_behavior_executes():
    result = subprocess.run(
        ["node", str(BEHAVIOR)],
        cwd=ROOT,
        text=True,
        capture_output=True,
        check=False,
    )
    assert result.returncode == 0, result.stderr or result.stdout
    assert "cover-recovery-checkpoints behavior passed" in result.stdout
