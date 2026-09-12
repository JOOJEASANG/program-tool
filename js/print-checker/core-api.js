/* core-api.js — expose the existing print-checker core through one stable global API. */
(function () {
  'use strict';
  if (window.__printCheckerCoreApiV1) return;
  window.__printCheckerCoreApiV1 = true;

  function expose() {
    try {
      if (typeof PrintChecker !== 'undefined' && PrintChecker?.getState) {
        window.PrintChecker = PrintChecker;
        document.documentElement.dataset.printCheckerCoreApi = 'v1';
        return true;
      }
    } catch (_) {}
    return false;
  }

  window.PrintCheckerCoreApi = Object.freeze({ expose, stage: 'v1' });
  if (!expose()) {
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', expose, { once: true });
    else queueMicrotask(expose);
  }
})();
