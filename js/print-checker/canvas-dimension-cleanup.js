/* canvas-dimension-cleanup.js — keep live dimensions out of the preview canvas */
(function () {
  'use strict';

  if (window.__printCheckerCanvasDimensionCleanupV1) return;
  window.__printCheckerCanvasDimensionCleanupV1 = true;

  const proto = window.CanvasRenderingContext2D?.prototype;
  if (!proto || typeof proto.fillText !== 'function') return;

  const nativeFillText = proto.fillText;
  const DIMENSION_TEXT = /(?:^|\s)(?:\d+(?:\.\d+)?|\?)\s*(?:×\s*(?:\d+(?:\.\d+)?|\?)\s*)?mm\s*$/i;

  proto.fillText = function (text, ...args) {
    const canvas = this?.canvas;
    const value = String(text ?? '').trim();
    if (canvas?.id === 'previewCanvas' && DIMENSION_TEXT.test(value)) return undefined;
    return nativeFillText.call(this, text, ...args);
  };

  window.PrintCheckerCanvasDimensionCleanup = Object.freeze({
    stage: 'v1-header-only-dimensions',
  });
})();
