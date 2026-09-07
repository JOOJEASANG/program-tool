/* spine-live-dimension.js — 표지 미리보기 책등 실시간 치수 표시 */
(function () {
  'use strict';

  if (window.__printCheckerSpineLiveDimensionV1) return;
  window.__printCheckerSpineLiveDimensionV1 = true;

  const OVERLAY_ID = 'spineLiveDimension';
  const STYLE_ID = 'spineLiveDimensionStyle';
  const byId = (id) => document.getElementById(id);
  let resizeObserver = null;
  let raf = 0;

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
      .canvas-wrap{position:relative}
      #${OVERLAY_ID}{position:absolute;top:34px;height:18px;z-index:7;pointer-events:none;display:none;border-top:2px solid #dc2626;transform:translateZ(0)}
      #${OVERLAY_ID}::before,#${OVERLAY_ID}::after{content:'';position:absolute;top:-6px;width:2px;height:12px;background:#dc2626}
      #${OVERLAY_ID}::before{left:0}#${OVERLAY_ID}::after{right:0}
      #${OVERLAY_ID} .spine-live-label{position:absolute;left:50%;bottom:8px;transform:translateX(-50%);white-space:nowrap;padding:4px 7px;border:1px solid rgba(220,38,38,.28);border-radius:999px;background:rgba(255,255,255,.95);box-shadow:0 2px 7px rgba(15,23,42,.12);color:#b91c1c;font:900 11px Pretendard,'Noto Sans KR',sans-serif;letter-spacing:-.1px}
      #${OVERLAY_ID}[data-narrow='1'] .spine-live-label{bottom:9px}
    `;
    document.head.appendChild(style);
  }

  function ensureOverlay() {
    installStyle();
    const canvas = byId('previewCanvas');
    const wrap = canvas?.closest('.canvas-wrap') || canvas?.parentElement;
    if (!canvas || !wrap) return null;
    let overlay = byId(OVERLAY_ID);
    if (!overlay) {
      overlay = document.createElement('div');
      overlay.id = OVERLAY_ID;
      overlay.setAttribute('aria-hidden', 'true');
      overlay.innerHTML = '<span class="spine-live-label"></span>';
      wrap.appendChild(overlay);
    }
    return overlay;
  }

  function currentPdfWidthMm(state) {
    if (state?.fileKind !== 'pdf' || !state.pdfPages) return 0;
    const page = state.fileSide === 'back' && state.pdfPages['2'] ? state.pdfPages['2'] : state.pdfPages['1'];
    return Number(page?.widthMm) || 0;
  }

  function hide() {
    const overlay = byId(OVERLAY_ID);
    if (overlay) overlay.style.display = 'none';
  }

  function syncNow() {
    const api = checker();
    const state = api?.getState?.();
    const canvas = byId('previewCanvas');
    if (!state || !canvas || state.product !== 'cover') {
      hide();
      return;
    }

    const spineMm = Number(state.specs?.spine) || 0;
    const trimW = Number(state.specs?.trimW) || 0;
    if (spineMm <= 0 || trimW <= 0 || !canvas.width) {
      hide();
      return;
    }

    const layout = api?.__test?.getLayout?.();
    if (!layout?.fileW) {
      hide();
      return;
    }

    const overlay = ensureOverlay();
    if (!overlay) return;

    const rect = canvas.getBoundingClientRect();
    if (!rect.width) {
      hide();
      return;
    }

    const guideWidthMm = currentPdfWidthMm(state) || Number(layout.fileW) || 0;
    if (!guideWidthMm) {
      hide();
      return;
    }

    const mmToCanvas = canvas.width / guideWidthMm;
    const bleedMm = byId('fileHasBleed')?.checked ? Number(layout.bleedMm || 0) : 0;
    const trimLeft = bleedMm * mmToCanvas;
    const spineLeft = trimLeft + Number(layout.wingMm || 0) * mmToCanvas + trimW * mmToCanvas;
    const spineWidth = spineMm * mmToCanvas;
    const cssScale = rect.width / canvas.width;
    const cssLeft = spineLeft * cssScale;
    const cssWidth = Math.max(1, spineWidth * cssScale);

    overlay.style.left = `${cssLeft}px`;
    overlay.style.width = `${cssWidth}px`;
    overlay.style.display = 'block';
    overlay.dataset.narrow = cssWidth < 18 ? '1' : '0';
    const label = overlay.querySelector('.spine-live-label');
    if (label) label.textContent = `책등 ${spineMm.toFixed(1)} mm`;
  }

  function scheduleSync() {
    cancelAnimationFrame(raf);
    raf = requestAnimationFrame(() => requestAnimationFrame(syncNow));
  }

  function bind() {
    ensureOverlay();
    document.addEventListener('input', (event) => {
      if (event.target?.closest?.('#specForm') || event.target?.id === 'fileHasBleed') scheduleSync();
    });
    document.addEventListener('change', (event) => {
      if (event.target?.closest?.('#specForm') || event.target?.id === 'fileHasBleed' || event.target?.id === 'fileInput') scheduleSync();
    });
    document.addEventListener('click', (event) => {
      if (event.target?.closest?.('.product-card,.side-btn,#resetBtn,#resetAdjBtn')) scheduleSync();
    });
    window.addEventListener('resize', scheduleSync, { passive: true });

    if (typeof ResizeObserver === 'function') {
      const canvas = byId('previewCanvas');
      const wrap = canvas?.closest('.canvas-wrap') || canvas?.parentElement;
      if (wrap) {
        resizeObserver = new ResizeObserver(scheduleSync);
        resizeObserver.observe(wrap);
        resizeObserver.observe(canvas);
      }
    }

    const form = byId('specForm');
    if (form && typeof MutationObserver === 'function') {
      new MutationObserver(scheduleSync).observe(form, { childList: true, subtree: true });
    }

    scheduleSync();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', bind, { once: true });
  else bind();
})();
