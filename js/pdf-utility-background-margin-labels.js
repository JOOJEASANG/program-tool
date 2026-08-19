// PDF Utility: user-facing labels for combined background + margin content removal.
(function () {
  'use strict';
  if (window.__pdfUtilityBackgroundMarginLabelsV1) return;
  window.__pdfUtilityBackgroundMarginLabelsV1 = true;
  const path = location.pathname.replace(/\/+$/, '') || '/';
  if (!(path === '/pdf-preflight' || path.endsWith('/pdf-preflight/index.html') || path.endsWith('/tools/pdf-Checker.html') || path.endsWith('/tools/preflight.html'))) return;

  function installStyles() {
    if (document.getElementById('pdfUtilityBackgroundMarginLabelsStyles')) return;
    const style = document.createElement('style');
    style.id = 'pdfUtilityBackgroundMarginLabelsStyles';
    style.textContent = `
      #pdfUtilityModalTitle{font-size:0}
      #pdfUtilityModalTitle::after{content:'배경 및 여백 제거';font-size:19px;font-weight:950}
      .pdfu-margin-title{font-size:0!important}
      .pdfu-margin-title::after{content:'여백 내용 제거';font-size:12px}
      .pdfu-margin-desc{font-size:0!important}
      .pdfu-margin-desc::after{content:'입력한 만큼 가장자리의 내용을 삭제합니다. 페이지 크기는 그대로 유지됩니다. 수치는 mm 단위이며 모든 페이지에 적용됩니다.';font-size:10px}
    `;
    document.head.appendChild(style);
  }

  function install() {
    installStyles();
    const run = document.getElementById('pdfUtilityModalRun');
    if (run && run.dataset.marginRemovalLabel !== 'true') {
      run.dataset.marginRemovalLabel = 'true';
      const observer = new MutationObserver(() => {
        if (run.textContent.includes('여백자르기')) run.textContent = run.textContent.replaceAll('여백자르기', '여백제거');
        if (run.textContent.includes('여백 자르기')) run.textContent = run.textContent.replaceAll('여백 자르기', '여백 제거');
      });
      observer.observe(run, { childList: true, characterData: true, subtree: true });
    }
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', install, { once: true });
  else install();
  const observer = new MutationObserver(install);
  observer.observe(document.body, { childList: true, subtree: true });
})();
