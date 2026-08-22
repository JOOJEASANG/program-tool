from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]
ASSET_STORE = ROOT / "js" / "design-editor" / "asset-store.js"
PHASE2 = ROOT / "js" / "design-editor" / "phase2.js"
DRAFT_SCOPE = ROOT / "js" / "design-editor" / "phase5-draft-scope.js"
PROJECT_FILE = ROOT / "js" / "design-editor" / "phase11-project-file.js"
REGISTER = ROOT / "js" / "sw-register.js"


def test_asset_store_uses_indexeddb_and_blob_object_urls():
    source = ASSET_STORE.read_text(encoding="utf-8")
    for marker in (
        "indexedDB.open(DB_NAME,DB_VERSION)",
        "createObjectStore(STORE,{keyPath:'id'})",
        "blob instanceof Blob",
        "URL.createObjectURL(record.blob)",
        "snapshotProject",
        "ensureProject",
        "toPortableProject",
        "importPortableProject",
    ):
        assert marker in source
    assert "if(item.assetId)delete item.src" in source
    assert "assetStorageVersion=1" in source


def test_image_addition_stores_blob_before_project_reference():
    source = PHASE2.read_text(encoding="utf-8")
    assert "canvas.toBlob(" in source
    assert "assetStore?.storeBlob" in source
    assert "const stored=await storePreparedImage(data,file.name)" in source
    assert "target.assetId=stored.assetId" in source
    assert "item.assetId=stored.assetId" in source
    assert "DesignEditorDraftScope?.saveCurrent?.('phase2')" in source
    assert "hydrateAssets" in source
    assert "assetStore.ensureProject(p)" in source


def test_image_tools_run_on_the_general_editor_route():
    source = PHASE2.read_text(encoding="utf-8")
    assert "path!=='/design-editor/general'" in source
    assert "path!=='/design-editor/general.html'" in source
    assert "path.endsWith('/design-editor/general.html')" in source
    assert "path!=='/design-editor/index.html'" not in source


def test_scoped_draft_removes_runtime_image_sources_after_asset_migration():
    source = DRAFT_SCOPE.read_text(encoding="utf-8")
    assert "function durableSnapshot(project)" in source
    assert "DesignEditorAssetStore?.snapshotProject?.(project)" in source
    assert "project:snapshot" in source


def test_portable_project_export_reembeds_images_and_import_rehydrates_them():
    source = PROJECT_FILE.read_text(encoding="utf-8")
    assert "async function exportProject()" in source
    assert "await assetStore.toPortableProject(current)" in source
    assert "await assetStore.importPortableProject(portable)" in source
    assert "FORMAT_VERSION=1" in source
    assert "data:image\\/(?:png|jpeg|webp);base64" in source


def test_asset_store_loads_before_image_editor_module():
    source = REGISTER.read_text(encoding="utf-8")
    assert "/js/design-editor/asset-store.js?v=20260822-1" in source
    assert source.index("designEditorAssetStoreScriptV1") < source.index("designEditorPhase2ScriptV1")
