/* leaflet-layout-popover.js — show leaflet page placement from a centered toolbar hover/focus popover */
(function () {
  'use strict';
  if (window.__printCheckerLeafletLayoutPopoverV1) return;
  window.__printCheckerLeafletLayoutPopoverV1 = true;

  const byId = (id) => document.getElementById(id);
  let scheduled = false;
  let rootObserver = null;

  function checker() {
    try {
      if (typeof PrintChecker !== 'undefined') return PrintChecker;
    } catch (_) {}
    return window.PrintChecker || null;
  }

  function currentProduct() {
    const root = document.documentElement;
    const active = String(root.dataset.printCheckerActiveProduct || '');
    if (root.dataset.printCheckerProductTransition === 'ready' && active) return active;
    try { return checker()?.getState?.()?.product || active || ''; } catch (_) { return active || ''; }
  }

  function ensureZoomGroup(toolbar) {
    let group = byId('previewZoomControls');
    if (!group) {
      group = document.createElement('div');
      group.id = 'previewZoomControls';
      group.className = 'pc-preview-zoom-controls';
    }
    ['previewZoomOut', 'previewZoomLabel', 'previewZoomIn', 'previewZoomReset'].forEach((id) => {
      const node = byId(id);
      if (node && node.parentElement !== group) group.appendChild(node);
    });
    if (group.parentElement !== toolbar) toolbar.appendChild(group);
    return group;
  }

  function closePopover() {
    const button = byId('leafletLayoutPopoverButton');
    const layer = byId('leafletLayoutPopoverLayer');
    if (layer) layer.hidden = true;
    if (button) button.setAttribute('aria-expanded', 'false');
  }

  function openPopover() {
    if (currentProduct() !== 'leaflet') return;
    const button = byId('leafletLayoutPopoverButton');
    const layer = byId('leafletLayoutPopoverLayer');
    if (!button || !layer) return;
    layer.hidden = false;
    button.setAttribute('aria-expanded', 'true');
  }

  function bindInteractions(wrap, button) {
    if (wrap.dataset.leafletPopoverBound === '1') return;
    wrap.dataset.leafletPopoverBound = '1';

    wrap.addEventListener('mouseenter', openPopover);
    wrap.addEventListener('mouseleave', () => {
      if (!wrap.contains(document.activeElement)) closePopover();
    });
    wrap.addEventListener('focusin', openPopover);
    wrap.addEventListener('focusout', (event) => {
      if (!wrap.contains(event.relatedTarget)) closePopover();
    });
    button.addEventListener('click', (event) => {
      event.preventDefault();
      const layer = byId('leafletLayoutPopoverLayer');
      if (!layer) return;
      if (layer.hidden) openPopover();
      else closePopover();
    });
    document.addEventListener('pointerdown', (event) => {
      if (!wrap.contains(event.target)) closePopover();
    }, true);
    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape') closePopover();
    });
  }

  function ensurePopover() {
    const toolbar = byId('previewZoomToolbar');
    const guide = byId('leafletGuide');
    if (!toolbar || !guide) return null;

    toolbar.classList.add('pc-leaflet-popover-toolbar');
    const zoomGroup = ensureZoomGroup(toolbar);

    let wrap = byId('leafletLayoutPopoverWrap');
    if (!wrap) {
      wrap = document.createElement('div');
      wrap.id = 'leafletLayoutPopoverWrap';
      wrap.className = 'pc-leaflet-layout-popover-wrap';
      wrap.hidden = true;
      wrap.innerHTML = `
        <button class="preview-zoom-btn pc-leaflet-layout-button" id="leafletLayoutPopoverButton" type="button" aria-haspopup="dialog" aria-expanded="false" aria-controls="leafletLayoutPopoverLayer">페이지 배치 보기</button>
        <div class="pc-leaflet-layout-popover-layer" id="leafletLayoutPopoverLayer" role="dialog" aria-label="리플렛 페이지 배치" hidden></div>`;
    }

    const liveDimensions = byId('coverLiveDimensions');
    if (wrap.parentElement !== toolbar) {
      if (liveDimensions?.parentElement === toolbar) liveDimensions.insertAdjacentElement('afterend', wrap);
      else toolbar.insertBefore(wrap, zoomGroup);
    } else if (liveDimensions?.parentElement === toolbar && liveDimensions.nextElementSibling !== wrap) {
      liveDimensions.insertAdjacentElement('afterend', wrap);
    }

    const layer = byId('leafletLayoutPopoverLayer');
    if (guide.parentElement !== layer) layer.appendChild(guide);

    const button = byId('leafletLayoutPopoverButton');
    bindInteractions(wrap, button);
    return { toolbar, zoomGroup, wrap, button, layer, guide };
  }

  function sync() {
    scheduled = false;
    const ui = ensurePopover();
    if (!ui) return;
    const isLeaflet = currentProduct() === 'leaflet';
    ui.wrap.hidden = !isLeaflet;
    if (!isLeaflet) closePopover();
    document.documentElement.dataset.printCheckerLeafletLayoutPopover = isLeaflet ? 'ready' : 'hidden';
  }

  function schedule() {
    if (scheduled) return;
    scheduled = true;
    requestAnimationFrame(sync);
  }

  function boot() {
    sync();
    window.addEventListener('programstudio:print-checker-product-stable', sync);
    document.addEventListener('click', (event) => {
      if (event.target?.closest?.('.product-card,#resetBtn')) window.setTimeout(sync, 0);
    }, true);

    if (typeof MutationObserver === 'function') {
      rootObserver = new MutationObserver(schedule);
      rootObserver.observe(document.documentElement, {
        attributes: true,
        attributeFilter: ['data-print-checker-active-product', 'data-print-checker-product-transition'],
      });
    }
  }

  window.PrintCheckerLeafletLayoutPopover = Object.freeze({
    sync,
    open: openPopover,
    close: closePopover,
    stage: 'v1-toolbar-hover-layer',
  });

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once: true });
  else boot();
})();