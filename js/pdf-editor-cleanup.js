// Compatibility wrapper. The real cleanup logic now lives in /js/pdf-editor/storage-cleanup.js.
(function () {
  if ([...document.scripts].some((s) => s.src && s.src.includes('/js/pdf-editor/storage-cleanup.js'))) return;
  const s = document.createElement('script');
  s.src = '/js/pdf-editor/storage-cleanup.js?v=20260518-1';
  s.defer = true;
  document.head.appendChild(s);
})();
