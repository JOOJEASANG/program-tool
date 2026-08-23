from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]
CLOUD = ROOT / "js" / "design-editor" / "phase24-cloud-projects.js"
PROJECT_FILE = ROOT / "js" / "design-editor" / "phase11-project-file.js"
REGISTER = ROOT / "js" / "sw-register.js"


def test_project_file_exposes_shared_portable_payload_contract():
    source = PROJECT_FILE.read_text(encoding="utf-8")
    assert "async function buildPortablePayload" in source
    assert "async function restorePortablePayload" in source
    assert "buildPortablePayload,restorePortablePayload" in source
    assert "validateProject,validateCoverProject,canonicalizeCoverProject,unwrapProject" in source
    assert "maxFileBytes:MAX_FILE_BYTES" in source
    assert "const payload=await buildPortablePayload(current);" in source
    assert "const incoming=await restorePortablePayload(parsed,'project-file-import');" in source


def test_cloud_projects_are_owner_scoped_and_size_bounded():
    source = CLOUD.read_text(encoding="utf-8")
    for marker in (
        "const MAX_PROJECTS=8;",
        "const MAX_FILE_BYTES=30*1024*1024;",
        "const STORAGE_ROOT='design_projects';",
        "window.db.collection('users').doc(userId).collection('design_projects')",
        "ownerUid:userId",
        "format:projectFile.format||'program-studio-design-project'",
        "클라우드 작업은 최대 ${MAX_PROJECTS}개까지 저장할 수 있습니다.",
        "stage:'owner-scoped-revisioned-firestore-storage-cloud-projects'",
    ):
        assert marker in source
    assert "admin" not in source.lower()


def test_cloud_save_uses_revision_commit_before_old_revision_cleanup():
    source = CLOUD.read_text(encoding="utf-8")
    assert "function revisionStoragePath(userId,projectId,revisionId)" in source
    assert "function isOwnedStoragePath(userId,projectId,path)" in source
    assert "const previousPath=existing.exists?String(existing.data().storagePath||''):'';" in source
    assert "const path=revisionStoragePath(userId,projectId,newRevisionId());" in source
    upload = source.index("await uploadedRef.put(blob")
    commit = source.index("await docRef.set(metadata);")
    committed = source.index("committed=true;")
    cleanup = source.index("if(previousPath&&previousPath!==path&&isOwnedStoragePath")
    assert upload < commit < committed < cleanup
    assert "if(uploadedRef&&!committed)" in source


def test_cloud_load_rejects_metadata_paths_outside_current_owner_project():
    source = CLOUD.read_text(encoding="utf-8")
    assert "if(!isOwnedStoragePath(userId,id,path))" in source
    assert "storage.ref(path).getDownloadURL()" in source
    assert "if(blob.size>MAX_FILE_BYTES)" in source
    assert "restorePortablePayload(parsed,'cloud-project-load')" in source
    assert "incoming.cloudProjectId=id;" in source


def test_cloud_runtime_loads_after_portable_project_file_module():
    source = REGISTER.read_text(encoding="utf-8")
    assert "designEditorCloudProjectsScriptV1" in source
    assert "/js/design-editor/phase24-cloud-projects.js?v=20260823-1" in source
    assert source.index("designEditorProjectFileScriptV1") < source.index("designEditorCloudProjectsScriptV1")
