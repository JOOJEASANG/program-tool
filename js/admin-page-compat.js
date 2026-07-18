// Recovers the administrator console on Hosting preview channels where the
// matching Cloud Functions have not been deployed yet.
(function () {
  if (window.__programToolAdminPageCompatV1) return;
  window.__programToolAdminPageCompatV1 = true;

  async function waitForDependencies() {
    for (let i = 0; i < 100; i += 1) {
      if (window.ProgramToolCompat && window.auth?.currentUser && typeof window.loadAdminData === 'function') return;
      await new Promise(resolve => setTimeout(resolve, 50));
    }
    throw new Error('관리자 호환 기능을 불러오지 못했습니다.');
  }

  async function recover() {
    try {
      await waitForDependencies();
      const status = await window.ProgramToolCompat.adminStatus();
      if (!status.isAdmin) return;

      window.api = (path, options = {}) => window.ProgramToolCompat.adminRequest(path, options);
      document.getElementById('authLoading')?.style.setProperty('display', 'none');
      document.getElementById('noAccess')?.classList.add('hidden');
      document.getElementById('adminContent')?.classList.remove('hidden');
      if (document.getElementById('diagEmail')) {
        document.getElementById('diagEmail').textContent = status.currentEmail || auth.currentUser.email || '-';
      }
      await Promise.allSettled([window.loadAdminData(), window.checkHealth?.()]);
    } catch (error) {
      console.warn('[admin-page-compat] recovery failed', error);
    }
  }

  recover();
  setTimeout(recover, 1200);
})();