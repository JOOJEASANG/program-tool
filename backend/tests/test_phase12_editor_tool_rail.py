from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]


def test_phase12_shared_editor_tool_rail_is_loaded_only_for_document_and_image_editors():
    ui = (ROOT / "js" / "program-studio-ui-v2.js").read_text(encoding="utf-8")
    assert "/js/editor-tool-rail-v1.js?v=20260828-1" in ui
    assert "editorToolRailV1Script" in ui
    for surface in ("pdf-editor", "pdf-preflight", "design-editor", "document-editor", "image-editor"):
        assert f"surface==='{surface}'" in ui
    assert ui.count("loadEditorToolRail();") >= 2
    assert "if(surface==='pdf-editor'||surface==='pdf-preflight')return;" in ui
    design_block = ui.split("if(surface==='design-editor'){", 1)[1].split("if(surface==='document-editor')", 1)[0]
    assert "loadDesignEssentialWorkspace();" in design_block
    assert "loadEditorToolRail();" not in design_block
    assert "designEditorEssentialWorkspaceScriptV1" in ui


def test_phase12_tool_rail_keeps_shared_icon_groups_for_remaining_supported_editors():
    source = (ROOT / "js" / "editor-tool-rail-v1.js").read_text(encoding="utf-8")
    for surface in ("pdf-editor", "design-editor", "document-editor", "image-editor"):
        assert f"'{surface}'" in source
    for label in ("파일", "페이지·배치", "구성", "편집", "시작", "작성", "검토", "불러오기", "자르기·크기", "전체 도구"):
        assert label in source
    assert "<svg viewBox=" in source
    assert "data-ps-tool-step" in source
    assert "showAll" in source
    assert "ps-tool-source" in source


def test_phase12_existing_guided_workflow_apis_remain_available_for_shared_rail():
    source = (ROOT / "js" / "editor-tool-rail-v1.js").read_text(encoding="utf-8")
    assert "window.PdfEditorWorkflowV2" in source
    assert "window.DesignEditorWorkflowV2" in source
    assert "window.DocumentEditorWorkflowV2" in source
    assert "window.ImageEditorWorkflowV2" in source
    assert "activateStep?.(next,false)" in source


def test_phase12_route_budget_contract_counts_design_essential_workspace():
    source = (ROOT / "scripts" / "validate_route_budgets.py").read_text(encoding="utf-8")
    assert 'DESIGN_ESSENTIAL_WORKSPACE_ID = "designEditorEssentialWorkspaceScriptV1"' in source
    assert 'routes["design-general"].add(ui_asset(ui_text, DESIGN_ESSENTIAL_WORKSPACE_ID))' in source
    assert '"pdf-editor": (24, 950_000)' in source
    assert "PREFLIGHT_ROUTE_BUDGET = (22, 1_100_000)" in source


def test_phase12_browser_smoke_is_wired_into_quality_gate():
    workflow = (ROOT / ".github" / "workflows" / "quality-gate.yml").read_text(encoding="utf-8")
    assert "Run Phase 12 compact editor tool rail smoke" in workflow
    assert "bash scripts/run_phase12_browser_smoke.sh" in workflow
    assert (ROOT / "tests" / "browser" / "editor-tool-rail-v6-smoke.html").is_file()
    assert (ROOT / "scripts" / "run_phase12_browser_smoke.sh").is_file()
