import { advancedState, selectedPage, isSheetLayoutMode } from './state.js';

const $ = id => document.getElementById(id);
let labelObserver = null;
let pageListObserver = null;
let trimSyncTimer = 0;

function installStyles() {
  if ($('pdfAdvancedPageSidebarV6Styles')) return;
  const style = document.createElement('style');
  style.id = 'pdfAdvancedPageSidebarV6Styles';
  style.textContent = `
    .advanced-page-sidebar #selectionLabel{display:none!important}
    .advanced-page-sidebar .page-sidebar-help{display:none!important}
    .advanced-page-sidebar .page-section{padding-top:8px!important}
    .advanced-page-sidebar .section-title-row{margin:0 2px 7px!important}
    .advanced-page-sidebar .page-section>.pair-nav{display:grid!important;grid-template-columns:1fr auto 1fr!important;align-items:center!important;gap:6px!important;margin:0 0 9px!important;padding:0!important}
    .advanced-page-sidebar .page-section>.pair-nav button{height:32px!important;width:100%!important;min-width:0!important;border-radius:8px!important}
    .advanced-page-sidebar .page-section>.pair-nav span{min-width:62px!important;text-align:center!important;font-size:10px!important;font-weight:850!important;color:#475569!important}
    .advanced-page-sidebar .workspace-toolbar>.pair-nav{display:none!important}

    .advanced-page-sidebar .page-list{display:grid!important;grid-template-columns:repeat(2,minmax(0,1fr))!important;align-content:start!important;gap:9px!important;padding:2px 2px 12px!important}
    .advanced-page-sidebar .page-item{position:relative!important;display:flex!important;flex-direction:column!important;align-items:stretch!important;min-width:0!important;min-height:0!important;padding:7px!important;gap:5px!important;border-radius:10px!important}
    .advanced-page-sidebar .page-item canvas.page-sidebar-thumb{order:1!important;display:block!important;width:100%!important;height:132px!important;object-fit:contain!important;background:#fff!important;border:1px solid #dfe5ec!important;border-radius:5px!important}
    .advanced-page-sidebar .page-item-info{order:2!important;display:block!important;width:100%!important;text-align:center!important;min-width:0!important}
    .advanced-page-sidebar .page-item-info strong{display:block!important;font-size:10px!important;line-height:1.35!important;color:#334155!important;font-weight:900!important}
    .advanced-page-sidebar .page-item-info span{display:none!important}
    .advanced-page-sidebar .page-remove{position:absolute!important;right:4px!important;top:4px!important;z-index:3!important;width:22px!important;height:22px!important;border-radius:999px!important;background:rgba(255,255,255,.94)!important;box-shadow:0 1px 4px rgba(15,23,42,.15)!important}
    .advanced-page-sidebar .page-item.selected{box-shadow:inset 0 0 0 2px #2563eb!important;background:#eff6ff!important}

    .advanced-size-guide.trim{border-style:solid!important}
    .advanced-trim-crop-mark{position:absolute!important;display:none;pointer-events:none;background:#111827!important;z-index:7!important}
    .advanced-size-guide.trim.crop-marks-visible .advanced-trim-crop-mark{display:block!important}
    .advanced-trim-crop-mark.h{height:1px!important;width:var(--crop-mark-length-x,14px)!important}
    .advanced-trim-crop-mark.v{width:1px!important;height:var(--crop-mark-length-y,14px)!important}
    .advanced-trim-crop-mark.tl-h{right:calc(100% + var(--crop-mark-gap-x,5px));top:-1px}
    .advanced-trim-crop-mark.tr-h{left:calc(100% + var(--crop-mark-gap-x,5px));top:-1px}
    .advanced-trim-crop-mark.bl-h{right:calc(100% + var(--crop-mark-gap-x,5px));bottom:-1px}
    .advanced-trim-crop-mark.br-h{left:calc(100% + var(--crop-mark-gap-x,5px));bottom:-1px}
    .advanced-trim-crop-mark.tl-v{bottom:calc(100% + var(--crop-mark-gap-y,5px));left:-1px}
    .advanced-trim-crop-mark.tr-v{bottom:calc(100% + var(--crop-mark-gap-y,5px));right:-1px}
    .advanced-trim-crop-mark.bl-v{top:calc(100% + var(--crop-mark-gap-y,5px));left:-1px}
    .advanced-trim-crop-mark.br-v{top:calc(100% + var(--crop-mark-gap-y,5px));right:-1px}

    @media(max-width:1180px){.advanced-page-sidebar .page-item canvas.page-sidebar-thumb{height:118px!important}}
    @media(max-width:900px){.advanced-page-sidebar .page-list{grid-template-columns:1fr!important}.advanced-page-sidebar .page-item canvas.page-sidebar-thumb{height:126px!important}}
    @media(max-width:720px){.advanced-page-sidebar .page-list{grid-template-columns:repeat(2,minmax(0,1fr))!important}.advanced-page-sidebar .page-item canvas.page-sidebar-thumb{height:140px!important}}
  `;
  document.head.appendChild(style);
}

function selectedIndex() {
  return advancedState.pages.findIndex(page => page.id === advancedState.selectedId);
}

function syncPageNavLabel() {
  const label = $('pairPageLabel');
  if (!label) return;
  const index = selectedIndex();
  const next = index >= 0 ? `${index + 1} / ${advancedState.pages.length}` : `0 / ${advancedState.pages.length}`;
  if (label.textContent !== next) label.textContent = next;
}

