// PDF editor helper loader compatibility file.
// Actual helper logic is split into js/pdf-editor/*.js modules.
(function () {
  if (window.__pdfEditorHelperLoaderV1) return;
  window.__pdfEditorHelperLoaderV1 = true;
  const modules = [
    '/js/pdf-editor/nup-helper.js?v=20260518-1',
    '/js/pdf-editor/divider-helper.js?v=20260518-1',
    '/js/pdf-editor-cleanup.js?v=20260518-1'
  ];
  function load(src) {
    if ([...document.scripts].some((s) => s.src && s.src.includes(src.split('?')[0]))) return;
    const s = document.createElement('script');
    s.src = src;
    s.defer = true;
    document.head.appendChild(s);
  }
  modules.forEach(load);
})();
