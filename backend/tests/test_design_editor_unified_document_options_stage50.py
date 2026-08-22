from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]
RUNTIME = ROOT / "js" / "design-editor" / "embedded-runtime.js"
SHELL = ROOT / "design-editor" / "index.html"


def test_general_design_modes_share_standard_and_direct_size_controls():
    source = RUNTIME.read_text(encoding="utf-8")
    for marker in (
        "const PAPERS=",
        "a6:{label:'A6',width:105,height:148}",
        "a5:{label:'A5',width:148,height:210}",
        "a4:{label:'A4',width:210,height:297}",
        "a3:{label:'A3',width:297,height:420}",
        "b5:{label:'B5',width:182,height:257}",
        "b4:{label:'B4',width:257,height:364}",
        "b3:{label:'B3',width:364,height:515}",
        'id="designModePaper"',
        'id="designModeWidth"',
        'id="designModeHeight"',
        'id="designModeOrientation"',
        "직접 입력",
        "현재 옵션 적용",
    ):
        assert marker in source


def test_leaflets_are_not_fixed_to_a4_and_fold_geometry_uses_current_width():
    source = RUNTIME.read_text(encoding="utf-8")
    for marker in (
        "2단 접지선은 선택한 가로 크기의 정확한 1/2",
        "용지 크기와 접지 방식을 선택하면 각 면 폭과 접지선이 자동 계산",
        "const half=project.width/2",
        "const third=project.width/3",
        "surface.folds=[third,third*2]",
        "const inset=clamp(project.width/297,0.8,2)",
        "surface.folds=[third-inset,third*2-inset]",
        "surface.folds=[third+inset,third*2+inset]",
        "접히는 면 ${small}mm",
    ):
        assert marker in source


def test_switching_general_modes_changes_configuration_without_parent_iframe_reload():
    source = RUNTIME.read_text(encoding="utf-8")
    for marker in (
        "function switchGeneralMode(detail,source='option-change')",
        "if(!isGeneral)return parentMode(config)",
        "if(isGeneral)return switchGeneralMode(nextConfig,'mode-button')",
        "switchGeneralMode(readOptions(mode,card),'options-apply')",
        "app.startProject(preset)",
        "applyConfigToProject(config)",
        "updateHistory(config)",
        "history.replaceState",
        "DesignEditorDraftScope?.saveCurrent",
        "DesignEditorDraftScope?.restoreCurrentScope",
        "stage:'single-general-editor-dynamic-document-options'",
    ):
        assert marker in source
    assert "location.reload()" not in source
    assert "MutationObserver" not in source
    assert "setInterval(" not in source
    assert "eval(" not in source


def test_outer_shell_passes_dimensions_for_any_general_mode_only_when_engine_changes():
    source = SHELL.read_text(encoding="utf-8")
    for marker in (
        "poster:{mode:'poster'",
        "flyer:{mode:'flyer'",
        "leaflet2:{mode:'leaflet2'",
        "leaflet3:{mode:'leaflet3'",
        "w:297,h:210",
        "data.w??data.width",
        "data.h??data.height",
        "query.set('fold'",
        "return `/design-editor/general?${query.toString()}`",
    ):
        assert marker in source
