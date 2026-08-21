// Safe cover preview layout and zoom controls.
(function () {
  'use strict';
  if (window.__coverPreviewWorkspaceV2) return;
  window.__coverPreviewWorkspaceV2 = true;
  if (!location.pathname.includes('perfect-binding-cover')) return;

  const $ = (selector, root = document) => root.querySelector(selector);
  let zoom = 1;
  let baseWidth = 0;
  let baseHeight = 0;
  const MIN_ZOOM = 0.5;
  const MAX_ZOOM = 2.5;
  const STEP = 0.1;

  function installStyles() {
    if ($('#coverPreviewWorkspaceStylesV2')) return;
    $('#coverPreviewWorkspaceStyles')?.remove();
    const style = document.createElement('style');
    style.id = 'coverPreviewWorkspaceStylesV2';
    style.textContent = `
      .workspace{grid-template-columns:360px minmax(0,1fr)!important}
      .dimension-bar{display:none!important}
      .preview-panel{padding:7px!important}
      .preview-card{border-radius:10px!important}
      .preview-head{padding:8px 11px!important}
      /* The canvas itself already includes the exact bleed area. Keep only top room for the panel labels. */
      .canvas-shell{padding:22px 0 0!important;align-items:center!important;justify-content:center!important;overflow:auto!important}
      .canvas-wrap{margin:auto!important;transform:none!important;transition:none!important}
      .cover-preview-zoom{display:flex;align-items:center;gap:5px;margin-left:8px;padding-left:8px;border-left:1px solid #dbe5ee;position:relative;z-index:2}
      .cover-preview-zoom button{width:28px;height:28px;border:1px solid #cbd5e1;background:#fff;border-radius:7px;color:#334155;font-size:14px;font-weight:900;cursor:pointer;display:grid;place-items:center;pointer-events:auto}
      .cover-preview-zoom .zoom-reset{width:auto;padding:0 8px;font-size:9px}
      .cover-preview-zoom-value{min-width:42px;text-align:center;font-size:9px;font-weight:900;color:#12396d}
      .cover-sidebar-actions{position:sticky;bottom:-13px;z-index:20;background:#fff;border-top:1px solid #dbe5ee;padding:9px 0 0;margin-top:auto;box-shadow:0 -8px 18px rgba(15,23,42,.08)}
      .cover-sidebar-actions .download-card{margin:0!important;padding:9px 0 0!important;border:0!important;box-shadow:none!important;border-radius:0!important;background:#fff!important}
      .cover-sidebar-actions .download-grid{grid-template-columns:1.25fr 1fr 1fr!important;gap:6px!important}
      .cover-sidebar-actions .download-btn{padding:10px 5px!important;font-size:9px!important}
      @media(max-width:980px){.workspace{grid-template-columns:1fr!important}.cover-sidebar-actions{position:static;bottom:auto}.preview-panel{padding:9px!important}.canvas-shell{padding:22px 0 0!important}}
    `;
    document.head.appendChild(style);
  }

  function captureBaseSize(force = false) {
    const canvas = $('#previewCanvas');
    if (!canvas) return false;
    const rect = canvas.getBoundingClientRect();
    if (force || !baseWidth || !baseHeight || zoom === 1) {
      const currentWidth = parseFloat(canvas.style.width) || rect.width;
      const currentHeight = parseFloat(canvas.style.height) || rect.height;
      if (currentWidth > 0 && currentHeight > 0) {
        baseWidth = currentWidth / zoom;
        baseHeight = currentHeight / zoom;
      }
    }
    return baseWidth > 0 && baseHeight > 0;
  }

  function applyZoom() {
    const canvas = $('#previewCanvas');
    const wrap = $('.canvas-wrap');
    if (!canvas || !wrap || !captureBaseSize()) return;
    canvas.style.width = `${Math.max(1, baseWidth * zoom)}px`;
    canvas.style.height = `${Math.max(1, baseHeight * zoom)}px`;
    wrap.style.width = canvas.style.width;
    wrap.style.height = canvas.style.height;
    wrap.style.transform = 'none';
    const value = $('#coverPreviewZoomValue');
    if (value) value.textContent = `${Math.round(zoom * 100)}%`;
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
    $('#coverZoomOut').onclick = event => { event.stopPropagation(); setZoom(zoom - STEP); };
    $('#coverZoomIn').onclick = event => { event.stopPropagation(); setZoom(zoom + STEP); };
    $('#coverZoomReset').onclick = event => { event.stopPropagation(); zoom = 1; captureBaseSize(true); applyZoom(); };
    const shell = $('.canvas-shell');
    if (shell && !shell.dataset.safeZoomWheelBound) {
      shell.dataset.safeZoomWheelBound = '1';
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
      settings.appendChild(dock);
    }
    if (download.parentElement !== dock) dock.appendChild(download);
  }

  function boot() {
    installStyles();
    document.querySelectorAll('.dimension-bar').forEach(node => node.style.display = 'none');
    moveDownloadActions();
    installZoomControls();
    setTimeout(() => { captureBaseSize(true); applyZoom(); }, 250);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => setTimeout(boot, 450));
  else setTimeout(boot, 450);
})();
