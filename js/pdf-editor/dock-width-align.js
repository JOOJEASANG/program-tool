// PDF editor flat action area, fixed to the bottom of the settings sidebar.
(function () {
  'use strict';
  if (window.__pdfEditorDockWidthAlignV5) return;
  window.__pdfEditorDockWidthAlignV5 = true;

  let frame = 0;
  let resizeObserver = null;
  let sidebarObserver = null;
  let dockObserver = null;

  function installStyles() {
    if (document.getElementById('pdfFlatFixedDockStyles')) return;
    const style = document.createElement('style');
    style.id = 'pdfFlatFixedDockStyles';
    style.textContent = `
      aside{padding-bottom:86px!important}
      .pdf-output-dock.pdf-flat-fixed-dock{
        position:fixed!important;
        bottom:0!important;
        z-index:490!important;
        margin:0!important;
        padding:12px 16px 14px!important;
        border:0!important;
        border-radius:0!important;
        background:#fff!important;
        box-shadow:none!important;
        backdrop-filter:none!important;
        -webkit-backdrop-filter:none!important;
        overflow:hidden!important;
      }
      .pdf-output-dock.pdf-flat-fixed-dock:before{
        content:"";
        position:absolute;
        left:0;
        right:0;
        top:0;
        height:3px;
        background:linear-gradient(90deg,#12396d,#2563eb,#1d9bb2);
      }
      .pdf-output-dock.pdf-flat-fixed-dock>.sec-head,
      .pdf-output-dock.pdf-flat-fixed-dock .pdf-book-cover-dock-head,
      .pdf-output-dock.pdf-flat-fixed-dock .pdf-flat-fixed-dock-head,
      .pdf-output-dock.pdf-flat-fixed-dock .pdf-dock-state{display:none!important}
      .pdf-output-dock.pdf-flat-fixed-dock .sec-body{
        display:grid!important;
        grid-template-columns:repeat(3,minmax(0,1fr))!important;
        gap:8px!important;
        padding:0!important;
      }
      .pdf-output-dock.pdf-flat-fixed-dock .sec-body>div[style*="height"]{display:none!important}
      .pdf-output-dock.pdf-flat-fixed-dock .btn{
        grid-row:1!important;
        min-width:0!important;
        min-height:40px!important;
        border-radius:9px!important;
        padding:9px 8px!important;
        font-size:11px!important;
        font-weight:800!important;
        line-height:1.2!important;
        box-shadow:none!important;
        margin:0!important;
      }
      .pdf-output-dock.pdf-flat-fixed-dock #previewBtn{
        grid-column:1!important;
        background:#eff6ff!important;
        color:#1d4ed8!important;
        border:1px solid #bfdbfe!important;
      }
      .pdf-output-dock.pdf-flat-fixed-dock #downloadBtn{
        grid-column:2!important;
        background:linear-gradient(135deg,#2563eb,#1d4ed8)!important;
        color:#fff!important;
        border:1px solid #1d4ed8!important;
      }
      .pdf-output-dock.pdf-flat-fixed-dock #resetBtn{
        grid-column:3!important;
        background:#f8fafc!important;
        color:#475569!important;
        border:1px solid #dbe3ee!important;
      }
      .pdf-output-dock.pdf-flat-fixed-dock .btn:disabled{
        opacity:.48!important;
        cursor:not-allowed!important;
        filter:saturate(.7)!important;
      }
      @media(max-width:900px){
        aside{padding-bottom:86px!important}
        .pdf-output-dock.pdf-flat-fixed-dock{bottom:0!important}
        .pdf-output-dock.pdf-flat-fixed-dock .sec-body{gap:6px!important}
        .pdf-output-dock.pdf-flat-fixed-dock .btn{font-size:10px!important;padding:8px 5px!important}
      }
    `;
    document.head.appendChild(style);
  }

  function prepareDock() {
    const preview = document.getElementById('previewBtn');
    const dock = preview && preview.closest('.sec');
    if (!dock) return null;

    dock.classList.remove('pdf-output-floating', 'pdf-cover-style-dock', 'pdf-book-cover-dock');
    dock.classList.add('pdf-output-dock', 'pdf-flat-fixed-dock');

    dock.querySelectorAll('.sec-head,.pdf-book-cover-dock-head,.pdf-flat-fixed-dock-head,.pdf-dock-state').forEach((element) => element.remove());

    const body = dock.querySelector('.sec-body');
    const download = document.getElementById('downloadBtn');
    const reset = document.getElementById('resetBtn');
    if (body && download && preview && reset) {
      body.appendChild(preview);
      body.appendChild(download);
      body.appendChild(reset);
    }
    return dock;
  }

  function syncDock() {
    cancelAnimationFrame(frame);
    frame = requestAnimationFrame(() => {
      const aside = document.querySelector('.app > aside') || document.querySelector('aside');
      const dock = document.querySelector('.pdf-output-dock.pdf-flat-fixed-dock');
      if (!aside || !dock) return;

      dock.classList.remove('pdf-output-floating', 'pdf-cover-style-dock', 'pdf-book-cover-dock');
      const rect = aside.getBoundingClientRect();
      const sidebarStyle = getComputedStyle(aside);
      const paddingLeft = parseFloat(sidebarStyle.paddingLeft) || 0;
      const paddingRight = parseFloat(sidebarStyle.paddingRight) || 0;
      const width = Math.max(0, aside.clientWidth);
      if (!width) return;

      dock.style.setProperty('left', `${Math.round(rect.left)}px`, 'important');
      dock.style.setProperty('right', 'auto', 'important');
      dock.style.setProperty('width', `${Math.round(width)}px`, 'important');
      dock.style.setProperty('bottom', '0', 'important');
      dock.style.setProperty('padding-left', `${paddingLeft}px`, 'important');
      dock.style.setProperty('padding-right', `${paddingRight}px`, 'important');
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
        if (
          dock.classList.contains('pdf-output-floating') ||
          dock.classList.contains('pdf-cover-style-dock') ||
          dock.classList.contains('pdf-book-cover-dock')
        ) {
          dock.classList.remove('pdf-output-floating', 'pdf-cover-style-dock', 'pdf-book-cover-dock');
          dock.classList.add('pdf-flat-fixed-dock');
        }
        dock.querySelectorAll('.sec-head,.pdf-book-cover-dock-head,.pdf-flat-fixed-dock-head,.pdf-dock-state').forEach((element) => element.remove());
        syncDock();
      });
      dockObserver.observe(dock, { attributes: true, childList: true, subtree: true, attributeFilter: ['class'] });
    }
  }

  function install() {
    installStyles();
    const aside = document.querySelector('.app > aside') || document.querySelector('aside');
    const dock = prepareDock();
    if (!aside || !dock) return false;
    syncDock();
    installObservers(aside, dock);

    if (!window.__pdfFlatFixedDockResizeHookV5) {
      window.__pdfFlatFixedDockResizeHookV5 = true;
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
