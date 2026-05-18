// Service worker registration disabled.
// Loads per-program module loaders without intercepting navigation.
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

  function loadScript(id, src) {
    if (document.getElementById(id)) return;
    const script = document.createElement('script');
    script.id = id;
    script.src = src;
    script.defer = true;
    document.head.appendChild(script);
  }

  function loadHelpers() {
    if (location.pathname.endsWith('/tools/pdf-editor.html')) {
      loadScript('pdfEditorModuleLoaderScript', '/js/pdf-editor/loader.js?v=20260518-2');
    }
    if (location.pathname.endsWith('/tools/design-studio.html')) {
      loadScript('designStudioHelperScript', '/js/design-studio/helper-loader.js?v=20260518-1');
    }
    if (location.pathname.endsWith('/tools/preflight.html')) {
      loadScript('preflightFixDownloadScript', '/js/preflight/fix-download.js?v=20260518-1');
    }
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', loadHelpers);
  else loadHelpers();
})();
