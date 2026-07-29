// PDF editor live-preview status adapter.
// Preview scheduling is owned by preview-controller.js.
(function () {
  'use strict';
  if (window.__pdfEditorLivePreviewV4) return;
  window.__pdfEditorLivePreviewV4 = true;

  const byId = (id) => document.getElementById(id);

  function isFastMode() {
    return !!window.__pdfEditorFastMode;
  }

  function installStatusHint() {
    let hint = byId('livePreviewHint');
    const previewInfo = byId('previewInfo');
    if (!previewInfo || !previewInfo.parentElement) return false;
    if (!hint) {
      hint = document.createElement('span');
      hint.id = 'livePreviewHint';
      previewInfo.insertAdjacentElement('afterend', hint);
    }
    hint.style.cssText = 'font-size:10px;color:#64748b;font-weight:800;white-space:nowrap;';
    if (window.__pdfEditorExtremeMode) {
      hint.textContent = '초대용량 목록 모드';
      hint.style.color = '#b45309';
    } else if (isFastMode()) {
      hint.textContent = '대용량 문서 · 수동 미리보기';
      hint.style.color = '#b45309';
    } else {
      hint.textContent = '실시간 미리보기 ON';
      hint.style.color = '#64748b';
    }
    return true;
  }

  function request(delay, force) {
    if (window.PdfPreviewController) {
      window.PdfPreviewController.request(delay, !!force);
      return;
    }
    try {
      if (typeof schedulePreview === 'function' && !force) schedulePreview(delay);
      else if (typeof triggerPreview === 'function') {
        if (force) window.__pdfEditorManualPreviewRequest = true;
        triggerPreview();
      }
    } catch (_) {}
  }

  function boot(attempt) {
    const ready = installStatusHint();
    if (!ready && attempt < 10) setTimeout(() => boot(attempt + 1), 160 + attempt * 60);
  }

  window.PdfLivePreview = {
    request,
    refresh: () => request(0, true),
    updateStatus: installStatusHint,
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => boot(0), { once: true });
  else boot(0);
})();
