/* preview-zoom.js — fit-to-screen preview zoom without changing print dimensions */
(function () {
  'use strict';
  if (window.__printCheckerPreviewZoomV3) return;
  window.__printCheckerPreviewZoomV3 = true;

  const MIN_ZOOM = 25;
  const MAX_ZOOM = 200;
  const STEP = 25;
  const FIT_MAX_ZOOM = 100;
  const byId = (id) => document.getElementById(id);
  let zoom = 100;
  let mode = 'fit';
  let fitTimer = 0;

  function clamp(value) {
    return Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, Number(value) || 100));
  }

  function stack() {
    return byId('previewCanvas')?.closest('.preview-canvas-stack') || null;
  }

  function currentProduct() {
    try {
      if (typeof PrintChecker !== 'undefined') return PrintChecker?.getState?.()?.product || '';
    } catch (_) {}
    return window.PrintChecker?.getState?.()?.product || document.querySelector('.product-card.selected')?.dataset?.product || '';
  }

  function syncUi() {
    const label = byId('previewZoomLabel');
    const out = byId('previewZoomOut');
    const inc = byId('previewZoomIn');
    const fit = byId('previewZoomReset');
    if (label) label.textContent = `${Math.round(zoom)}%`;
    if (out) out.disabled = zoom <= MIN_ZOOM;
    if (inc) inc.disabled = zoom >= MAX_ZOOM;
    if (fit) fit.setAttribute('aria-pressed', mode === 'fit' ? 'true' : 'false');
  }

  function setZoom(value, options = {}) {
    zoom = clamp(value);
    mode = options.mode || 'manual';
    const target = stack();
    if (target) target.style.setProperty('--pc-preview-zoom', `${zoom}%`);
    syncUi();
    window.dispatchEvent(new CustomEvent('programstudio:print-checker-zoom-changed', {
      detail: { zoom, mode },
    }));
    return zoom;
  }

  function applyZoom(value) {
    return setZoom(value, { mode: 'manual' });
  }

  function stepZoom(direction) {
    return applyZoom(zoom + STEP * direction);
  }

  function contentWidth(element) {
    if (!element) return 0;
    const style = getComputedStyle(element);
    const left = parseFloat(style.paddingLeft) || 0;
    const right = parseFloat(style.paddingRight) || 0;
    return Math.max(0, element.clientWidth - left - right);
  }

  function previewRatio(target) {
    const rect = target?.getBoundingClientRect?.();
    if (rect?.width > 0 && rect?.height > 0) return rect.height / rect.width;
    const guide = byId('productionGuideLayer');
    if (guide?.width > 0 && guide?.height > 0) return guide.height / guide.width;
    const canvas = byId('previewCanvas');
    if (canvas?.width > 0 && canvas?.height > 0) return canvas.height / canvas.width;
    return 1;
  }

  function fitAvailableHeight(wrap) {
    if (!wrap) return 0;
    const rect = wrap.getBoundingClientRect();
    const viewportBottom = Math.max(0, window.innerHeight || document.documentElement.clientHeight || 0);
    const style = getComputedStyle(wrap);
    const topPad = parseFloat(style.paddingTop) || 0;
    const bottomPad = parseFloat(style.paddingBottom) || 0;
    // 실시간 치수는 캔버스 밖 상단 툴바에 있으므로 wrap 높이에서 다시 차감하지 않는다.
    return Math.max(180, viewportBottom - rect.top - topPad - bottomPad - 8);
  }

  function fitToScreen() {
    if (currentProduct() === 'booklet') return zoom;
    const target = stack();
    const wrap = target?.closest('.canvas-wrap');
    if (!target || !wrap) return zoom;

    const widthAt100 = contentWidth(wrap);
    const ratio = previewRatio(target);
    const heightAt100 = widthAt100 * ratio;
    const availableHeight = fitAvailableHeight(wrap);
    if (!widthAt100 || !heightAt100 || !availableHeight) return setZoom(FIT_MAX_ZOOM, { mode: 'fit' });

    const fitted = Math.min(FIT_MAX_ZOOM, Math.floor((availableHeight / heightAt100) * 100));
    return setZoom(Math.max(MIN_ZOOM, fitted), { mode: 'fit' });
  }

  function scheduleFit(options = {}) {
    if (options.force !== true && mode !== 'fit') return;
    window.clearTimeout(fitTimer);
    fitTimer = window.setTimeout(() => {
      requestAnimationFrame(() => requestAnimationFrame(fitToScreen));
    }, Number(options.delay) || 0);
  }

  function bind() {
    byId('previewZoomOut')?.addEventListener('click', () => stepZoom(-1));
    byId('previewZoomIn')?.addEventListener('click', () => stepZoom(1));
    byId('previewZoomReset')?.addEventListener('click', fitToScreen);
    byId('resetBtn')?.addEventListener('click', () => scheduleFit({ force: true }));

    const viewport = document.querySelector('.canvas-wrap');
    viewport?.addEventListener('wheel', (event) => {
      if (!event.ctrlKey && !event.metaKey) return;
      event.preventDefault();
      stepZoom(event.deltaY > 0 ? -1 : 1);
    }, { passive: false });

    document.addEventListener('input', (event) => {
      if (event.target?.closest?.('#specForm')) scheduleFit();
    }, true);
    document.addEventListener('change', (event) => {
      if (event.target?.closest?.('#specForm')) scheduleFit();
    }, true);
    window.addEventListener('programstudio:print-checker-product-stable', () => scheduleFit({ force: true }));
    window.addEventListener('programstudio:print-checker-file-rendered', () => scheduleFit());
    window.addEventListener('resize', () => scheduleFit(), { passive: true });

    mode = 'fit';
    scheduleFit({ force: true, delay: 40 });
    document.documentElement.dataset.printCheckerPreviewZoom = 'v3-fit-compact-top';
  }

  window.PrintCheckerPreviewZoom = Object.freeze({
    applyZoom,
    stepZoom,
    fitToScreen,
    getZoom: () => zoom,
    getMode: () => mode,
    min: MIN_ZOOM,
    max: MAX_ZOOM,
    step: STEP,
    stage: 'v3-fit-compact-top',
  });

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', bind, { once: true });
  else bind();
})();