/* file-relative-preview.js — 인쇄물 사전 검토 미리보기 이동을 첨부 파일 기준으로 유지 */
(function () {
  'use strict';

  if (window.__printCheckerFileRelativePreviewV1) return;
  window.__printCheckerFileRelativePreviewV1 = true;

  const byId = (id) => document.getElementById(id);
  const AXIS_LIMIT = 25;
  const AXIS_STEP = 0.5;

  let xPercent = 0;
  let yPercent = 0;
  let sourceX = null;
  let sourceY = null;
  let uiX = null;
  let uiY = null;
  let applying = false;
  let resizeTimer = 0;

  function checker() {
    try {
      if (typeof PrintChecker !== 'undefined') return PrintChecker;
    } catch (_) {}
    return window.PrintChecker || null;
  }

  function signedPercent(value) {
    const number = Math.round((Number(value) || 0) * 10) / 10;
    return `${number > 0 ? '+' : ''}${number}%`;
  }

  function setLabel(id, value) {
    const label = byId(id);
    if (label) label.textContent = signedPercent(value);
  }

  function dispatchSource(input, value) {
    if (!input) return;
    input.value = String(value);
    input.dispatchEvent(new Event('input'));
  }

  function applyFileRelativeOffsets() {
    if (applying || !sourceX || !sourceY) return;
    const canvas = byId('previewCanvas');
    if (!canvas || !checker()?.getState?.().fileKind) return;

    const width = Number(canvas.width) || Number(canvas.clientWidth) || 0;
    const height = Number(canvas.height) || Number(canvas.clientHeight) || 0;
    if (!width || !height) return;

    applying = true;
    try {
      // 내부 렌더러에는 현재 캔버스 px가 필요하므로, 사용자 값(파일 대비 %)을
      // 렌더링 직전에만 px로 환산한다. 상태의 기준값은 항상 첨부 파일 비율이다.
      dispatchSource(sourceX, width * xPercent / 100);
      dispatchSource(sourceY, height * yPercent / 100);
      setLabel('adjXVal', xPercent);
      setLabel('adjYVal', yPercent);
    } finally {
      applying = false;
    }
  }

  function redrawForCurrentViewport() {
    if (!sourceX || applying) return;
    // 기존 drawCanvas를 한 번 실행해 새 화면 폭에 맞는 캔버스 크기를 먼저 얻는다.
    dispatchSource(sourceX, Number(sourceX.value) || 0);
    requestAnimationFrame(applyFileRelativeOffsets);
  }

  function upgradeAxis(inputId, labelId, axis) {
    const original = byId(inputId);
    if (!original || original.dataset.fileRelativeUi === '1') return null;

    const replacement = original.cloneNode(true);
    replacement.dataset.fileRelativeUi = '1';
    replacement.min = String(-AXIS_LIMIT);
    replacement.max = String(AXIS_LIMIT);
    replacement.step = String(AXIS_STEP);
    replacement.value = '0';
    replacement.setAttribute('aria-valuetext', '0%');

    // 분리된 원본 슬라이더는 PrintChecker 내부 이벤트 리스너를 그대로 보존한다.
    // 값 제한만 넓혀 화면 px 환산값을 안전하게 전달한다.
    original.min = '-100000';
    original.max = '100000';
    original.step = '0.01';
    original.replaceWith(replacement);

    replacement.addEventListener('input', () => {
      const value = Math.max(-AXIS_LIMIT, Math.min(AXIS_LIMIT, Number(replacement.value) || 0));
      if (axis === 'x') xPercent = value;
      else yPercent = value;
      replacement.setAttribute('aria-valuetext', signedPercent(value));
      setLabel(labelId, value);
      applyFileRelativeOffsets();
    });

    return { source: original, ui: replacement };
  }

  function resetRelativeState() {
    xPercent = 0;
    yPercent = 0;
    if (uiX) uiX.value = '0';
    if (uiY) uiY.value = '0';
    if (uiX) uiX.setAttribute('aria-valuetext', '0%');
    if (uiY) uiY.setAttribute('aria-valuetext', '0%');
    setLabel('adjXVal', 0);
    setLabel('adjYVal', 0);
  }

  function install() {
    const x = upgradeAxis('adjX', 'adjXVal', 'x');
    const y = upgradeAxis('adjY', 'adjYVal', 'y');
    if (!x || !y) return;

    sourceX = x.source;
    sourceY = y.source;
    uiX = x.ui;
    uiY = y.ui;
    setLabel('adjXVal', 0);
    setLabel('adjYVal', 0);

    byId('resetAdjBtn')?.addEventListener('click', resetRelativeState);
    byId('resetBtn')?.addEventListener('click', resetRelativeState);

    byId('fileInput')?.addEventListener('change', () => {
      resetRelativeState();
      requestAnimationFrame(applyFileRelativeOffsets);
    });

    document.querySelectorAll('.side-btn').forEach((button) => {
      button.addEventListener('click', () => {
        requestAnimationFrame(() => requestAnimationFrame(applyFileRelativeOffsets));
      });
    });

    window.addEventListener('resize', () => {
      window.clearTimeout(resizeTimer);
      resizeTimer = window.setTimeout(redrawForCurrentViewport, 80);
    }, { passive: true });

    if (typeof ResizeObserver === 'function') {
      const wrap = byId('previewCanvas')?.parentElement;
      if (wrap) {
        const observer = new ResizeObserver(() => {
          window.clearTimeout(resizeTimer);
          resizeTimer = window.setTimeout(redrawForCurrentViewport, 60);
        });
        observer.observe(wrap);
      }
    }
  }

  document.addEventListener('DOMContentLoaded', install);
})();
