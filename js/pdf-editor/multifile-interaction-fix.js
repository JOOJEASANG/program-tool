// Stabilize PDF editor controls after adding multiple files.
(function () {
  'use strict';
  if (window.__pdfEditorMultiFileInteractionFixV1) return;
  window.__pdfEditorMultiFileInteractionFixV1 = true;

  const NUPS = [1, 2, 4, 6, 8, 9];
  const byId = (id) => document.getElementById(id);

  function editorReady() {
    try {
      return Array.isArray(parsedPages) && Array.isArray(uploadedFiles);
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
    if (!section) return;
    section.classList.add('pdf-output-dock');
  }

  function fileIndicesInPageOrder() {
    if (!editorReady()) return [];
    const result = [];
    parsedPages.forEach((page) => {
      const fi = Number(page && (page.file_index ?? page.fileIndex));
      if (Number.isInteger(fi) && fi >= 0 && !result.includes(fi)) result.push(fi);
    });
    return result;
  }

  function annotateFileSelectors() {
    const indices = fileIndicesInPageOrder();
    document.querySelectorAll('#thumbArea .thumb-file-sep').forEach((sep, order) => {
      const select = sep.querySelector('select');
      const fi = indices[order];
      if (select && Number.isInteger(fi)) select.dataset.fileIndex = String(fi);
    });
  }

  function syncFileNup(fileIndex, value) {
    if (!editorReady()) return;
    const n = Number(value);
    if (!Number.isInteger(fileIndex) || fileIndex < 0 || !NUPS.includes(n)) return;

    try { fileNupMap[fileIndex] = n; } catch (_) {}
    try {
      const helperMap = window.__pdfEditorFileNupMapV5;
      if (helperMap) helperMap[fileIndex] = n;
    } catch (_) {}

    parsedPages.forEach((page) => {
      const fi = Number(page && (page.file_index ?? page.fileIndex));
      if (fi !== fileIndex) return;
      page.nupOverride = n;
      page.nup_override = n;
      page.nupDisabled = false;
      page.nup_disabled = false;
    });

    document.querySelectorAll('#thumbArea select[data-file-index="' + fileIndex + '"]').forEach((select) => {
      if (select.value !== String(n)) select.value = String(n);
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
    if (!area || area.dataset.multiFileNupDelegatedV1) return;
    area.dataset.multiFileNupDelegatedV1 = '1';

    area.addEventListener('change', (event) => {
      const select = event.target && event.target.closest
        ? event.target.closest('.file-nup-select-v5, .thumb-file-sep select')
        : null;
      if (!select) return;
      annotateFileSelectors();
      const fi = Number(select.dataset.fileIndex);
      if (!Number.isInteger(fi)) return;
      event.stopImmediatePropagation();
      syncFileNup(fi, select.value);
    }, true);
  }

  function refreshSlideCount() {
    try {
      const total = parsedPages.length;
      const active = parsedPages.filter((page) => !page.excluded).length;
      if (byId('slideCount')) byId('slideCount').textContent = active + '/' + total + 'p';
    } catch (_) {}
  }

  function installPageHideDelegation() {
    const area = byId('thumbArea');
    if (!area || area.dataset.pageHideDelegatedV1) return;
    area.dataset.pageHideDelegatedV1 = '1';

    area.addEventListener('click', (event) => {
      const wrap = event.target && event.target.closest ? event.target.closest('.thumb-wrap') : null;
      if (!wrap || !area.contains(wrap)) return;
      const item = wrap.closest('.thumb-item');
      const id = item ? Number(item.dataset.id) : NaN;
      if (!Number.isFinite(id) || !editorReady()) return;
      const page = parsedPages.find((entry) => Number(entry.id) === id);
      if (!page) return;

      event.preventDefault();
      event.stopImmediatePropagation();
      page.excluded = !page.excluded;
      wrap.classList.toggle('excluded', page.excluded);
      let mark = wrap.querySelector('.thumb-ex');
      if (page.excluded && !mark) {
        mark = document.createElement('div');
        mark.className = 'thumb-ex';
        mark.textContent = '✕';
        wrap.appendChild(mark);
      } else if (!page.excluded && mark) {
        mark.remove();
      }
      refreshSlideCount();
      try { if (typeof schedulePreview === 'function') schedulePreview(120); } catch (_) {}
    }, true);
  }

  function patchRenderThumbs() {
    try {
      if (typeof renderThumbs !== 'function' || renderThumbs.__multiFileInteractionPatchedV1) return;
      const original = renderThumbs;
      const wrapped = function () {
        const result = original.apply(this, arguments);
        setTimeout(() => {
          annotateFileSelectors();
          installSelectorDelegation();
          installPageHideDelegation();
        }, 0);
        return result;
      };
      wrapped.__multiFileInteractionPatchedV1 = true;
      renderThumbs = wrapped;
    } catch (_) {}
  }

  function boot() {
    installStyles();
    dockOutputButtons();
    if (!editorReady()) return;
    patchRenderThumbs();
    annotateFileSelectors();
    installSelectorDelegation();
    installPageHideDelegation();
  }

  document.addEventListener('DOMContentLoaded', boot);
  setTimeout(boot, 700);
  setInterval(boot, 1200);
})();
