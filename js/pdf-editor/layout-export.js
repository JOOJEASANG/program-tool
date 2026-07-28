// PDF editor layout export module.
// Sends independent paper margins, facing-page options, and page-number spacing to backend export.
(function () {
  'use strict';
  if (window.__pdfEditorLayoutExportV5) return;
  window.__pdfEditorLayoutExportV5 = true;

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
  window.PdfEditorLayoutExport = { patchSettings, marginValues };
})();
