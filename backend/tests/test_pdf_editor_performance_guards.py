from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]


def source():
    return (ROOT / 'pdf-editor' / 'index.html').read_text(encoding='utf-8')


def test_preview_generation_is_serialized_and_stale_work_is_canceled():
    text = source()
    assert '_previewRunnerPromise' in text
    assert '_previewRequestId' in text
    assert 'assertPreviewRequest(requestId)' in text
    assert "error?.name !== 'AbortError'" in text


def test_large_preview_is_resolution_and_page_capped():
    text = source()
    assert 'const PREVIEW_DPI = 56' in text
    assert 'const MAX_PREVIEW_OUTPUT_PAGES = 60' in text
    assert 'const THUMB_MAX_EDGE = 360' in text
    assert 'out.truncated = totalOutputPages > out.length' in text


def test_canvas_clones_and_repeating_watchdog_are_removed():
    text = source()
    assert "wrap.appendChild(page.thumbCanvas)" in text
    assert "wrap.appendChild(canvas)" in text
    assert "setInterval(async () =>" not in text
    assert "drawImage(page.thumbCanvas, 0, 0)" not in text
    assert "c.getContext('2d').drawImage(canvas, 0, 0)" not in text


def test_reset_and_rotation_release_pdf_and_canvas_memory():
    text = source()
    assert 'clearLoadedDocumentMemory()' in text
    assert 'releaseCanvasList(previewCanvases)' in text
    assert 'releasePageMemory(parsedPages)' in text
    assert 'destroyPdfDocuments(loadedPdfDocs)' in text
    assert 'releaseCanvas(previousThumb)' in text


def test_import_failure_rolls_back_without_erasing_current_work():
    text = source()
    assert 'const previous = isNew ? {' in text
    assert 'const addedPages = parsedPages.splice(startPageCount)' in text
    assert 'parsedPages = previous.parsedPages' in text
    assert 'previewCanvases = previous.previewCanvases' in text
    assert 'parsedPages.length + total > MAX_IMPORT_PAGES' in text


def test_deployment_boot_guard_is_not_committed_to_source_html():
    text = source()
    assert '<head><script data-program-studio-boot-guard' not in text
    assert text.startswith('<!doctype html>\n<html lang="ko">\n<head>\n')
