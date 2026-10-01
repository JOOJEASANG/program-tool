import { advancedState, isSheetLayoutMode } from './state.js';

const $ = id => document.getElementById(id);
let navRetryTimer = 0;
let cropSyncFrame = 0;

function installStyles() {
  if ($('pdfAdvancedPageSidebarV7Styles')) return;
  const style = document.createElement('style');
  style.id = 'pdfAdvancedPageSidebarV7Styles';
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
  label.textContent = index >= 0 ? `${index + 1} / ${advancedState.pages.length}` : `0 / ${advancedState.pages.length}`;
}

function movePageNavToListTop() {
  const section = document.querySelector('.advanced-page-sidebar .page-section');
  const nav = $('pairNav');
  const titleRow = section?.querySelector('.section-title-row');
  if (!section || !nav || !titleRow) return false;
  if (nav.parentElement !== section || nav.previousElementSibling !== titleRow) titleRow.insertAdjacentElement('afterend', nav);
  syncPageNavLabel();
  return true;
}

function ensureNavSoon() {
  window.clearTimeout(navRetryTimer);
  let tries = 0;
  const tryMove = () => {
    tries += 1;
    if (movePageNavToListTop() || tries >= 30) return;
    navRetryTimer = window.setTimeout(tryMove, 50);
  };
  tryMove();
}

function ensureTrimCropMarks() {
  const guide = $('advancedTrimGuide');
  if (!guide) return null;
  for (const name of ['tl-h','tr-h','bl-h','br-h','tl-v','tr-v','bl-v','br-v']) {
    if (guide.querySelector(`.advanced-trim-crop-mark.${name}`)) continue;
    const mark = document.createElement('i');
    mark.className = `advanced-trim-crop-mark ${name.endsWith('-h') ? 'h' : 'v'} ${name}`;
    mark.setAttribute('aria-hidden', 'true');
    guide.appendChild(mark);
  }
  return guide;
}

function syncCropMarksNow() {
  cropSyncFrame = 0;
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

function scheduleCropMarks() {
  if (cropSyncFrame) cancelAnimationFrame(cropSyncFrame);
  cropSyncFrame = requestAnimationFrame(() => requestAnimationFrame(syncCropMarksNow));
}

function bindTrimInputs() {
  document.addEventListener('input', event => {
    if (event.target?.id !== 'advancedTrimWidth' && event.target?.id !== 'advancedTrimHeight') return;
    if (!advancedState.paper || typeof advancedState.paper !== 'object') return;
    advancedState.paper.trimMode = 'manual';
    advancedState.paper.trimWidthMm = Number($('advancedTrimWidth')?.value || 0);
    advancedState.paper.trimHeightMm = Number($('advancedTrimHeight')?.value || 0);
    scheduleCropMarks();
  });
  document.addEventListener('click', event => {
    if (event.target?.id !== 'advancedTrimAuto') return;
    if (!advancedState.paper || typeof advancedState.paper !== 'object') return;
    advancedState.paper.trimMode = 'auto';
    advancedState.paper.trimWidthMm = 0;
    advancedState.paper.trimHeightMm = 0;
    window.setTimeout(scheduleCropMarks, 40);
  });
}

function install() {
  installStyles();
  bindTrimInputs();
  ensureNavSoon();
  window.addEventListener('pdf-advanced-state-change', () => {
    ensureNavSoon();
    window.setTimeout(syncPageNavLabel, 90);
    scheduleCropMarks();
  });
  $('pageList')?.addEventListener('click', () => {
    window.setTimeout(syncPageNavLabel, 90);
    scheduleCropMarks();
  });
  window.addEventListener('resize', scheduleCropMarks);
  document.documentElement.dataset.pdfAdvancedPageSidebar = 'workspace-v7';
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', install, { once: true });
else install();
