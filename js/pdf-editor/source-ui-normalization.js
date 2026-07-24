// Normalize legacy copy that remains in the monolithic PDF editor HTML.
(function () {
  'use strict';
  if (window.__pdfSourceUiNormalizationV1) return;
  window.__pdfSourceUiNormalizationV1 = true;

  function normalize() {
    const hint = document.querySelector('#sb-pages .thumb-hint');
    if (hint) {
      hint.textContent = '클릭=선택 · Ctrl/Shift=다중선택 · 우클릭=숨김/회전/삭제 · 드래그=순서변경';
    }
    const outputHead = document.querySelector('#previewBtn')?.closest('.sec')?.querySelector('.sec-head');
    if (outputHead) {
      outputHead.setAttribute('aria-hidden', 'true');
      outputHead.style.display = 'none';
    }
    document.querySelectorAll('.pdf-flat-fixed-dock-head,.pdf-dock-state').forEach((element) => element.remove());
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', normalize, { once: true });
  else normalize();
  setTimeout(normalize, 300);
})();
