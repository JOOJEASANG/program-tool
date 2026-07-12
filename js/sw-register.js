(function () {
  function loadScript(id, src) {
    if (document.getElementById(id)) return;
    const script = document.createElement('script');
    script.id = id;
    script.src = src;
    script.defer = true;
    document.head.appendChild(script);
  }

  function isToolPath(name) {
    const path = location.pathname.replace(/\/+$/, '');
    return path.endsWith(`/tools/${name}`) || path.endsWith(`/tools/${name}.html`);
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
      loadScript('homeCleanupScript', '/js/home-cleanup.js?v=20260712-cover-maker-1');
    }

    if (isToolPath('pdf-editor')) {
      loadScript('pdfEditorModuleLoaderScript', '/js/pdf-editor/loader.js?v=20260618-4');
    }

    if (isToolPath('pdf-Checker') || isToolPath('preflight')) {
      loadScript('pdfCheckerFinalGuardScript', '/js/pdf-checker-final-guard.js?v=20260710-6');
    }

    if (isToolPath('perfect-binding-cover')) {
      loadScript('perfectBindingFineControlsScript', '/js/perfect-binding-cover-fine-controls.js?v=20260712-6');
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
