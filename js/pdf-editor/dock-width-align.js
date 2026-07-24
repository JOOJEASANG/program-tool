// Keep the floating PDF action dock aligned with the sidebar content area.
(function () {
  'use strict';
  if (window.__pdfEditorDockWidthAlignV1) return;
  window.__pdfEditorDockWidthAlignV1 = true;

  let resizeObserver = null;
  let mutationObserver = null;
  let frame = 0;

  function syncDockWidth() {
    cancelAnimationFrame(frame);
    frame = requestAnimationFrame(() => {
      const aside = document.querySelector('.app > aside') || document.querySelector('aside');
      const dock = document.querySelector('.pdf-output-dock.pdf-output-floating');
      if (!aside || !dock) return;

      const rect = aside.getBoundingClientRect();
      const style = getComputedStyle(aside);
      const paddingLeft = parseFloat(style.paddingLeft) || 0;
      const paddingRight = parseFloat(style.paddingRight) || 0;
      // clientWidth excludes the vertical scrollbar, so the dock follows the
      // exact visible width of the sidebar controls on every browser.
      const contentWidth = Math.max(0, aside.clientWidth - paddingLeft - paddingRight);
      const contentLeft = rect.left + paddingLeft;
      if (!contentWidth) return;

      dock.style.setProperty('left', `${Math.round(contentLeft)}px`, 'important');
      dock.style.setProperty('right', 'auto', 'important');
      dock.style.setProperty('width', `${Math.round(contentWidth)}px`, 'important');
      dock.dataset.widthAligned = '1';
    });
  }

  function install() {
    const aside = document.querySelector('.app > aside') || document.querySelector('aside');
    if (!aside) return;
    syncDockWidth();

    if (!resizeObserver && typeof ResizeObserver === 'function') {
      resizeObserver = new ResizeObserver(syncDockWidth);
      resizeObserver.observe(aside);
    }

    if (!mutationObserver) {
      mutationObserver = new MutationObserver(syncDockWidth);
      // Child changes can make the sidebar scrollbar appear or disappear.
      // Do not observe style attributes because this module changes dock styles itself.
      mutationObserver.observe(aside, { childList: true, subtree: true });
    }

    if (!window.__pdfEditorDockResizeHookV1) {
      window.__pdfEditorDockResizeHookV1 = true;
      window.addEventListener('resize', syncDockWidth, { passive: true });
    }
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', install, { once: true });
  else install();
  setTimeout(install, 350);
  setTimeout(install, 1200);
})();
