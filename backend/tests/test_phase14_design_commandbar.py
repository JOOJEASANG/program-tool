from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]


def test_phase14_design_commandbar_groups_product_surface_and_common_actions():
    source = (ROOT / "js" / "design-editor" / "print-product-topbar.js").read_text(encoding="utf-8")
    for token in (
        "designSurfaceTopbarGroup",
        "designTopCommandbar",
        'data-design-command="undo"',
        'data-design-command="redo"',
        'data-design-command="insert"',
        'data-design-command="panel"',
        'data-design-command="fit"',
        'data-design-command="help"',
        'data-design-command="output"',
    ):
        assert token in source
    assert "productRoot.insertAdjacentElement('afterend',group)" in source
    assert "if(tabs.parentElement!==group)group.appendChild(tabs)" in source
    assert "toolbar.dataset.designCommandbar='v2'" in source


def test_phase14_commandbar_reuses_existing_editor_actions_instead_of_forking_logic():
    source = (ROOT / "js" / "design-editor" / "print-product-topbar.js").read_text(encoding="utf-8")
    assert "window.DesignEditorPhase3Controls" in source
    assert "phase3Undo" in source and "phase3Redo" in source
    for target in (
        "addTitleBtn",
        "addSubtitleBtn",
        "addBodyBtn",
        "addInfoBtn",
        "phase2AddImage",
        "phase2AddRect",
        "phase2AddEllipse",
        "phase2AddLine",
    ):
        assert target in source
    assert "window.ProgramStudioEditorToolRail?.select" in source
    assert "window.DesignEditorWorkflowV2?.activateStep" in source
    assert "routeStep('output')" in source


def test_phase14_commandbar_adds_panel_fit_help_and_smart_selection_routing():
    source = (ROOT / "js" / "design-editor" / "print-product-topbar.js").read_text(encoding="utf-8")
    assert "program-studio:sidebar:design-editor" in source
    assert "root.classList.toggle('ps-sidebar-collapsed')" in source
    assert "window.dispatchEvent(new Event('resize'))" in source
    assert "event.key==='0'" in source
    assert "selectionKey()" in source
    assert "if(step!=='edit'&&step!=='arrange')routeStep('edit')" in source
    for help_text in ("Ctrl Z", "Ctrl Y / Shift Z", "Ctrl D", "Shift + 방향키", "더블클릭"):
        assert help_text in source
    assert "stage:'professional-design-commandbar-v2'" in source


def test_phase14_browser_smoke_covers_high_frequency_commands():
    smoke = (ROOT / "tests" / "browser" / "design-editor-product-topbar-smoke.html").read_text(encoding="utf-8")
    runner = (ROOT / "scripts" / "run_design_editor_print_products_smoke.sh").read_text(encoding="utf-8")
    for marker in (
        "data-design-product-topbar-hierarchy=\"product-surface\"",
        "data-design-product-topbar-commands=\"undo-redo-insert-panel-fit-output\"",
        "data-design-product-topbar-context=\"edit\"",
    ):
        assert marker in runner
    assert "professional command bar" in smoke.lower()
