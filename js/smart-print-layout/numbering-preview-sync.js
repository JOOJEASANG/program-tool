(() => {
  'use strict';
  if (window.__smartPrintNumberingPreviewSyncV1) return;
  window.__smartPrintNumberingPreviewSyncV1 = true;

  const $ = id => document.getElementById(id);
  const KOREAN_STACK = '"Malgun Gothic","Apple SD Gothic Neo","Noto Sans KR",Arial,sans-serif';
  const WATCHED_CONTROLS = new Set([
    'numberingEnabled', 'numberingStart', 'numberingEnd', 'numberingPrefix',
    'numberingFormat', 'numberingPosition', 'numberingFont', 'numberingFontSize',
    'numberingTransparent', 'numberingMarginX', 'numberingMarginY',
  ]);
  let frame = 0;
  let shellObserver = null;

  const numberValue = (id, fallback, min, max) => {
    const value = Number($(id)?.value);
    if (!Number.isFinite(value)) return fallback;
    return Math.min(max, Math.max(min, value));
  };

  function hasKorean(text) {
    return /[\u1100-\u11ff\u3130-\u318f\ua960-\ua97f\uac00-\ud7a3\ud7b0-\ud7ff]/u.test(String(text || ''));
  }

  function formatNumber(value) {
    const format = $('numberingFormat')?.value || 'pad3';
    let number;
    if (format === 'plain') number = String(value);
    else if (format === 'no-pad3') number = `NO.${String(value).padStart(3, '0')}`;
    else number = String(value).padStart(3, '0');
    const prefix = String($('numberingPrefix')?.value || '').trim();
    return prefix ? `${prefix} ${number}` : number;
  }

  function mirrorBack(placement, cfg) {
    const portrait = cfg.paperH >= cfg.paperW;
    const mirrorX = (cfg.flipEdge === 'long' && portrait) || (cfg.flipEdge === 'short' && !portrait);
    return mirrorX
      ? { ...placement, x: cfg.paperW - placement.x - placement.width }
      : { ...placement, y: cfg.paperH - placement.y - placement.height };
  }

  function applyPosition(element, placement, scale, position, marginX, marginY) {
    const left = placement.x * scale;
    const top = placement.y * scale;
    const width = placement.width * scale;
    const height = placement.height * scale;
    const insetX = marginX * scale;
    const insetY = marginY * scale;

    element.style.margin = '0';
    if (position === 'top-left') {
      element.style.left = `${left + insetX}px`;
      element.style.top = `${top + insetY}px`;
      element.style.transform = 'none';
    } else if (position === 'top-center') {
      element.style.left = `${left + width / 2}px`;
      element.style.top = `${top + insetY}px`;
      element.style.transform = 'translateX(-50%)';
    } else if (position === 'top-right') {
      element.style.left = `${left + width - insetX}px`;
      element.style.top = `${top + insetY}px`;
      element.style.transform = 'translateX(-100%)';
    } else if (position === 'bottom-left') {
      element.style.left = `${left + insetX}px`;
      element.style.top = `${top + height - insetY}px`;
      element.style.transform = 'translateY(-100%)';
    } else if (position === 'bottom-center') {
      element.style.left = `${left + width / 2}px`;
      element.style.top = `${top + height - insetY}px`;
      element.style.transform = 'translate(-50%,-100%)';
    } else {
      element.style.left = `${left + width - insetX}px`;
      element.style.top = `${top + height - insetY}px`;
      element.style.transform = 'translate(-100%,-100%)';
    }
  }

  function updateHint() {
    const hint = document.querySelector('#numberingOptions .hint');
    if (!hint) return;
    hint.textContent = '문구와 번호 사이는 자동으로 한 칸 띄웁니다. 좌우·상하 여백으로 넘버링 위치를 조절하며, 한글 문구는 저장 PDF에서도 자동으로 한국어 글꼴로 처리합니다. 양면은 앞·뒤에 같은 번호가 들어갑니다.';
  }

  function syncPreview() {
    const overlay = $('numberingPreviewOverlay');
    const canvas = $('layoutCanvas');
    const api = window.SmartPrintLayout;
    const plan = api?.state?.plan;
    if (!overlay || !canvas || !plan?.cfg || !$('numberingEnabled')?.checked) return;

    const labels = Array.from(overlay.querySelectorAll('.numbering-preview-label'));
    if (!labels.length) return;
    const cfg = plan.cfg;
    const scale = canvas.clientWidth / Number(cfg.paperW || 1);
    if (!Number.isFinite(scale) || scale <= 0) return;

    const sheetIndex = Number(api.state.sheetIndex || 0);
    const sheet = plan.sheets?.[sheetIndex] || [];
    const sequenceOffset = (plan.sheets || []).slice(0, sheetIndex)
      .reduce((sum, entries) => sum + (entries?.length || 0), 0);
    const start = Math.round(numberValue('numberingStart', 1, 0, 9_999_999));
    const rawEnd = String($('numberingEnd')?.value || '').trim();
    const end = rawEnd === '' ? null : Math.round(numberValue('numberingEnd', start, 0, 9_999_999));
    const position = $('numberingPosition')?.value || 'bottom-right';
    const marginX = numberValue('numberingMarginX', 1.5, 0, 50);
    const marginY = numberValue('numberingMarginY', 1.5, 0, 50);
    const prefix = String($('numberingPrefix')?.value || '').trim();

    let labelIndex = 0;
    sheet.forEach((frontPlacement, index) => {
      const value = start + sequenceOffset + index;
      if (end != null && value > end) return;
      const element = labels[labelIndex++];
      if (!element) return;
      const placement = api.state.side === 'back' ? mirrorBack(frontPlacement, cfg) : frontPlacement;
      const text = formatNumber(value);
      if (element.textContent !== text) element.textContent = text;
      if (hasKorean(prefix) || hasKorean(text)) element.style.fontFamily = KOREAN_STACK;
      applyPosition(element, placement, scale, position, marginX, marginY);
    });
  }

  function schedule() {
    cancelAnimationFrame(frame);
    frame = requestAnimationFrame(() => requestAnimationFrame(syncPreview));
  }

  function bind() {
    updateHint();
    const shell = $('canvasShell');
    if (shell && typeof MutationObserver === 'function') {
      shellObserver = new MutationObserver(schedule);
      shellObserver.observe(shell, { childList: true, subtree: true });
    }
    document.addEventListener('input', event => {
      if (WATCHED_CONTROLS.has(event.target?.id)) schedule();
    }, true);
    document.addEventListener('change', event => {
      if (WATCHED_CONTROLS.has(event.target?.id)) schedule();
    }, true);
    ['prevSheet', 'nextSheet', 'frontBtn', 'backBtn', 'resetBtn'].forEach(id => {
      $(id)?.addEventListener('click', schedule);
    });
    window.addEventListener('resize', schedule);
    schedule();
    document.documentElement.dataset.smartLayoutNumberingPreviewSync = 'v1-position-font-safe';
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', bind, { once: true });
  else bind();
})();
