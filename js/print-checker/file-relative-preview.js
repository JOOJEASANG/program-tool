/* file-relative-preview.js — 고정 안내선 + 첨부 파일 전용 이동 레이어 */
(function () {
  'use strict';

  if (window.__printCheckerFileRelativePreviewV4) return;
  window.__printCheckerFileRelativePreviewV4 = true;

  const byId = (id) => document.getElementById(id);
  const AXIS_LIMIT = 25;
  const AXIS_STEP = 0.5;
  const FILE_LAYER_ID = 'previewFileLayer';
  const STACK_CLASS = 'preview-canvas-stack';

  let xPercent = 0;
  let yPercent = 0;
  let scalePercent = 100;
  let sourceX = null;
  let sourceY = null;
  let sourceScale = null;
  let uiX = null;
  let uiY = null;
  let uiScale = null;
  let patchedContext = null;
  let nativeDrawImage = null;
  let nativeFillRect = null;
  let capturedImage = null;
  let capturedFrame = null;
  let resizeTimer = 0;
  let resizeObserver = null;
  let dragState = null;

  function checker() {
    try {
      if (typeof PrintChecker !== 'undefined') return PrintChecker;
    } catch (_) {}
    return window.PrintChecker || null;
  }

  function clamp(value, min, max) {
    return Math.max(min, Math.min(max, Number(value) || 0));
  }

  function signedPercent(value) {
    const number = Math.round((Number(value) || 0) * 10) / 10;
    return `${number > 0 ? '+' : ''}${number}%`;
  }

  function setLabel(id, value, signed = false) {
    const label = byId(id);
    if (!label) return;
    const rounded = Math.round((Number(value) || 0) * 10) / 10;
    label.textContent = signed ? signedPercent(rounded) : `${rounded}%`;
  }

  function syncUi() {
    if (uiX) {
      uiX.value = String(xPercent);
      uiX.setAttribute('aria-valuetext', signedPercent(xPercent));
    }
    if (uiY) {
      uiY.value = String(yPercent);
      uiY.setAttribute('aria-valuetext', signedPercent(yPercent));
    }
    if (uiScale) {
      uiScale.value = String(scalePercent);
      uiScale.setAttribute('aria-valuetext', `${scalePercent}%`);
    }
    setLabel('adjXVal', xPercent, true);
    setLabel('adjYVal', yPercent, true);
    setLabel('adjScaleVal', scalePercent);
  }

  function dispatchSource(input, value) {
    if (!input) return;
    input.value = String(value);
    input.dispatchEvent(new Event('input'));
  }

  function neutralizeCoreTransform() {
    // 코어 캔버스는 안내선 전용이다. 이동/배율은 항상 0 / 0 / 100으로 고정한다.
    dispatchSource(sourceX, 0);
    dispatchSource(sourceY, 0);
    dispatchSource(sourceScale, 100);
  }

  function ensureStack() {
    const canvas = byId('previewCanvas');
    if (!canvas) return null;
    let stack = canvas.parentElement?.classList?.contains(STACK_CLASS) ? canvas.parentElement : null;
    if (!stack) {
      stack = document.createElement('div');
      stack.className = STACK_CLASS;
      canvas.parentNode?.insertBefore(stack, canvas);
      stack.appendChild(canvas);
    }
    return stack;
  }

  function ensureFileLayer() {
    const canvas = byId('previewCanvas');
    const stack = ensureStack();
    if (!canvas || !stack) return null;

    let layer = byId(FILE_LAYER_ID);
    if (!layer) {
      layer = document.createElement('canvas');
      layer.id = FILE_LAYER_ID;
      layer.setAttribute('aria-label', '첨부 파일 이동 레이어');
      layer.tabIndex = 0;
      stack.insertBefore(layer, canvas);
      bindDrag(layer);
    }
    syncLayerSize(layer, canvas);
    return layer;
  }

  function syncLayerSize(layer = byId(FILE_LAYER_ID), canvas = byId('previewCanvas')) {
    if (!layer || !canvas) return;
    if (layer.width !== canvas.width) layer.width = Math.max(1, canvas.width);
    if (layer.height !== canvas.height) layer.height = Math.max(1, canvas.height);
  }

  function clearFileLayer(options = {}) {
    const layer = byId(FILE_LAYER_ID);
    if (layer) {
      const context = layer.getContext('2d');
      context?.clearRect(0, 0, layer.width, layer.height);
      layer.hidden = options.hide !== false;
    }
    if (options.dropSource) {
      capturedImage = null;
      capturedFrame = null;
    }
  }

  function drawFileLayer() {
    const canvas = byId('previewCanvas');
    const layer = ensureFileLayer();
    if (!canvas || !layer || !capturedImage || !capturedFrame) {
      clearFileLayer({ hide: true });
      return;
    }

    syncLayerSize(layer, canvas);
    const context = layer.getContext('2d');
    if (!context) return;
    context.clearRect(0, 0, layer.width, layer.height);

    const { x: baseX, y: baseY, w: baseW, h: baseH } = capturedFrame;
    const scale = Math.max(0.1, scalePercent / 100);
    const drawW = baseW * scale;
    const drawH = baseH * scale;
    const shiftX = layer.width * xPercent / 100;
    const shiftY = layer.height * yPercent / 100;
    const drawX = baseX + (baseW - drawW) / 2 + shiftX;
    const drawY = baseY + (baseH - drawH) / 2 + shiftY;

    context.save();
    context.imageSmoothingEnabled = true;
    context.imageSmoothingQuality = 'high';
    context.drawImage(capturedImage, drawX, drawY, drawW, drawH);
    context.restore();
    layer.hidden = false;
  }

  function patchPreviewContext() {
    const canvas = byId('previewCanvas');
    const context = canvas?.getContext?.('2d');
    if (!canvas || !context || patchedContext === context || context.__fileOnlyAdjustmentV4) return;

    nativeDrawImage = context.drawImage.bind(context);
    nativeFillRect = context.fillRect.bind(context);
    context.__fileOnlyAdjustmentV4 = true;

    // 업로드 파일은 코어 캔버스에 그리지 않고 별도 레이어로 보낸다.
    context.drawImage = function (image, ...args) {
      const state = checker()?.getState?.();
      const isUploadedPreview = Boolean(state?.fileKind) && args.length === 4 && this.canvas === canvas;
      if (!isUploadedPreview) return nativeDrawImage(image, ...args);

      const [x, y, w, h] = args.map(Number);
      capturedImage = image;
      capturedFrame = { x, y, w, h };
      drawFileLayer();
      return undefined;
    };

    // 파일이 있을 때 코어의 불투명 배경 채우기만 막아 아래 파일 레이어가 보이게 한다.
    context.fillRect = function (x, y, w, h) {
      const state = checker()?.getState?.();
      const isFullPreviewBackground = Boolean(state?.fileKind)
        && this.canvas === canvas
        && Number(x) === 0
        && Number(y) === 0
        && Math.abs(Number(w) - canvas.width) < 0.5
        && Math.abs(Number(h) - canvas.height) < 0.5;
      if (isFullPreviewBackground) return undefined;
      return nativeFillRect(x, y, w, h);
    };

    patchedContext = context;
    ensureFileLayer();
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
      const value = clamp(replacement.value, -AXIS_LIMIT, AXIS_LIMIT);
      if (axis === 'x') xPercent = value;
      else yPercent = value;
      syncUi();
      drawFileLayer();
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
      scalePercent = clamp(replacement.value, 10, 500) || 100;
      syncUi();
      drawFileLayer();
    });

    return { source: original, ui: replacement };
  }

  function resetFileAdjustment(options = {}) {
    xPercent = 0;
    yPercent = 0;
    scalePercent = 100;
    syncUi();
    if (options.redraw !== false) drawFileLayer();
  }

  function updateFromPointer(layer, event) {
    if (!dragState) return;
    const rect = layer.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    const dxPercent = (event.clientX - dragState.startX) / rect.width * 100;
    const dyPercent = (event.clientY - dragState.startY) / rect.height * 100;
    xPercent = clamp(dragState.originX + dxPercent, -AXIS_LIMIT, AXIS_LIMIT);
    yPercent = clamp(dragState.originY + dyPercent, -AXIS_LIMIT, AXIS_LIMIT);
    syncUi();
    drawFileLayer();
  }

  function bindDrag(layer) {
    layer.addEventListener('pointerdown', (event) => {
      if (!capturedImage || event.button !== 0) return;
      dragState = {
        pointerId: event.pointerId,
        startX: event.clientX,
        startY: event.clientY,
        originX: xPercent,
        originY: yPercent,
      };
      layer.classList.add('is-dragging');
      try { layer.setPointerCapture(event.pointerId); } catch (_) {}
      event.preventDefault();
    });

    layer.addEventListener('pointermove', (event) => {
      if (!dragState || dragState.pointerId !== event.pointerId) return;
      updateFromPointer(layer, event);
      event.preventDefault();
    });

    const finish = (event) => {
      if (!dragState || dragState.pointerId !== event.pointerId) return;
      try { layer.releasePointerCapture(event.pointerId); } catch (_) {}
      dragState = null;
      layer.classList.remove('is-dragging');
      event.preventDefault();
    };
    layer.addEventListener('pointerup', finish);
    layer.addEventListener('pointercancel', finish);
  }

  function installNote() {
    const panel = byId('adjPanel');
    if (!panel || byId('fileOnlyAdjustmentNote')) return;
    const note = document.createElement('div');
    note.id = 'fileOnlyAdjustmentNote';
    note.textContent = '안내선과 미리보기 캔버스는 고정됩니다. 첨부 파일만 슬라이더 또는 미리보기에서 마우스로 끌어 이동할 수 있습니다.';
    note.style.cssText = 'margin:0 0 9px;padding:8px 9px;border-radius:8px;background:#eff6ff;color:#1e40af;font-size:10px;font-weight:800;line-height:1.45';
    const kicker = panel.querySelector('.adj-kicker');
    if (kicker) kicker.insertAdjacentElement('afterend', note);
    else panel.prepend(note);
  }

  function refreshAfterCoreRender() {
    patchPreviewContext();
    const state = checker()?.getState?.();
    if (!state?.fileKind) {
      clearFileLayer({ hide: true, dropSource: true });
      return;
    }
    syncLayerSize();
    drawFileLayer();
  }

  function install() {
    patchPreviewContext();

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

    sourceX.min = '-100000';
    sourceX.max = '100000';
    sourceY.min = '-100000';
    sourceY.max = '100000';
    sourceScale.min = '10';
    sourceScale.max = '500';

    resetFileAdjustment({ redraw: false });
    neutralizeCoreTransform();
    installNote();
    document.documentElement.dataset.printCheckerFileOnlyPreview = 'v4-layered-drag';

    byId('resetAdjBtn')?.addEventListener('click', () => {
      resetFileAdjustment();
      requestAnimationFrame(neutralizeCoreTransform);
    });
    byId('resetBtn')?.addEventListener('click', () => {
      resetFileAdjustment({ redraw: false });
      requestAnimationFrame(() => {
        neutralizeCoreTransform();
        refreshAfterCoreRender();
      });
    });

    byId('fileInput')?.addEventListener('change', () => {
      resetFileAdjustment({ redraw: false });
      clearFileLayer({ hide: true, dropSource: true });
      requestAnimationFrame(() => requestAnimationFrame(refreshAfterCoreRender));
    });

    document.querySelectorAll('.side-btn').forEach((button) => {
      button.addEventListener('click', () => {
        requestAnimationFrame(() => requestAnimationFrame(refreshAfterCoreRender));
      });
    });

    byId('specForm')?.addEventListener('input', () => requestAnimationFrame(refreshAfterCoreRender));
    byId('specForm')?.addEventListener('change', () => requestAnimationFrame(refreshAfterCoreRender));
    byId('fileHasBleed')?.addEventListener('change', () => requestAnimationFrame(refreshAfterCoreRender));

    window.addEventListener('resize', () => {
      window.clearTimeout(resizeTimer);
      resizeTimer = window.setTimeout(refreshAfterCoreRender, 80);
    }, { passive: true });

    if (typeof ResizeObserver === 'function') {
      const wrap = ensureStack();
      if (wrap) {
        resizeObserver = new ResizeObserver(() => {
          window.clearTimeout(resizeTimer);
          resizeTimer = window.setTimeout(refreshAfterCoreRender, 60);
        });
        resizeObserver.observe(wrap);
      }
    }
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', install, { once: true });
  else install();
})();
