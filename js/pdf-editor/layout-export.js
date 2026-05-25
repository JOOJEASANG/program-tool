// PDF editor layout export module.
// Ensures paper margins and page gaps from the UI are sent to backend export.
(function () {
  if (window.__pdfEditorLayoutExportV1) return;
  window.__pdfEditorLayoutExportV1 = true;

  function $(id) { return document.getElementById(id); }
  function num(id, fallback) {
    const v = Number($(id) && $(id).value);
    return Number.isFinite(v) ? v : fallback;
  }
  function patchSettings(settings) {
    if (!settings || typeof settings !== 'object') return settings;
    settings.margin_h_mm = num('marginH', 10);
    settings.margin_v_mm = num('marginV', 10);
    settings.gap_mm = num('gap', 5);
    return settings;
  }
  function wrapApiProcessPdf() {
    if (window.__pdfLayoutApiWrapped || typeof window.apiProcessPdf !== 'function') return;
    const original = window.apiProcessPdf;
    window.apiProcessPdf = function layoutPatchedApiProcessPdf(files, settings) {
      return original.call(this, files, patchSettings(settings));
    };
    window.__pdfLayoutApiWrapped = true;
  }
  function _isSameOriginApiPath(url) {
    try {
      const parsed = new URL(url, location.origin);
      return parsed.origin === location.origin && parsed.pathname === '/api/pdf/process';
    } catch (_) {
      return false;
    }
  }
  function wrapFetch() {
    if (window.__pdfLayoutFetchWrapped) return;
    const originalFetch = window.fetch.bind(window);
    window.fetch = function layoutPatchedFetch(input, init) {
      try {
        const url = typeof input === 'string' ? input : (input && input.url) || '';
        if (_isSameOriginApiPath(url) && init && init.body instanceof FormData) {
          const raw = init.body.get('settings');
          if (raw) init.body.set('settings', JSON.stringify(patchSettings(JSON.parse(raw))));
        }
      } catch (e) { console.warn('[pdf-layout] settings patch failed', e); }
      return originalFetch(input, init);
    };
    window.__pdfLayoutFetchWrapped = true;
  }
  function boot() { wrapApiProcessPdf(); wrapFetch(); }
  document.addEventListener('DOMContentLoaded', boot);
  setInterval(boot, 1000);
})();
