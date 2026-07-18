// App version badge. The service worker is registered only by sw-register.js.
(function () {
  if (window.__appVersionHelperV2) return;
  window.__appVersionHelperV2 = true;

  const LOCAL_KEY = 'programToolAppVersion';

  function makeBadge(changed) {
    let badge = document.getElementById('appVersionBadge');
    if (!changed) {
      badge?.remove();
      return;
    }
    if (!badge) {
      badge = document.createElement('div');
      badge.id = 'appVersionBadge';
      badge.style.cssText = 'position:fixed;right:10px;bottom:10px;z-index:99999;background:#0f172a;color:#fff;border-radius:10px;padding:7px 10px;font-size:11px;font-weight:800;box-shadow:0 8px 24px rgba(15,23,42,.22);display:flex;gap:8px;align-items:center;max-width:calc(100vw - 20px);';
      document.body.appendChild(badge);
    }
    badge.replaceChildren();
    const text = document.createElement('span');
    text.textContent = '새 버전이 준비되었습니다.';
    const button = document.createElement('button');
    button.textContent = '업데이트 적용';
    button.style.cssText = 'border:0;border-radius:7px;background:#22c55e;color:#052e16;font-size:11px;font-weight:900;padding:4px 7px;cursor:pointer;';
    button.addEventListener('click', forceReload);
    badge.append(text, button);
  }

  async function clearAppCaches() {
    try {
      const registration = await navigator.serviceWorker?.getRegistration();
      registration?.active?.postMessage({ type: 'CLEAR_APP_CACHES' });
    } catch (_) {}
    try {
      if ('caches' in window) {
        const keys = await caches.keys();
        await Promise.all(keys.filter(key => key.startsWith('program-tool-')).map(key => caches.delete(key)));
      }
    } catch (_) {}
  }

  async function forceReload() {
    await clearAppCaches();
    const url = new URL(location.href);
    url.searchParams.set('v', Date.now().toString());
    location.replace(url.toString());
  }

  async function checkVersion() {
    try {
      const response = await fetch('/version.json?ts=' + Date.now(), { cache: 'no-store' });
      if (!response.ok) return;
      const data = await response.json();
      const version = data.version || 'unknown';
      const previous = localStorage.getItem(LOCAL_KEY);
      const changed = !!previous && previous !== version;
      localStorage.setItem(LOCAL_KEY, version);
      makeBadge(changed);
    } catch (_) {}
  }

  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.addEventListener('message', event => {
      if (event.data?.type === 'APP_VERSION') {
        const previous = localStorage.getItem(LOCAL_KEY);
        if (previous && previous !== event.data.version) makeBadge(true);
      }
    });
  }

  checkVersion();
})();
