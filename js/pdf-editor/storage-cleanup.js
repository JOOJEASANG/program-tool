// PDF editor storage cleanup module.
// Keeps source uploads temporary and clears working memory after final output is saved.
(function () {
  if (window.__pdfEditorStorageCleanupV1) return;
  window.__pdfEditorStorageCleanupV1 = true;

  const TEMP_KEYS = [
    'programToolPdfFileNupOverridesV1',
    'programToolPdfPageNupOverridesV1',
    'programToolPdfSelectedPageOrdinalV1'
  ];

  function $(id) { return document.getElementById(id); }

  function clearWorkingState() {
    try { if (Array.isArray(window.uploadedFiles)) window.uploadedFiles.length = 0; } catch (_) {}
    try { if (Array.isArray(window.parsedPages)) window.parsedPages.length = 0; } catch (_) {}
    try { if (Array.isArray(window.previewCanvases)) window.previewCanvases.length = 0; } catch (_) {}

    try { const input = $('fileInput'); if (input) input.value = ''; } catch (_) {}
    try { TEMP_KEYS.forEach((key) => localStorage.removeItem(key)); } catch (_) {}

    try { if (typeof window.renderThumbs === 'function') window.renderThumbs(); } catch (_) {}

    const previewBtn = $('previewBtn');
    const downloadBtn = $('downloadBtn');
    if (previewBtn) previewBtn.disabled = true;
    if (downloadBtn) downloadBtn.disabled = true;
    if ($('previewInfo')) $('previewInfo').textContent = '작업 완료 후 원본 업로드 파일을 정리했습니다. 새 작업은 PDF를 다시 업로드하세요.';
    if ($('previewPages')) $('previewPages').textContent = '';
    if ($('thumbArea')) $('thumbArea').innerHTML = '';
    if ($('thumbSection')) $('thumbSection').style.display = 'none';
    if ($('previewScroll')) {
      $('previewScroll').innerHTML = '<div class="empty-state"><div class="icon">✅</div><p>최종 편집 PDF만 저장되었습니다.<br>원본 업로드 파일은 작업 상태에서 제거되었습니다.</p></div>';
    }
  }

  function wrapSaveToStorage() {
    if (window.__saveToStorageCleanupWrapped || typeof window.saveToStorage !== 'function') return;
    const original = window.saveToStorage;
    window.saveToStorage = async function saveOnlyFinalOutput(blob, filename) {
      const result = await original.call(this, blob, filename);
      setTimeout(clearWorkingState, 500);
      return result;
    };
    window.__saveToStorageCleanupWrapped = true;
  }

  function boot() { wrapSaveToStorage(); }
  document.addEventListener('DOMContentLoaded', boot);
  setInterval(boot, 1000);
})();
