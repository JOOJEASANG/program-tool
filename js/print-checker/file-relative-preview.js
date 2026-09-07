/* file-relative-preview.js — 첨부 파일 레이어만 미리보기에서 조절 */
(function () {
  'use strict';

  if (window.__printCheckerFileRelativePreviewV2) return;
  window.__printCheckerFileRelativePreviewV2 = true;

  const byId = (id) => document.getElementById(id);
  const AXIS_LIMIT = 25;
  const AXIS_STEP = 0.5;

  let xPercent = 0;
  let yPercent = 0;
  let scalePercent = 100;
  let sourceX = null;
  let sourceY = null;
  let sourceScale = null;
  let uiX = null;
  let uiY = null;
  let uiScale = null;
  let resizeTimer = 0;
  let patchedContext = null;

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

  function setLabel(id, value, signed = false) {
    const label = byId(id);
    if (!label) return;
    label.textContent = signed ? signedPercent(value) : `${Math.round((Number(value) || 0) * 10) / 10}%`;
  }

  function dispatchSource(input, value) {
    if (!input) return;
    input.value = String(value);
    input.dispatchEvent(new Event('input'));
  }

  function triggerCoreRedraw() {
    // 코어에는 이동 0px, 배율 100%만 전달한다.
    // 따라서 재단선/안전선/접지선 등 화면 기준 안내선은 움직이지 않는다.
    if (sourceX) dispatchSource(sourceX, 0);
    else if (sourceScale) dispatchSource(sourceScale, 100);
  }

  function patchPreviewDrawImage() {
    const canvas = byId('previewCanvas');
    const context = canvas?.getContext?.('2d');
    if (!canvas || !context || patchedContext === context || context.__fileOnlyAdjustmentV2) return;

    const nativeDrawImage = context.drawImage.bind(context);
    context.__fileOnlyAdjustmentV2 = true;
    context.drawImage = function (image, ...args) {
      const state = checker()?.getState?.();
      const isUploadedPreview = Boolean(state?.fileKind) && args.length === 4 && this.canvas === canvas;
      if (!isUploadedPreview) return nativeDrawImage(image, ...args);

      const [baseX, baseY, baseW, baseH] = args.map(Number);
      const scale = Math.max(0.1, scalePercent / 100);
      const drawW = baseW * scale;
      const drawH = baseH * scale;
      const shiftX = (Number(canvas.width) || baseW) * xPercent / 100;
      const shiftY = (Number(canvas.height) || baseH) * yPercent / 100;
      const drawX = baseX + (baseW - drawW) / 2 + shiftX;
      const drawY = baseY + (baseH - drawH) / 2 + shiftY;

      return nativeDrawImage(image, drawX, drawY, drawW, drawH);
    };
    patchedContext = context;
  }

  function upgradeAxis(inputId, labelId, axis) {
    const original = byId(inputId);
    if (!original || original.dataset.fileOnlyUi === '1') return null;

    const replacement = original.cloneNode(true);
    replacement.dataset.fileOnlyUi = '1';
    replacement.min = String(-AXIS_LIMIT);
    replacement.max = String(AXIS_LIMIT);
    replacement.step = String(AXIS_STEP);
    replacement.value = '0';
    replacement.setAttribute('aria-valuetext', '0%');
    original.replaceWith(replacement);

    replacement.addEventListener('input', () => {
      const value = Math.max(-AXIS_LIMIT, Math.min(AXIS_LIMIT, Number(replacement.value) || 0));
      if (axis === 'x') xPercent = value;
      else yPercent = value;
      replacement.setAttribute('aria-valuetext', signedPercent(value));
      setLabel(labelId, value, true);
      triggerCoreRedraw();
    });

    return { source: original, ui: replacement };
  }

  function upgradeScale() {
    const original = byId('adjScale');
    if (!original || original.dataset.fileOnlyUi === '1') return null;

    const replacement = original.cloneNode(true);
    replacement.dataset.fileOnlyUi = '1';
    replacement.value = '100';
    replacement.setAttribute('aria-valuetext', '100%');
    original.replaceWith(replacement);

    replacement.addEventListener('input', () => {
      scalePercent = Math.max(10, Number(replacement.value) || 100);
      replacement.setAttribute('aria-valuetext', `${scalePercent}%`);
      setLabel('adjScaleVal', scalePercent);
      // 코어 배율은 항상 100%로 두고 실제 첨부 파일 drawImage만 확대/축소한다.
      dispatchSource(sourceScale, 100);
    });

    return { source: original, ui: replacement };
  }

  function resetFileAdjustment() {
    xPercent = 0;
    yPercent = 0;
    scalePercent = 100;
    if (uiX) uiX.value = '0';
    if (uiY) uiY.value = '0';
    if (uiScale) uiScale.value = '100';
    setLabel('adjXVal', 0, true);
    setLabel('adjYVal', 0, true);
    setLabel('adjScaleVal', 100);
    if (sourceX) sourceX.value = '0';
    if (sourceY) sourceY.value = '0';
    if (sourceScale) sourceScale.value = '100';
  }

  function redrawAfterResize() {
    patchPreviewDrawImage();
    triggerCoreRedraw();
  }

  function install() {
    patchPreviewDrawImage();

    const x = upgradeAxis('adjX', 'adjXVal', 'x');
    const y = upgradeAxis('adjY', 'adjYVal', 'y');
    const scale = upgradeScale();
    if (!x || !y || !scale) return;

    sourceX = x.source;
    sourceY = y.source;
    sourceScale = scale.source;
    uiX = x.ui;
    uiY = y.ui;
    uiScale = scale.ui;

    // 원래 코어 이벤트 리스너가 붙어 있는 분리 입력은 항상 기본값으로 유지한다.
    sourceX.min = '-100000';
    sourceX.max = '100000';
    sourceY.min = '-100000';
    sourceY.max = '100000';
    sourceScale.min = '10';
    sourceScale.max = '500';
    resetFileAdjustment();

    byId('resetAdjBtn')?.addEventListener('click', () => {
      resetFileAdjustment();
      requestAnimationFrame(triggerCoreRedraw);
    });
    byId('resetBtn')?.addEventListener('click', resetFileAdjustment);

    byId('fileInput')?.addEventListener('change', () => {
      resetFileAdjustment();
      requestAnimationFrame(() => {
        patchPreviewDrawImage();
        triggerCoreRedraw();
      });
    });

    document.querySelectorAll('.side-btn').forEach((button) => {
      button.addEventListener('click', () => {
        requestAnimationFrame(() => requestAnimationFrame(() => {
          patchPreviewDrawImage();
          triggerCoreRedraw();
        }));
      });
    });

    window.addEventListener('resize', () => {
      window.clearTimeout(resizeTimer);
      resizeTimer = window.setTimeout(redrawAfterResize, 80);
    }, { passive: true });

    if (typeof ResizeObserver === 'function') {
      const wrap = byId('previewCanvas')?.parentElement;
      if (wrap) {
        const observer = new ResizeObserver(() => {
          window.clearTimeout(resizeTimer);
          resizeTimer = window.setTimeout(redrawAfterResize, 60);
        });
        observer.observe(wrap);
      }
    }
  }

  document.addEventListener('DOMContentLoaded', install);
})();
