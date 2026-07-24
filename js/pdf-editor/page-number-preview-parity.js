// Make preview page-number formatting and edge anchors match PDF export.
(function () {
  'use strict';
  if (window.__pdfPageNumberPreviewParityV1) return;
  window.__pdfPageNumberPreviewParityV1 = true;

  const byId = (id) => document.getElementById(id);
  let patched = false;
  let attempts = 0;

  function numberValue(id, fallback) {
    const value = Number(byId(id)?.value);
    return Number.isFinite(value) ? value : fallback;
  }

  function applies(outputIndex) {
    try {
      if (!pnEnabled) return false;
      if (pnExcludeFirst && outputIndex === 0) return false;
      const odd = outputIndex % 2 === 0;
      return pnApplyTo === 'all' || (pnApplyTo === 'odd' && odd) || (pnApplyTo === 'even' && !odd);
    } catch (_) {
      return false;
    }
  }

  function pageNumberText(outputIndex, totalPages) {
    const offset = pnExcludeFirst ? 1 : 0;
    const visible = outputIndex + pnStart - offset;
    const visibleTotal = Math.max(0, totalPages - offset) + pnStart - 1;
    if (pnFormat === 'number') return String(visible);
    if (pnFormat === 'number-total') return `${visible} / ${visibleTotal}`;
    if (pnFormat === 'dash') return `- ${visible} -`;
    return `- ${visible} / ${visibleTotal} -`;
  }

  function margins(outputIndex) {
    if (window.PdfEditorIndividualMargins?.effectiveMargins) {
      return { ...window.PdfEditorIndividualMargins.effectiveMargins(outputIndex) };
    }
    const horizontal = numberValue('marginH', 10);
    const vertical = numberValue('marginV', 10);
    return {
      left: numberValue('marginLeft', horizontal),
      right: numberValue('marginRight', horizontal),
      top: numberValue('marginTop', vertical),
      bottom: numberValue('marginBottom', vertical),
    };
  }

  function draw(canvas, outputIndex, totalPages, mm2px) {
    if (!applies(outputIndex)) return;
    const context = canvas.getContext('2d');
    const pageMargins = margins(outputIndex);
    const extra = Math.max(0, numberValue('pnMarginMm', 5));
    const left = Math.max(pageMargins.left, extra) * mm2px;
    const right = Math.max(pageMargins.right, extra) * mm2px;
    const top = Math.max(pageMargins.top, extra) * mm2px;
    const bottom = Math.max(pageMargins.bottom, extra) * mm2px;
    const fontSize = Math.max(5, Math.min(72, Number(pnFontSize || 10))) * 0.353 * mm2px;

    let [vertical, horizontal] = String(pnPosition || 'bottom-center').split('-');
    const odd = outputIndex % 2 === 0;
    let facing = false;
    try { facing = !!facingPages; } catch (_) { facing = !!byId('facingPages')?.checked; }
    if (facing && !odd) {
      if (horizontal === 'left') horizontal = 'right';
      else if (horizontal === 'right') horizontal = 'left';
    }

    const x = horizontal === 'center' ? canvas.width / 2 : (horizontal === 'right' ? canvas.width - right : left);
    const y = vertical === 'top' ? top + fontSize * 0.75 : canvas.height - bottom - fontSize * 0.75;

    context.save();
    context.fillStyle = pnColor;
    context.font = `${fontSize}px "Pretendard","Malgun Gothic",Arial,sans-serif`;
    context.textAlign = horizontal === 'center' ? 'center' : (horizontal === 'right' ? 'right' : 'left');
    context.textBaseline = 'middle';
    context.fillText(pageNumberText(outputIndex, totalPages), x, y);
    context.restore();
  }

  function patch() {
    if (patched) return true;
    try {
      if (typeof applyDocEdits !== 'function') return false;
      if (applyDocEdits.__pageNumberPreviewParityV1) {
        patched = true;
        return true;
      }
      const original = applyDocEdits;
      const wrapped = function applyDocEditsWithPageNumberParity(canvas, outputIndex, totalPages, mm2px) {
        let enabled = false;
        try { enabled = !!pnEnabled; } catch (_) {}
        if (!enabled) return original.apply(this, arguments);
        try {
          pnEnabled = false;
          original.apply(this, arguments);
        } finally {
          pnEnabled = enabled;
        }
        draw(canvas, outputIndex, totalPages, mm2px);
      };
      wrapped.__pageNumberPreviewParityV1 = true;
      applyDocEdits = wrapped;
      window.applyDocEdits = wrapped;
      patched = true;
      return true;
    } catch (error) {
      console.warn('[pdf-page-number] preview parity patch failed', error);
      return false;
    }
  }

  function boot() {
    if (!patch() && attempts < 12) {
      attempts += 1;
      setTimeout(boot, 160 + attempts * 60);
    }
  }

  window.PdfPageNumberPreviewParity = { draw, text: pageNumberText };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once: true });
  else boot();
})();