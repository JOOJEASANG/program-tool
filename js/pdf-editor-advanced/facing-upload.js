import { advancedState, checkpoint, emitStateChange } from './state.js';
import './workspace-v2.js';

const $ = id => document.getElementById(id);

function syncFacingUi() {
  const checkbox = $('facingPages');
  if (!checkbox) return;
  checkbox.checked = !!advancedState.margins.facingPages;
  const left = Number(advancedState.margins.left || 0);
  const right = Number(advancedState.margins.right || 0);
  const hint = $('facingHint');
  if (hint) {
    hint.textContent = Math.abs(left - right) < 1e-9
      ? '현재 좌·우 여백이 같아 반전해도 배치가 동일합니다.'
      : '짝수 페이지에서 왼쪽·오른쪽 여백을 서로 반전합니다.';
  }
}

function bindUploadDropzone() {
  const zone = $('uploadBtn');
  const input = $('fileInput');
  if (!zone || !input) return;

  const clearDrag = () => zone.classList.remove('drag-over');
  for (const type of ['dragenter', 'dragover']) {
    zone.addEventListener(type, event => {
      event.preventDefault();
      event.stopPropagation();
      if (!zone.disabled) zone.classList.add('drag-over');
    });
  }
  for (const type of ['dragleave', 'dragend']) {
    zone.addEventListener(type, event => {
      event.preventDefault();
      event.stopPropagation();
      clearDrag();
    });
  }
  zone.addEventListener('drop', event => {
    event.preventDefault();
    event.stopPropagation();
    clearDrag();
    if (zone.disabled) return;
    const pdfFiles = [...(event.dataTransfer?.files || [])].filter(file =>
      file.type === 'application/pdf' || String(file.name || '').toLowerCase().endsWith('.pdf')
    );
    if (!pdfFiles.length || typeof DataTransfer !== 'function') return;
    const transfer = new DataTransfer();
    for (const file of pdfFiles) transfer.items.add(file);
    input.files = transfer.files;
    input.dispatchEvent(new Event('change', { bubbles: true }));
  });
}

function bindFacingPages() {
  const checkbox = $('facingPages');
  if (!checkbox) return;
  checkbox.addEventListener('change', () => {
    checkpoint('양면 마주보기');
    advancedState.margins.facingPages = checkbox.checked;
    emitStateChange('facing-pages');
    window.dispatchEvent(new Event('resize'));
    syncFacingUi();
  });
  for (const id of ['marginLeft', 'marginRight']) {
    $(id)?.addEventListener('input', syncFacingUi);
    $(id)?.addEventListener('change', syncFacingUi);
  }
  window.addEventListener('pdf-advanced-state-change', syncFacingUi);
  syncFacingUi();
}

bindUploadDropzone();
bindFacingPages();
document.documentElement.dataset.pdfAdvancedUploadFacing = '1';
