// Registers one stable service worker and loads page-specific helpers.
(function () {
  if (window.__programToolBootstrapV2) return;
  window.__programToolBootstrapV2 = true;

  function loadScript(id, src) {
    if (document.getElementById(id)) return;
    const script = document.createElement('script');
    script.id = id;
    script.src = src;
    script.async = false;
    document.head.appendChild(script);
  }

  function isToolPath(name) {
    const path = location.pathname.replace(/\/+$/, '').toLowerCase();
    return path.endsWith('/tools/' + name.toLowerCase()) || path.endsWith('/tools/' + name.toLowerCase() + '.html');
  }

  function loadHelpers() {
    loadScript('accessCompatScript', '/js/access-compat.js?v=20260718-access-fix-1');
    loadScript('appVersionHelperScript', '/js/app-version.js?v=20260718-security-1');

    if (location.pathname === '/' || location.pathname.endsWith('/index.html')) {
      loadScript('homeCleanupScript', '/js/home-cleanup.js?v=20260712-cover-maker-1');
      loadScript('adminLinkScript', '/js/admin-link.js?v=20260718-access-fix-1');
    }

    if (isToolPath('pdf-editor')) {
      loadScript('programAccessScript', '/js/program-access.js?v=20260718-access-fix-1');
      loadScript('pdfEditorModuleLoaderScript', '/js/pdf-editor/loader.js?v=20260712-13');
    }

    if (isToolPath('pdf-checker') || isToolPath('preflight')) {
      loadScript('programAccessScript', '/js/program-access.js?v=20260718-access-fix-1');
      loadScript('pdfCheckerFinalGuardScript', '/js/pdf-checker-final-guard.js?v=20260710-6');
      loadScript('preflightTempClientScript', '/js/preflight-temp-client.js?v=20260718-1');
    }

    if (isToolPath('perfect-binding-cover')) {
      loadScript('programAccessScript', '/js/program-access.js?v=20260718-access-fix-1');
      loadScript('perfectBindingFineControlsScript', '/js/perfect-binding-cover-fine-controls.js?v=20260712-6');
      loadScript('perfectBindingProjectsScript', '/js/perfect-binding-cover-projects.js?v=20260718-1');
    }
  }

  async function registerServiceWorker() {
    if (!('serviceWorker' in navigator)) return;
    try {
      const registration = await navigator.serviceWorker.register('/sw.js', { updateViaCache: 'none' });
      registration.update().catch(() => {});
      if (registration.waiting) registration.waiting.postMessage({ type: 'SKIP_WAITING' });
    } catch (error) {
      console.warn('[service-worker] registration failed', error);
    }
  }

  function boot() {
    loadHelpers();
    registerServiceWorker();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once: true });
  else boot();
})();