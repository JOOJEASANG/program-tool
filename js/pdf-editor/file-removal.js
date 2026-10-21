(function () {
  'use strict';
  if (window.PdfUploadedFileRemoval) return;
  if (!location.pathname.includes('pdf-editor')) return;

  const byId = (id) => document.getElementById(id);

  function sourceIndex(page) {
    if (!page || page.pageType !== 'pdf' || page.file_index == null) return null;
    const index = Number(page.file_index);
    return Number.isInteger(index) && index >= 0 ? index : null;
  }

  function remapNupOverrides(overrides, deletedIndex) {
    const updated = {};
    for (const [key, value] of Object.entries(overrides || {})) {
      const index = Number(key);
      if (!Number.isInteger(index) || index < 0 || index === deletedIndex) continue;
      updated[index > deletedIndex ? index - 1 : index] = value;
    }
    return updated;
  }

  function report(message, error = false) {
    if (typeof showStatus === 'function') showStatus(message, error ? 'error' : 'success');
  }

  function setEmptyPreview() {
    const scroll = byId('previewScroll');
    if (scroll) {
      scroll.dataset.lazyPreview = 'false';
      scroll.replaceChildren();
      const empty = document.createElement('div');
      empty.className = 'empty-state';
      const title = document.createElement('p');
      title.textContent = 'PDF 파일을 추가하면 미리보기가 표시됩니다.';
      empty.appendChild(title);
      scroll.appendChild(empty);
    }
    const lazyNav = byId('pdfLazyPreviewNav');
    if (lazyNav) lazyNav.dataset.active = 'false';
    window.__pdfEditorLazyPreviewActive = false;
    if (byId('previewInfo')) byId('previewInfo').textContent = '';
    if (byId('previewPages')) byId('previewPages').textContent = '';
  }

  function removeFile(value) {
    if (typeof uploadedFiles === 'undefined' || typeof parsedPages === 'undefined'
        || !Array.isArray(uploadedFiles) || !Array.isArray(parsedPages)) return false;
    const index = Number(value);
    if (!Number.isInteger(index) || index < 0 || index >= uploadedFiles.length) return false;
    if (byId('uploadZone')?.dataset?.importBusy === '1' || window.PdfUploadOrderUi?.pending?.busy) {
      report('PDF 파일 추가가 완료된 후 삭제해 주세요.', true);
      return false;
    }

    const file = uploadedFiles[index];
    const fileName = String(file?.name || 'PDF 파일');
    const deletedPages = parsedPages.filter((page) => sourceIndex(page) === index);
    if (typeof window.confirm !== 'function' || !window.confirm(
      '"' + fileName + '" 파일과 포함된 ' + deletedPages.length + '페이지를 작업에서 삭제할까요?\n' +
      '다른 PDF 파일과 페이지는 그대로 유지됩니다.'
    )) return false;

    // Preserve unrelated pages and compact source indices used by export and session save.
    const remainingPages = parsedPages.filter((page) => sourceIndex(page) !== index);
    for (const page of remainingPages) {
      if (page.file_index == null) continue;
      const oldIndex = Number(page.file_index);
      if (Number.isInteger(oldIndex) && oldIndex > index) page.file_index = oldIndex - 1;
    }
    parsedPages = remainingPages;
    uploadedFiles.splice(index, 1);
    fileNupMap = remapNupOverrides(fileNupMap, index);
    previewCanvases = [];

    try { if (typeof _autoPreviewTimer !== 'undefined') clearTimeout(_autoPreviewTimer); } catch (_) {}
    try { _nupPopup?.remove?.(); _nupPopup = null; } catch (_) {}
    try { _dragSrcId = null; _dragPageIds = []; clearThumbDragState?.(); } catch (_) {}
    try { byId('thumbCtxMenu')?.classList.remove('open'); } catch (_) {}
    try { window.PdfEditorPageSelection?.clearSelection?.(); } catch (_) {}
    try { _uploadMode = uploadedFiles.length ? 'cont' : 'new'; } catch (_) {}
    try { window.PdfUploadOptimization?.syncAggregateMode?.(); } catch (_) {}

    if (typeof renderThumbs === 'function') renderThumbs();
    const hasPages = parsedPages.length > 0;
    if (byId('previewBtn')) byId('previewBtn').disabled = !hasPages;
    if (byId('downloadBtn')) {
      byId('downloadBtn').disabled = !hasPages || !uploadedFiles.length || !parsedPages.some((page) => !page.excluded);
    }
    if (!hasPages) {
      setEmptyPreview();
    } else {
      const scroll = byId('previewScroll');
      if (scroll) {
        scroll.replaceChildren();
        const message = document.createElement('p');
        message.className = 'empty-state';
        message.textContent = '변경된 PDF 미리보기를 생성 중입니다.';
        scroll.appendChild(message);
      }
      if (typeof schedulePreview === 'function') schedulePreview(0);
      else if (typeof triggerPreview === 'function') void triggerPreview();
    }

    document.dispatchEvent(new CustomEvent('pdf-file-removed', {
      detail: { fileIndex: index, fileName, pageCount: deletedPages.length },
    }));
    report('"' + fileName + '" 파일 및 ' + deletedPages.length + '페이지를 삭제했습니다.');
    return true;
  }

  window.PdfUploadedFileRemoval = {
    removeFile,
    sourceIndex,
    remapNupOverrides,
    stage: 'file-source-delete-and-index-compaction',
  };
})();
