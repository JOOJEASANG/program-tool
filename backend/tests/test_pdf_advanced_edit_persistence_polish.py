from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]
POLISH = ROOT / "js" / "pdf-editor" / "advanced-edit-persistence-polish.js"
RUNTIME = ROOT / "js" / "pdf-editor" / "advanced-runtime.js"
INDEX = ROOT / "pdf-editor" / "index.html"
DIRECT = ROOT / "js" / "pdf-editor" / "direct-page-edit-v2.js"


def text(path: Path) -> str:
    return path.read_text(encoding="utf-8")


def test_crop_fields_have_more_space_before_lower_actions():
    js = text(POLISH)

    assert '#pdfDragCropAutoFitControlsV1{margin-top:10px!important}' in js


def test_partial_erase_mode_is_sticky_across_page_navigation_until_user_turns_it_off():
    js = text(POLISH)

    assert "let stickyErase=false;" in js
    assert "setStickyErase(!stickyErase" in js
    assert "Promise.resolve(api.activate(page))" in js
    assert "#pdfAdvancedPrevPageV1,#pdfAdvancedNextPageV1" in js
    assert "attributeFilter:['data-selected','data-page-id','data-output-index']" in js
    assert "event.key==='Escape'&&stickyErase" in js
    assert "pdfAdvancedEraseSticky=String(stickyErase)" in js


def test_advanced_sidebar_exposes_session_save_load_and_icon_only_list_logout():
    js = text(POLISH)
    index = text(INDEX)
    direct = text(DIRECT)

    assert "setTextNode(save,'편집저장')" in js
    assert "setTextNode(load,'편집파일 불러오기')" in js
    assert "#pdfAdvancedSidebarNavV1 .nav-back" in js
    assert "#pdfAdvancedSidebarNavV1 .nav-logout" in js
    assert "font-size:0!important" in js
    assert "back.setAttribute('aria-label','목록')" in js
    assert "logout.setAttribute('aria-label','로그아웃')" in js

    assert 'id="navSessionBtn"' in index
    assert 'id="navSessionLoadBtn"' in index
    assert "state.pageEraseRegions=pages().map(eraseRegionsForPage)" in direct
    assert "window.loadEditorSession=wrapped" in direct


def test_advanced_runtime_loads_persistence_polish_after_existing_edit_helpers():
    runtime = text(RUNTIME)

    assert "/js/pdf-editor/advanced-edit-persistence-polish.js?v=20260909-1" in runtime
    assert ".then(()=>loadDirectPageEditQuickbar())" in runtime
    assert ".then(()=>loadAdvancedEditPersistencePolish())" in runtime
    assert "'advanced-edit-persistence-polish'" in runtime
