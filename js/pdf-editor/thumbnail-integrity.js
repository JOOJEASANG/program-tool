// Keep page thumbnails synchronized with page rotation and divider state.
(function () {
  'use strict';
  if (window.__pdfThumbnailIntegrityV1) return;
  window.__pdfThumbnailIntegrityV1 = true;

  let renderPagePatched = false;
  let dividerPatched = false;
  let thumbsPatched = false;
  let attempts = 0;
  let refreshRunning = false;
  const pending = new Set();

  function editorReady() {
    try {
      return Array.isArray(parsedPages) && typeof renderThumbs === 'function';
    } catch (_) {
      return false;
    }
  }

  function normalizedRotation(value) {
    return ((Number(value || 0) % 360) + 360) % 360;
  }

  function dividerSignature(content) {
    try { return JSON.stringify(content || {}); }
    catch (_) { return ''; }
  }

  function tagPageCanvas(canvas, rotation) {
    if (canvas?.dataset) canvas.dataset.pageRotation = String(normalizedRotation(rotation));
    return canvas;
  }

  function tagDividerCanvas(canvas, content) {
    if (canvas?.dataset) canvas.dataset.dividerSignature = dividerSignature(content);
    return canvas;
  }

  function patchRenderPdfPage() {
    if (renderPagePatched) return true;
    try {
      if (typeof renderPdfPage !== 'function') return false;
      if (renderPdfPage.__thumbnailIntegrityPatchedV1) {
        renderPagePatched = true;
        return true;
      }
      const original = renderPdfPage;
      const wrapped = async function renderPdfPageWithStateTag(pdfPage, scale, rotation) {
        const canvas = await original.apply(this, arguments);
        return tagPageCanvas(canvas, rotation);
      };
      wrapped.__thumbnailIntegrityPatchedV1 = true;
      renderPdfPage = wrapped;
      window.renderPdfPage = wrapped;
      renderPagePatched = true;
      return true;
    } catch (error) {
      console.warn('[pdf-thumbnail] render page patch failed', error);
      return false;
    }
  }

  function patchDividerRenderer() {
    if (dividerPatched) return true;
    try {
      if (typeof renderDividerCanvas !== 'function') return false;
      if (renderDividerCanvas.__thumbnailIntegrityPatchedV1) {
        dividerPatched = true;
        return true;
      }
      const original = renderDividerCanvas;
      const wrapped = function renderDividerCanvasWithStateTag(content) {
        return tagDividerCanvas(original.apply(this, arguments), content);
      };
      wrapped.__thumbnailIntegrityPatchedV1 = true;
      renderDividerCanvas = wrapped;
      window.renderDividerCanvas = wrapped;
      dividerPatched = true;
      return true;
    } catch (error) {
      console.warn('[pdf-thumbnail] divider patch failed', error);
      return false;
    }
  }

  function totalPagesForFile(fileIndex) {
    try { return parsedPages.filter((page) => page.pageType === 'pdf' && page.file_index === fileIndex).length; }
    catch (_) { return 0; }
  }

  async function repairPdfPage(page) {
    const id = Number(page?.id);
    if (!Number.isFinite(id) || pending.has(id)) return false;
    const expected = normalizedRotation(page.rotation);
    const actual = Number(page.thumbCanvas?.dataset?.pageRotation);
    if (Number.isFinite(actual) && actual === expected) return false;

    pending.add(id);
    try {
      if (page.lightweight && window.PdfUploadOptimization?.makePagePlaceholder) {
        page.thumbCanvas = window.PdfUploadOptimization.makePagePlaceholder(
          Number(page.page_index || 0) + 1,
          totalPagesForFile(page.file_index),
          expected,
        );
      } else if (page.pdfPage && typeof renderPdfPage === 'function') {
        page.thumbCanvas = await renderPdfPage(page.pdfPage, 0.9, expected);
      } else {
        tagPageCanvas(page.thumbCanvas, expected);
      }
      page.hiCanvas = null;
      return true;
    } catch (error) {
      console.warn('[pdf-thumbnail] page refresh failed', page?.page_index, error);
      return false;
    } finally {
      pending.delete(id);
    }
  }

  function repairDivider(page) {
    if (!page || page.pageType !== 'divider' || typeof renderDividerCanvas !== 'function') return false;
    const expected = dividerSignature(page.dividerContent);
    const actual = page.thumbCanvas?.dataset?.dividerSignature;
    if (actual === expected) return false;
    page.thumbCanvas = renderDividerCanvas(page.dividerContent || {}, 200, 283);
    page.hiCanvas = null;
    return true;
  }

  async function repairAll() {
    if (!editorReady() || refreshRunning) return false;
    refreshRunning = true;
    let changed = false;
    try {
      for (const page of parsedPages) {
        if (page.pageType === 'divider') changed = repairDivider(page) || changed;
        else if (page.pageType === 'pdf') changed = (await repairPdfPage(page)) || changed;
      }
    } finally {
      refreshRunning = false;
    }
    return changed;
  }

  function patchRenderThumbs() {
    if (thumbsPatched) return true;
    try {
      if (typeof renderThumbs !== 'function') return false;
      if (renderThumbs.__thumbnailIntegrityPatchedV1) {
        thumbsPatched = true;
        return true;
      }
      const original = renderThumbs;
      const wrapped = function renderThumbsWithIntegrityCheck() {
        const result = original.apply(this, arguments);
        setTimeout(async () => {
          if (await repairAll()) {
            original.apply(this, arguments);
            window.PdfPreviewController?.invalidate?.();
            window.PdfPreviewController?.request?.(120, false);
          }
        }, 0);
        return result;
      };
      wrapped.__thumbnailIntegrityPatchedV1 = true;
      renderThumbs = wrapped;
      window.renderThumbs = wrapped;
      thumbsPatched = true;
      return true;
    } catch (error) {
      console.warn('[pdf-thumbnail] thumbnail list patch failed', error);
      return false;
    }
  }

  function boot() {
    if (!editorReady()) {
      if (attempts < 12) {
        attempts += 1;
        setTimeout(boot, 160 + attempts * 60);
      }
      return;
    }
    const pageReady = patchRenderPdfPage();
    const dividerReady = patchDividerRenderer();
    const thumbsReady = patchRenderThumbs();
    if ((!pageReady || !dividerReady || !thumbsReady) && attempts < 12) {
      attempts += 1;
      setTimeout(boot, 160 + attempts * 60);
    }
  }

  window.PdfThumbnailIntegrity = { repair: repairAll };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once: true });
  else boot();
})();