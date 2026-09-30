/* preview-surface.js — 디자인 검토 미리보기 표면 대비 개선 */
(function () {
  'use strict';

  if (window.__printCheckerPreviewSurfaceV1) return;
  window.__printCheckerPreviewSurfaceV1 = true;

  const GRID = 16;
  const GRID_COLOR = '#e7ecf2';

  function drawDottedGrid(context, canvas, nativeFillRect) {
    context.save();
    context.fillStyle = '#ffffff';
    nativeFillRect(0, 0, canvas.width, canvas.height);
    context.strokeStyle = GRID_COLOR;
    context.lineWidth = 0.8;
    context.setLineDash([2, 4]);
    context.beginPath();
    for (let x = GRID + 0.5; x < canvas.width; x += GRID) {
      context.moveTo(x, 0);
      context.lineTo(x, canvas.height);
    }
    for (let y = GRID + 0.5; y < canvas.height; y += GRID) {
      context.moveTo(0, y);
      context.lineTo(canvas.width, y);
    }
    context.stroke();
    context.restore();
  }

  function normalizeColor(value) {
    return String(value || '').replace(/\s+/g, '').toLowerCase();
  }

  function patchBookCanvas() {
    const canvas = document.getElementById('bookReviewCanvas');
    if (!canvas) return false;
    const context = canvas.getContext('2d');
    if (!context || context.__programStudioPreviewSurfaceV1) return true;

    const nativeFillRect = context.fillRect.bind(context);
    const nativeFillText = context.fillText.bind(context);
    context.__programStudioPreviewSurfaceV1 = true;

    context.fillRect = function (x, y, width, height) {
      const fullCanvas = Number(x) === 0
        && Number(y) === 0
        && Math.abs(Number(width) - canvas.width) < 0.5
        && Math.abs(Number(height) - canvas.height) < 0.5;
      const fill = normalizeColor(this.fillStyle);

      if (fullCanvas && (fill === '#aeb9c7' || fill === 'rgb(174,185,199)')) {
        drawDottedGrid(this, canvas, nativeFillRect);
        return undefined;
      }

      if (fill === 'rgba(15,23,42,0.42)' || fill === 'rgba(15,23,42,.42)') {
        const previous = this.fillStyle;
        this.fillStyle = 'rgba(15,23,42,.14)';
        nativeFillRect(x, y, width, height);
        this.fillStyle = previous;
        return undefined;
      }

      return nativeFillRect(x, y, width, height);
    };

    context.fillText = function (text, x, y, maxWidth) {
      const nextText = String(text || '').startsWith('회색=인쇄용지 밖')
        ? String(text).replace('회색=인쇄용지 밖', '점선격자=인쇄용지 밖')
        : text;
      return maxWidth === undefined
        ? nativeFillText(nextText, x, y)
        : nativeFillText(nextText, x, y, maxWidth);
    };

    return true;
  }

  function ensurePatched() {
    if (patchBookCanvas()) return;
    requestAnimationFrame(ensurePatched);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', ensurePatched, { once: true });
  } else {
    ensurePatched();
  }
})();
