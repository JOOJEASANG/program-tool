(() => {
  'use strict';
  if (window.__smartPrintDuplexPreviewV2) return;
  window.__smartPrintDuplexPreviewV2 = true;

  const $ = id => document.getElementById(id);
  let frame = 0;

  function injectStyles() {
    if ($('smartDuplexPreviewStylesV2')) return;
    const style = document.createElement('style');
    style.id = 'smartDuplexPreviewStylesV2';
    style.textContent = `
      #layoutCanvasBack,#duplexBackOverlay,#duplexFrontLabel,#duplexBackLabel{display:none!important}
      .canvas-shell.duplex-preview-active{display:flex!important;align-items:center!important;justify-content:center!important;gap:0!important;padding-top:12px!important}
      .canvas-shell.duplex-preview-active #layoutCanvas{display:block;max-width:none;max-height:none}
      .preview-controls.duplex-preview-mode .side-btn,.preview-controls.duplex-preview-mode .divider{display:inline-flex!important}
      .preview-controls.duplex-preview-mode::after{content:none!important;display:none!important}
    `;
    document.head.appendChild(style);
  }

  function applyA4Default() {
    if (document.documentElement.dataset.smartLayoutA4DefaultApplied === '1') return;
    const preset = $('paperPreset');
    const width = $('paperWidth');
    const height = $('paperHeight');
    if (!preset || !width || !height) return;
    preset.value = 'a4';
    width.value = '210';
    height.value = '297';
    document.documentElement.dataset.smartLayoutA4DefaultApplied = '1';
    preset.dispatchEvent(new Event('change', { bubbles: true }));
  }

  function cleanupLegacyDualPreview() {
    const shell = $('canvasShell');
    shell?.classList.remove('duplex-preview-active');
    document.querySelector('.preview-controls')?.classList.remove('duplex-preview-mode');
    ['layoutCanvasBack', 'duplexBackOverlay', 'duplexFrontLabel', 'duplexBackLabel'].forEach(id => $(id)?.remove());
  }

  function syncCopy() {
    const copy = document.querySelector('.workspace-head p');
    if (copy) copy.textContent = '단면과 양면 모두 같은 크기의 중앙 미리보기를 사용합니다. 양면은 앞면·뒷면 버튼으로 선택해 확인하며 재단선과 넘버링도 선택한 면에 맞춰 표시됩니다.';
  }

  function sync() {
    injectStyles();
    cleanupLegacyDualPreview();
    syncCopy();
    const api = window.SmartPrintLayout;
    const plan = api?.state?.plan;
    const front = $('frontBtn');
    const back = $('backBtn');
    if (front) front.hidden = false;
    if (back) {
      back.hidden = false;
      back.disabled = !plan?.duplex;
    }
    window.SmartPrintLayoutEnhancements?.scheduleOverlay?.();
    document.documentElement.dataset.smartLayoutDuplexPreview = 'v2-selected-side-centered';
  }

  function schedule() {
    cancelAnimationFrame(frame);
    frame = requestAnimationFrame(() => requestAnimationFrame(sync));
  }

  function bind() {
    injectStyles();
    applyA4Default();
    cleanupLegacyDualPreview();
    syncCopy();
    document.addEventListener('input', event => {
      if (event.target?.closest?.('.sidebar')) schedule();
    }, true);
    document.addEventListener('change', event => {
      if (event.target?.closest?.('.sidebar')) schedule();
    }, true);
    ['prevSheet', 'nextSheet', 'frontBtn', 'backBtn', 'resetBtn'].forEach(id => $(id)?.addEventListener('click', schedule));
    window.addEventListener('resize', schedule);
    schedule();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', bind, { once: true });
  else bind();
})();