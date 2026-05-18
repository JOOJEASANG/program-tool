// Service worker registration disabled.
// Loads safe page helpers without intercepting navigation.
(function () {
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.getRegistrations()
      .then((regs) => Promise.all(regs.map((reg) => reg.unregister())))
      .catch(() => {});
  }

  if ('caches' in window) {
    caches.keys()
      .then((keys) => Promise.all(keys.map((key) => caches.delete(key))))
      .catch(() => {});
  }

  if (location.pathname.endsWith('/tools/pdf-editor.html')) {
    const loadScript = (id, src) => {
      if (document.getElementById(id)) return;
      const s = document.createElement('script');
      s.id = id;
      s.src = src;
      s.defer = true;
      document.head.appendChild(s);
    };
    const loadHelpers = () => {
      loadScript('pdfEditorHelperScript', '/js/pdf-editor-helper.js?v=20260518-4');
      loadScript('pdfEditorCleanupScript', '/js/pdf-editor-cleanup.js?v=20260518-1');
    };
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', loadHelpers);
    else loadHelpers();
  }
})();
