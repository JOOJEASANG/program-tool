import subprocess
from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]
GUARD = ROOT / "js" / "pdf-editor" / "viewport-lazy-preview-guard.js"
REGISTER = ROOT / "js" / "sw-register.js"
BEHAVIOR = ROOT / "backend" / "tests" / "test_pdf_viewport_lazy_preview_guard_behavior.cjs"


def test_lazy_preview_guard_loads_after_lazy_preview_once():
    source = REGISTER.read_text(encoding="utf-8")
    lazy = source.index("/js/pdf-editor/viewport-lazy-preview.js")
    guard = source.index("/js/pdf-editor/viewport-lazy-preview-guard.js")
    assert lazy < guard
    assert source.count("pdfViewportLazyPreviewGuardScriptV1") == 1
    assert source.count("/js/pdf-editor/viewport-lazy-preview-guard.js") == 1


def test_lazy_preview_guard_keeps_canvas_insertion_controls_enabled():
    source = GUARD.read_text(encoding="utf-8")
    for marker in (
        "function enableInsertionControls(root)",
        ".prev-ins-zone,.prev-ins-zone-v",
        "zone.hidden = false",
        "button.disabled = false",
        "button.tabIndex = 0",
        "button.setAttribute('aria-disabled', 'false')",
        "pdfLazyPreviewCanvasInsert = 'enabled'",
    ):
        assert marker in source

    assert "왼쪽 페이지 목록에서 추가해 주세요" not in source
    assert "event.stopImmediatePropagation()" not in source
    assert "blockStaleInsertion" not in source


def test_lazy_preview_guard_uses_global_output_index_for_labels():
    source = GUARD.read_text(encoding="utf-8")
    for marker in (
        "const outputIndex = Number(wrap.dataset.outputIndex)",
        "globalFaceLabel(outputIndex)",
        "Math.floor(outputIndex / 2) + 1",
        "outputIndex % 2 === 1",
        "primary.dataset.globalOutputIndex = String(outputIndex)",
        ".pdf-output-source-label",
        "label.hidden = true",
    ):
        assert marker in source


def test_lazy_preview_guard_reapplies_after_preview_mutations():
    source = GUARD.read_text(encoding="utf-8")
    for marker in (
        "new MutationObserver(scheduleRefresh)",
        "observer.observe(root, { childList: true, subtree: true, attributes: true",
        "document.addEventListener('pdf-import-committed', scheduleRefresh)",
        "document.addEventListener('pdf-preview-page-inserted', scheduleRefresh)",
        "stage: 'canvas-insert-global-output-labels-v2'",
    ):
        assert marker in source
    assert "setInterval(" not in source
    assert "eval(" not in source


def test_lazy_preview_guard_behavior_executes():
    result = subprocess.run(
        ["node", str(BEHAVIOR)],
        cwd=ROOT,
        text=True,
        capture_output=True,
        check=False,
    )
    assert result.returncode == 0, result.stderr or result.stdout
    assert "pdf-viewport-lazy-preview-guard behavior passed" in result.stdout
