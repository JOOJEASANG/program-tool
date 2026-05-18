// PDF editor cleanup helper.
// Original uploaded PDFs are used only in browser memory while processing.
// After the edited PDF is saved to Storage, clear the working session so only the final PDF remains saved.
(function () {
  if (window.__pdfEditorCleanupV1) return;
  window.__pdfEditorCleanupV1 = true;

  function $(id) { return document.getElementById(id); }

  function clearWorkingFiles() {
    try {
      if (Array.isArray(window.uploadedFiles)) window.uploadedFiles.length = 0;
      if (Array.isArray(window.parsedPages)) window.parsedPages.length = 0;
      if (Array.isArray(window.previewCanvases)) window.previewCanvases.length = 0;
    } catch (_) {}

    try {
      const fileInput = $('fileInput');
      if (fileInput) fileInput.value = '';
    } catch (_) {}

    try {
      ['programToolPdfFileNupOverridesV1', 'programToolPdfPageNupOverridesV1', 'programToolPdfSelectedPageOrdinalV1'].forEach((key) => localStorage.removeItem(key));
    } catch (_) {}

    try {
      if (typeof window.renderThumbs === 'function') window.renderThumbs();
    } catch (_) {}

    try {
      const previewBtn = $('previewBtn');
      const downloadBtn = $('downloadBtn');
      if (previewBtn) previewBtn.disabled = true;
      if (downloadBtn) downloadBtn.disabled = true;
      if ($('previewInfo')) $('previewInfo').textContent = '작업 완료 후 원본 업로드 파일을 정리했습니다. 새 작업은 PDF를 다시 업로드하세요.';
      if ($('previewPages')) $('previewPages').textContent = '';
      if ($('previewScroll')) $('previewScroll').innerHTML = '<div class="empty-state"><div class="icon">✅</div><p>최종 편집 PDF만 저장되었습니다.<br>원본 업로드 파일은 작업 상태에서 제거되었습니다.</p></div>';
      if ($('thumbArea')) $('thumbArea').innerHTML = '';
      if ($('thumbSection')) $('thumbSection').style.display = 'none';
    } catch (_) {}
  }

  function wrapSaveToStorage() {
    if (window.__saveToStorageCleanupWrapped || typeof window.saveToStorage !== 'function') return;
    const original = window.saveToStorage;
    window.saveToStorage = async function cleanedSaveToStorage(blob, filename) {
      // Keep saving only the processed output PDF. Never store source uploaded files here.
      const result = await original.call(this, blob, filename);
      setTimeout(clearWorkingFiles, 500);
      return result;
    };
    window.__saveToStorageCleanupWrapped = true;
  }

  function boot() {
    wrapSaveToStorage();
  }

  document.addEventListener('DOMContentLoaded', boot);
  setInterval(boot, 1000);
})();
