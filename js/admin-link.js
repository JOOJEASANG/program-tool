// Shows the administrator link and restores the original administrator redirect.
(function () {
  if (window.__programToolAdminLinkV3) return;
  window.__programToolAdminLinkV3 = true;

  async function waitForCompat() {
    for (let i = 0; i < 80; i += 1) {
      if (window.ProgramToolCompat) return window.ProgramToolCompat;
      await new Promise(resolve => setTimeout(resolve, 50));
    }
    throw new Error('관리자 확인 모듈을 불러오지 못했습니다.');
  }

  function boot() {
    const button = document.getElementById('adminBtn');
    if (!button) return;
    button.style.display = 'none';

    if (typeof auth === 'undefined' || !auth?.onAuthStateChanged) {
      setTimeout(boot, 80);
      return;
    }

    auth.onAuthStateChanged(async user => {
      button.style.display = 'none';
      if (!user) return;
      try {
        const compat = await waitForCompat();
        const status = await compat.adminStatus();
        if (!status.isAdmin) return;
        button.style.display = 'block';
        location.replace('admin.html');
      } catch (error) {
        console.warn('[admin-link] administrator check failed', error);
      }
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once: true });
  else boot();
})();