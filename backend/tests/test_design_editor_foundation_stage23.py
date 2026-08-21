from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]
HTML = ROOT / "design-editor" / "general.html"
PRESETS = ROOT / "js" / "design-editor" / "presets.js"
APP = ROOT / "js" / "design-editor" / "app.js"
HOME = ROOT / "js" / "home-professional-suite.js"
ADMIN = ROOT / "js" / "admin-professional-program-manager.js"


def test_design_editor_page_loads_separate_foundation_modules():
    source = HTML.read_text(encoding="utf-8")
    for marker in (
        "디자인 편집기 · Program Studio",
        "id=\"presetGrid\"",
        "id=\"inspector\"",
        "id=\"layerList\"",
        "id=\"artboard\"",
        "../js/design-editor/presets.js?v=20260821-1",
        "../js/design-editor/app.js?v=20260821-1",
    ):
        assert marker in source


def test_print_presets_cover_poster_flyer_and_two_three_fold_leaflets():
    source = PRESETS.read_text(encoding="utf-8")
    for marker in (
        "'poster-a4'",
        "'poster-a3'",
        "'flyer-a4'",
        "'flyer-a5'",
        "'leaflet-2'",
        "'leaflet-3-z'",
        "'leaflet-3-roll'",
        "folds:[148.5]",
        "folds:[99,198]",
        "folds:[98,197]",
        "접히는 면 98mm",
        "ROLE_PRESETS",
        "메인 제목",
        "날짜·장소",
    ):
        assert marker in source


def test_editor_keeps_direct_text_editing_and_simple_selected_properties():
    source = APP.read_text(encoding="utf-8")
    for marker in (
        "작업영역을 더블클릭",
        "contentEditable='true'",
        "타이틀 서식",
        "앞 아이콘",
        "글자 크기 pt",
        "data-align=\"left\"",
        "data-align=\"center\"",
        "data-align=\"right\"",
        "이 글씨 잠금",
        "duplicateSelected",
        "deleteSelected",
        "scheduleSave",
        "programTool.designEditor.draft.v1",
    ):
        assert marker in source


def test_home_and_admin_route_design_tool_to_new_workspace():
    home = HOME.read_text(encoding="utf-8")
    admin = ADMIN.read_text(encoding="utf-8")
    assert "id:'design-editor'" in home
    assert "url:'design-editor/'" in home
    assert "id:'design-editor'" in admin
    assert "url:'design-editor/'" in admin
    assert "perfect-binding-cover/" in home  # migration from the former direct cover route remains safe
    assert "perfect-binding-cover/" in admin
