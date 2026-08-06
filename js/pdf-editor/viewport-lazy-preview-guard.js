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

  function disableInsertionControls(root) {
    const zones = root?.querySelectorAll?.('.prev-ins-zone,.prev-ins-zone-v') || [];
    zones.forEach((zone) => {
      zone.hidden = true;
      zone.setAttribute('aria-hidden', 'true');
      zone.querySelectorAll('button').forEach((button) => {
        button.disabled = true;
        button.tabIndex = -1;
        button.setAttribute('aria-disabled', 'true');
      });
    });
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
      disableInsertionControls(root);
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
      #previewScroll[data-lazy-preview="true"] .prev-ins-zone-v{display:none!important;pointer-events:none!important}
      #previewScroll[data-lazy-preview="true"] .pdf-output-source-label{display:none!important}
      #previewScroll[data-lazy-preview="true"] .pdf-lazy-global-label{position:absolute;top:5px;right:5px;z-index:4;border-radius:999px;padding:3px 7px;background:rgba(15,23,42,.82);color:#fff;font-size:9px;font-weight:850;pointer-events:none}
    `;
    document.head.appendChild(style);
  }

  function blockStaleInsertion(event) {
    if (!lazyActive()) return;
    const button = event.target?.closest?.('.prev-ins-btn,.prev-ins-btn-v');
    if (!button || !byId('previewScroll')?.contains(button)) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    event.stopPropagation();
    try { window.showStatus?.('대용량 구간 미리보기에서는 삽입 위치 오류 방지를 위해 이 버튼을 사용하지 않습니다. 왼쪽 페이지 목록에서 추가해 주세요.', 'error'); }
    catch (_) {}
  }

  function installObserver() {
    const root = byId('previewScroll');
    if (!root || typeof MutationObserver !== 'function') return false;
    if (observer) observer.disconnect();
    observer = new MutationObserver(scheduleRefresh);
    observer.observe(root, { childList: true, subtree: true, attributes: true, attributeFilter: ['data-output-index', 'data-lazy-preview'] });
    return true;
  }

  function install() {
    installStyles();
    installObserver();
    refresh();
  }

  if (document.documentElement.dataset.pdfLazyPreviewGuardEvents !== '1') {
    document.documentElement.dataset.pdfLazyPreviewGuardEvents = '1';
    document.addEventListener('click', blockStaleInsertion, true);
    document.addEventListener('keydown', (event) => {
      if (event.key === 'Enter' || event.key === ' ') blockStaleInsertion(event);
    }, true);
    document.addEventListener('pdf-import-committed', scheduleRefresh);
  }

  window.PdfViewportLazyPreviewGuard = {
    lazyActive,
    globalFaceLabel,
    disableInsertionControls,
    correctGlobalLabels,
    refresh,
    scheduleRefresh,
    stage: 'disable-local-insert-global-output-labels',
  };

  for (const delay of INSTALL_DELAYS) setTimeout(install, delay);
})();
