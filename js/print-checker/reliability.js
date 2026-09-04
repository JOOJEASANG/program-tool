/* print-checker reliability guards — v20260904-1 */
'use strict';

(() => {
  const PDF_SCRIPT_ID = 'printCheckerPdfJs';
  const PDF_LOAD_TIMEOUT_MS = 15000;
  const watchedScripts = new WeakSet();

  function invalidateReport() {
    const section = document.getElementById('reportSection');
    if (!section || section.hidden) return;
    section.hidden = true;

    const grid = document.getElementById('reportGrid');
    if (grid) grid.replaceChildren();

    const summary = document.getElementById('reportSummary');
    if (summary) {
      summary.textContent = '';
      summary.className = 'report-summary';
    }
  }

  function isPdfJsScript(node) {
    return node instanceof HTMLScriptElement && node.id === PDF_SCRIPT_ID;
  }

  function watchPdfJsScript(script) {
    if (!isPdfJsScript(script) || watchedScripts.has(script)) return;
    watchedScripts.add(script);

    let settled = false;
    const finish = () => {
      settled = true;
      clearTimeout(timeoutId);
    };

    script.addEventListener('load', finish, { once: true });
    script.addEventListener('error', finish, { once: true });

    const timeoutId = setTimeout(() => {
      if (settled || !script.isConnected) return;
      if (window.pdfjsLib && typeof window.pdfjsLib.getDocument === 'function') return;
      script.dispatchEvent(new Event('error'));
      queueMicrotask(() => script.remove());
    }, PDF_LOAD_TIMEOUT_MS);
  }

  document.addEventListener('error', (event) => {
    const target = event.target;
    if (!isPdfJsScript(target)) return;
    queueMicrotask(() => {
      if (target.isConnected) target.remove();
    });
  }, true);

  const observer = new MutationObserver((records) => {
    records.forEach((record) => {
      record.addedNodes.forEach((node) => watchPdfJsScript(node));
    });
  });

  if (document.head) observer.observe(document.head, { childList: true });
  const existingPdfScript = document.getElementById(PDF_SCRIPT_ID);
  if (existingPdfScript) watchPdfJsScript(existingPdfScript);

  document.addEventListener('DOMContentLoaded', () => {
    const form = document.getElementById('specForm');
    form?.addEventListener('input', invalidateReport);
    form?.addEventListener('change', invalidateReport);

    const fileInput = document.getElementById('fileInput');
    fileInput?.addEventListener('click', () => {
      fileInput.value = '';
    });
    fileInput?.addEventListener('change', invalidateReport);

    document.getElementById('uploadZone')?.addEventListener('drop', invalidateReport);
    document.getElementById('fileHasBleed')?.addEventListener('change', invalidateReport);
    document.getElementById('resetAdjBtn')?.addEventListener('click', invalidateReport);
  });
})();
