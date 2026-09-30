// Validation guard for advanced document print review.
(() => {
  'use strict';

  const run = document.getElementById('aprConfigRun');
  if (!run || run.dataset.trimValidationBound === '1') return;
  run.dataset.trimValidationBound = '1';

  run.addEventListener('click', event => {
    const width = Number.parseFloat(document.getElementById('aprTrimW')?.value || '0');
    const height = Number.parseFloat(document.getElementById('aprTrimH')?.value || '0');
    if (width > 0 && height > 0) return;

    event.preventDefault();
    event.stopImmediatePropagation();
    alert('실제 재단 폭과 높이를 모두 입력해 주세요. 재단 규격 없이 인쇄 검토를 완료할 수 없습니다.');
    const target = !(width > 0) ? document.getElementById('aprTrimW') : document.getElementById('aprTrimH');
    target?.focus();
  }, true);

  document.documentElement.dataset.pdfAdvancedPrintReviewValidation = '1';
})();
