// PDF editor floating action dock, using the same fixed layout as the book-cover creator.
(function () {
  'use strict';
  if (window.__pdfEditorDockWidthAlignV3) return;
  window.__pdfEditorDockWidthAlignV3 = true;

  let frame = 0;
  let resizeObserver = null;
  let sidebarObserver = null;
  let dockObserver = null;

  function installStyles() {
    if (document.getElementById('pdfBookCoverDockStyles')) return;
    const style = document.createElement('style');
    style.id = 'pdfBookCoverDockStyles';
    style.textContent = `
      aside{padding-bottom:190px!important}
      .pdf-output-dock.pdf-book-cover-dock{
        position:fixed!important;
        bottom:12px!important;
        z-index:490!important;
        margin:0!important;
        padding:10px 12px 12px!important;
        border:1px solid rgba(148,163,184,.38)!important;
        border-radius:16px!important;
        background:rgba(255,255,255,.96)!important;
        box-shadow:0 18px 48px rgba(15,23,42,.22)!important;
        backdrop-filter:blur(16px)!important;
        -webkit-backdrop-filter:blur(16px)!important;
        overflow:hidden!important;
      }
      .pdf-output-dock.pdf-book-cover-dock:before{
        content:"";
        position:absolute;
        left:0;
        right:0;
        top:0;
        height:3px;
        background:linear-gradient(90deg,#12396d,#2563eb,#1d9bb2);
      }
      .pdf-output-dock.pdf-book-cover-dock>.sec-head{display:none!important}
      .pdf-book-cover-dock-head{
        display:flex!important;
        align-items:center!important;
        gap:8px!important;
        padding:4px 1px 8px!important;
      }
      .pdf-book-cover-dock-title{
        font-size:11px!important;
        font-weight:900!important;
        color:#0f172a!important;
        letter-spacing:.02em!important;
      }
      .pdf-book-cover-dock-state{
        margin-left:auto!important;
        font-size:9px!important;
        font-weight:900!important;
        color:#2563eb!important;
        background:#eff6ff!important;
        border:1px solid #bfdbfe!important;
        border-radius:999px!important;
        padding:3px 7px!important;
      }
      .pdf-output-dock.pdf-book-cover-dock .sec-body{
        display:grid!important;
        grid-template-columns:1fr 1fr!important;
        gap:8px!important;
        padding:0!important;
      }
      .pdf-output-dock.pdf-book-cover-dock .sec-body>div[style*="height"]{display:none!important}
      .pdf-output-dock.pdf-book-cover-dock .btn{
        min-height:39px!important;
        border-radius:10px!important;
        padding:9px 10px!important;
        font-size:11px!important;
        box-shadow:none!important;
        margin:0!important;
      }
      .pdf-output-dock.pdf-book-cover-dock #downloadBtn{grid-column:1/-1!important;grid-row:1!important}
      .pdf-output-dock.pdf-book-cover-dock #previewBtn{grid-column:1!important;grid-row:2!important}
      .pdf-output-dock.pdf-book-cover-dock #resetBtn{
        grid-column:2!important;
        grid-row:2!important;
        min-height:39px!important;
        background:#f8fafc!important;
        color:#64748b!important;
        border:1px solid #e2e8f0!important;
      }
      @media(max-width:900px){
        aside{padding-bottom:190px!important}
        .pdf-output-dock.pdf-book-cover-dock{bottom:10px!important}
      }
    `;
    document.head.appendChild(style);
  }

  function prepareDock() {
    const preview = document.getElementById('previewBtn');
    const dock = preview && preview.closest('.sec');
    if (!dock) return null;

    // The older repair module used this class and its own fixed dimensions.
    // Remove it so this module is the single owner of the dock layout.
    dock.classList.remove('pdf-output-floating', 'pdf-cover-style-dock');
    dock.classList.add('pdf-output-dock', 'pdf-book-cover-dock');

    let head = dock.querySelector('.pdf-book-cover-dock-head');
    if (!head) {
      head = document.createElement('div');
      head.className = 'pdf-book-cover-dock-head';
      head.innerHTML = '<span class="pdf-book-cover-dock-title">작업 메뉴</span><span class="pdf-book-cover-dock-state">화면 고정</span>';
      dock.insertBefore(head, dock.firstChild);
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

  function syncDock() {
    cancelAnimationFrame(frame);
    frame = requestAnimationFrame(() => {
      const aside = document.querySelector('.app > aside') || document.querySelector('aside');
      const dock = document.querySelector('.pdf-output-dock.pdf-book-cover-dock');
      if (!aside || !dock) return;

      dock.classList.remove('pdf-output-floating', 'pdf-cover-style-dock');
      const rect = aside.getBoundingClientRect();
      const style = getComputedStyle(aside);
      const paddingLeft = parseFloat(style.paddingLeft) || 0;
      const paddingRight = parseFloat(style.paddingRight) || 0;
      const width = Math.max(0, aside.clientWidth - paddingLeft - paddingRight);
      if (!width) return;

      dock.style.setProperty('left', `${Math.round(rect.left + paddingLeft)}px`, 'important');
      dock.style.setProperty('right', 'auto', 'important');
      dock.style.setProperty('width', `${Math.round(width)}px`, 'important');
      dock.style.setProperty('bottom', window.innerWidth <= 900 ? '10px' : '12px', 'important');
      dock.dataset.widthAligned = '1';
    });
  }

  function installObservers(aside, dock) {
    if (!resizeObserver && typeof ResizeObserver === 'function') {
      resizeObserver = new ResizeObserver(syncDock);
      resizeObserver.observe(aside);
    }
    if (!sidebarObserver) {
      sidebarObserver = new MutationObserver(syncDock);
      sidebarObserver.observe(aside, { childList: true, subtree: true });
    }
    if (!dockObserver) {
      dockObserver = new MutationObserver(() => {
        if (dock.classList.contains('pdf-output-floating') || dock.classList.contains('pdf-cover-style-dock')) {
          dock.classList.remove('pdf-output-floating', 'pdf-cover-style-dock');
        }
        syncDock();
      });
      dockObserver.observe(dock, { attributes: true, attributeFilter: ['class'] });
    }
  }

  function install() {
    installStyles();
    const aside = document.querySelector('.app > aside') || document.querySelector('aside');
    const dock = prepareDock();
    if (!aside || !dock) return false;
    syncDock();
    installObservers(aside, dock);

    if (!window.__pdfBookCoverDockResizeHookV3) {
      window.__pdfBookCoverDockResizeHookV3 = true;
      window.addEventListener('resize', syncDock, { passive: true });
    }
    return true;
  }

  function boot(attempt) {
    if (!install() && attempt < 12) setTimeout(() => boot(attempt + 1), 160 + attempt * 60);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => boot(0), { once: true });
  else boot(0);
  setTimeout(() => install(), 400);
  setTimeout(() => install(), 1300);
})();
