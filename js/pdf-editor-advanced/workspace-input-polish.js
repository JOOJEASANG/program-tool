import { advancedState, emitStateChange } from './state.js';

const $ = id => document.getElementById(id);
let stickyErase = false;
let dropDepth = 0;
let observer = null;
let syncTimer = 0;

function pdfFiles(fileList) {
  return [...(fileList || [])].filter(file =>
    String(file?.type || '').toLowerCase() === 'application/pdf' || /\.pdf$/i.test(String(file?.name || ''))
  );
}

function installStyles() {
  if ($('pdfAdvancedWorkspaceInputPolishStylesV1')) return;
  const style = document.createElement('style');
  style.id = 'pdfAdvancedWorkspaceInputPolishStylesV1';
  style.textContent = `
    #previewScroll.pdf-advanced-file-drop-active{
      outline:3px solid rgba(37,99,235,.48);
      outline-offset:-6px;
      background:#eaf2fb;
    }
  `;
  document.head.appendChild(style);
}

function syncEraseVisuals() {
  const button = $('eraseModeBtn');
  const stage = $('pageStage');
  if (button) {
    button.classList.toggle('active', !!advancedState.eraseMode);
    button.textContent = advancedState.eraseMode ? '부분 지우기 종료' : '부분 지우기';
  }
  stage?.classList.toggle('erase-active', !!advancedState.eraseMode);
  document.documentElement.dataset.pdfAdvancedEraseSticky = stickyErase ? 'true' : 'false';
}

function ensureStickyErase() {
  if (!stickyErase || !advancedState.pages.length || !advancedState.selectedId) return;
  if (!advancedState.eraseMode) {
    advancedState.eraseMode = true;
    syncEraseVisuals();
    emitStateChange('erase-sticky-page-navigation');
  } else syncEraseVisuals();
}

function syncAutoAlignAvailability() {
  const button = $('autoAlignAllBtn');
  if (!button) return;
  button.disabled = !!advancedState.busy || advancedState.pages.length === 0;
  button.title = advancedState.pages.length
    ? '모든 페이지의 방향과 텍스트 기울기를 자동으로 보정합니다.'
    : 'PDF를 불러오면 사용할 수 있습니다.';
}

function scheduleSync() {
  if (syncTimer) clearTimeout(syncTimer);
  syncTimer = window.setTimeout(() => {
    syncTimer = 0;
    syncAutoAlignAvailability();
    if (stickyErase) ensureStickyErase();
  }, 0);
}

function assignFilesToInput(input, files) {
  if (!input || !files.length) return false;
  try {
    const transfer = new DataTransfer();
    files.forEach(file => transfer.items.add(file));
    input.files = transfer.files;
    return true;
  } catch (_) {
    try {
      input.files = files;
      return true;
    } catch (_) {
      return false;
    }
  }
}

function bindWorkspaceDrop() {
  const zone = $('previewScroll');
  const input = $('fileInput');
  if (!zone || !input || zone.dataset.workspacePdfDropBound === '1') return;
  zone.dataset.workspacePdfDropBound = '1';

  const isFileDrag = event => [...(event.dataTransfer?.types || [])].includes('Files');
  const clearDropState = () => {
    dropDepth = 0;
    zone.classList.remove('pdf-advanced-file-drop-active');
  };

  zone.addEventListener('dragenter', event => {
    if (!isFileDrag(event) || advancedState.busy) return;
    event.preventDefault();
    dropDepth += 1;
    zone.classList.add('pdf-advanced-file-drop-active');
  });
  zone.addEventListener('dragover', event => {
    if (!isFileDrag(event) || advancedState.busy) return;
    event.preventDefault();
    if (event.dataTransfer) event.dataTransfer.dropEffect = 'copy';
    zone.classList.add('pdf-advanced-file-drop-active');
  });
  zone.addEventListener('dragleave', event => {
    if (!isFileDrag(event)) return;
    dropDepth = Math.max(0, dropDepth - 1);
    if (!dropDepth) zone.classList.remove('pdf-advanced-file-drop-active');
  });
  zone.addEventListener('drop', event => {
    if (!isFileDrag(event) || advancedState.busy) return;
    event.preventDefault();
    event.stopPropagation();
    clearDropState();
    const incoming = pdfFiles(event.dataTransfer?.files);
    if (!incoming.length) {
      const status = $('statusLine');
      if (status) {
        status.textContent = 'PDF 파일만 미리보기 영역에 끌어다 놓을 수 있습니다.';
        status.dataset.level = 'error';
      }
      return;
    }
    if (!assignFilesToInput(input, incoming)) {
      $('uploadBtn')?.focus();
      return;
    }
    input.dispatchEvent(new Event('change', { bubbles: true }));
  });
  window.addEventListener('dragend', clearDropState);
  window.addEventListener('drop', () => setTimeout(clearDropState, 0));
}

function bindStickyErase() {
  if (document.documentElement.dataset.pdfAdvancedStickyEraseBound === '1') return;
  document.documentElement.dataset.pdfAdvancedStickyEraseBound = '1';

  document.addEventListener('click', event => {
    const eraseButton = event.target?.closest?.('#eraseModeBtn');
    if (eraseButton) {
      setTimeout(() => {
        stickyErase = !!advancedState.eraseMode;
        syncEraseVisuals();
      }, 0);
      return;
    }

    if (!stickyErase) return;
    const pageNavigation = event.target?.closest?.(
      '#pageList .page-item,#pairPrevBtn,#pairNextBtn,#companionStage,[data-page-id].companion-page-stage'
    );
    if (pageNavigation) setTimeout(ensureStickyErase, 0);
  }, true);

  window.addEventListener('pdf-advanced-state-change', event => {
    const reason = String(event?.detail?.reason || '');
    if (reason === 'reset') {
      stickyErase = false;
      syncEraseVisuals();
    } else if (stickyErase) {
      setTimeout(ensureStickyErase, 0);
    }
    scheduleSync();
  });
}

function installObserver() {
  if (observer || typeof MutationObserver !== 'function') return;
  const root = document.querySelector('.advanced-app');
  if (!root) return;
  observer = new MutationObserver(scheduleSync);
  observer.observe(root, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ['hidden', 'disabled', 'class']
  });
}

function boot() {
  installStyles();
  bindWorkspaceDrop();
  bindStickyErase();
  installObserver();
  scheduleSync();
  for (const delay of [120, 360, 800, 1500]) setTimeout(() => {
    bindWorkspaceDrop();
    syncAutoAlignAvailability();
  }, delay);
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once: true });
else boot();

window.PdfAdvancedWorkspaceInputPolish = {
  syncAutoAlignAvailability,
  ensureStickyErase,
  stage: 'preview-drop-auto-align-erase-sticky-v1'
};
