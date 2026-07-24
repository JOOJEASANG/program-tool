// PDF editor module loader.
// Add new PDF editor modules here instead of growing tools/pdf-editor.html.
(function () {
  if (window.__pdfEditorModuleLoaderV19) return;
  window.__pdfEditorModuleLoaderV19 = true;

  const MODULES = [
    '/js/pdf-editor/font-render-fix.js?v=20260618-1',
    '/js/pdf-editor/upload-fix.js?v=20260618-3',
    '/js/pdf-editor/live-preview.js?v=20260618-2',
    '/js/pdf-editor/layout-export.js?v=20260712-2',
    '/js/pdf-editor/page-count-hint.js?v=20260518-1',
    '/js/pdf-editor/nup-helper.js?v=20260724-2',
    '/js/pdf-editor/preview-row-default.js?v=20260602-1',
    '/js/pdf-editor/divider-helper.js?v=20260722-2',
    '/js/pdf-editor/divider-studio.js?v=20260722-1',
    '/js/pdf-editor/divider-studio-render-fix.js?v=20260722-1',
    '/js/pdf-editor/multifile-interaction-fix.js?v=20260722-1',
    '/js/pdf-editor/ux-repair.js?v=20260724-1',
    '/js/pdf-editor/dock-width-align.js?v=20260724-1'
  ];

  function loadScript(src) {
    const clean = src.split('?')[0];
    if ([...document.scripts].some((script) => script.src && script.src.includes(clean))) return;
    const script = document.createElement('script');
    script.src = src;
    // Dynamic scripts are async by default. Keep module execution order so the
    // PDF.js font patch is installed before upload-fix opens a document.
    script.async = false;
    document.head.appendChild(script);
  }

  MODULES.forEach(loadScript);
})();
