"""PDF배치: 간결한 오른쪽 사이드바와 선택 기능 회귀 검사."""
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]


def read(path):
    return (ROOT / path).read_text(encoding="utf-8")


def test_only_one_global_selection_toolbar_is_visible():
    html = read("pdf-editor/index.html")
    selection = read("js/pdf-editor/page-selection-preview-focus.js")
    productivity = read("js/pdf-editor/page-count-hint.js")
    assert 'html.pdf-direct-thumb-selection #pageSidebar #pageProductivityPanelV3.single-selection-ui .page-productivity-top{display:none!important}' in html
    assert '#pageSidebar #pageProductivityPanelV3 .page-productivity-top{display:none!important}' not in html
    route = read("js/pdf-editor/route-runtime.js")
    assert "page-selection-preview-focus.js?v=20261112-4',app:'layout'" in route
    assert "panel.classList.toggle('single-selection-ui',unifiedSelection());" in productivity
    assert 'data-selection-action="all" aria-pressed="false"' in selection
    assert '<button type="button" class="page-selection-btn" data-selection-action="clear"' not in selection
    assert "allToggle.textContent = allSelected ? '선택 해제' : '전체 선택';" in selection
    assert "const shared = window.PdfEditorPageSelection?.selectedIds;" in productivity
    assert "selectedIds = shared;" in productivity


def test_advanced_page_selection_and_margins_are_collapsed_by_default():
    html = read("pdf-editor/index.html")
    selection = read("js/pdf-editor/page-selection-preview-focus.js")
    assert '<details id="pageSelectedMarginDetails" class="page-selected-margin-details">' in html
    assert '<summary class="page-selected-margin-heading">' in html
    assert 'id="pageSelectedMarginApply"' in html
    assert 'id="pageSelectedMarginReset"' in html
    assert '<details class="page-selection-advanced" id="pageSelectionAdvanced">' in selection
    assert '<summary>범위·홀짝 선택</summary>' in selection
    for action in ("range-replace", "range-add", "range-remove", "odd", "even", "invert", "drag"):
        assert f'data-selection-action="{action}"' in selection


def test_file_buttons_are_distinguishable_from_global_buttons():
    navigation = read("js/pdf-editor/file-navigation.js")
    icons = read("js/pdf-editor/page-list-icons.js")
    manual = read("js/program-manuals/pdf-editor.js")
    assert "toggle.textContent = allSelected ? '파일 해제' : '파일 선택';" in navigation
    assert "['check-square','파일 선택'" in icons
    assert "['square','파일 해제'" in icons
    assert "['check-square','전체 선택'" in icons
    assert "['square','선택 해제'" in icons
    assert "복잡한 범위·홀짝 선택" in manual
    assert "개별 여백" in manual


def test_both_sidebars_keep_functions_and_reveal_only_necessary_options():
    html = read("pdf-editor/index.html")
    script = read("js/pdf-editor/simple-sidebar-ui.js")
    selection = read("js/pdf-editor/page-selection-preview-focus.js")
    ui = read("js/pdf-editor/ui-runtime.js")
    shell = read("js/program-shell-unify.js")
    runner = read("scripts/run_pdf_program_shell_smoke.sh")
    browser = read("tests/browser/pdf-two-sidebars-workflow-smoke.html")
    assert '<details id="pdfActualSizeDisclosure"' in html
    for marker in (
        "const defaultSections=new Set(['upload','paper','nup','output']);",
        "function organizeWorkspace(){",
        "function organizeRightSidebar(){",
        "paper.compareDocumentPosition(nup)",
        "section.classList.toggle('pdf-ui-closed',!isOpen);",
        "head.setAttribute('aria-expanded',String(isOpen));",
        "event.type==='keydown'",
        "details.id='pdfFileMarginsDetails';",
        "details.id='pdfPageJumpDetails';",
        "if(margin.parentElement!==details)details.appendChild(margin);",
        "if(navigation.parentElement!==details)details.appendChild(navigation);",
        "position:sticky!important;bottom:-12px!important",
    ):
        assert marker in script
    for marker in ("pageSelectionAdvanced", "pageSelectedMarginDetails",
                   "pageJumpInputV3+button", "pdfPageJumpDetails"):
        assert marker in html or marker in script or marker in selection
    assert "simple-sidebar-ui.js?v=20261112-1" in ui
    assert "PDF_UI_RUNTIME_VERSION='20261112-1'" in shell
    assert "pdf-two-sidebars-workflow-smoke.html" in runner
    assert "data-pdf-two-sidebars-smoke=\"pass\"" in runner
    assert "preserved action handlers and pinned PDF save" in browser
    assert "PDF 저장" in html
