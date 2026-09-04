from pathlib import Path
import json
ROOT=Path(__file__).resolve().parents[2]
def read(path:str)->str:return (ROOT/path).read_text(encoding="utf-8")
def release_version()->str:return str(json.loads(read("version.json"))["version"]).strip()
def test_runtime_boot_uses_canonical_owners_for_live_workflow_modules():
 runtime=read("js/sw-register.js");app_version=read("js/app-version.js");pdf_editor=read("js/pdf-editor/route-runtime.js");preflight=read("js/pdf-preflight/route-runtime.js");assert "admin-operations-overview.js" not in runtime and "home-print-workflow.js" not in runtime
 for asset in ("/js/pdf-editor-final-check.js","/js/pdf-editor/spread-split.js","/js/pdf-editor/booklet-sheet-preview.js"):assert asset in pdf_editor
 assert "/js/pdf-print-readiness.js" in preflight;executable=app_version.split("/*",1)[0]+app_version.rsplit("*/",1)[-1]
 for asset in ("/js/pdf-editor-final-check.js","/js/pdf-print-readiness.js","/js/pdf-editor/spread-split.js","/js/pdf-editor/booklet-sheet-preview.js"):assert asset not in executable
 assert f"const VERSION='{release_version()}'" in runtime
def test_pdf_editor_final_check_reuses_generated_output_without_manual_reupload():
 source=read("js/pdf-editor-final-check.js")
 for marker in ("인쇄 전 검사 후 저장","바로 PDF 저장","apiProcessPdf(sources,settings","apiPreflightCheck(file","checkedBlob=blob","downloadBlob(checkedBlob","검사 완료 PDF 저장","문제 있어도 PDF 저장"):assert marker in source
def test_static_home_keeps_current_programs_only():
 home=read("index.html")
 for label in ("인쇄물 사전 검토","PDF 편집 · 인쇄배치","PDF 도구 모음"):assert label in home
 for retired in ("디자인 편집기","문서 편집기","이미지 편집기"):assert retired not in home
def test_retired_admin_catalog_and_program_sync_runtime_is_absent():
 runtime=read("js/sw-register.js")
 retired=("admin-operations-overview.js","admin-professional-program-manager.js","admin-program-catalog-manager.js","admin-program-catalog-nav-guard.js","admin-program-icon-palette.js","program-catalog-core.js")
 for filename in retired:
  assert filename not in runtime
  assert not (ROOT/"js"/filename).exists()
 assert "/js/admin-workflow-v2.js?v=20260828-1" in read("js/program-studio-ui-v2.js")
def test_release_version_is_synchronized_for_new_workflow():
 version=json.loads(read("version.json"));expected=str(version["version"]).strip();sw=read("sw.js");firebase=read("js/firebase-config.js");assert expected and f"APP_VERSION='{expected}'" in sw and f"/js/sw-register.js?v={expected}" in firebase
