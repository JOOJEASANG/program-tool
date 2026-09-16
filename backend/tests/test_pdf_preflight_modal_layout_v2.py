from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]
PAGE = ROOT / "pdf-preflight" / "index.html"


def test_pdf_preflight_tool_modal_uses_spacious_full_width_work_surface():
    source = PAGE.read_text(encoding="utf-8")

    for marker in (
        "width:min(820px,100%)",
        "#toolModalBody{min-height:260px;padding:0 28px 24px}",
        "grid-template-columns:auto minmax(0,1fr) auto",
        "margin:0 -28px 26px",
        "position:sticky;bottom:0",
        "사용 중인 PDF",
        "selected-file-size",
        "aria-label=\"작업 창 닫기\"",
    ):
        assert marker in source


def test_pdf_preflight_modal_keeps_existing_tool_ids_and_actions():
    source = PAGE.read_text(encoding="utf-8")

    for marker in (
        'id="toolModalOverlay"',
        'id="toolModalBody"',
        'id="toolStatus"',
        'id="toolRunBtn"',
        "openTool('encrypt')",
        "openTool('decrypt')",
        "async function runTool()",
    ):
        assert marker in source
