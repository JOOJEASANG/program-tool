// Books cover creator floating action dock, aligned with the settings sidebar.
(function () {
  'use strict';
  if (window.__coverFloatingActionDockV1) return;
  window.__coverFloatingActionDockV1 = true;

  let frame = 0;
  let resizeObserver = null;

  function installStyles() {
    if (document.getElementById('coverFloatingActionDockStyles')) return;
    const style = document.createElement('style');
    style.id = 'coverFloatingActionDockStyles';
    style.textContent = `
      .settings{padding-bottom:190px!important}
      .download-card.cover-floating-dock{
        position:fixed!important;bottom:12px!important;z-index:490!important;
        margin:0!important;padding:10px 12px 12px!important;
        border:1px solid rgba(148,163,184,.38)!important;border-radius:16px!important;
        background:rgba(255,255,255,.96)!important;
        box-shadow:0 18px 48px rgba(15,23,42,.22)!important;
        backdrop-filter:blur(16px)!important;-webkit-backdrop-filter:blur(16px)!important;
        overflow:hidden!important;
      }
      .download-card.cover-floating-dock:before{
        content:"";position:absolute;left:0;right:0;top:0;height:3px;
        background:linear-gradient(90deg,#12396d,#2563eb,#1d9bb2);
      }
      .cover-dock-head{display:flex;align-items:center;gap:8px;padding:4px 1px 8px}
      .cover-dock-title{font-size:11px;font-weight:900;color:#0f172a;letter-spacing:.02em}
      .cover-dock-state{margin-left:auto;font-size:9px;font-weight:900;color:#2563eb;background:#eff6ff;border:1px solid #bfdbfe;border-radius:999px;padding:3px 7px}
      .download-card.cover-floating-dock .download-grid{display:grid!important;grid-template-columns:1fr 1fr!important;gap:8px!important}
      .download-card.cover-floating-dock #pdfBtn{grid-column:1/-1!important}
      .download-card.cover-floating-dock .download-btn{min-height:39px!important;border-radius:10px!important;padding:9px 10px!important;font-size:11px!important;box-shadow:none!important}
      .download-card.cover-floating-dock .status{grid-column:1/-1!important;margin-top:7px!important;min-height:13px!important;font-size:9px!important}
      @media(max-width:980px){
        .settings{padding-bottom:190px!important}
        .download-card.cover-floating-dock{bottom:10px!important}
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

    const status = document.getElementById('status');
    const grid = dock.querySelector('.download-grid');
    if (status && grid && status.parentElement !== grid) grid.appendChild(status);

    syncDock();
    if (!resizeObserver && typeof ResizeObserver === 'function') {
      resizeObserver = new ResizeObserver(syncDock);
      resizeObserver.observe(sidebar);
    }
    if (!window.__coverDockResizeHookV1) {
      window.__coverDockResizeHookV1 = true;
      window.addEventListener('resize', syncDock, { passive: true });
    }
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', install, { once: true });
  else install();
  setTimeout(install, 350);
  setTimeout(install, 1200);
})();
