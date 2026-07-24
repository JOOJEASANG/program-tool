// PDF editor layout export module.
// Sends independent paper margins, facing-page options, and page-number spacing to backend export.
(function () {
  'use strict';
  if (window.__pdfEditorLayoutExportV4) return;
  window.__pdfEditorLayoutExportV4 = true;

  function $(id) { return document.getElementById(id); }
  function num(id, fallback) {
    const value = Number($(id) && $(id).value);
    return Number.isFinite(value) ? Math.max(0, Math.min(80, value)) : fallback;
  }
  function marginValues() {
    const horizontal = num('marginH', 10);
    const vertical = num('marginV', 10);
    return {
      left: num('marginLeft', horizontal),
      right: num('marginRight', horizontal),
      top: num('marginTop', vertical),
      bottom: num('marginBottom', vertical),
    };
  }
  function patchSettings(settings) {
    if (!settings || typeof settings !== 'object') return settings;
    const margins = marginValues();
    settings.margin_left_mm = margins.left;
    settings.margin_right_mm = margins.right;
    settings.margin_top_mm = margins.top;
    settings.margin_bottom_mm = margins.bottom;
    // Keep paired values for backward compatibility with older Functions revisions.
    settings.margin_h_mm = (margins.left + margins.right) / 2;
    settings.margin_v_mm = (margins.top + margins.bottom) / 2;
    settings.gap_mm = num('gap', 5);
    settings.facing_pages = !!($('facingPages') && $('facingPages').checked);
    settings.page_numbers = settings.page_numbers || {};
    settings.page_numbers.auto_reserve_space = !($('pnAutoReserve') && !$('pnAutoReserve').checked);
    return settings;
  }
  function wrapApiProcessPdf() {
    if (window.__pdfLayoutApiWrappedV4 || typeof window.apiProcessPdf !== 'function') return false;
    const original = window.apiProcessPdf;
    window.apiProcessPdf = function layoutPatchedApiProcessPdf(files, settings, options) {
      return original.call(this, files, patchSettings(settings), options);
    };
    window.__pdfLayoutApiWrappedV4 = true;
    return true;
  }
  function wrapFetch() {
    if (window.__pdfLayoutFetchWrappedV4) return true;
    const originalFetch = window.fetch.bind(window);
    window.fetch = function layoutPatchedFetch(input, init) {
      try {
        const url = typeof input === 'string' ? input : (input && input.url) || '';
        if (url.includes('/api/pdf/process') && init && init.body instanceof FormData) {
          const raw = init.body.get('settings');
          if (raw) init.body.set('settings', JSON.stringify(patchSettings(JSON.parse(raw))));
        } else if (url.includes('/api/pdf/process-storage') && init && typeof init.body === 'string') {
          const body = JSON.parse(init.body);
          if (body && body.settings) {
            body.settings = patchSettings(body.settings);
            init.body = JSON.stringify(body);
          }
        }
      } catch (error) {
        console.warn('[pdf-layout] settings patch failed', error);
      }
      return originalFetch(input, init);
    };
    window.__pdfLayoutFetchWrappedV4 = true;
    return true;
  }
  function boot(attempt) {
    const ready = wrapApiProcessPdf();
    wrapFetch();
    if (!ready && attempt < 10) setTimeout(() => boot(attempt + 1), 180 + attempt * 80);
  }
  window.PdfEditorLayoutExport = { patchSettings, marginValues };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => boot(0), { once: true });
  else boot(0);
})();
