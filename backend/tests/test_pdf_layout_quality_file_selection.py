"""Regression tests for PDF layout output parity and source-file scoped selection."""
from pathlib import Path

import fitz

from models.schemas import HeaderFooterSettings, PageInfo, PageNumberSettings, PdfProcessRequest, NupValue
from services.pdf_engine import build_pdf_document


ROOT = Path(__file__).resolve().parents[2]


def test_repeat_each_cell_receives_vector_page_number_and_header():
    source = fitz.open()
    source.new_page(width=230, height=300)
    request = PdfProcessRequest(
        pages=[
            PageInfo(file_index=0, page_index=0, group_break=True),
            PageInfo(file_index=0, page_index=0),
        ],
        nup_default=NupValue.two,
        repeat_cell_overlays=True,
        page_numbers=PageNumberSettings(enabled=True, start_page=1, start=1),
        header_footer=HeaderFooterSettings(enabled=True, header_center="Batch"),
    )
    result = build_pdf_document([source], request)
    assert len(result) == 1
    words = result[0].get_text("words")
    numbered = [word for word in words if word[4] == "1"]
    headers = [word for word in words if word[4] == "Batch"]
    assert len(numbered) == 2
    assert len(headers) == 2
    assert abs(numbered[0][1] - numbered[1][1]) > 25
    result.close()
    source.close()


def test_per_file_selection_exposes_explicit_scoped_actions():
    selection = (ROOT / "js/pdf-editor/page-selection-preview-focus.js").read_text(encoding="utf-8")
    file_navigation = (ROOT / "js/pdf-editor/file-navigation.js").read_text(encoding="utf-8")
    page = (ROOT / "pdf-editor/index.html").read_text(encoding="utf-8")
    for marker in (
        "function selectFile(fileIndex, { additive = false } = {})",
        "Number(page.file_index) === target",
        "function clearFile(fileIndex)",
        "function selectedCountForFile(fileIndex)",
        "checkbox.type = 'checkbox'",
        "checkbox.checked = selected",
        "document.dispatchEvent(new CustomEvent('pdf-page-selection-change'",
    ):
        assert marker in selection
    for marker in (
        "파일 전체선택",
        "selection.selectFile(group.fileIndex",
        "selection.clearFile(group.fileIndex)",
        "updateFileSelectionCounts",
        "selectedCountForFile(group.fileIndex)",
    ):
        assert marker in file_navigation
    assert "page_order: orderLR ? 'row-major' : 'column-major'" in page
    assert "'page-of': '1/N'" in page


def test_export_guard_and_session_controls_cover_pdf_layout_options():
    page = (ROOT / "pdf-editor/index.html").read_text(encoding="utf-8")
    save_summary = (ROOT / "js/pdf-editor/save-operation.js").read_text(encoding="utf-8")
    core = (ROOT / "js/pdf-editor/core-runtime.js").read_text(encoding="utf-8")
    assert "exportBytes > 300 * 1024 * 1024" in page
    assert "state.orderLR ?? true" in page
    assert "$('hfEnabled').checked = hfEnabled" in page
    assert "$('pnEnabled').checked = pnEnabled" in page
    assert "invalidRange = ['pn', 'hf']" in page
    assert "repeatMode) return" in (ROOT / "js/pdf-editor/layout-export.js").read_text(encoding="utf-8")
    assert "layout-export.js?v=20261014-3" in core
    assert "rangeLabel('pn')" in save_summary
    assert "rangeLabel('hf')" in save_summary


def test_four_up_repeat_places_page_number_and_header_in_every_cell():
    """Four identical source copies need four numbered placement cells."""
    source = fitz.open()
    page = source.new_page(width=210, height=297)
    page.insert_text((25, 42), "ORIGINAL CONTENT", fontsize=13)
    request = PdfProcessRequest(
        pages=[
            PageInfo(file_index=0, page_index=0, group_break=True),
            *[PageInfo(file_index=0, page_index=0) for _ in range(3)],
        ],
        nup_default=NupValue.four,
        repeat_cell_overlays=True,
        page_numbers=PageNumberSettings(enabled=True, start=7),
        header_footer=HeaderFooterSettings(enabled=True, header_center="Repeated"),
    )
    result = build_pdf_document([source], request)
    assert result.page_count == 1
    words = result[0].get_text("words")
    numbers = [word for word in words if word[4] == "7"]
    headers = [word for word in words if word[4] == "Repeated"]
    originals = [word for word in words if word[4] == "ORIGINAL"]
    assert len(numbers) == 4, "Page number must be repeated exactly four times"
    assert len(headers) == 4
    assert len(originals) == 4
    # The number belongs to each individual cell, not a single sheet footer.
    assert len({(round(word[0] / 40), round(word[1] / 40)) for word in numbers}) == 4
    result.close()
    source.close()
