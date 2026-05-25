// App version badge + update helper.
(function () {
  if (window.__appVersionHelperV1) return;
  window.__appVersionHelperV1 = true;

  const LOCAL_KEY = 'programToolAppVersion';

  function makeBadge(version, changed) {
    let badge = document.getElementById('appVersionBadge');
    if (!badge) {
      badge = document.createElement('div');
      badge.id = 'appVersionBadge';
      badge.style.cssText = 'position:fixed;right:10px;bottom:10px;z-index:99999;background:#0f172a;color:#fff;border-radius:10px;padding:7px 10px;font-size:11px;font-weight:800;box-shadow:0 8px 24px rgba(15,23,42,.22);display:flex;gap:8px;align-items:center;max-width:calc(100vw - 20px);';
      document.body.appendChild(badge);
    }
    badge.innerHTML = `<span>버전 ${version}</span>` + (changed ? '<button id="appVersionReloadBtn" style="border:0;border-radius:7px;background:#22c55e;color:#052e16;font-size:11px;font-weight:900;padding:4px 7px;cursor:pointer;">업데이트 적용</button>' : '');
    const btn = document.getElementById('appVersionReloadBtn');
    if (btn) btn.onclick = forceReload;
  }

  async function clearCaches() {
    try {
      if ('serviceWorker' in navigator) {
        const reg = await navigator.serviceWorker.getRegistration();
        if (reg && reg.active) reg.active.postMessage({ type: 'CLEAR_CACHES' });
      }
    } catch (_) {}
    try {
      if ('caches' in window) {
        const keys = await caches.keys();
        await Promise.all(keys.map((key) => caches.delete(key)));
      }
    } catch (_) {}
  }

  async function forceReload() {
    await clearCaches();
    const url = new URL(location.href);
    url.searchParams.set('v', Date.now().toString());
    location.replace(url.toString());
  }

  async function checkVersion() {
    try {
      const res = await fetch('/version.json?ts=' + Date.now(), { cache: 'no-store' });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      const version = (data.version && data.version !== 'unknown') ? data.version : null;
      if (!version) {
        makeBadge('확인 실패', false);
        return;
      }
      const prev = localStorage.getItem(LOCAL_KEY);
      const changed = !!prev && prev !== version;
      localStorage.setItem(LOCAL_KEY, version);
      makeBadge(version, changed);
      if (changed) await clearCaches();
    } catch (_) {
      makeBadge('확인 실패', false);
    }
  }

  async function registerFreshServiceWorker() {
    if (!('serviceWorker' in navigator)) return;
    try {
      const reg = await navigator.serviceWorker.register('/sw.js?ts=' + Date.now(), { updateViaCache: 'none' });
      reg.update().catch(() => {});
      if (reg.waiting) reg.waiting.postMessage({ type: 'SKIP_WAITING' });
    } catch (_) {}
  }

  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.addEventListener('message', (event) => {
      if (event.data && event.data.type === 'APP_VERSION') {
        makeBadge(event.data.version, false);
      }
    });
  }

  async function boot() {
    await registerFreshServiceWorker();
    await checkVersion();
  }

  document.addEventListener('DOMContentLoaded', boot);
})();
