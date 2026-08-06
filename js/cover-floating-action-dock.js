// Compact floating action dock for the perfect-binding cover maker.
(function () {
  'use strict';
  if (window.__coverFloatingActionDockV2) return;
  window.__coverFloatingActionDockV2 = true;

  const INSTALL_DELAYS = [0, 320, 760, 1200, 1900, 2800];
  let frame = 0;
  let resizeObserver = null;

  function installStyles() {
    if (document.getElementById('coverFloatingActionDockStyles')) return;
    const style = document.createElement('style');
    style.id = 'coverFloatingActionDockStyles';
    style.textContent = `
      .settings{padding-bottom:146px!important}
      .download-card.cover-floating-dock{
        position:fixed!important;bottom:10px!important;z-index:490!important;
        margin:0!important;padding:7px 9px 8px!important;
        border:1px solid rgba(148,163,184,.38)!important;border-radius:13px!important;
        background:rgba(255,255,255,.97)!important;
        box-shadow:0 14px 38px rgba(15,23,42,.20)!important;
        backdrop-filter:blur(14px)!important;-webkit-backdrop-filter:blur(14px)!important;
        overflow:hidden!important;
      }
      .download-card.cover-floating-dock:before{
        content:"";position:absolute;left:0;right:0;top:0;height:2px;
        background:linear-gradient(90deg,#12396d,#2563eb,#1d9bb2);
      }
      .cover-dock-head{display:flex;align-items:center;gap:7px;padding:2px 1px 6px}
      .cover-dock-title{font-size:10px;font-weight:900;color:#0f172a;letter-spacing:.01em}
      .cover-dock-state{margin-left:auto;font-size:8px;font-weight:900;color:#2563eb;background:#eff6ff;border:1px solid #bfdbfe;border-radius:999px;padding:2px 6px}
      .download-card.cover-floating-dock .download-grid{
        display:grid!important;grid-template-columns:minmax(0,1fr) minmax(0,1fr) 38px!important;
        gap:6px!important;align-items:stretch!important;
      }
      .download-card.cover-floating-dock #pdfBtn{grid-column:1/-1!important;min-height:38px!important}
      .download-card.cover-floating-dock .download-btn{
        min-height:33px!important;border-radius:9px!important;padding:7px 7px!important;
        font-size:10px!important;box-shadow:none!important;white-space:nowrap!important;
      }
      .download-card.cover-floating-dock #coverResetBtn{
        grid-column:3!important;width:38px!important;min-width:38px!important;min-height:33px!important;
        margin:0!important;padding:0!important;border:1px solid #fecaca!important;border-radius:9px!important;
        background:#fff!important;color:#b91c1c!important;font-size:20px!important;font-weight:800!important;
        line-height:1!important;cursor:pointer!important;
      }
      .download-card.cover-floating-dock #coverResetBtn:hover{background:#fff1f2!important;border-color:#fca5a5!important}
      .download-card.cover-floating-dock > .card-note{display:none!important}
      .download-card.cover-floating-dock .status{
        grid-column:1/-1!important;margin:0!important;padding-top:2px!important;
        min-height:0!important;font-size:8px!important;line-height:1.35!important;
      }
      .download-card.cover-floating-dock .status:empty{display:none!important}
      @media(max-width:980px){
        .settings{padding-bottom:144px!important}
        .download-card.cover-floating-dock{bottom:8px!important}
      }
    `;
    document.head.appendChild(style);
  }

  function syncDock() {
    cancelAnimationFrame(frame);
    frame = requestAnimationFrame(() => {
      const sidebar = document.querySelector('.settings');
      const dock = document.querySelector('.download-card.cover-floating-dock');
      if (!sidebar || !dock) return;
      const rect = sidebar.getBoundingClientRect();
      const style = getComputedStyle(sidebar);
      const paddingLeft = parseFloat(style.paddingLeft) || 0;
      const paddingRight = parseFloat(style.paddingRight) || 0;
      const width = Math.max(0, sidebar.clientWidth - paddingLeft - paddingRight);
      if (!width) return;
      dock.style.setProperty('left', `${Math.round(rect.left + paddingLeft)}px`, 'important');
      dock.style.setProperty('right', 'auto', 'important');
      dock.style.setProperty('width', `${Math.round(width)}px`, 'important');
    });
  }

  function placeResetButton(dock, grid) {
    const reset = document.getElementById('coverResetBtn');
    if (!reset || !grid) return;
    reset.textContent = '↻';
    reset.setAttribute('aria-label', '표지 제작 초기화');
    reset.title = '표지 제작 초기화';
    reset.dataset.compactReset = '1';
    if (reset.parentElement !== grid) grid.appendChild(reset);
    const oldRow = dock.querySelector('.cover-reset-row');
    if (oldRow && !oldRow.children.length) oldRow.remove();
  }

  function install() {
    installStyles();
    const sidebar = document.querySelector('.settings');
    const dock = document.querySelector('.download-card');
    if (!sidebar || !dock) return;
    dock.classList.add('cover-floating-dock');

    if (!dock.querySelector('.cover-dock-head')) {
      const head = document.createElement('div');
      head.className = 'cover-dock-head';
      head.innerHTML = '<span class="cover-dock-title">작업 메뉴</span><span class="cover-dock-state">화면 고정</span>';
      dock.insertBefore(head, dock.firstChild);
    }

    const grid = dock.querySelector('.download-grid');
    const status = document.getElementById('status');
    if (status && grid && status.parentElement !== grid) grid.appendChild(status);
    placeResetButton(dock, grid);

    syncDock();
    if (!resizeObserver && typeof ResizeObserver === 'function') {
      resizeObserver = new ResizeObserver(syncDock);
      resizeObserver.observe(sidebar);
    }
    if (!window.__coverDockResizeHookV2) {
      window.__coverDockResizeHookV2 = true;
      window.addEventListener('resize', syncDock, { passive: true });
    }
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', install, { once: true });
  else install();
  for (const delay of INSTALL_DELAYS) setTimeout(install, delay);
})();
