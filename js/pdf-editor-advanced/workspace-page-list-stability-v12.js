import { advancedState } from './state.js';
import { renderThumbnail } from './preview.js';

const $ = id => document.getElementById(id);
let observer = null;
let thumbnailObserver = null;
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

function observeCanvas(page, canvas) {
  if (!page || !canvas) return;
  if (!('IntersectionObserver' in window)) {
    renderCanvas(page, canvas);
    return;
  }
  if (!thumbnailObserver) {
    thumbnailObserver = new IntersectionObserver(entries => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        const item = entry.target.closest('.page-item');
        const targetPage = advancedState.pages.find(candidate => String(candidate.id) === String(item?.dataset.pageId));
        if (targetPage) renderCanvas(targetPage, entry.target);
      }
    }, { root: $('pageList'), rootMargin: '240px 0px' });
  }
  thumbnailObserver.observe(canvas);
}

function ensureSingleThumbnail(item, page) {
  const allCanvases = [...item.querySelectorAll('canvas.page-sidebar-thumb')];
  let canvas = allCanvases.shift() || null;
  for (const extra of allCanvases) {
    thumbnailObserver?.unobserve(extra);
    extra.remove();
  }

  const allFrames = [...item.querySelectorAll('.page-thumb-frame')];
  let frame = (canvas && allFrames.find(candidate => candidate.contains(canvas))) || allFrames[0] || null;
  for (const extra of allFrames) {
    if (extra !== frame) extra.remove();
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

  observeCanvas(page, canvas);
}

function syncPageNavLabel() {
  const label = $('pairPageLabel');
  if (!label) return;
  const index = advancedState.pages.findIndex(page => page.id === advancedState.selectedId);
  label.textContent = index >= 0 ? `${index + 1} / ${advancedState.pages.length}` : `0 / ${advancedState.pages.length}`;
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
        child.querySelectorAll?.('canvas.page-sidebar-thumb').forEach(canvas => thumbnailObserver?.unobserve(canvas));
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

    // Old async thumbnail patches could leave a detached first-page canvas at the end of the list.
    for (const node of [...list.querySelectorAll(':scope > canvas, :scope > .page-thumb-frame')]) node.remove();

    list.dataset.stablePageCount = String(list.querySelectorAll(':scope > .page-item').length);
    syncPageNavLabel();
  } finally {
    if (observer && list.isConnected) observer.observe(list, { childList: true });
    normalizing = false;
  }
}

function scheduleNormalize() {
  if (normalizeFrame) cancelAnimationFrame(normalizeFrame);
  normalizeFrame = requestAnimationFrame(() => requestAnimationFrame(normalizeListNow));
}

function replaceLegacyObservedList() {
  const legacy = $('pageList');
  if (!legacy || legacy.dataset.stabilityOwner === 'v12') return legacy;
  const fresh = legacy.cloneNode(false);
  fresh.dataset.stabilityOwner = 'v12';
  legacy.replaceWith(fresh);
  return fresh;
}

function install() {
  installStyles();
  const list = replaceLegacyObservedList();
  if (!list) return;

  // v4's page-list MutationObserver and IntersectionObserver remain attached to the detached legacy node.
  // v12 is the only module that owns the live #pageList from this point onward.
  observer = new MutationObserver(scheduleNormalize);
  observer.observe(list, { childList: true });

  list.addEventListener('click', () => {
    window.setTimeout(() => {
      syncPageNavLabel();
      window.dispatchEvent(new Event('resize'));
      scheduleNormalize();
    }, 0);
  });
  window.addEventListener('pdf-advanced-state-change', scheduleNormalize);
  window.addEventListener('resize', scheduleNormalize);
  document.addEventListener('click', event => {
    if (event.target?.closest?.('#advancedPagesTab, #pairPrevBtn, #pairNextBtn')) scheduleNormalize();
  }, true);

  normalizeListNow();
  document.documentElement.dataset.pdfAdvancedPageListStability = 'v12';
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', install, { once: true });
else install();
