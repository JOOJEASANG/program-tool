from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]


def test_phase12_shared_editor_tool_rail_is_loaded_for_supported_editors_only():
    ui = (ROOT / "js" / "program-studio-ui-v2.js").read_text(encoding="utf-8")
    assert "/js/editor-tool-rail-v1.js?v=20260828-1" in ui
    assert "editorToolRailV1Script" in ui
    for surface in ("pdf-editor", "design-editor", "document-editor", "image-editor"):
        assert f"surface==='{surface}'" in ui
    assert ui.count("loadEditorToolRail();") >= 3
    pdf_block = ui.split("if(surface==='pdf-editor'){", 1)[1].split("if(surface==='pdf-preflight')", 1)[0]
    assert "loadEditorToolRail();" not in pdf_block
    assert "return;" in pdf_block


def test_phase12_tool_rail_has_icon_groups_and_safe_all_tools_fallback():
    source = (ROOT / "js" / "editor-tool-rail-v1.js").read_text(encoding="utf-8")
    for surface in ("pdf-editor", "design-editor", "document-editor", "image-editor"):
        assert f"'{surface}'" in source
    for label in ("파일", "페이지·배치", "구성", "편집", "시작", "작성", "검토", "불러오기", "자르기·크기", "전체 도구"):
        assert label in source
    assert "<svg viewBox=" in source
    assert "data-ps-tool-step" in source
    assert "showAll" in source
    assert "ps-tool-source" in source


def test_phase12_existing_guided_workflow_apis_remain_the_source_of_navigation():
    source = (ROOT / "js" / "editor-tool-rail-v1.js").read_text(encoding="utf-8")
    assert "window.PdfEditorWorkflowV2" in source
    assert "window.DesignEditorWorkflowV2" in source
    assert "window.DocumentEditorWorkflowV2" in source
    assert "window.ImageEditorWorkflowV2" in source
    assert "activateStep?.(next,false)" in source


def test_phase12_route_budget_contract_counts_shared_tool_rail_only_where_loaded():
    source = (ROOT / "scripts" / "validate_route_budgets.py").read_text(encoding="utf-8")
    assert "editorToolRailV1Script" in source
    assert 'EDITOR_TOOL_RAIL_ROUTES = ("design-general",)' in source
    assert '"pdf-editor": (22, 900_000)' in source


def test_phase12_browser_smoke_is_wired_into_quality_gate():
    workflow = (ROOT / ".github" / "workflows" / "quality-gate.yml").read_text(encoding="utf-8")
    assert "Run Phase 12 compact editor tool rail smoke" in workflow
    assert "bash scripts/run_phase12_browser_smoke.sh" in workflow
    assert (ROOT / "tests" / "browser" / "editor-tool-rail-v6-smoke.html").is_file()
    assert (ROOT / "scripts" / "run_phase12_browser_smoke.sh").is_file()
