/* 문서파일 검토 기능은 PDF 고급 편집으로 이동되었습니다. */
(function () {
  'use strict';
  if (window.__printCheckerBookReviewV1) return;
  window.__printCheckerBookReviewV1 = true;

  function openAdvancedEditor() {
    location.href = '/pdf-editor-advanced/';
  }

  window.PrintCheckerBookReview = Object.freeze({
    activate: openAdvancedEditor,
    deactivate() {},
    renderPreview() {},
    stage: 'document-review-moved-to-pdf-editor-advanced-v1',
  });
})();
