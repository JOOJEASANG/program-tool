/* spine-live-dimension.js — 표지 실시간 작업 치수 + 책등 별도 표시 */
(function () {
  'use strict';

  if (window.__printCheckerSpineLiveDimensionV3) return;
  window.__printCheckerSpineLiveDimensionV3 = true;

  const BAR_ID = 'coverLiveDimensions';
  const STYLE_ID = 'spineLiveDimensionStyle';
  const byId = (id) => document.getElementById(id);
  let raf = 0;
  let resizeObserver = null;

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
      #${BAR_ID}{display:none;align-items:center;justify-content:flex-start;gap:6px;flex:1 1 auto;min-width:0;margin:0;line-height:1.2}
      #${BAR_ID} .cover-live-dimension-chip{display:inline-flex;align-items:center;gap:5px;min-height:28px;padding:5px 9px;border:1px solid #cbd5e1;border-radius:8px;background:#fff;box-shadow:0 1px 5px rgba(15,23,42,.04);color:#334155;font:800 10px Pretendard,'Noto Sans KR',sans-serif;white-space:nowrap}
      #${BAR_ID} .cover-live-dimension-label{color:#64748b;font-weight:800}
      #${BAR_ID} .cover-live-dimension-value{color:#0f172a;font-variant-numeric:tabular-nums;font-weight:900}
      #${BAR_ID} .cover-spine-dimension{border-color:#ddd6fe;background:#faf5ff}
      #${BAR_ID} .cover-spine-dimension .cover-live-dimension-label,#${BAR_ID} .cover-spine-dimension .cover-live-dimension-value{color:#6d28d9}
      @media(max-width:760px){#${BAR_ID}{order:-1;flex-basis:100%;width:100%;flex-wrap:wrap}#${BAR_ID} .cover-live-dimension-chip{font-size:9px}}
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
      bar.setAttribute('aria-label', '표지 실시간 치수');
      bar.innerHTML = `
        <span class="cover-live-dimension-chip cover-work-dimension">
          <span class="cover-live-dimension-label">실시간 치수</span>
          <strong class="cover-live-dimension-value" data-cover-work-dimension>—</strong>
        </span>
        <span class="cover-live-dimension-chip cover-spine-dimension">
          <span class="cover-live-dimension-label">책등</span>
          <strong class="cover-live-dimension-value" data-cover-spine-dimension>—</strong>
        </span>`;
    }
    if (bar.parentElement !== toolbar) toolbar.prepend(bar);
    return bar;
  }

  function mmValue(id, fallback = 0) {
    const value = Number(byId(id)?.value);
    return Number.isFinite(value) ? value : fallback;
  }

  function fmt(value) {
    return `${Number(value || 0).toFixed(1)} mm`;
  }

  function hide() {
    const bar = byId(BAR_ID);
    if (bar) bar.style.display = 'none';
  }

  function syncNow() {
    const state = checker()?.getState?.();
    if (!state || state.product !== 'cover') {
      hide();
      return;
    }

    const trimW = Math.max(0, mmValue('trimW', Number(state.specs?.trimW) || 0));
    const trimH = Math.max(0, mmValue('trimH', Number(state.specs?.trimH) || 0));
    const spine = Math.max(0, mmValue('spine', Number(state.specs?.spine) || 0));
    const bleed = Math.max(0, mmValue('bleed', Number(state.specs?.bleed) || 0));
    const hasWing = Boolean(byId('hasWing')?.checked ?? state.specs?.hasWing);
    const wing = hasWing ? Math.max(0, mmValue('wingW', Number(state.specs?.wingW) || 0)) : 0;

    if (!trimW || !trimH) {
      hide();
      return;
    }

    const workW = trimW * 2 + spine + wing * 2 + bleed * 2;
    const workH = trimH + bleed * 2;
    const bar = ensureBar();
    if (!bar) return;

    const workValue = bar.querySelector('[data-cover-work-dimension]');
    const spineValue = bar.querySelector('[data-cover-spine-dimension]');
    if (workValue) workValue.textContent = `${workW.toFixed(1)} × ${workH.toFixed(1)} mm`;
    if (spineValue) spineValue.textContent = fmt(spine);
    bar.style.display = 'flex';
  }

  function scheduleSync() {
    cancelAnimationFrame(raf);
    raf = requestAnimationFrame(() => requestAnimationFrame(syncNow));
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
      if (event.target?.closest?.('.product-card,#resetBtn')) scheduleSync();
    }, true);
    window.addEventListener('programstudio:print-checker-product-stable', scheduleSync);
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

    scheduleSync();
  }

  window.PrintCheckerCoverLiveDimensions = Object.freeze({
    sync: scheduleSync,
    stage: 'v3-toolbar-left-compact',
  });

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', bind, { once: true });
  else bind();
})();