// PDF editor module loader.
// Add new PDF editor modules here instead of growing tools/pdf-editor.html.
(function () {
  if (window.__pdfEditorModuleLoaderV35) return;
  window.__pdfEditorModuleLoaderV35 = true;
  // Backward-compatible marker retained for existing diagnostics and cached pages.
  window.__pdfEditorModuleLoaderV34 = true;

  const MODULES = [
    '/js/pdf-editor/font-render-fix.js?v=20260618-1',
    '/js/pdf-editor/upload-fix.js?v=20260724-5',
    '/js/pdf-editor/live-preview.js?v=20260724-4',
    '/js/pdf-editor/layout-export.js?v=20260724-5',
    '/js/pdf-editor/page-count-hint.js?v=20260724-2',
    '/js/pdf-editor/nup-helper.js?v=20260724-2',
    '/js/pdf-editor/preview-row-default.js?v=20260602-1',
    '/js/pdf-editor/divider-helper.js?v=20260722-2',
    '/js/pdf-editor/divider-studio.js?v=20260722-1',
    '/js/pdf-editor/divider-studio-render-fix.js?v=20260722-1',
    '/js/pdf-editor/multifile-interaction-fix.js?v=20260724-3',
    '/js/pdf-editor/ux-repair.js?v=20260724-2',
    '/js/pdf-editor/individual-margins-facing-pages.js?v=20260724-1',
    '/js/pdf-editor/page-number-auto-reserve.js?v=20260724-1',
    '/js/pdf-editor/page-number-auto-reserve-layout-v2.js?v=20260724-1',
    '/js/pdf-editor/page-selection-preview-focus.js?v=20260724-1',
    '/js/pdf-editor/page-productivity.js?v=20260724-1',
    '/js/pdf-editor/thumbnail-integrity.js?v=20260724-1',
    '/js/pdf-editor/booklet-reliability.js?v=20260724-2',
    '/js/pdf-editor/hf-input-cleanup.js?v=20260724-1',
    '/js/pdf-editor/page-number-preview-parity.js?v=20260724-1',
    '/js/pdf-editor/runtime-integrity.js?v=20260724-1',
    '/js/pdf-editor/output-contract.js?v=20260727-1',
    '/js/pdf-editor/preview-controller.js?v=20260727-3',
    '/js/pdf-editor/source-ui-normalization.js?v=20260724-1',
    '/js/pdf-editor/operation-progress-summary.js?v=20260724-1',
    '/js/pdf-editor/booklet-print-guide.js?v=20260724-1',
    '/js/pdf-editor/print-marks-bleed.js?v=20260724-1',
    '/js/pdf-editor/dock-width-align.js?v=20260724-5',
    '/js/pdf-editor/preview-toolbar-layout-fix.js?v=20260724-2'
  ];

  function loadScript(src) {
    const clean = src.split('?')[0];
    if ([...document.scripts].some((script) => script.src && script.src.includes(clean))) return;
    const script = document.createElement('script');
    script.src = src;
    script.async = false;
    document.head.appendChild(script);
  }

  MODULES.forEach(loadScript);
})();
