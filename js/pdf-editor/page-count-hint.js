// PDF editor page count hint module.
// Explains the difference between source/work pages and exported PDF sheets when N-UP is used.
(function () {
  if (window.__pdfEditorPageCountHintV1) return;
  window.__pdfEditorPageCountHintV1 = true;

  const NUP_VALUES = [1, 2, 4, 6, 8, 9];

  function $(id) { return document.getElementById(id); }
  function getActiveNup() {
    const active = document.querySelector('.nup-btn.active,[data-nup].active');
    const raw = active ? (active.dataset.nup || active.textContent || '') : '';
    const n = Number((String(raw).match(/\d+/) || [])[0]);
    return NUP_VALUES.includes(n) ? n : 1;
  }
  function getWorkPageCount() {
    const txt = ($('slideCount') && $('slideCount').textContent) || '';
    const m = txt.match(/(\d+)\s*\/\s*(\d+)/);
    if (m) return Number(m[1]);
    const thumbs = [...document.querySelectorAll('.thumb-item')].filter((el) => !el.textContent.includes('✕'));
    return thumbs.length;
  }
  function estimateOutputPages() {
    const work = getWorkPageCount();
    const nup = getActiveNup();
    return { work, nup, output: Math.max(0, Math.ceil(work / Math.max(1, nup))) };
  }
  function ensureHint() {
    let hint = $('pdfPageCountHint');
    if (hint) return hint;
    const target = $('previewInfo') || $('slideCount') || document.querySelector('.preview-head,.thumb-head');
    if (!target || !target.parentElement) return null;
    hint = document.createElement('div');
    hint.id = 'pdfPageCountHint';
    hint.style.cssText = 'font-size:11px;color:#475569;background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:6px 8px;margin-top:6px;line-height:1.45;';
    target.parentElement.appendChild(hint);
    return hint;
  }
  function renderHint() {
    const hint = ensureHint();
    if (!hint) return;
    const { work, nup, output } = estimateOutputPages();
    if (!work) {
      hint.textContent = '작업 페이지와 출력 PDF 페이지 수를 이곳에서 확인할 수 있습니다.';
      return;
    }
    hint.textContent = `작업 페이지 ${work}쪽 · 현재 ${nup}장 배치 → 다운로드 PDF 예상 ${output}쪽` + (nup > 1 ? ' (페이지가 줄어든 것이 아니라 한 장에 여러 페이지가 배치됩니다.)' : '');
  }
  function boot() { renderHint(); }
  document.addEventListener('DOMContentLoaded', boot);
  document.addEventListener('click', () => setTimeout(renderHint, 200), true);
  document.addEventListener('change', () => setTimeout(renderHint, 200), true);
  setInterval(renderHint, 1200);
})();
