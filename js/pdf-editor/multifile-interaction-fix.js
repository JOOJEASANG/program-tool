// Stabilize PDF editor controls after adding multiple files.
(function () {
  'use strict';
  if (window.__pdfEditorMultiFileInteractionFixV2) return;
  window.__pdfEditorMultiFileInteractionFixV2 = true;
  window.__pdfEditorMultiFileInteractionFixV1 = true;

  const NUPS = [1, 2, 4, 6, 8, 9];
  const byId = (id) => document.getElementById(id);

  function editorReady() {
    try {
      return Array.isArray(parsedPages) && Array.isArray(uploadedFiles) && typeof fileNupMap === 'object';
    } catch (_) {
      return false;
    }
  }

  function installStyles() {
    if (byId('pdfEditorDockAndMultiFileStyles')) return;
    const style = document.createElement('style');
    style.id = 'pdfEditorDockAndMultiFileStyles';
    style.textContent = `
      aside{padding-bottom:190px!important}
      .pdf-output-dock{
        position:fixed!important;left:0!important;bottom:0!important;width:360px!important;
        z-index:480!important;background:#fff!important;border-top:1px solid #dbe3ec!important;
        border-right:1px solid #e5e7eb!important;padding:8px 16px 12px!important;
        box-shadow:0 -8px 22px rgba(15,23,42,.10)!important;
      }
      .pdf-output-dock .sec-head{padding:3px 0 6px!important}
      .pdf-output-dock .sec-body{padding-bottom:0!important}
      @media(max-width:900px){
        .pdf-output-dock{left:0!important;right:0!important;width:100%!important;border-right:0!important}
        aside{padding-bottom:190px!important}
      }
    `;
    document.head.appendChild(style);
  }

  function dockOutputButtons() {
    const preview = byId('previewBtn');
    const section = preview && preview.closest('.sec');
    if (section) section.classList.add('pdf-output-dock');
  }

  function fileIndicesInPageOrder() {
    if (!editorReady()) return [];
    const result = [];
    parsedPages.forEach((page) => {
      const index = Number(page && (page.file_index ?? page.fileIndex));
      if (Number.isInteger(index) && index >= 0 && !result.includes(index)) result.push(index);
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

  function setFileNup(fileIndex, rawValue) {
    if (!editorReady() || !Number.isInteger(fileIndex) || fileIndex < 0) return;
    const isDefault = rawValue === '' || rawValue === null || rawValue === undefined;
    const value = Number(rawValue);

    if (isDefault) {
      delete fileNupMap[fileIndex];
    } else if (NUPS.includes(value)) {
      fileNupMap[fileIndex] = value;
    } else {
      return;
    }

    // Expose the same map to compatibility modules. Do not copy the value into
    // individual pages: page-level overrides must remain independent.
    window.__pdfEditorFileNupMapV5 = fileNupMap;

    document.querySelectorAll(`#thumbArea select[data-file-index="${fileIndex}"]`).forEach((select) => {
      const expected = isDefault ? '' : String(value);
      if (select.value !== expected) select.value = expected;
    });

    try {
      if (typeof schedulePreview === 'function') schedulePreview(80);
      else if (typeof triggerPreview === 'function') triggerPreview();
    } catch (error) {
      console.warn('[pdf-multifile-fix] preview refresh failed', error);
    }
  }

  function installSelectorDelegation() {
    const area = byId('thumbArea');
    if (!area || area.dataset.multiFileNupDelegatedV2) return;
    area.dataset.multiFileNupDelegatedV2 = '1';

    area.addEventListener('change', (event) => {
      const select = event.target && event.target.closest
        ? event.target.closest('.thumb-file-sep select')
        : null;
      if (!select) return;
      annotateFileSelectors();
      const fileIndex = Number(select.dataset.fileIndex);
      if (!Number.isInteger(fileIndex)) return;
      event.stopImmediatePropagation();
      setFileNup(fileIndex, select.value);
    }, true);
  }

  function patchRenderThumbs() {
    try {
      if (typeof renderThumbs !== 'function' || renderThumbs.__multiFileInteractionPatchedV2) return;
      const original = renderThumbs;
      const wrapped = function renderThumbsWithStableFileSelectors() {
        const result = original.apply(this, arguments);
        setTimeout(() => {
          annotateFileSelectors();
          installSelectorDelegation();
        }, 0);
        return result;
      };
      wrapped.__multiFileInteractionPatchedV2 = true;
      renderThumbs = wrapped;
    } catch (error) {
      console.warn('[pdf-multifile-fix] render patch failed', error);
    }
  }

  function boot() {
    installStyles();
    dockOutputButtons();
    if (!editorReady()) return;
    window.__pdfEditorFileNupMapV5 = fileNupMap;
    patchRenderThumbs();
    annotateFileSelectors();
    installSelectorDelegation();
  }

  document.addEventListener('DOMContentLoaded', boot);
  setTimeout(boot, 700);
  setInterval(boot, 1500);
})();
