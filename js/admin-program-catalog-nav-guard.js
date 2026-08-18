// Keep the administrator category/program manager available after late auth/dependency startup.
(function () {
  'use strict';
  if (window.__adminProgramCatalogNavGuardV1) return;
  window.__adminProgramCatalogNavGuardV1 = true;
  const path = location.pathname.replace(/\/+$/, '') || '/';
  if (!(path === '/admin' || path === '/admin.html' || path.endsWith('/admin.html'))) return;

  let timer = null;
  let attempts = 0;

  function makePendingHint() {
    const side = document.querySelector('.side');
    if (!side || document.getElementById('adminProgramCatalogNav') || document.getElementById('adminProgramCatalogPending')) return;
    const foot = side.querySelector('.sidefoot');
    const label = document.createElement('div');
    label.id = 'adminProgramCatalogPending';
    label.className = 'navlabel';
    label.textContent = '홈 구성 불러오는 중';
    side.insertBefore(label, foot || null);
  }

  function cleanupPending() {
    document.getElementById('adminProgramCatalogPending')?.remove();
    const side = document.querySelector('.side');
    if (side) side.style.overflowY = 'auto';
  }

  async function retryInstall() {
    attempts += 1;
    const manager = window.AdminProgramCatalogManager;
    if (manager?.install) {
      try { await manager.install(); } catch (error) { console.warn('[admin-catalog] install retry failed', error); }
    }
    if (document.getElementById('adminProgramCatalogNav')) {
      cleanupPending();
      document.documentElement.dataset.adminCatalogNavGuard = 'ready';
      if (timer) clearTimeout(timer);
      return true;
    }
    makePendingHint();
    if (attempts < 60) timer = setTimeout(retryInstall, 250);
    else {
      document.documentElement.dataset.adminCatalogNavGuard = 'unavailable';
      const pending = document.getElementById('adminProgramCatalogPending');
      if (pending) pending.textContent = '홈 구성 · 다시 로그인 후 사용';
    }
    return false;
  }

  if (window.auth?.onAuthStateChanged) {
    auth.onAuthStateChanged(() => {
      attempts = 0;
      retryInstall();
    });
  }
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden && !document.getElementById('adminProgramCatalogNav')) {
      attempts = 0;
      retryInstall();
    }
  });
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', retryInstall, { once: true });
  else retryInstall();
})();
