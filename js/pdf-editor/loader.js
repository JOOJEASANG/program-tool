// PDF editor module loader.
// Add new PDF editor modules here instead of growing tools/pdf-editor.html.
(function () {
  if (window.__pdfEditorModuleLoaderV5) return;
  window.__pdfEditorModuleLoaderV5 = true;

  const MODULES = [
    '/js/pdf-editor/upload-fix.js?v=20260518-1',
    '/js/pdf-editor/live-preview.js?v=20260518-1',
    '/js/pdf-editor/layout-export.js?v=20260518-1',
    '/js/pdf-editor/page-count-hint.js?v=20260518-1',
    '/js/pdf-editor/nup-helper.js?v=20260518-2',
    '/js/pdf-editor/divider-helper.js?v=20260518-2',
    '/js/pdf-editor/storage-cleanup.js?v=20260518-1',
    '/js/pdf-editor/history-policy.js?v=20260518-1'
  ];

  function loadScript(src) {
    const clean = src.split('?')[0];
    if ([...document.scripts].some((script) => script.src && script.src.includes(clean))) return;
    const script = document.createElement('script');
    script.src = src;
    script.defer = true;
    document.head.appendChild(script);
  }

  MODULES.forEach(loadScript);
})();
