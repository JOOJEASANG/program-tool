/* product-transition-v1.js — deterministic product switching for the print checker */
(function () {
  'use strict';
  if (window.__printCheckerProductTransitionV1) return;
  window.__printCheckerProductTransitionV1 = true;

  const LABELS = Object.freeze({
    cover: '표지',
    leaflet: '리플렛',
    flyer: '전단지/포스터',
    invitation: '초대장/안내장',
    booklet: '소책자',
  });
  const byId = (id) => document.getElementById(id);
  let serial = 0;
  let settleTimer = 0;
  let pendingProduct = '';

  function checker() {
    try {
      if (typeof PrintChecker !== 'undefined') return PrintChecker;
    } catch (_) {}
    return window.PrintChecker || null;
  }

  function currentProduct() {
    try { return checker()?.getState?.()?.product || ''; } catch (_) { return ''; }
  }

  function installStyles() {
    if (byId('printCheckerProductTransitionStyles')) return;
    const style = document.createElement('style');
    style.id = 'printCheckerProductTransitionStyles';
    style.textContent = `
      #printCheckerTransitionStatus{display:none;align-items:center;justify-content:center;gap:8px;margin:0 0 10px;padding:9px 12px;border:1px solid #dbe5ef;border-radius:10px;background:rgba(248,250,252,.96);color:#475569;font-size:11px;font-weight:800;line-height:1.35}
      #printCheckerTransitionStatus::before{content:'';width:12px;height:12px;border:2px solid #cbd5e1;border-top-color:#0f4c81;border-radius:50%;animation:pc-product-spin .55s linear infinite}
      html[data-print-checker-product-transition="loading"] #printCheckerTransitionStatus{display:flex}
      html[data-print-checker-product-transition="loading"] #specSection,
      html[data-print-checker-product-transition="loading"] .canvas-wrap,
      html[data-print-checker-product-transition="loading"] #leafletGuide,
      html[data-print-checker-product-transition="loading"] #impositionGuide,
      html[data-print-checker-product-transition="loading"] #contentPreflightSection,
      html[data-print-checker-product-transition="loading"] #reportSection{opacity:0;pointer-events:none}
      #specSection,.canvas-wrap,#leafletGuide,#impositionGuide,#contentPreflightSection,#reportSection{transition:opacity .12s ease}
      @keyframes pc-product-spin{to{transform:rotate(360deg)}}
      @media(prefers-reduced-motion:reduce){#printCheckerTransitionStatus::before{animation:none}#specSection,.canvas-wrap,#leafletGuide,#impositionGuide,#contentPreflightSection,#reportSection{transition:none}}
    `;
    document.head.appendChild(style);
  }

  function ensureStatus() {
    let status = byId('printCheckerTransitionStatus');
    if (status) return status;
    const main = byId('printCheckerMain');
    if (!main) return null;
    status = document.createElement('div');
    status.id = 'printCheckerTransitionStatus';
    status.setAttribute('role', 'status');
    status.setAttribute('aria-live', 'polite');
    const toolbar = byId('previewZoomToolbar');
    if (toolbar?.parentElement === main) toolbar.insertAdjacentElement('afterend', status);
    else main.prepend(status);
    return status;
  }

  function begin(product) {
    const token = ++serial;
    pendingProduct = product || '';
    document.documentElement.dataset.printCheckerProductTransition = 'loading';
    document.documentElement.dataset.printCheckerPendingProduct = pendingProduct;
    const main = byId('printCheckerMain');
    main?.setAttribute('aria-busy', 'true');
    const status = ensureStatus();
    if (status) status.textContent = `${LABELS[pendingProduct] || '선택한 인쇄물'} 화면 준비 중`;

    // Never show a previous product's secondary result while the new form is being built.
    ['leafletGuide', 'impositionGuide', 'reportSection', 'contentPreflightSection'].forEach((id) => {
      const node = byId(id);
      if (node) node.hidden = true;
    });
    return token;
  }

  function seedDefaults(product) {
    const defaults = window.PrintCheckerDefaultsLive;
    try {
      if (defaults?.seedProduct) defaults.seedProduct(product, { force: true });
    } catch (error) {
      console.warn('[print-checker] product default sync failed', error);
    }
  }

  function syncBookletMode(product) {
    try { window.PrintCheckerBookletLayoutOnly?.apply?.(); } catch (_) {}

    const stack = byId('previewCanvas')?.closest?.('.preview-canvas-stack');
    const productionLayer = byId('productionGuideLayer');
    const fileLayer = byId('previewFileLayer');
    const guideLayer = byId('previewGuideLayer');

    if (product === 'booklet') {
      // Booklet has its own imposition canvas/board; production trim overlays must not cover it.
      stack?.classList.remove('production-guide-stack');
      stack?.style.removeProperty('--pc-work-ratio');
      if (productionLayer) productionLayer.style.display = 'none';
      if (fileLayer) fileLayer.style.display = 'none';
      if (guideLayer) guideLayer.style.display = 'none';
      const canvas = byId('previewCanvas');
      if (canvas) canvas.style.opacity = '';
    } else {
      if (productionLayer) productionLayer.style.display = '';
      if (fileLayer) fileLayer.style.display = '';
      if (guideLayer) guideLayer.style.display = '';
      try { window.PrintCheckerProductionGuides?.render?.(); } catch (_) {}
    }
  }

  function enforceProductVisibility(product) {
    const leaflet = byId('leafletGuide');
    const booklet = byId('impositionGuide');
    if (product !== 'leaflet' && leaflet) leaflet.hidden = true;
    if (product !== 'booklet' && booklet) booklet.hidden = true;

    if (product === 'booklet') {
      const summary = byId('printCheckerLiveSummary');
      summary?.classList.add('pc-booklet-only-hidden');
    }
  }

  function renderPass(product, token) {
    if (token !== serial || currentProduct() !== product) return false;
    syncBookletMode(product);
    try { window.PrintCheckerPageLayout?.render?.(); } catch (_) {}
    try { window.PrintCheckerDefaultsLive?.updateSummary?.(); } catch (_) {}
    try { window.PrintCheckerFileLayer?.requestGuideRefresh?.(); } catch (_) {}
    enforceProductVisibility(product);
    document.documentElement.dataset.printCheckerActiveProduct = product;
    return true;
  }

  function finish(product, token) {
    if (!renderPass(product, token)) return;
    document.documentElement.dataset.printCheckerProductTransition = 'ready';
    document.documentElement.dataset.printCheckerPendingProduct = '';
    const main = byId('printCheckerMain');
    main?.removeAttribute('aria-busy');
    const status = ensureStatus();
    if (status) status.textContent = '';
    window.dispatchEvent(new CustomEvent('programstudio:print-checker-product-stable', {
      detail: { product, token },
    }));
  }

  function stabilize(product, options = {}) {
    const target = product || currentProduct();
    if (!target) return false;
    const token = options.token || begin(target);
    if (token !== serial) return false;

    if (options.seed !== false) seedDefaults(target);
    renderPass(target, token);

    requestAnimationFrame(() => {
      if (!renderPass(target, token)) return;
      requestAnimationFrame(() => renderPass(target, token));
    });

    window.clearTimeout(settleTimer);
    settleTimer = window.setTimeout(() => finish(target, token), 96);
    return true;
  }

  function bindProductClicks() {
    // Capture phase blanks stale UI before the core button handler creates the new form.
    document.addEventListener('click', (event) => {
      const card = event.target.closest?.('.product-card');
      if (!card) return;
      const product = String(card.dataset.product || '');
      if (!product) return;
      card.dataset.transitionToken = String(begin(product));
    }, true);

    // Bubble phase runs after the core selectProduct handler, so all selected-product DOM exists.
    document.addEventListener('click', (event) => {
      const card = event.target.closest?.('.product-card');
      if (!card) return;
      const product = String(card.dataset.product || '');
      const token = Number(card.dataset.transitionToken || 0);
      stabilize(product, { token: token || undefined, seed: true });
    });
  }

  function boot() {
    installStyles();
    ensureStatus();
    bindProductClicks();
    const product = currentProduct();
    if (product) stabilize(product, { seed: true });
    document.documentElement.dataset.printCheckerProductTransitionController = 'v1-latest-selection-wins';
  }

  window.PrintCheckerProductTransition = Object.freeze({
    begin,
    stabilize,
    currentProduct,
    stage: 'v1-latest-selection-wins',
  });

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once: true });
  else boot();
})();