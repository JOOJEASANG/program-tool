/* live-summary-cleanup.js — keep legacy defaults-live summary out of the preview canvas */
(function () {
  'use strict';
  if (window.__printCheckerLiveSummaryCleanupV1) return;
  window.__printCheckerLiveSummaryCleanupV1 = true;

  const SUMMARY_ID = 'printCheckerLiveSummary';
  const STYLE_ID = 'printCheckerLiveSummaryCleanupStyle';

  function installStyle() {
    if (document.getElementById(STYLE_ID)) return;
    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = `#${SUMMARY_ID}{display:none!important}`;
    document.head.appendChild(style);
  }

  function ensureHiddenSink() {
    if (!document.body) return null;
    let summary = document.getElementById(SUMMARY_ID);
    if (!summary) {
      summary = document.createElement('div');
      summary.id = SUMMARY_ID;
      document.body.appendChild(summary);
    } else if (summary.parentElement !== document.body) {
      document.body.appendChild(summary);
    }
    summary.hidden = true;
    summary.setAttribute('aria-hidden', 'true');
    summary.dataset.legacySummaryDisabled = '1';
    return summary;
  }

  function install() {
    installStyle();
    ensureHiddenSink();
    document.documentElement.dataset.printCheckerLiveSummary = 'disabled';

    if (typeof MutationObserver === 'function') {
      new MutationObserver(() => {
        const summary = document.getElementById(SUMMARY_ID);
        if (!summary || summary.parentElement !== document.body || !summary.hidden) ensureHiddenSink();
      }).observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['hidden'] });
    }
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', install, { once: true });
  else install();
})();