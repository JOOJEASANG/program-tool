// Cover preview workspace layout and zoom controls.
(function () {
  'use strict';
  if (window.__coverPreviewWorkspaceV1) return;
  window.__coverPreviewWorkspaceV1 = true;
  if (!location.pathname.includes('perfect-binding-cover')) return;

  const $ = (selector, root = document) => root.querySelector(selector);
  let zoom = 1;
  const MIN_ZOOM = 0.5;
  const MAX_ZOOM = 2.5;
  const STEP = 0.1;

  function installStyles() {
    if ($('#coverPreviewWorkspaceStyles')) return;
    const style = document.createElement('style');
    style.id = 'coverPreviewWorkspaceStyles';
    style.textContent = `
      .workspace{grid-template-columns:360px minmax(0,1fr)!important}
      .settings{padding-bottom:92px!important;position:relative}
      .dimension-bar{display:none!important}
      .preview-panel{padding:7px!important}
      .preview-card{border-radius:10px!important}
      .preview-head{padding:8px 11px!important}
      .canvas-shell{padding:14px!important;align-items:flex-start!important;justify-content:flex-start!important}
      .canvas-wrap{margin:auto;transform-origin:center center;transition:transform .14s ease}
      .cover-preview-zoom{display:flex;align-items:center;gap:5px;margin-left:8px;padding-left:8px;border-left:1px solid #dbe5ee}
      .cover-preview-zoom button{width:28px;height:28px;border:1px solid #cbd5e1;background:#fff;border-radius:7px;color:#334155;font-size:14px;font-weight:900;cursor:pointer;display:grid;place-items:center}
      .cover-preview-zoom button:hover{border-color:#67c7d8;background:#ecfeff;color:#0e7490}
      .cover-preview-zoom .zoom-reset{width:auto;padding:0 8px;font-size:9px}
      .cover-preview-zoom-value{min-width:42px;text-align:center;font-size:9px;font-weight:900;color:#12396d}
      .cover-sidebar-actions{position:fixed;left:0;bottom:0;width:360px;z-index:55;background:#fff;border-top:1px solid #dbe5ee;padding:9px 11px;box-shadow:0 -8px 24px rgba(15,23,42,.10)}
      .cover-sidebar-actions .download-card{margin:0!important;padding:0!important;border:0!important;box-shadow:none!important;border-radius:0!important;background:transparent!important}
      .cover-sidebar-actions .download-grid{grid-template-columns:1.25fr 1fr 1fr!important;gap:6px!important}
      .cover-sidebar-actions .download-btn{padding:10px 5px!important;font-size:9px!important}
      .cover-sidebar-actions .status{margin-top:4px!important;min-height:12px!important}
      @media(max-width:980px){.workspace{grid-template-columns:1fr!important}.cover-sidebar-actions{position:static;width:auto;padding:9px 0 0;box-shadow:none;border-top:0}.settings{padding-bottom:13px!important}.preview-panel{padding:9px!important}.canvas-shell{padding:12px 8px!important}}
    `;
    document.head.appendChild(style);
  }

  function applyZoom() {
    const wrap = $('.canvas-wrap');
    const shell = $('.canvas-shell');
    if (!wrap || !shell) return;
    wrap.style.transform = `scale(${zoom})`;
    wrap.dataset.previewZoom = String(zoom);
    const value = $('#coverPreviewZoomValue');
    if (value) value.textContent = `${Math.round(zoom * 100)}%`;
    shell.style.cursor = zoom > 1 ? 'grab' : 'default';
  }

  function setZoom(next) {
    zoom = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, Math.round(next * 10) / 10));
    applyZoom();
  }

  function installZoomControls() {
    const actions = $('.preview-actions');
    if (!actions || $('#coverPreviewZoomControls')) return;
    const controls = document.createElement('div');
    controls.className = 'cover-preview-zoom';
    controls.id = 'coverPreviewZoomControls';
    controls.innerHTML = '<button type="button" id="coverZoomOut" title="축소">−</button><span class="cover-preview-zoom-value" id="coverPreviewZoomValue">100%</span><button type="button" id="coverZoomIn" title="확대">＋</button><button type="button" class="zoom-reset" id="coverZoomReset">맞춤</button>';
    actions.appendChild(controls);
    $('#coverZoomOut').addEventListener('click', () => setZoom(zoom - STEP));
    $('#coverZoomIn').addEventListener('click', () => setZoom(zoom + STEP));
    $('#coverZoomReset').addEventListener('click', () => setZoom(1));

    const shell = $('.canvas-shell');
    if (shell && !shell.dataset.zoomWheelBound) {
      shell.dataset.zoomWheelBound = '1';
      shell.addEventListener('wheel', event => {
        if (!event.ctrlKey) return;
        event.preventDefault();
        setZoom(zoom + (event.deltaY < 0 ? STEP : -STEP));
      }, { passive: false });
    }
  }

  function moveDownloadActions() {
    const settings = $('.settings');
    const download = $('.download-card');
    if (!settings || !download) return;
    let dock = $('#coverSidebarActions');
    if (!dock) {
      dock = document.createElement('div');
      dock.id = 'coverSidebarActions';
      dock.className = 'cover-sidebar-actions';
      document.body.appendChild(dock);
    }
    if (download.parentElement !== dock) dock.appendChild(download);
  }

  function hideMeta() {
    document.querySelectorAll('.dimension-bar').forEach(node => node.style.display = 'none');
  }

  function enlargePreview() {
    const panel = $('.preview-panel');
    const card = $('.preview-card');
    if (panel) panel.style.minHeight = '0';
    if (card) card.style.minHeight = '0';
  }

  function boot() {
    installStyles();
    hideMeta();
    moveDownloadActions();
    installZoomControls();
    enlargePreview();
    applyZoom();
    const observer = new MutationObserver(() => {
      hideMeta();
      moveDownloadActions();
      installZoomControls();
      applyZoom();
    });
    observer.observe(document.body, { childList: true, subtree: true });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => setTimeout(boot, 450));
  else setTimeout(boot, 450);
})();