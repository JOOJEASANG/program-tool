// Keeps batch page actions visually synchronized with the canonical right-hand preview.
(function () {
  'use strict';
  if (window.__pdfPreviewCanvasActionSyncV1) return;
  window.__pdfPreviewCanvasActionSyncV1 = true;
  if (!location.pathname.includes('pdf-editor')) return;

  const byId = (id) => document.getElementById(id);
  let refreshToken = 0;

  function editorPages() {
    try { return Array.isArray(parsedPages) ? parsedPages : []; }
    catch (_) { return []; }
  }

  function selectedRotationSnapshot() {
    const ids = window.PdfEditorPageSelection?.selectedIds;
    if (!ids || typeof ids.has !== 'function') return [];
    return editorPages()
      .filter((page) => ids.has(Number(page?.id)) && page?.pageType === 'pdf' && page?.pdfPage)
      .map((page) => ({ id: Number(page.id), rotation: Number(page.rotation || 0) }));
  }

  function allSelectedRotationsChanged(snapshot) {
    if (!snapshot.length) return true;
    const pages = editorPages();
    return snapshot.every((before) => {
      const page = pages.find((entry) => Number(entry?.id) === before.id);
      return page && Number(page.rotation || 0) !== before.rotation;
    });
  }

  function lazyActive() {
    return Boolean(window.__pdfEditorLazyPreviewActive || byId('previewScroll')?.dataset?.lazyPreview === 'true');
  }

  function refreshRightPreview(reason) {
    const token = ++refreshToken;
    try {
      const lazy = window.PdfViewportLazyPreview;
      if (lazyActive() && lazy && typeof lazy.requestRender === 'function') {
        const outputIndex = typeof lazy.getCurrentOutputIndex === 'function' ? lazy.getCurrentOutputIndex() : 0;
        Promise.resolve(lazy.requestRender(outputIndex)).finally(() => {
          if (token !== refreshToken) return;
          document.documentElement.dataset.pdfBatchPreviewSync = reason || 'lazy-render';
        });
        return true;
      }
    } catch (error) {
      console.warn('[pdf-preview-sync] lazy preview refresh failed', error);
    }
    try {
      if (typeof triggerPreview === 'function') {
        Promise.resolve(triggerPreview()).finally(() => {
          if (token !== refreshToken) return;
          document.documentElement.dataset.pdfBatchPreviewSync = reason || 'preview-render';
        });
        return true;
      }
    } catch (error) {
      console.warn('[pdf-preview-sync] preview refresh failed', error);
    }
    try {
      if (typeof schedulePreview === 'function') {
        schedulePreview(0);
        document.documentElement.dataset.pdfBatchPreviewSync = reason || 'scheduled-render';
        return true;
      }
    } catch (error) {
      console.warn('[pdf-preview-sync] scheduled preview refresh failed', error);
    }
    return false;
  }

  function waitForBatchRotation(snapshot, attempt) {
    if (allSelectedRotationsChanged(snapshot) || attempt >= 40) {
      refreshRightPreview('batch-rotation');
      return;
    }
    setTimeout(() => waitForBatchRotation(snapshot, attempt + 1), 40);
  }

  function onContextAction(event) {
    const item = event.target?.closest?.('#thumbCtxMenu .ctx-item');
    if (!item) return;
    const label = String(item.textContent || '');
    if (!label.includes('회전')) return;
    const snapshot = selectedRotationSnapshot();
    setTimeout(() => waitForBatchRotation(snapshot, 0), 0);
  }

  document.addEventListener('click', onContextAction, true);
  document.addEventListener('pdf-preview-page-inserted', () => {
    if (lazyActive()) refreshRightPreview('canvas-page-insert');
  });

  window.PdfPreviewCanvasActionSync = {
    selectedRotationSnapshot,
    allSelectedRotationsChanged,
    lazyActive,
    refreshRightPreview,
    stage: 'right-preview-batch-action-sync-v1',
  };
})();
