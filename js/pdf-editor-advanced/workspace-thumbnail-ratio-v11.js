const $ = id => document.getElementById(id);

let syncFrame = 0;
let syncTimers = [];

function installStyles() {
  if ($('pdfAdvancedThumbnailRatioV11Styles')) return;
  const style = document.createElement('style');
  style.id = 'pdfAdvancedThumbnailRatioV11Styles';
  style.textContent = `
    .advanced-page-sidebar .page-list{
      display:grid!important;
      grid-template-columns:repeat(2,minmax(0,1fr))!important;
      gap:9px!important;
      align-content:start!important;
    }
    .advanced-page-sidebar .page-item{
      width:auto!important;
      min-width:0!important;
      min-height:0!important;
      align-self:start!important;
      overflow:visible!important;
    }
    .advanced-page-sidebar .page-item canvas.page-sidebar-thumb{
      display:block!important;
      width:100%!important;
      height:auto!important;
      min-height:0!important;
      max-height:none!important;
      aspect-ratio:var(--advanced-thumb-ratio, 210 / 297)!important;
      object-fit:contain!important;
      flex:none!important;
      align-self:center!important;
      background:#fff!important;
    }
    @media(max-width:900px){
      .advanced-page-sidebar .page-list{grid-template-columns:repeat(2,minmax(0,1fr))!important}
    }
    @media(max-width:720px){
      .advanced-page-sidebar .page-list{grid-template-columns:repeat(2,minmax(0,1fr))!important}
    }
  `;
  document.head.appendChild(style);
}

function syncCanvasRatio(canvas) {
  if (!(canvas instanceof HTMLCanvasElement)) return false;
  if (canvas.dataset.rendered !== '1') return false;
  const width = Number(canvas.width || 0);
  const height = Number(canvas.height || 0);
  if (!(width > 0 && height > 0)) return false;

  const ratio = `${width} / ${height}`;
  canvas.style.setProperty('--advanced-thumb-ratio', ratio);
  canvas.style.setProperty('width', '100%', 'important');
  canvas.style.setProperty('height', 'auto', 'important');
  canvas.style.setProperty('min-height', '0', 'important');
  canvas.style.setProperty('max-height', 'none', 'important');
  canvas.style.setProperty('aspect-ratio', ratio, 'important');
  canvas.dataset.aspectSynced = `${width}x${height}`;
  return true;
}

function syncAllRatios() {
  syncFrame = 0;
  document.querySelectorAll('.advanced-page-sidebar canvas.page-sidebar-thumb').forEach(syncCanvasRatio);
}

function scheduleSync() {
  if (syncFrame) cancelAnimationFrame(syncFrame);
  syncFrame = requestAnimationFrame(syncAllRatios);

  for (const timer of syncTimers) clearTimeout(timer);
  syncTimers = [80, 180, 360, 700, 1200, 2000].map(delay => setTimeout(syncAllRatios, delay));
}

function install() {
  installStyles();
  scheduleSync();

  window.addEventListener('pdf-advanced-state-change', scheduleSync);
  window.addEventListener('resize', scheduleSync);

  const list = $('pageList');
  if (list) {
    let scrollTimer = 0;
    list.addEventListener('scroll', () => {
      clearTimeout(scrollTimer);
      scrollTimer = setTimeout(scheduleSync, 70);
    }, { passive: true });
    if ('ResizeObserver' in window) new ResizeObserver(scheduleSync).observe(list);
  }

  document.addEventListener('click', event => {
    if (event.target?.closest?.('#advancedPagesTab, .page-item, #pairPrevBtn, #pairNextBtn')) scheduleSync();
  }, true);

  document.documentElement.dataset.pdfAdvancedThumbnailRatio = 'v11';
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', install, { once: true });
else install();
