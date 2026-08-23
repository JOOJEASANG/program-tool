from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]
HARNESS = ROOT / "tests" / "browser" / "design-editor-user-flow-smoke.html"
RUNNER = ROOT / "scripts" / "run_design_editor_user_flow_smoke.sh"
SUITE = ROOT / "scripts" / "run_design_editor_browser_smoke.sh"
PHASE2 = ROOT / "js" / "design-editor" / "phase2.js"
ASSET_STORE = ROOT / "js" / "design-editor" / "asset-store.js"
PROJECT_FILE = ROOT / "js" / "design-editor" / "phase11-project-file.js"
DRAFT_SCOPE = ROOT / "js" / "design-editor" / "phase5-draft-scope.js"
OUTPUT = ROOT / "js" / "design-editor" / "output.js"


def test_stage81_real_user_flow_covers_image_edit_save_restore_and_outputs():
    source = HARNESS.read_text(encoding="utf-8")
    for marker in (
        "canvas.toBlob(value=>value?resolve(value):reject(new Error('test PNG creation failed')),'image/png')",
        "new File([blob],'user-flow.png',{type:'image/png'})",
        "Object.defineProperty(imageInput,'files',{configurable:true,value:transfer.files})",
        "imageInput.files?.[0]?.name==='user-flow.png'",
        "DesignEditorProjectFile.buildPortablePayload(project)",
        "portableImage?.src?.startsWith('data:image/webp;base64,')",
        "DesignEditorProjectFile.restorePortablePayload(payload,'browser-user-flow-smoke')",
        "restoredImage?.name==='user-flow.png'",
        "await DesignEditorOutput.exportPng()",
        "await DesignEditorOutput.exportPdf()",
        "pdf.getNumberOfPages()===2&&pdf.images.length===2",
        "pass('image upload, edit, portable save, restore, PNG and PDF output')",
    ):
        assert marker in source


def test_stage81_new_project_restores_scope_before_user_can_edit():
    source = DRAFT_SCOPE.read_text(encoding="utf-8")
    for marker in (
        "let startHookInstalled=false",
        "function installProjectStartHook()",
        "const originalStart=app.startProject.bind(app)",
        "app.startProject=(...args)=>{",
        "restoredScope=''",
        "const result=originalStart(...args)",
        "restoreCurrentScope()",
        "installProjectStartHook();restoreCurrentScope();",
        "stage:'preset-trim-size-scoped-draft-recovery'",
    ):
        assert marker in source
    start_hook = source.index("app.startProject=(...args)=>{")
    assert source.index("const result=originalStart(...args)", start_hook) < source.index("restoreCurrentScope()", start_hook)


def test_stage81_user_flow_uses_real_asset_and_portable_project_boundaries():
    phase2 = PHASE2.read_text(encoding="utf-8")
    store = ASSET_STORE.read_text(encoding="utf-8")
    project = PROJECT_FILE.read_text(encoding="utf-8")
    for marker in (
        "prepareImage(file)",
        "assetStore.storeBlob(data.blob,{name})",
        "phase2ImageInput",
    ):
        assert marker in phase2
    for marker in (
        "async function toPortableProject(project)",
        "item.src=await blobToDataUrl(record.blob)",
        "async function importPortableProject(project)",
        "item.assetId=assetId",
        "item.src=await resolve(assetId)",
    ):
        assert marker in store
    assert "assetStore?.toPortableProject?await assetStore.toPortableProject(current)" in project
    assert "assetStore?.importPortableProject?await assetStore.importPortableProject(portable)" in project


def test_stage81_restored_project_keeps_real_png_and_pdf_output_paths():
    source = OUTPUT.read_text(encoding="utf-8")
    for marker in (
        "async function exportPng()",
        "async function exportPdf()",
        "if(gate&&!(await gate({format:'png'})))return;",
        "if(gate&&!(await gate({format:'pdf'})))return;",
        "const rendered=await renderSurface(p,surface);",
        "JsPdf=await loader.ensure()",
    ):
        assert marker in source


def test_stage81_user_flow_runner_is_isolated_and_part_of_full_browser_suite():
    runner = RUNNER.read_text(encoding="utf-8")
    harness = HARNESS.read_text(encoding="utf-8")
    suite = SUITE.read_text(encoding="utf-8")
    assert 'PROFILE_DIR="$(mktemp -d)"' in runner
    assert '--user-data-dir="$PROFILE_DIR"' in runner
    assert '--virtual-time-budget=60000' in runner
    assert "/__design_user_flow_hold__" in runner
    assert "time.sleep(8)" in runner
    assert 'src="/__design_user_flow_hold__"' in harness
    for marker in (
        'data-user-flow-runtime="32"',
        'data-user-flow-upload-handler="production-change-listener"',
        'data-user-flow-portable="true"',
        'data-user-flow-restored="true"',
        'data-user-flow-png="true"',
        'data-user-flow-pdf-pages="2"',
    ):
        assert marker in runner
    assert 'bash "$ROOT_DIR/scripts/run_design_editor_user_flow_smoke.sh"' in suite
    assert suite.index("run_design_editor_cover_project_smoke.sh") < suite.index("run_design_editor_user_flow_smoke.sh") < suite.index("run_design_editor_pdf_smoke.sh")
