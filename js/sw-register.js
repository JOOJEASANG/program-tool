// Register the service worker and handle automatic reloads on update.
// Include with: <script src="js/sw-register.js" defer></script>
//          or: <script src="../js/sw-register.js" defer></script>
(function () {
  if (!('serviceWorker' in navigator)) return;
  if (location.protocol !== 'https:' && location.hostname !== 'localhost') return;

  // Compute path to /sw.js regardless of whether we're in / or /tools/
  const swPath = new URL('/sw.js', location.origin).toString();

  let reloading = false;
  // Only auto-reload when an *existing* SW is being replaced — not on the
  // very first install, otherwise every first visit would reload itself.
  const hadExistingController = !!navigator.serviceWorker.controller;
  function reloadOnce() {
    if (reloading || !hadExistingController) return;
    reloading = true;
    location.reload();
  }

  navigator.serviceWorker.register(swPath, { scope: '/' }).then((reg) => {
    // If a waiting worker is already there, activate it now
    if (reg.waiting) reg.waiting.postMessage({ type: 'SKIP_WAITING' });

    reg.addEventListener('updatefound', () => {
      const incoming = reg.installing;
      if (!incoming) return;
      incoming.addEventListener('statechange', () => {
        if (incoming.state === 'installed' && navigator.serviceWorker.controller) {
          // A newer SW has been installed alongside the active one — adopt it
          incoming.postMessage({ type: 'SKIP_WAITING' });
        }
      });
    });

    // Check for updates whenever the tab becomes visible again
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') reg.update().catch(() => {});
    });
  }).catch(() => {});

  // When the active SW is replaced (skipWaiting → activate), reload to use it
  navigator.serviceWorker.addEventListener('controllerchange', reloadOnce);
  navigator.serviceWorker.addEventListener('message', (e) => {
    if (e.data?.type === 'SW_UPDATED') reloadOnce();
  });
})();
