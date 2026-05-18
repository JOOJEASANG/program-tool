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
    const loadHelper = () => {
      if (document.getElementById('pdfEditorHelperScript')) return;
      const s = document.createElement('script');
      s.id = 'pdfEditorHelperScript';
      s.src = '/js/pdf-editor-helper.js?v=20260518-3';
      s.defer = true;
      document.head.appendChild(s);
    };
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', loadHelper);
    else loadHelper();
  }
})();
