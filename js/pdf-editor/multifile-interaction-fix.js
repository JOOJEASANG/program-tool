// Keep per-file N-UP controls synchronized after multiple PDF uploads.
(function () {
  'use strict';
  if (window.__pdfEditorMultiFileInteractionFixV3) return;
  window.__pdfEditorMultiFileInteractionFixV3 = true;

  const NUPS = [1, 2, 4, 6, 8, 9];
  const byId = (id) => document.getElementById(id);
  let attempts = 0;

  function editorReady() {
    try {
      return Array.isArray(parsedPages) && Array.isArray(uploadedFiles);
    } catch (_) {
      return false;
    }
  }

  function fileIndicesInPageOrder() {
    if (!editorReady()) return [];
    const result = [];
    parsedPages.forEach((page) => {
      const fileIndex = Number(page && (page.file_index ?? page.fileIndex));
      if (Number.isInteger(fileIndex) && fileIndex >= 0 && !result.includes(fileIndex)) result.push(fileIndex);
    });
    return result;
  }

  function annotateFileSelectors() {
    const indices = fileIndicesInPageOrder();
    document.querySelectorAll('#thumbArea .thumb-file-sep').forEach((separator, order) => {
      const select = separator.querySelector('select');
      const fileIndex = indices[order];
      if (select && Number.isInteger(fileIndex)) select.dataset.fileIndex = String(fileIndex);
    });
  }

  function explicitFileNup(fileIndex) {
    try {
      const value = Number(fileNupMap[fileIndex]);
      return NUPS.includes(value) ? value : null;
    } catch (_) {
      return null;
    }
  }

  function mirrorFileNup(fileIndex) {
    if (!Number.isInteger(fileIndex) || fileIndex < 0) return;
    const explicit = explicitFileNup(fileIndex);
    const helperMap = window.__pdfEditorFileNupMapV5;
    if (helperMap) {
      if (explicit === null) delete helperMap[fileIndex];
      else helperMap[fileIndex] = explicit;
    }
    document.querySelectorAll('#thumbArea .file-nup-select-v5[data-file-index="' + fileIndex + '"]').forEach((select) => {
      const next = explicit === null ? '' : String(explicit);
      if (select.value !== next) select.value = next;
    });
  }

  function installSelectorDelegation() {
    const area = byId('thumbArea');
    if (!area || area.dataset.multiFileNupDelegatedV3) return;
    area.dataset.multiFileNupDelegatedV3 = '1';
    area.addEventListener('change', (event) => {
      const select = event.target && event.target.closest
        ? event.target.closest('.file-nup-select-v5, .thumb-file-sep select')
        : null;
      if (!select) return;
      annotateFileSelectors();
      const fileIndex = Number(select.dataset.fileIndex);
      if (!Number.isInteger(fileIndex)) return;
      setTimeout(() => mirrorFileNup(fileIndex), 0);
    });
  }

  function refreshAfterRender() {
    annotateFileSelectors();
    fileIndicesInPageOrder().forEach(mirrorFileNup);
    installSelectorDelegation();
  }

  function patchRenderThumbs() {
    try {
      if (typeof renderThumbs !== 'function') return false;
      if (renderThumbs.__multiFileInteractionPatchedV3) return true;
      const original = renderThumbs;
      const wrapped = function renderThumbsWithFileNupSync() {
        const result = original.apply(this, arguments);
        setTimeout(refreshAfterRender, 0);
        return result;
      };
      wrapped.__multiFileInteractionPatchedV3 = true;
      wrapped.__multiFileInteractionPatchedV2 = true;
      renderThumbs = wrapped;
      window.renderThumbs = wrapped;
      return true;
    } catch (error) {
      console.warn('[pdf-multifile] render patch failed', error);
      return false;
    }
  }

  function boot() {
    if (!editorReady()) {
      if (attempts < 10) {
        attempts += 1;
        setTimeout(boot, 180 + attempts * 80);
      }
      return;
    }
    patchRenderThumbs();
    refreshAfterRender();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once: true });
  else boot();
})();