function movePageNavToListTop() {
  const section = document.querySelector('.advanced-page-sidebar .page-section');
  const nav = $('pairNav');
  const titleRow = section?.querySelector('.section-title-row');
  if (!section || !nav || !titleRow) return false;
  if (nav.parentElement !== section || nav.previousElementSibling !== titleRow) {
    titleRow.insertAdjacentElement('afterend', nav);
  }
  syncPageNavLabel();
  if (!labelObserver && $('pairPageLabel')) {
    labelObserver = new MutationObserver(syncPageNavLabel);
    labelObserver.observe($('pairPageLabel'), { childList: true, characterData: true, subtree: true });
  }
  return true;
}

function simplifyPageItems() {
  const list = $('pageList');
  if (!list) return;
  for (const item of list.querySelectorAll('.page-item')) {
    const info = item.querySelector('.page-item-info');
    const title = info?.querySelector('strong');
    if (info) info.querySelectorAll('span').forEach(node => node.remove());
    if (title) {
      const index = advancedState.pages.findIndex(page => String(page.id) === String(item.dataset.pageId));
      title.textContent = index >= 0 ? `${index + 1}페이지` : title.textContent;
    }
  }
}

function watchPageList() {
  const list = $('pageList');
  if (!list || pageListObserver) return;
  simplifyPageItems();
  pageListObserver = new MutationObserver(() => {
    simplifyPageItems();
    syncPageNavLabel();
  });
  pageListObserver.observe(list, { childList: true, subtree: true });
}

function ensureTrimCropMarks() {
  const guide = $('advancedTrimGuide');
  if (!guide) return null;
  const classes = ['tl-h','tr-h','bl-h','br-h','tl-v','tr-v','bl-v','br-v'];
  for (const name of classes) {
    if (guide.querySelector(`.advanced-trim-crop-mark.${name}`)) continue;
    const mark = document.createElement('i');
    mark.className = `advanced-trim-crop-mark ${name.endsWith('-h') ? 'h' : 'v'} ${name}`;
    mark.setAttribute('aria-hidden', 'true');
    guide.appendChild(mark);
  }
  return guide;
}

function syncTrimStateFromInspector() {
  window.clearTimeout(trimSyncTimer);
  trimSyncTimer = window.setTimeout(() => {
    const width = Number($('advancedTrimWidth')?.value || 0);
    const height = Number($('advancedTrimHeight')?.value || 0);
    if (!advancedState.paper || typeof advancedState.paper !== 'object') return;
    if (width > 0 && height > 0 && advancedState.paper.trimMode === 'manual') {
      advancedState.paper.trimWidthMm = width;
      advancedState.paper.trimHeightMm = height;
    }
    syncCropMarks();
  }, 0);
}

function syncCropMarks() {
  const guide = ensureTrimCropMarks();
  if (!guide) return;
  const width = Number($('advancedTrimWidth')?.value || 0);
  const height = Number($('advancedTrimHeight')?.value || 0);
  const visible = !!advancedState.paper?.cropMarks && isSheetLayoutMode() && width > 0 && height > 0 && !guide.hidden;
  guide.classList.toggle('crop-marks-visible', visible);
  if (!visible) return;

  const pxPerMmX = guide.clientWidth / Math.max(1, width);
  const pxPerMmY = guide.clientHeight / Math.max(1, height);
  guide.style.setProperty('--crop-mark-gap-x', `${Math.max(2, pxPerMmX * 2)}px`);
  guide.style.setProperty('--crop-mark-gap-y', `${Math.max(2, pxPerMmY * 2)}px`);
  guide.style.setProperty('--crop-mark-length-x', `${Math.max(8, pxPerMmX * 5)}px`);
  guide.style.setProperty('--crop-mark-length-y', `${Math.max(8, pxPerMmY * 5)}px`);
}

function bindTrimInputs() {
  document.addEventListener('input', event => {
    if (event.target?.id !== 'advancedTrimWidth' && event.target?.id !== 'advancedTrimHeight') return;
    if (!advancedState.paper || typeof advancedState.paper !== 'object') return;
    advancedState.paper.trimMode = 'manual';
    advancedState.paper.trimWidthMm = Number($('advancedTrimWidth')?.value || 0);
    advancedState.paper.trimHeightMm = Number($('advancedTrimHeight')?.value || 0);
    syncCropMarks();
  });
  document.addEventListener('click', event => {
    if (event.target?.id !== 'advancedTrimAuto') return;
    if (!advancedState.paper || typeof advancedState.paper !== 'object') return;
    advancedState.paper.trimMode = 'auto';
    advancedState.paper.trimWidthMm = 0;
    advancedState.paper.trimHeightMm = 0;
    window.setTimeout(syncCropMarks, 20);
  });
}

function install() {
  installStyles();
  watchPageList();
  bindTrimInputs();
  if (!movePageNavToListTop()) {
    let tries = 0;
    const timer = window.setInterval(() => {
      tries += 1;
      if (movePageNavToListTop() || tries >= 80) window.clearInterval(timer);
    }, 50);
  }
  window.addEventListener('pdf-advanced-state-change', () => {
    window.setTimeout(() => {
      movePageNavToListTop();
      simplifyPageItems();
      syncPageNavLabel();
      syncTrimStateFromInspector();
      syncCropMarks();
    }, 0);
  });
  window.addEventListener('resize', syncCropMarks);
  $('pageList')?.addEventListener('click', () => window.setTimeout(() => {
    syncPageNavLabel();
    syncCropMarks();
  }, 30));
  document.documentElement.dataset.pdfAdvancedPageSidebar = 'workspace-v6';
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', install, { once: true });
else install();
