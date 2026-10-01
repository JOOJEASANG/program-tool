from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]


def read(path: str) -> str:
    return (ROOT / path).read_text(encoding="utf-8")


def test_sidebar_hotfix_avoids_competing_subtree_observers():
    facing = read("js/pdf-editor-advanced/facing-upload.js")
    fix = read("js/pdf-editor-advanced/workspace-page-sidebar-v7.js")

    assert "workspace-page-sidebar-v7.js" in facing
    assert "workspace-page-sidebar-v6.js" not in facing
    assert "MutationObserver" not in fix
    assert "subtree: true" not in fix
    assert ".page-item-info span{display:none!important}" in fix


def test_workspace_reset_clears_new_trim_state_and_preserves_bound_objects():
    reset = read("js/pdf-editor-advanced/workspace-reset.js")

    assert "trimMode: 'auto'" in reset
    assert "trimWidthMm: 0" in reset
    assert "trimHeightMm: 0" in reset
    assert "Object.assign(advancedState.paper, DEFAULT_PAPER)" in reset
    assert "Object.assign(advancedState.margins, DEFAULT_MARGINS)" in reset
    assert "Object.assign(advancedState.headerFooter, DEFAULT_HEADER_FOOTER)" in reset
    assert "Object.assign(advancedState.pageNumbers, DEFAULT_PAGE_NUMBERS)" in reset
    assert "advancedState.margins =" not in reset
    assert "advancedState.headerFooter =" not in reset
    assert "emitStateChange('workspace-reset')" in reset
