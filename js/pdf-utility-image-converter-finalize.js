// Final-screen reconciler for PDF Utility image conversion.
// The converter is intentionally loaded early by the version observer, while the
// wide PDF Utility layout is finalized later. This reconciler moves the card to
// the final visible action grid and adds print-quality DPI choices without
// duplicating the converter implementation.
(function () {
  'use strict';
  if (window.__pdfUtilityImageConverterFinalizeV1) return;
  window.__pdfUtilityImageConverterFinalizeV1 = true;

  const path = location.pathname.replace(/\/+$/, '') || '/';
  if (!(path === '/pdf-preflight' || path.endsWith('/pdf-preflight/index.html') || path.endsWith('/tools/pdf-Checker.html') || path.endsWith('/tools/preflight.html'))) return;

  const $ = (id) => document.getElementById(id);

  function moveCard() {
    const card = $('pdfUtilityImageConverterCard');
    if (!card) return false;
    const target = document.querySelector('.pdfuw-action-grid.single') || document.querySelector('.action-grid:not(.pdfuw-legacy-grid)');
    if (target && card.parentElement !== target) target.appendChild(card);
    return Boolean(target);
  }

  function addDpiOptions() {
    const select = $('pdficDpi');
    if (!select) return false;
    const values = [96, 150, 200, 300, 400, 600];
    const existing = new Set(Array.from(select.options).map((option) => Number(option.value)));
    for (const dpi of values) {
      if (existing.has(dpi)) continue;
      const option = document.createElement('option');
      option.value = String(dpi);
      option.textContent = `${dpi} DPI`;
      select.appendChild(option);
    }
    return true;
  }

  function install() {
    moveCard();
    addDpiOptions();
    document.documentElement.dataset.pdfUtilityImageConverterFinalized = '1';
  }

  let attempts = 0;
  function retry() {
    attempts += 1;
    install();
    if (attempts < 80 && !document.documentElement.dataset.pdfUtilityImageConverterFinalized) {
      setTimeout(retry, 100);
      return;
    }
    if (attempts < 80) {
      setTimeout(() => {
        moveCard();
        addDpiOptions();
      }, 500);
    }
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', retry, { once: true });
  else retry();
  const observer = new MutationObserver(() => {
    moveCard();
    addDpiOptions();
  });
  observer.observe(document.body, { childList: true, subtree: true });

  window.PdfUtilityImageConverterFinalizer = { install, moveCard, addDpiOptions, stage: 'final-screen-card-and-dpi-reconciler' };
})();
