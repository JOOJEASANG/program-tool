// Shows the administrator link without exposing the administrator email list.
(function () {
  if (window.__programToolAdminLinkV1) return;
  window.__programToolAdminLinkV1 = true;

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
        const token = await user.getIdToken();
        const response = await fetch('/api/admin/me', {
          headers: { Authorization: 'Bearer ' + token },
          cache: 'no-store',
        });
        const data = await response.json().catch(() => ({}));
        if (response.ok && data.isAdmin) button.style.display = 'block';
      } catch (_) {}
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once: true });
  else boot();
})();
