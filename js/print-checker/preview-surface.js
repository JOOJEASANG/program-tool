/* preview-surface.js — 문서파일 검토 미리보기 표면 및 재단 가이드 보정 */
(function () {
  'use strict';

  if (window.__printCheckerPreviewSurfaceV2) return;
  window.__printCheckerPreviewSurfaceV2 = true;

  const GRID = 16;
  const GRID_COLOR = '#e7ecf2';
  const TRIM_COLOR = '#2563eb';
  const CROP_COLOR = '#111827';

  function normalizeColor(value) {
    return String(value || '').replace(/\s+/g, '').toLowerCase();
  }

  function drawSolidGrid(context, canvas, nativeFillRect, nativeSetLineDash) {
    context.save();
    context.fillStyle = '#ffffff';
    nativeFillRect(0, 0, canvas.width, canvas.height);
    context.strokeStyle = GRID_COLOR;
    context.lineWidth = 0.65;
    nativeSetLineDash([]);
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

  function drawCropMarks(context, x, y, width, height, nativeSetLineDash) {
    const gap = 7;
    const length = 18;
    const right = x + width;
    const bottom = y + height;

    context.save();
    context.strokeStyle = CROP_COLOR;
    context.lineWidth = 1.6;
    nativeSetLineDash([]);
    context.beginPath();

    // 좌상단
    context.moveTo(x - gap - length, y); context.lineTo(x - gap, y);
    context.moveTo(x, y - gap - length); context.lineTo(x, y - gap);
    // 우상단
    context.moveTo(right + gap, y); context.lineTo(right + gap + length, y);
    context.moveTo(right, y - gap - length); context.lineTo(right, y - gap);
    // 좌하단
    context.moveTo(x - gap - length, bottom); context.lineTo(x - gap, bottom);
    context.moveTo(x, bottom + gap); context.lineTo(x, bottom + gap + length);
    // 우하단
    context.moveTo(right + gap, bottom); context.lineTo(right + gap + length, bottom);
    context.moveTo(right, bottom + gap); context.lineTo(right, bottom + gap + length);

    context.stroke();
    context.restore();
  }

  function patchBookCanvas() {
    const canvas = document.getElementById('bookReviewCanvas');
    if (!canvas) return false;
    const context = canvas.getContext('2d');
    if (!context || context.__programStudioPreviewSurfaceV2) return true;

    const nativeFillRect = context.fillRect.bind(context);
    const nativeFillText = context.fillText.bind(context);
    const nativeSetLineDash = context.setLineDash.bind(context);
    const nativeStrokeRect = context.strokeRect.bind(context);
    context.__programStudioPreviewSurfaceV2 = true;

    context.setLineDash = function () {
      // 문서파일 검토의 모든 가이드 선은 실선으로 통일한다.
      return nativeSetLineDash([]);
    };

    context.fillRect = function (x, y, width, height) {
      const fullCanvas = Number(x) === 0
        && Number(y) === 0
        && Math.abs(Number(width) - canvas.width) < 0.5
        && Math.abs(Number(height) - canvas.height) < 0.5;
      const fill = normalizeColor(this.fillStyle);

      if (fullCanvas && (fill === '#aeb9c7' || fill === 'rgb(174,185,199)')) {
        drawSolidGrid(this, canvas, nativeFillRect, nativeSetLineDash);
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

    context.strokeRect = function (x, y, width, height) {
      const stroke = normalizeColor(this.strokeStyle);
      const isTrimLine = stroke === TRIM_COLOR || stroke === 'rgb(37,99,235)';
      const result = nativeStrokeRect(x, y, width, height);
      if (isTrimLine && Number(this.lineWidth) >= 2.5) {
        drawCropMarks(this, Number(x), Number(y), Number(width), Number(height), nativeSetLineDash);
      }
      return result;
    };

    context.fillText = function (text, x, y, maxWidth) {
      const raw = String(text || '');
      const nextText = raw.startsWith('회색=인쇄용지 밖') || raw.startsWith('점선격자=인쇄용지 밖')
        ? '격자=인쇄용지 밖 · 보라=업로드 파일 · 어두운 영역=재단 제외 · 파랑=실제 재단선 · 검정=사방 재단표시'
        : text;
      return maxWidth === undefined
        ? nativeFillText(nextText, x, y)
        : nativeFillText(nextText, x, y, maxWidth);
    };

    return true;
  }

  function removeUnusedSafetyFields() {
    if (!document.body?.classList.contains('book-review-active')) return;

    const safeZone = document.getElementById('safeZone');
    const bindingSafe = document.getElementById('bookBindingSafe');
    let changed = false;

    [safeZone, bindingSafe].forEach((input) => {
      if (!input) return;
      input.value = '0';
      input.dispatchEvent(new Event('input', { bubbles: true }));
      input.closest('.spec-field')?.remove();
      changed = true;
    });

    const card = document.querySelector('.product-card[data-product="book-review"] .pc-desc');
    if (card) card.textContent = 'PDF 문서·재단선·전체 페이지';

    if (changed) {
      requestAnimationFrame(() => window.PrintCheckerBookReview?.renderPreview?.());
    }
  }

  function removeSafetyReportCards() {
    const grid = document.getElementById('reportGrid');
    if (!grid) return;
    grid.querySelectorAll('.report-card').forEach((card) => {
      const label = card.querySelector('.rc-label')?.textContent?.trim() || '';
      if (label === '안전영역 안내') card.remove();
    });
  }

  function installSafetyFieldCleanup() {
    const form = document.getElementById('specForm');
    if (form && !form.__programStudioSafetyFieldObserver) {
      const observer = new MutationObserver(() => removeUnusedSafetyFields());
      observer.observe(form, { childList: true, subtree: true });
      form.__programStudioSafetyFieldObserver = observer;
    }

    const reportGrid = document.getElementById('reportGrid');
    if (reportGrid && !reportGrid.__programStudioSafetyReportObserver) {
      const observer = new MutationObserver(() => removeSafetyReportCards());
      observer.observe(reportGrid, { childList: true, subtree: true });
      reportGrid.__programStudioSafetyReportObserver = observer;
    }
  }

  function ensurePatched() {
    installSafetyFieldCleanup();
    removeUnusedSafetyFields();
    removeSafetyReportCards();
    if (patchBookCanvas()) return;
    requestAnimationFrame(ensurePatched);
  }

  document.addEventListener('click', (event) => {
    if (!event.target.closest?.('.product-card[data-product="book-review"]')) return;
    requestAnimationFrame(() => {
      installSafetyFieldCleanup();
      removeUnusedSafetyFields();
      patchBookCanvas();
    });
  }, true);

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', ensurePatched, { once: true });
  } else {
    ensurePatched();
  }
})();
