import subprocess
from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]
LAZY = ROOT / "js" / "pdf-editor" / "viewport-lazy-preview.js"
REGISTER = ROOT / "js" / "sw-register.js"
BEHAVIOR = ROOT / "backend" / "tests" / "test_pdf_viewport_lazy_preview_behavior.cjs"


def test_pdf_lazy_preview_loads_after_transaction_safety_once():
    source = REGISTER.read_text(encoding="utf-8")
    transaction = source.index("/js/pdf-editor/import-transaction-safety.js")
    lazy = source.index("/js/pdf-editor/viewport-lazy-preview.js")
    assert transaction < lazy
    assert source.count("pdfViewportLazyPreviewScriptV1") == 1
    assert source.count("/js/pdf-editor/viewport-lazy-preview.js") == 1


def test_pdf_lazy_preview_uses_bounded_output_windows():
    source = LAZY.read_text(encoding="utf-8")
    for marker in (
        "const ACTIVE_OUTPUT_THRESHOLD = 80",
        "const WINDOW_RADIUS = 3",
        "const EXTREME_WINDOW_RADIUS = 2",
        "const EDGE_SCROLL_STEP = 3",
        "const size = Math.min(safeTotal, safeRadius * 2 + 1)",
        "descriptors.slice(windowRange.start, windowRange.end)",
        "출력면 표시 · 전체 저장에는 모두 반영",
    ):
        assert marker in source
    assert "WINDOW_RADIUS = 3" in source
    assert "EXTREME_WINDOW_RADIUS = 2" in source


def test_pdf_lazy_preview_matches_final_output_grouping_and_global_numbering():
    source = LAZY.read_text(encoding="utf-8")
    for marker in (
        "const groups = groupByNup(sourcePages)",
        "const layout = getLayout(group.n)",
        "const perPage = cols * rows",
        "sourcePages: group.pages.slice(start, start + perPage)",
        "buildOutputPage(",
        "descriptor.groupPages.slice()",
        "descriptor.pageIndex",
        "descriptor.outputIndex",
        "applyDocEdits(canvas, descriptor.outputIndex, total, PREVIEW_PPM)",
        "window.PdfPrintMarks.addMarksToCanvas(canvas, PREVIEW_PPM)",
    ):
        assert marker in source


def test_pdf_lazy_preview_hydrates_only_selected_lightweight_sources():
    source = LAZY.read_text(encoding="utf-8")
    for marker in (
        "function isLightweightPage(page)",
        "page?.pdfPage?.__lightweightPdfPage",
        "page?.thumbCanvas?.dataset?.lightweightPage === '1'",
        "const file = uploadedFiles[fileIndex]",
        "const buffer = await file.arrayBuffer()",
        "safety.safePdfGetDocument(buffer, true)",
        "documentHandle.getPage(Number(page.page_index || 0) + 1)",
        "safety.safeRenderPdfPage(pdfPage, 0.62, rotation, true)",
        "const documentCache = new Map()",
        "closeSourceDocuments(documentCache)",
        "releaseTemporarySources(temporary)",
    ):
        assert marker in source


def test_pdf_lazy_preview_supports_thumbnail_number_buttons_and_scroll_edges():
    source = LAZY.read_text(encoding="utf-8")
    for marker in (
        "pdfLazyPreviewPrevious",
        "pdfLazyPreviewOutputNumber",
        "pdfLazyPreviewNext",
        "handleThumbnailNavigation",
        "event.stopImmediatePropagation()",
        "document.addEventListener('click', handleThumbnailNavigation, true)",
        "document.addEventListener('keydown', handleThumbnailNavigation, true)",
        "document.addEventListener('wheel', handlePreviewWheel, { capture: true, passive: false })",
        "currentWindow.end < currentWindow.total",
        "currentWindow.start > 0",
    ):
        assert marker in source


def test_pdf_lazy_preview_replaces_only_preview_delegate_not_final_download():
    source = LAZY.read_text(encoding="utf-8")
    for marker in (
        "coordinator.setDelegate(async (context, args)",
        "return original.apply(context, args)",
        "triggerPreview = coordinator.request",
        "window.triggerPreview = coordinator.request",
        "stage: 'selected-output-window-real-source-hydration'",
    ):
        assert marker in source
    assert "downloadBtn.addEventListener" not in source
    assert "buildAllPages =" not in source
    assert "parsedPages =" not in source
    assert "uploadedFiles =" not in source
    assert "setInterval(" not in source
    assert "eval(" not in source


def test_pdf_lazy_preview_behavior_executes():
    result = subprocess.run(
        ["node", str(BEHAVIOR)],
        cwd=ROOT,
        text=True,
        capture_output=True,
        check=False,
    )
    assert result.returncode == 0, result.stderr or result.stdout
    assert "pdf-viewport-lazy-preview behavior passed" in result.stdout
