// Replace legacy header/footer inputs so only explicit assignments remain bound.
(function () {
  'use strict';
  if (window.__pdfHeaderFooterInputCleanupV1) return;
  window.__pdfHeaderFooterInputCleanupV1 = true;

  const FIELD_IDS = ['hfHL', 'hfHC', 'hfHR', 'hfFL', 'hfFC', 'hfFR'];
  let attempts = 0;

  function assignValue(id, value) {
    try {
      if (id === 'hfHL') hfHL = value;
      else if (id === 'hfHC') hfHC = value;
      else if (id === 'hfHR') hfHR = value;
      else if (id === 'hfFL') hfFL = value;
      else if (id === 'hfFC') hfFC = value;
      else if (id === 'hfFR') hfFR = value;
    } catch (_) {}
  }

  function requestPreview() {
    if (window.PdfPreviewController) {
      window.PdfPreviewController.request(450, false);
      return;
    }
    try { if (typeof schedulePreview === 'function') schedulePreview(450); } catch (_) {}
  }

  function replaceInput(id) {
    const current = document.getElementById(id);
    if (!current) return false;
    if (current.dataset.safeHfInput === '1') return true;
    const replacement = current.cloneNode(true);
    replacement.dataset.safeHfInput = '1';
    replacement.addEventListener('input', () => {
      assignValue(id, replacement.value);
      requestPreview();
    });
    current.replaceWith(replacement);
    assignValue(id, replacement.value);
    return true;
  }

  function install() {
    const ready = FIELD_IDS.map(replaceInput).every(Boolean);
    if (!ready && attempts < 10) {
      attempts += 1;
      setTimeout(install, 160 + attempts * 60);
    }
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', install, { once: true });
  else install();
})();
