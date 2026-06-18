(function () {
  function loadScript(id, src) {
    if (document.getElementById(id)) return;
    const script = document.createElement('script');
    script.id = id;
    script.src = src;
    script.defer = true;
    document.head.appendChild(script);
  }
  async function clearOldCaches() {
    try {
      if ('caches' in window) {
        const keys = await caches.keys();
        await Promise.all(keys.map((key) => caches.delete(key)));
      }
    } catch (_) {}
  }
  async function registerFreshServiceWorker() {
    if (!('serviceWorker' in navigator)) return;
    try {
      const reg = await navigator.serviceWorker.register('/sw.js?ts=' + Date.now(), { updateViaCache: 'none' });
      await reg.update().catch(() => {});
      if (reg.waiting) reg.waiting.postMessage({ type: 'SKIP_WAITING' });
    } catch (_) {}
  }
  function loadHelpers() {
    loadScript('appVersionHelperScript', '/js/app-version.js?v=20260518-1');
    if (location.pathname === '/' || location.pathname.endsWith('/index.html')) {
      loadScript('homeCleanupScript', '/js/home-cleanup.js?v=20260618-1');
    }
    if (location.pathname.endsWith('/tools/pdf-editor.html')) {
      loadScript('pdfEditorModuleLoaderScript', '/js/pdf-editor/loader.js?v=20260618-3');
    }
    if (location.pathname.endsWith('/tools/design-studio.html')) {
      loadScript('designStudioHelperScript', '/js/design-studio/helper-loader.js?v=20260518-1');
    }
    if (location.pathname.endsWith('/tools/pdf-Checker.html') || location.pathname.endsWith('/tools/preflight.html')) {
      loadScript('preflightFixDownloadScript', '/js/preflight/fix-download.js?v=20260618-3');
      loadScript('preflightCompressHelperScript', '/js/preflight/compress-helper.js?v=20260618-2');
      loadScript('pdfCheckerReportHelperScript', '/js/preflight/report-helper.js?v=20260518-1');
    }
  }
  async function boot() {
    await clearOldCaches();
    await registerFreshServiceWorker();
    loadHelpers();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
