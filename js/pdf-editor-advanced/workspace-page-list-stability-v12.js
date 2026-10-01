import { advancedState } from './state.js';
import { renderThumbnail } from './preview.js';

const $ = id => document.getElementById(id);
let observer = null;
let normalizeFrame = 0;
let normalizing = false;

function normalizedRotation(value) {
  return ((Number(value || 0) % 360) + 360) % 360;
}

function pageAspect(page) {
  if (!page) return 210 / 297;
  const rotation = normalizedRotation(page.rotation);
  const rotated = rotation === 90 || rotation === 270;
  const width = Number(rotated ? page.heightPt : page.widthPt) || 210;
  const height = Number(rotated ? page.widthPt : page.heightPt) || 297;
  return Math.max(.1, width / Math.max(1, height));
}

function installStyles() {
  if ($('pdfAdvancedPageListStabilityV12Styles')) return;
  const style = document.createElement('style');
  style.id = 'pdfAdvancedPageListStabilityV12Styles';
  style.textContent = `
    .advanced-page-sidebar .page-list{
      display:grid!important;
      grid-template-columns:repeat(2,minmax(0,1fr))!important;
      grid-auto-flow:row!important;
      grid-auto-rows:max-content!important;
      align-content:start!important;
      align-items:start!important;
      gap:9px!important;
      overflow-y:auto!important;
      overflow-x:hidden!important;
      scrollbar-gutter:stable!important;
    }
    .advanced-page-sidebar .page-item{
      position:relative!important;
      display:flex!important;
      flex-direction:column!important;
      align-items:stretch!important;
      justify-content:flex-start!important;
      align-self:start!important;
      width:100%!important;
      min-width:0!important;
      min-height:0!important;
      height:auto!important;
      overflow:visible!important;
      padding:7px!important;
      gap:5px!important;
    }
    .advanced-page-sidebar .page-thumb-frame{
      order:1!important;
      position:relative!important;
      display:block!important;
      width:100%!important;
      height:auto!important;
      min-height:0!important;
      overflow:hidden!important;
      background:#fff!important;
      border:1px solid #dfe5ec!important;
      border-radius:6px!important;
    }
    .advanced-page-sidebar .page-thumb-frame canvas.page-sidebar-thumb{
      display:block!important;
      width:100%!important;
      height:100%!important;
      min-width:0!important;
      min-height:0!important;
      max-width:none!important;
      max-height:none!important;
      margin:0!important;
      border:0!important;
      border-radius:0!important;
      object-fit:fill!important;
      aspect-ratio:auto!important;
      flex:none!important;
    }
    .advanced-page-sidebar .page-item-info{order:2!important}
    .advanced-page-sidebar .page-remove{z-index:5!important}
    @media(max-width:900px){
      .advanced-page-sidebar .page-list{grid-template-columns:repeat(2,minmax(0,1fr))!important}
    }
    @media(max-width:720px){
      .advanced-page-sidebar .page-list{grid-template-columns:repeat(2,minmax(0,1fr))!important}
    }
  `;
  document.head.appendChild(style);
}

function renderCanvas(page, canvas) {
  if (!page || !canvas || canvas.dataset.rendering === '1' || canvas.dataset.rendered === '1') return;
  canvas.dataset.rendering = '1';
  renderThumbnail(page, canvas)
    .then(() => { canvas.dataset.rendered = '1'; })
    .catch(error => console.warn('[pdf-advanced] stable thumbnail render failed', error))
    .finally(() => { canvas.dataset.rendering = '0'; });
}

function ensureSingleThumbnail(item, page) {
  const allCanvases = [...item.querySelectorAll('canvas.page-sidebar-thumb')];
  let canvas = allCanvases.shift() || null;
  for (const extra of allCanvases) extra.remove();

  const allFrames = [...item.querySelectorAll('.page-thumb-frame')];
  let frame = allFrames.shift() || null;
  for (const extra of allFrames) {
    if (canvas && extra.contains(canvas)) continue;
    extra.remove();
  }

  if (!frame) {
    frame = document.createElement('div');
    frame.className = 'page-thumb-frame';
    frame.setAttribute('aria-hidden', 'true');
  }
  if (!canvas) {
    canvas = document.createElement('canvas');
    canvas.className = 'page-sidebar-thumb';
    canvas.setAttribute('aria-hidden', 'true');
  }

  const ratio = pageAspect(page);
  frame.style.setProperty('aspect-ratio', String(ratio), 'important');
  frame.dataset.pageAspect = ratio.toFixed(6);

  canvas.style.removeProperty('--advanced-thumb-ratio');
  canvas.style.removeProperty('aspect-ratio');
  canvas.style.removeProperty('width');
  canvas.style.removeProperty('height');
  canvas.style.removeProperty('min-height');
  canvas.style.removeProperty('max-height');
  delete canvas.dataset.aspectSynced;

  if (canvas.parentElement !== frame) frame.appendChild(canvas);
  if (item.firstElementChild !== frame) item.insertBefore(frame, item.firstElementChild);

  renderCanvas(page, canvas);
}

function normalizeListNow() {
  normalizeFrame = 0;
  const list = $('pageList');
  if (!list || normalizing) return;
  normalizing = true;
  observer?.disconnect();
  try {
    const validIds = new Set(advancedState.pages.map(page => String(page.id)));
    const seen = new Set();

    for (const child of [...list.children]) {
      if (!child.classList?.contains('page-item')) {
        child.remove();
        continue;
      }
      const id = String(child.dataset.pageId || '');
      if (!id || !validIds.has(id) || seen.has(id)) {
        child.remove();
        continue;
      }
      seen.add(id);
    }

    for (const item of [...list.querySelectorAll(':scope > .page-item')]) {
      const page = advancedState.pages.find(entry => String(entry.id) === String(item.dataset.pageId));
      if (!page) {
        item.remove();
        continue;
      }
      ensureSingleThumbnail(item, page);
    }

    // Any orphan thumbnail/canvas directly under the list is invalid and caused the old ghost first-page symptom.
    for (const node of [...list.querySelectorAll(':scope > canvas, :scope > .page-thumb-frame')]) node.remove();

    list.dataset.stablePageCount = String(list.querySelectorAll(':scope > .page-item').length);
  } finally {
    if (observer && list.isConnected) observer.observe(list, { childList: true });
    normalizing = false;
  }
}

function scheduleNormalize() {
  if (normalizeFrame) cancelAnimationFrame(normalizeFrame);
  normalizeFrame = requestAnimationFrame(() => requestAnimationFrame(normalizeListNow));
}

function install() {
  installStyles();
  const list = $('pageList');
  if (!list) return;

  observer = new MutationObserver(scheduleNormalize);
  observer.observe(list, { childList: true });

  window.addEventListener('pdf-advanced-state-change', scheduleNormalize);
  window.addEventListener('resize', scheduleNormalize);
  document.addEventListener('click', event => {
    if (event.target?.closest?.('.page-remove, #advancedPagesTab, #pairPrevBtn, #pairNextBtn')) scheduleNormalize();
  }, true);

  normalizeListNow();
  document.documentElement.dataset.pdfAdvancedPageListStability = 'v12';
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', install, { once: true });
else install();
