// Service worker registration disabled.
// This keeps Program Tool pages loading directly from Firebase Hosting.
(function () {
  if (!('serviceWorker' in navigator)) return;
  navigator.serviceWorker.getRegistrations()
    .then((regs) => Promise.all(regs.map((reg) => reg.unregister())))
    .catch(() => {});
})();
