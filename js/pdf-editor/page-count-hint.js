// PDF editor page-count hint module.
// Keeps work-page and output-sheet counts inside the preview information area.
(function () {
  'use strict';
  if (window.__pdfEditorPageCountHintV2) return;
  window.__pdfEditorPageCountHintV2 = true;

  const NUP_VALUES = [1, 2, 4, 6, 8, 9];
  let timer = null;

  function $(id) { return document.getElementById(id); }
  function getActiveNup() {
    const active = document.querySelector('.nup-btn.active,[data-nup].active');
    const raw = active ? (active.dataset.nup || active.textContent || '') : '';
    const n = Number((String(raw).match(/\d+/) || [])[0]);
    return NUP_VALUES.includes(n) ? n : 1;
  }
  function getWorkPageCount() {
    const text = ($('slideCount') && $('slideCount').textContent) || '';
    const match = text.match(/(\d+)\s*\/\s*(\d+)/);
    if (match) return Number(match[1]);
    return [...document.querySelectorAll('.thumb-item')]
      .filter((element) => !element.textContent.includes('✕')).length;
  }
  function estimateOutputPages() {
    const work = getWorkPageCount();
    const nup = getActiveNup();
    return { work, nup, output: Math.max(0, Math.ceil(work / Math.max(1, nup))) };
  }
  function ensureHint() {
    let hint = $('pdfPageCountHint');
    if (hint) return hint;
    const previewInfo = $('previewInfo');
    if (!previewInfo || !previewInfo.parentElement) return null;
    hint = document.createElement('span');
    hint.id = 'pdfPageCountHint';
    hint.className = 'preview-page-count-hint';
    previewInfo.insertAdjacentElement('afterend', hint);
    return hint;
  }
  function renderHint() {
    const hint = ensureHint();
    if (!hint) return false;
    const { work, nup, output } = estimateOutputPages();
    hint.textContent = work
      ? `작업 ${work}쪽 · ${nup}장 배치 · 출력 예상 ${output}쪽`
      : '작업 페이지와 출력 PDF 쪽수를 이곳에서 확인합니다.';
    hint.title = nup > 1
      ? '페이지가 줄어든 것이 아니라 한 장에 여러 페이지가 배치됩니다.'
      : '';
    return true;
  }
  function schedule() {
    clearTimeout(timer);
    timer = setTimeout(renderHint, 140);
  }
  function installEvents() {
    if (window.__pdfPageCountEventsV2) return;
    window.__pdfPageCountEventsV2 = true;
    document.addEventListener('click', schedule, true);
    document.addEventListener('change', schedule, true);
    const area = $('thumbArea');
    if (area) new MutationObserver(schedule).observe(area, { childList: true, subtree: true, attributes: true });
  }
  function boot(attempt) {
    installEvents();
    const ready = renderHint();
    if (!ready && attempt < 10) setTimeout(() => boot(attempt + 1), 180 + attempt * 70);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => boot(0), { once: true });
  else boot(0);
})();
