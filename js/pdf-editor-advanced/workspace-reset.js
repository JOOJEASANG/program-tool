import { advancedState, clearHistory, emitStateChange } from './state.js';

const $ = id => document.getElementById(id);

const DEFAULT_PAPER = {
  preset: 'original',
  customWidthMm: 210,
  customHeightMm: 297,
  landscape: false,
  cropMarks: false,
};
const DEFAULT_MARGINS = { left: 0, right: 0, top: 0, bottom: 0, facingPages: false };
const DEFAULT_HEADER_FOOTER = {
  enabled: false,
  headerLeft: '', headerCenter: '', headerRight: '',
  footerLeft: '', footerCenter: '', footerRight: '',
  fontSize: 10,
  color: '#333333',
  margin: 8,
};
const DEFAULT_PAGE_NUMBERS = {
  enabled: false,
  position: 'bottom-center',
  format: '1',
  start: 1,
  fontSize: 10,
  color: '#333333',
  margin: 5,
  excludeFirst: false,
};

function setValue(id, value) {
  const node = $(id);
  if (node) node.value = String(value);
}

function syncControls() {
  setValue('marginLeft', 0);
  setValue('marginRight', 0);
  setValue('marginTop', 0);
  setValue('marginBottom', 0);
  if ($('facingPages')) $('facingPages').checked = false;

  if ($('hfEnabled')) $('hfEnabled').checked = false;
  $('hfOptions')?.classList.add('disabled-block');
  setValue('headerLeft', '');
  setValue('headerCenter', '');
  setValue('headerRight', '');
  setValue('footerLeft', '');
  setValue('footerCenter', '');
  setValue('footerRight', '');
  setValue('hfFontSize', 10);
  setValue('hfColor', '#333333');
  setValue('hfMargin', 8);

  if ($('pnEnabled')) $('pnEnabled').checked = false;
  $('pnOptions')?.classList.add('disabled-block');
  setValue('pnPosition', 'bottom-center');
  setValue('pnFormat', '1');
  setValue('pnStart', 1);
  setValue('pnFontSize', 10);
  setValue('pnColor', '#333333');
  setValue('pnMargin', 5);
  if ($('pnExcludeFirst')) $('pnExcludeFirst').checked = false;

  setValue('scaleRange', 100);
  setValue('offsetXRange', 0);
  setValue('offsetYRange', 0);
  setValue('cropLeft', 0);
  setValue('cropTop', 0);
  setValue('cropRight', 0);
  setValue('cropBottom', 0);
  if ($('scaleValue')) $('scaleValue').textContent = '100%';
  if ($('offsetXValue')) $('offsetXValue').textContent = '0.0 mm';
  if ($('offsetYValue')) $('offsetYValue').textContent = '0.0 mm';
  if ($('zoomLabel')) $('zoomLabel').textContent = '맞춤';
  if ($('eraseModeBtn')) {
    $('eraseModeBtn').classList.remove('active');
    $('eraseModeBtn').textContent = '부분 지우기';
  }
  $('pageStage')?.classList.remove('erase-active');
}

function resetPage(page) {
  page.rotation = ((Number(page.intrinsicRotation || 0) % 360) + 360) % 360;
  page.fineRotation = 0;
  page.crop = { left: 0, top: 0, right: 0, bottom: 0 };
  page.eraseRegions = [];
  page.overlays = [];
  page.scale = 1;
  page.offsetX = 0;
  page.offsetY = 0;
}

function setStatus(message) {
  const status = $('statusLine');
  if (!status) return;
  status.textContent = message;
  status.style.color = '#166534';
}

function resetWorkspace() {
  if (!advancedState.pages.length || advancedState.busy) return;
  if (!window.confirm('불러온 PDF는 그대로 두고 모든 편집 내용과 출력 설정을 초기화할까요?')) return;

  advancedState.pages.forEach(resetPage);
  Object.assign(advancedState.paper, DEFAULT_PAPER);
  Object.assign(advancedState.margins, DEFAULT_MARGINS);
  Object.assign(advancedState.headerFooter, DEFAULT_HEADER_FOOTER);
  Object.assign(advancedState.pageNumbers, DEFAULT_PAGE_NUMBERS);
  advancedState.eraseMode = false;
  advancedState.zoom = 1;
  clearHistory();
  syncControls();
  emitStateChange('workspace-reset');
  window.PdfAdvancedPageOverlays?.render?.();
  window.dispatchEvent(new Event('resize'));
  setStatus('PDF 원본은 유지하고 편집 내용과 출력 설정을 초기화했습니다.');
}

function install() {
  if ($('advancedWorkspaceResetBtn')) return;
  const clear = $('clearAllBtn');
  if (!clear) return;

  const button = document.createElement('button');
  button.id = 'advancedWorkspaceResetBtn';
  button.type = 'button';
  button.className = 'secondary-btn';
  button.textContent = '편집 초기화';
  button.title = '불러온 PDF는 유지하고 편집 내용과 출력 설정만 원래 상태로 되돌립니다.';
  clear.insertAdjacentElement('afterend', button);
  button.addEventListener('click', resetWorkspace);

  const syncDisabled = () => {
    button.disabled = Boolean(clear.disabled) || advancedState.busy || !advancedState.pages.length;
  };
  new MutationObserver(syncDisabled).observe(clear, { attributes: true, attributeFilter: ['disabled'] });
  window.addEventListener('pdf-advanced-state-change', syncDisabled);
  syncDisabled();

  document.documentElement.dataset.pdfAdvancedWorkspaceReset = 'ready';
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', install, { once: true });
else install();
