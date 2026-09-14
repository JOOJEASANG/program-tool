// Safety layer for controls and labels rendered inside a windowed PDF preview.
(function () {
  'use strict';
  if (window.__pdfViewportLazyPreviewGuardV1) return;
  window.__pdfViewportLazyPreviewGuardV1 = true;
  if (!location.pathname.includes('pdf-editor')) return;

  const INSTALL_DELAYS = [0, 180, 420, 800, 1400, 2300, 3600];
  let observer = null;
  let refreshFrame = 0;
  let refreshing = false;

  const byId = (id) => document.getElementById(id);

  function lazyActive() {
    const scroll = byId('previewScroll');
    return Boolean(window.__pdfEditorLazyPreviewActive || scroll?.dataset?.lazyPreview === 'true');
  }

  function bookletEnabled() {
    return Boolean(byId('bookletCheck')?.checked);
  }

  function globalFaceLabel(outputIndex) {
    const oneBased = outputIndex + 1;
    if (!bookletEnabled()) return `출력면 ${oneBased}`;
    const sheet = Math.floor(outputIndex / 2) + 1;
    const side = outputIndex % 2 === 1 ? '뒷면' : '앞면';
    return `${sheet}번 용지 ${side} · 출력면 ${oneBased}`;
  }

  function enableInsertionControls(root) {
    const zones = root?.querySelectorAll?.('.prev-ins-zone,.prev-ins-zone-v') || [];
    zones.forEach((zone) => {
      zone.hidden = false;
      zone.removeAttribute?.('aria-hidden');
      zone.querySelectorAll('button').forEach((button) => {
        button.disabled = false;
        button.tabIndex = 0;
        button.setAttribute('aria-disabled', 'false');
        button.style?.removeProperty?.('pointer-events');
      });
    });
    if (zones.length) document.documentElement.dataset.pdfLazyPreviewCanvasInsert = 'enabled';
    return zones.length;
  }

  function correctGlobalLabels(root) {
    const previews = root?.querySelectorAll?.('.page-preview[data-output-index]') || [];
    let corrected = 0;
    previews.forEach((wrap) => {
      const outputIndex = Number(wrap.dataset.outputIndex);
      if (!Number.isInteger(outputIndex) || outputIndex < 0) return;
      wrap.querySelectorAll('.pdf-output-source-label').forEach((label) => {
        label.hidden = true;
        label.setAttribute('aria-hidden', 'true');
      });
      const primary = wrap.querySelector('.lazy-preview-face-label');
      if (primary) {
        primary.textContent = globalFaceLabel(outputIndex);
        primary.dataset.globalOutputIndex = String(outputIndex);
      } else {
        let label = wrap.querySelector('.pdf-lazy-global-label');
        if (!label) {
          label = document.createElement('span');
          label.className = 'pdf-lazy-global-label';
          wrap.appendChild(label);
        }
        label.textContent = globalFaceLabel(outputIndex);
        label.dataset.globalOutputIndex = String(outputIndex);
      }
      corrected += 1;
    });
    return corrected;
  }

  function refresh() {
    refreshFrame = 0;
    if (refreshing || !lazyActive()) return false;
    const root = byId('previewScroll');
    if (!root) return false;
    refreshing = true;
    try {
      root.dataset.lazyPreviewGuard = 'true';
      enableInsertionControls(root);
      correctGlobalLabels(root);
      return true;
    } finally {
      refreshing = false;
    }
  }

  function scheduleRefresh() {
    if (refreshFrame) return;
    refreshFrame = requestAnimationFrame(refresh);
  }

  function installStyles() {
    if (byId('pdfViewportLazyPreviewGuardStyles')) return;
    const style = document.createElement('style');
    style.id = 'pdfViewportLazyPreviewGuardStyles';
    style.textContent = `
      #previewScroll[data-lazy-preview="true"] .prev-ins-zone,
      #previewScroll[data-lazy-preview="true"] .prev-ins-zone-v{visibility:visible!important;pointer-events:auto!important}
      #previewScroll[data-lazy-preview="true"] .prev-ins-zone{display:flex!important}
      #previewScroll[data-lazy-preview="true"] .prev-ins-zone-v{display:flex!important}
      #previewScroll[data-lazy-preview="true"] .prev-ins-btn,
      #previewScroll[data-lazy-preview="true"] .prev-ins-btn-v{pointer-events:auto!important;cursor:pointer!important}
      #previewScroll[data-lazy-preview="true"] .pdf-output-source-label{display:none!important}
      #previewScroll[data-lazy-preview="true"] .pdf-lazy-global-label{position:absolute;top:5px;right:5px;z-index:4;border-radius:999px;padding:3px 7px;background:rgba(15,23,42,.82);color:#fff;font-size:9px;font-weight:850;pointer-events:none}
    `;
    document.head.appendChild(style);
  }

  function installObserver() {
    const root = byId('previewScroll');
    if (!root || typeof MutationObserver !== 'function') return false;
    if (observer) observer.disconnect();
    observer = new MutationObserver(scheduleRefresh);
    observer.observe(root, { childList: true, subtree: true, attributes: true, attributeFilter: ['data-output-index', 'data-lazy-preview', 'hidden', 'disabled', 'aria-disabled'] });
    return true;
  }

  function install() {
    installStyles();
    installObserver();
    refresh();
  }

  if (document.documentElement.dataset.pdfLazyPreviewGuardEvents !== '1') {
    document.documentElement.dataset.pdfLazyPreviewGuardEvents = '1';
    document.addEventListener('pdf-import-committed', scheduleRefresh);
    document.addEventListener('pdf-preview-page-inserted', scheduleRefresh);
    document.addEventListener('pdf-preview-page-insert-requested', scheduleRefresh);
  }

  window.PdfViewportLazyPreviewGuard = {
    lazyActive,
    globalFaceLabel,
    enableInsertionControls,
    correctGlobalLabels,
    refresh,
    scheduleRefresh,
    stage: 'canvas-insert-global-output-labels-v2',
  };

  for (const delay of INSTALL_DELAYS) setTimeout(install, delay);
})();
