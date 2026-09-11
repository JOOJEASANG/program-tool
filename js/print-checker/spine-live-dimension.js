/* spine-live-dimension.js — 제품 공통 실시간 작업 치수 + 표지 책등 별도 표시 */
(function () {
  'use strict';

  if (window.__printCheckerSpineLiveDimensionV5) return;
  window.__printCheckerSpineLiveDimensionV5 = true;

  const BAR_ID = 'coverLiveDimensions';
  const STYLE_ID = 'spineLiveDimensionStyle';
  const PRODUCT_LABELS = Object.freeze({
    cover: '표지',
    leaflet: '리플렛',
    flyer: '전단지/포스터',
    invitation: '초대장/안내장',
    booklet: '소책자',
  });
  const byId = (id) => document.getElementById(id);
  let raf = 0;
  let resizeObserver = null;
  let rootObserver = null;
  let settleTimer = 0;

  function checker() {
    try {
      if (typeof PrintChecker !== 'undefined') return PrintChecker;
    } catch (_) {}
    return window.PrintChecker || null;
  }

  function installStyle() {
    if (byId(STYLE_ID)) return;
    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = `
      #${BAR_ID}{display:none;align-items:center;justify-content:flex-start;gap:5px;flex:1 1 auto;min-width:0;margin:0;line-height:1.2}
      #${BAR_ID} .cover-live-dimension-chip{display:inline-flex;align-items:center;gap:5px;min-height:28px;padding:5px 8px;border:1px solid #cbd5e1;border-radius:8px;background:#fff;box-shadow:0 1px 5px rgba(15,23,42,.04);color:#334155;font:800 10px Pretendard,'Noto Sans KR',sans-serif;white-space:nowrap}
      #${BAR_ID} .cover-live-dimension-product{color:#0f5f91;font-weight:950}
      #${BAR_ID} .cover-live-dimension-label{color:#64748b;font-weight:800}
      #${BAR_ID} .cover-live-dimension-value{color:#0f172a;font-variant-numeric:tabular-nums;font-weight:950}
      #${BAR_ID} .cover-spine-dimension{border-color:#ddd6fe;background:#faf5ff}
      #${BAR_ID} .cover-spine-dimension .cover-live-dimension-label,#${BAR_ID} .cover-spine-dimension .cover-live-dimension-value{color:#6d28d9}
      @media(max-width:900px){#${BAR_ID}{flex-basis:100%;width:100%;flex-wrap:wrap}#${BAR_ID} .cover-live-dimension-chip{font-size:9px;padding:4px 7px}}
    `;
    document.head.appendChild(style);
  }

  function ensureBar() {
    installStyle();
    const toolbar = byId('previewZoomToolbar');
    if (!toolbar) return null;
    let bar = byId(BAR_ID);
    if (!bar) {
      bar = document.createElement('div');
      bar.id = BAR_ID;
      bar.setAttribute('aria-live', 'polite');
      bar.setAttribute('aria-label', '제품 실시간 치수');
      bar.innerHTML = `
        <span class="cover-live-dimension-chip cover-trim-dimension">
          <span class="cover-live-dimension-product" data-live-product>제품</span>
          <span class="cover-live-dimension-label" data-live-trim-label>재단</span>
          <strong class="cover-live-dimension-value" data-live-trim-dimension>—</strong>
        </span>
        <span class="cover-live-dimension-chip cover-work-dimension" data-live-work-chip>
          <span class="cover-live-dimension-label">작업 전체</span>
          <strong class="cover-live-dimension-value" data-live-work-dimension>—</strong>
        </span>
        <span class="cover-live-dimension-chip cover-spine-dimension" data-live-spine-chip hidden>
          <span class="cover-live-dimension-label">책등</span>
          <strong class="cover-live-dimension-value" data-live-spine-dimension>—</strong>
        </span>`;
    }
    if (bar.parentElement !== toolbar) toolbar.prepend(bar);
    return bar;
  }

  function mmValue(id, fallback = 0) {
    const value = Number(byId(id)?.value);
    return Number.isFinite(value) ? value : fallback;
  }

  function fmtPair(width, height) {
    return `${Number(width || 0).toFixed(1)} × ${Number(height || 0).toFixed(1)} mm`;
  }

  function fmt(value) {
    return `${Number(value || 0).toFixed(1)} mm`;
  }

  function hide() {
    const bar = byId(BAR_ID);
    if (bar) bar.style.display = 'none';
  }

  function stableProduct(state) {
    const root = document.documentElement;
    if (root.dataset.printCheckerProductTransition === 'loading') return '';
    const active = String(root.dataset.printCheckerActiveProduct || '');
    if (active && PRODUCT_LABELS[active] && active === state?.product) return active;
    return state?.product || '';
  }

  function syncNow() {
    const state = checker()?.getState?.();
    const product = stableProduct(state);
    if (!product || !PRODUCT_LABELS[product]) {
      hide();
      return;
    }

    const trimW = Math.max(0, mmValue('trimW', Number(state.specs?.trimW) || 0));
    const trimH = Math.max(0, mmValue('trimH', Number(state.specs?.trimH) || 0));
    const bleed = Math.max(0, mmValue('bleed', Number(state.specs?.bleed) || 0));
    if (!trimW || !trimH) {
      hide();
      return;
    }

    const bar = ensureBar();
    if (!bar) return;

    const productNode = bar.querySelector('[data-live-product]');
    const trimLabel = bar.querySelector('[data-live-trim-label]');
    const trimValue = bar.querySelector('[data-live-trim-dimension]');
    const workChip = bar.querySelector('[data-live-work-chip]');
    const workValue = bar.querySelector('[data-live-work-dimension]');
    const spineChip = bar.querySelector('[data-live-spine-chip]');
    const spineValue = bar.querySelector('[data-live-spine-dimension]');

    if (productNode) productNode.textContent = PRODUCT_LABELS[product];
    if (trimLabel) trimLabel.textContent = product === 'cover' ? '완성면' : product === 'booklet' ? '완성판' : '재단';
    if (trimValue) trimValue.textContent = fmtPair(trimW, trimH);

    if (product === 'booklet') {
      if (workChip) workChip.hidden = true;
      if (spineChip) spineChip.hidden = true;
      bar.style.display = 'flex';
      return;
    }

    let workW = trimW + bleed * 2;
    const workH = trimH + bleed * 2;
    if (product === 'cover') {
      const spine = Math.max(0, mmValue('spine', Number(state.specs?.spine) || 0));
      const hasWing = Boolean(byId('hasWing')?.checked ?? state.specs?.hasWing);
      const wing = hasWing ? Math.max(0, mmValue('wingW', Number(state.specs?.wingW) || 0)) : 0;
      workW = trimW * 2 + spine + wing * 2 + bleed * 2;
      if (spineChip) spineChip.hidden = false;
      if (spineValue) spineValue.textContent = fmt(spine);
    } else if (spineChip) {
      spineChip.hidden = true;
    }

    if (workChip) workChip.hidden = false;
    if (workValue) workValue.textContent = fmtPair(workW, workH);
    bar.dataset.liveProduct = product;
    bar.style.display = 'flex';
  }

  function scheduleSync() {
    cancelAnimationFrame(raf);
    raf = requestAnimationFrame(() => requestAnimationFrame(syncNow));
  }

  function scheduleSettledSync() {
    scheduleSync();
    window.clearTimeout(settleTimer);
    settleTimer = window.setTimeout(scheduleSync, 130);
  }

  function bind() {
    ensureBar();
    document.addEventListener('input', (event) => {
      if (event.target?.closest?.('#specForm')) scheduleSync();
    }, true);
    document.addEventListener('change', (event) => {
      if (event.target?.closest?.('#specForm') || event.target?.id === 'fileInput') scheduleSync();
    }, true);
    document.addEventListener('click', (event) => {
      if (event.target?.closest?.('.product-card,#resetBtn')) scheduleSettledSync();
    }, true);
    window.addEventListener('programstudio:print-checker-product-stable', scheduleSettledSync);
    window.addEventListener('programstudio:print-checker-file-rendered', scheduleSync);
    window.addEventListener('resize', scheduleSync, { passive: true });

    const toolbar = byId('previewZoomToolbar');
    if (toolbar && typeof ResizeObserver === 'function') {
      resizeObserver = new ResizeObserver(scheduleSync);
      resizeObserver.observe(toolbar);
    }

    const form = byId('specForm');
    if (form && typeof MutationObserver === 'function') {
      new MutationObserver(scheduleSync).observe(form, { childList: true, subtree: true });
    }

    if (typeof MutationObserver === 'function') {
      rootObserver = new MutationObserver((records) => {
        if (records.some((record) => record.attributeName === 'data-print-checker-active-product'
          || record.attributeName === 'data-print-checker-product-transition')) {
          scheduleSettledSync();
        }
      });
      rootObserver.observe(document.documentElement, {
        attributes: true,
        attributeFilter: ['data-print-checker-active-product', 'data-print-checker-product-transition'],
      });
    }

    scheduleSettledSync();
  }

  const api = Object.freeze({
    sync: scheduleSettledSync,
    stage: 'v5-stable-product-toolbar-left',
  });
  window.PrintCheckerCoverLiveDimensions = api;
  window.PrintCheckerLiveDimensions = api;

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', bind, { once: true });
  else bind();
})();
