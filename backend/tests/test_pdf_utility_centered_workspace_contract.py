from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]


def test_centered_pdf_utility_contract():
    source = (ROOT / "js/pdf-suite/centered-workspace.js").read_text(encoding="utf-8")

    assert "const MAX_FILE_BYTES=500*MIB" in source
    assert "const MAX_TOTAL_BYTES=800*MIB" in source
    assert "CATEGORY_ORDER=['pages','convert','security','inspect']" in source
    assert "페이지 · 문서" in source
    assert "변환 · OCR" in source
    assert "편집 · 보안" in source
    assert "최적화 · 검사" in source
    assert "pdfUtilityCenteredCategories" in source
    assert "pdfUtilityCenteredModal" in source
    assert "pdfUtilityCenteredUpload" not in source
    assert "buildUpload" not in source
    assert "pdfUtilityUploadFlow='tool-first'" in source
    assert "pdfuc-tool-upload" in source
    assert "data.pdfucServerTool" not in source
    assert "card.dataset.pdfucServerTool=isMerge?'merge':'extract'" in source
    assert "/api/pdf-utility/merge-storage" in source
    assert "/api/pdf-utility/extract-storage" in source
    assert "cloudfunctions.net/api" in source
    assert "SERVER_TIMEOUT_MS=9*60*1000" in source


def test_centered_workspace_is_loaded_by_pdf_suite_direct_hook():
    hook = (ROOT / "js/pdf-suite/direct-tool-hook.js").read_text(encoding="utf-8")

    assert "centered-workspace.js?v=20260915-3" in hook
    assert "centered-workspace-fixes.js?v=20260915-3" in hook
    assert "tool-modal-flow.js?v=20260915-1" in hook
    assert "__programStudioPdfUtilityCenteredV2" in hook
    assert "__programStudioPdfUtilityCenteredFixesV3" in hook
    assert "__programStudioPdfUtilityToolModalFlowV1" in hook
    assert "ensureCenteredWorkspace" in hook
    assert "ensureCenteredFixes" in hook
    assert "ensureToolModalFlow" in hook
    assert "ProgramStudioPdfUtilityCentered" in hook


def test_centered_workspace_tool_first_readability_refinements():
    source = (ROOT / "js/pdf-suite/centered-workspace-fixes.js").read_text(encoding="utf-8")

    assert ".pdfuc-inner{width:min(1360px,100%)!important}" in source
    assert ".pdfuc-category{padding:18px!important;border-radius:22px!important}" in source
    assert ".pdfuc-cat-icon{width:62px!important;height:62px!important" in source
    assert ".pdfuc-category .pdfu-menu-item{grid-template-columns:40px minmax(0,1fr) auto!important" in source
    assert ".pdfuc-category .pdfu-menu-icon{font-size:24px!important" in source
    assert ".pdfuc-category .pdfu-menu-name{font-size:14px!important" in source
    assert ".pdfuc-tool-upload{min-height:126px!important" in source
    assert "pdfUtilityCenteredRefinements='tool-first-v3'" in source
    assert "pdfUtilityCenteredUpload" not in source
    assert "ProgramStudioPdfUtilityCentered?.addFiles" not in source


def test_tool_modal_flow_supports_drag_drop_and_progressive_results():
    source = (ROOT / "js/pdf-suite/tool-modal-flow.js").read_text(encoding="utf-8")
    curated = (ROOT / "js/pdf-suite/curated-core.js").read_text(encoding="utf-8")

    assert "DROP_SELECTOR='.pdfud-file,.pdfuc-tool-upload,.pdfocr-file,.pdfadv-file,#localDrop,.drop,[data-pdfu-drop-zone]'" in source
    assert "new DataTransfer()" in source
    assert "input.dispatchEvent(new Event('change',{bubbles:true}))" in source
    assert "data-pdfud-modal-flow" in source
    assert "data-pdfuc-modal-flow" in source
    assert "pdfud-flow-track" in source
    assert "startProgress(root)" in source
    assert "pdfUtilityToolModalFlow='upload-first-reveal-v1'" in source
    assert "['여백·크롭·배경','배경/여백 제거']" in curated


def test_backend_runtime_keeps_transient_utility_500_800_limits():
    main = (ROOT / "backend/main.py").read_text(encoding="utf-8")

    assert "PDF_UTILITY_FILE_BYTES = 500 * MIB" in main
    assert "PDF_UTILITY_TOTAL_BYTES = 800 * MIB" in main
    assert "timeout_sec=600" in main
    assert "memory=options.MemoryOption.GB_4" in main
