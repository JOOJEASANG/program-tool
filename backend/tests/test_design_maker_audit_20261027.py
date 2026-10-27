"""Safety contracts for the design maker save/load and print audit."""
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]


def source(path):
    return (ROOT / path).read_text(encoding="utf-8")


def test_explicit_save_is_not_overwritten_by_draft_autosave():
    src = source("js/ai-design-maker.js")
    assert "const manualSnapshotKey = () => STORAGE_KEY + ':manual'" in src
    assert "localStorage.setItem(manualSnapshotKey(), JSON.stringify(serializableState()))" in src
    assert "localStorage.getItem(manualSnapshotKey())" in src
    assert "if (!saveLocal()) throw new Error(" in src
    assert "if (!raw) throw new Error('저장된 편집 설정이 없습니다.')" in src
    assert "badge.textContent = '저장 실패'" in src
    assert "function loadLocal(rawState = null)" in src


def test_text_shapes_logo_can_export_without_ai_background():
    src = source("js/ai-design-maker.js")
    assert "function hasRenderableWork(spec = currentSpec())" in src
    assert "state.background || state.logo || state.shapes.length" in src
    assert "textLayout(spec, 1).some(" in src
    assert "if(!hasRenderableWork())" in src
    assert "if ($('exportBtn')) $('exportBtn').disabled = !hasRenderableWork(spec) || stale;" in src


def test_gallery_downloads_before_replacing_unsaved_work():
    src = source("js/ai-design-maker.js")
    a = src.index("async function loadOwnGalleryWork(item)")
    b = src.index("async function deleteOwnGalleryDesign(item)", a)
    loader = src[a:b]
    assert loader.index("await waitForImage(backgroundImage)") < loader.index("localStorage.setItem(STORAGE_KEY,JSON.stringify(restored))")
    assert loader.index("await waitForImage(logoImage)") < loader.index("localStorage.setItem(STORAGE_KEY,JSON.stringify(restored))")
    assert "window.DesignWorkspaceLayers?.clearAll?.({silent:true})" in loader
    assert "if(window.DesignWorkspaceLayers?.hasLayers()" in loader
    assert "내 파일 레이어는 보관함 저장을 지원하지 않습니다." in src


def test_local_import_is_serialized_and_garbage_collected():
    src = source("js/design-workspace-layers.js")
    assert "let importQueue = Promise.resolve()" in src
    assert "const task = importQueue.then(run,run)" in src
    assert "importQueue = task.catch(() => {})" in src
    assert "function clearAll({ silent = false } = {})" in src
    assert "layer.pdfDocument?.destroy?.()" in src
    assert "URL.revokeObjectURL(layer.url)" in src
    assert "60_000_000" in src


def test_concurrent_uploads_cannot_restore_cleared_assets():
    src = source("js/ai-design-maker.js")
    assert "if(loadVersion!==backgroundLoadVersion)" in src
    assert "if(loadVersion!==logoLoadVersion)" in src
    assert "backgroundLoadVersion++" in src
    assert "logoLoadVersion++" in src
    assert "URL.revokeObjectURL(previous.src)" in src


def test_retired_design_usage_help_is_not_rendered():
    page = source("ai-design-maker/index.html")
    runtime = source("js/ai-design-maker.js")
    assert 'id="manualBtn"' not in page
    assert "program-manuals/home-modal.js" not in page
    assert "program-manual-home-modal.css" not in page
    assert "ProgramManualHomeModal?.open" not in runtime
    assert "updated: '2026-10-27'" in source("js/program-manuals/ai-design-maker.js")


def test_auth_callbacks_cannot_duplicate_paid_generation_actions():
    src = source("js/ai-design-maker.js")
    assert "let boundUserId = ''" in src
    assert "if(!boundUserId){boundUserId=user.uid;bind();}" in src
    assert "if(boundUserId && boundUserId!==user.uid)" in src
    assert "location.reload();return;" in src
