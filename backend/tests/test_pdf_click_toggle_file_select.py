"""PDF 배치 오른쪽 페이지 목록: 단일 버튼 전환 및 재클릭 선택 해제."""
from pathlib import Path
import subprocess

ROOT = Path(__file__).resolve().parents[2]
SELECTION = ROOT / "js/pdf-editor/page-selection-preview-focus.js"
FILES = ROOT / "js/pdf-editor/file-navigation.js"
ICONS = ROOT / "js/pdf-editor/page-list-icons.js"
PRODUCTIVITY = ROOT / "js/pdf-editor/page-count-hint.js"
ROUTE = ROOT / "js/pdf-editor/route-runtime.js"
CORE = ROOT / "js/pdf-editor/core-runtime.js"
LOADER = ROOT / "js/pdf-editor/loader.js"
EDITOR = ROOT / "pdf-editor/index.html"
MANUAL = ROOT / "js/program-manuals/pdf-editor.js"
BROWSER = ROOT / "tests/browser/pdf-page-select-icons-smoke.html"


def test_single_global_all_clear_toggle_reacts_to_exact_selection():
    src = SELECTION.read_text(encoding="utf-8")
    assert 'data-selection-action="all" aria-pressed="false"' in src
    assert '<button type="button" class="page-selection-btn" data-selection-action="clear"' not in src
    assert "const allSelected = total > 0 && selectedIds.size === total;" in src
    assert "const nextAction = allSelected ? 'clear' : 'all';" in src
    assert "allToggle.dataset.selectionAction = nextAction;" in src
    assert "allToggle.textContent = allSelected ? '선택 해제' : '전체 선택';" in src
    assert "allToggle.setAttribute('aria-pressed', String(allSelected));" in src
    assert "allToggle.disabled = total === 0;" in src


def test_plain_click_deselects_same_thumbnail_and_ctrl_keeps_multi_select():
    src = SELECTION.read_text(encoding="utf-8")
    assert "if (selectedIds.has(id)) selectedIds.delete(id);" in src
    assert "else {\n        selectedIds.clear();\n        selectedIds.add(id);" in src
    assert "const additive = !!(event.ctrlKey || event.metaKey);" in src
    assert "const range = !!event.shiftKey;" in src
    assert "event.target.closest('.thumb-item')" in src
    assert "window.PdfEditorPageSelection" in src
    assert "document.dispatchEvent(new CustomEvent('pdf-page-selection-change'" in src


def test_single_file_toggle_updates_caption_count_and_preserves_other_files():
    src = FILES.read_text(encoding="utf-8")
    assert "selectToggle.dataset.fileSelectToggle = 'true';" in src
    assert "const allSelected = fileTotal > 0 && selection.selectedCountForFile(group.fileIndex) === fileTotal;" in src
    assert "if (allSelected) selection.clearFile(group.fileIndex);" in src
    assert "selection.selectFile(group.fileIndex, { additive: event.ctrlKey || event.metaKey });" in src
    assert "toggle.classList.toggle('is-clear', allSelected);" in src
    assert "toggle.textContent = allSelected ? '파일 해제' : '파일 선택';" in src
    assert "toggle.setAttribute('aria-pressed', String(allSelected));" in src
    assert "actionRow.appendChild(clearButton);" not in src


def test_icons_and_compact_toolbar_track_the_same_toggle_state():
    icons = ICONS.read_text(encoding="utf-8")
    productivity = PRODUCTIVITY.read_text(encoding="utf-8")
    assert "const stateful=button.matches('.pdf-file-select-btn[data-file-select-toggle=\"true\"]" in icons
    assert "const description=stateful" in icons
    assert "panel.classList.toggle('single-selection-ui',unifiedSelection());" in productivity
    assert ".page-productivity-panel.single-selection-ui .page-productivity-top{display:none!important}" in productivity
    assert "page-selection-preview-focus.js?v=20261112-3" in ROUTE.read_text(encoding="utf-8")
    assert "file-navigation.js?v=20261112-2" in ROUTE.read_text(encoding="utf-8")
    assert "page-count-hint.js?v=20261112-3" in CORE.read_text(encoding="utf-8")
    assert "page-count-hint.js?v=20261112-3" in LOADER.read_text(encoding="utf-8")
    assert "page-list-icons.js?v=20261112-3" in EDITOR.read_text(encoding="utf-8")
    assert "같은 페이지를 한 번 더 클릭" in MANUAL.read_text(encoding="utf-8")
    browser = BROWSER.read_text(encoding="utf-8")
    assert "click same page again deselects" in browser
    assert "file-specific clear" in browser
    assert "global clear button did not switch back to all" in browser
    for path in (SELECTION, FILES, ICONS, PRODUCTIVITY):
        run = subprocess.run(["node", "--check", str(path)], text=True, capture_output=True, cwd=ROOT)
        assert run.returncode == 0, run.stderr
