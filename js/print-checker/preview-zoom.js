/* preview-zoom.js — canvas preview zoom without changing print dimensions */
(function () {
  'use strict';
  if (window.__printCheckerPreviewZoomV1) return;
  window.__printCheckerPreviewZoomV1 = true;

  const MIN_ZOOM = 50;
  const MAX_ZOOM = 200;
  const STEP = 25;
  const byId = (id) => document.getElementById(id);
  let zoom = 100;

  function clamp(value) {
    return Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, Number(value) || 100));
  }

  function stack() {
    return byId('previewCanvas')?.closest('.preview-canvas-stack') || null;
  }

  function syncUi() {
    const label = byId('previewZoomLabel');
    const out = byId('previewZoomOut');
    const inc = byId('previewZoomIn');
    if (label) label.textContent = `${zoom}%`;
    if (out) out.disabled = zoom <= MIN_ZOOM;
    if (inc) inc.disabled = zoom >= MAX_ZOOM;
  }

  function applyZoom(value) {
    zoom = clamp(value);
    const target = stack();
    if (target) target.style.setProperty('--pc-preview-zoom', `${zoom}%`);
    syncUi();
    window.dispatchEvent(new CustomEvent('programstudio:print-checker-zoom-changed', { detail: { zoom } }));
    return zoom;
  }

  function stepZoom(direction) {
    return applyZoom(zoom + STEP * direction);
  }

  function bind() {
    byId('previewZoomOut')?.addEventListener('click', () => stepZoom(-1));
    byId('previewZoomIn')?.addEventListener('click', () => stepZoom(1));
    byId('previewZoomReset')?.addEventListener('click', () => applyZoom(100));

    const viewport = document.querySelector('.canvas-wrap');
    viewport?.addEventListener('wheel', (event) => {
      if (!event.ctrlKey && !event.metaKey) return;
      event.preventDefault();
      stepZoom(event.deltaY > 0 ? -1 : 1);
    }, { passive: false });

    applyZoom(100);
    document.documentElement.dataset.printCheckerPreviewZoom = 'v1';
  }

  window.PrintCheckerPreviewZoom = Object.freeze({
    applyZoom,
    stepZoom,
    getZoom: () => zoom,
    min: MIN_ZOOM,
    max: MAX_ZOOM,
    step: STEP,
    stage: 'v1',
  });

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', bind, { once: true });
  else bind();
})();
