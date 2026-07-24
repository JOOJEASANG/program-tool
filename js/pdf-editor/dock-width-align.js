// PDF editor floating action dock, matching the book-cover creator dock.
(function () {
  'use strict';
  if (window.__pdfEditorDockWidthAlignV2) return;
  window.__pdfEditorDockWidthAlignV2 = true;

  let resizeObserver = null;
  let mutationObserver = null;
  let frame = 0;

  function installStyles() {
    if (document.getElementById('pdfCoverStyleDockStyles')) return;
    const style = document.createElement('style');
    style.id = 'pdfCoverStyleDockStyles';
    style.textContent = `
      aside{padding-bottom:190px!important}
      .pdf-output-dock.pdf-output-floating.pdf-cover-style-dock{
        position:fixed!important;bottom:12px!important;z-index:490!important;
        margin:0!important;padding:10px 12px 12px!important;
        border:1px solid rgba(148,163,184,.38)!important;border-radius:16px!important;
        background:rgba(255,255,255,.96)!important;
        box-shadow:0 18px 48px rgba(15,23,42,.22)!important;
        backdrop-filter:blur(16px)!important;-webkit-backdrop-filter:blur(16px)!important;
        overflow:hidden!important;
      }
      .pdf-output-dock.pdf-output-floating.pdf-cover-style-dock:before{
        content:"";position:absolute;left:0;right:0;top:0;height:3px;
        background:linear-gradient(90deg,#12396d,#2563eb,#1d9bb2);
      }
      .pdf-output-dock.pdf-cover-style-dock .sec-head{display:flex!important;align-items:center!important;gap:8px!important;padding:4px 1px 8px!important;pointer-events:none!important}
      .pdf-output-dock.pdf-cover-style-dock .sec-title{font-size:11px!important;font-weight:900!important;color:#0f172a!important;letter-spacing:.02em!important}
      .pdf-output-dock.pdf-cover-style-dock .pdf-dock-state{margin-left:auto!important;font-size:9px!important;font-weight:900!important;color:#2563eb!important;background:#eff6ff!important;border:1px solid #bfdbfe!important;border-radius:999px!important;padding:3px 7px!important}
      .pdf-output-dock.pdf-cover-style-dock .sec-body{display:grid!important;grid-template-columns:1fr 1fr!important;gap:8px!important;padding:0!important}
      .pdf-output-dock.pdf-cover-style-dock .sec-body>div[style*="height"]{display:none!important}
      .pdf-output-dock.pdf-cover-style-dock .btn{min-height:39px!important;border-radius:10px!important;padding:9px 10px!important;font-size:11px!important;box-shadow:none!important;margin:0!important}
      .pdf-output-dock.pdf-cover-style-dock #downloadBtn{grid-column:1/-1!important;grid-row:1!important}
      .pdf-output-dock.pdf-cover-style-dock #previewBtn{grid-column:1!important;grid-row:2!important}
      .pdf-output-dock.pdf-cover-style-dock #resetBtn{grid-column:2!important;grid-row:2!important;min-height:39px!important;background:#f8fafc!important;color:#64748b!important;border:1px solid #e2e8f0!important}
      @media(max-width:900px){
        aside{padding-bottom:190px!important}
        .pdf-output-dock.pdf-output-floating.pdf-cover-style-dock{bottom:10px!important}
      }
    `;
    document.head.appendChild(style);
  }

  function prepareDock() {
    const preview = document.getElementById('previewBtn');
    const dock = preview && preview.closest('.sec');
    if (!dock) return null;
    dock.classList.add('pdf-output-dock', 'pdf-output-floating', 'pdf-cover-style-dock');
    const title = dock.querySelector('.sec-title');
    if (title) title.textContent = '작업 메뉴';
    const head = dock.querySelector('.sec-head');
    if (head && !head.querySelector('.pdf-dock-state')) {
      const state = document.createElement('span');
      state.className = 'pdf-dock-state';
      state.textContent = '화면 고정';
      head.appendChild(state);
    }
    const body = dock.querySelector('.sec-body');
    const download = document.getElementById('downloadBtn');
    const reset = document.getElementById('resetBtn');
    if (body && download && preview && reset) {
      body.appendChild(download);
      body.appendChild(preview);
      body.appendChild(reset);
    }
    return dock;
  }

  function syncDockWidth() {
    cancelAnimationFrame(frame);
    frame = requestAnimationFrame(() => {
      const aside = document.querySelector('.app > aside') || document.querySelector('aside');
      const dock = document.querySelector('.pdf-output-dock.pdf-cover-style-dock');
      if (!aside || !dock) return;
      const rect = aside.getBoundingClientRect();
      const style = getComputedStyle(aside);
      const paddingLeft = parseFloat(style.paddingLeft) || 0;
      const paddingRight = parseFloat(style.paddingRight) || 0;
      const contentWidth = Math.max(0, aside.clientWidth - paddingLeft - paddingRight);
      if (!contentWidth) return;
      dock.style.setProperty('left', `${Math.round(rect.left + paddingLeft)}px`, 'important');
      dock.style.setProperty('right', 'auto', 'important');
      dock.style.setProperty('width', `${Math.round(contentWidth)}px`, 'important');
      dock.dataset.widthAligned = '1';
    });
  }

  function install() {
    installStyles();
    const aside = document.querySelector('.app > aside') || document.querySelector('aside');
    const dock = prepareDock();
    if (!aside || !dock) return;
    syncDockWidth();

    if (!resizeObserver && typeof ResizeObserver === 'function') {
      resizeObserver = new ResizeObserver(syncDockWidth);
      resizeObserver.observe(aside);
    }
    if (!mutationObserver) {
      mutationObserver = new MutationObserver(syncDockWidth);
      mutationObserver.observe(aside, { childList: true, subtree: true });
    }
    if (!window.__pdfEditorDockResizeHookV2) {
      window.__pdfEditorDockResizeHookV2 = true;
      window.addEventListener('resize', syncDockWidth, { passive: true });
    }
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', install, { once: true });
  else install();
  setTimeout(install, 350);
  setTimeout(install, 1200);
})();
