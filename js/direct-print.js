// Retired direct-printer action. Kept as a compatibility cleanup entry point
// for previously cached HTML that may still load this file during deployment.
// PDF generation and download buttons are deliberately unaffected.
(() => {
  'use strict';
  if (window.__programStudioDirectPrintRetiredV1) return;
  window.__programStudioDirectPrintRetiredV1 = true;

  const removeLegacyPrintButtons = () => {
    document.querySelectorAll('.program-direct-print-btn').forEach(button => button.remove());
  };
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', removeLegacyPrintButtons, { once: true });
  } else {
    removeLegacyPrintButtons();
  }
})();
