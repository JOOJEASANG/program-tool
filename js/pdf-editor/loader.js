// PDF editor module loader.
// Keep the stable July 20 runtime, with selected July 24 core upgrades.
(function () {
  if (window.__pdfEditorModuleLoaderV15) return;
  window.__pdfEditorModuleLoaderV15 = true;

  const MODULES = [
    '/js/pdf-editor/font-render-fix.js?v=20260618-1',
    '/js/pdf-editor/upload-fix.js?v=20260724-5',
    '/js/pdf-editor/live-preview.js?v=20260724-4',
    '/js/pdf-editor/layout-export.js?v=20260724-5',
    '/js/pdf-editor/page-count-hint.js?v=20260724-2',
    '/js/pdf-editor/nup-helper.js?v=20260724-2',
    '/js/pdf-editor/preview-row-default.js?v=20260602-1',
    '/js/pdf-editor/divider-helper.js?v=20260724-2-safe1'
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
