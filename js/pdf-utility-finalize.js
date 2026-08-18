// Re-assert PDF Utility branding and batch-check binding after legacy preflight guards finish.
(function () {
  'use strict';
  if (window.__pdfUtilityFinalizeV1) return;
  window.__pdfUtilityFinalizeV1 = true;

  const path = location.pathname.replace(/\/+$/, '') || '/';
  if (!(path === '/pdf-preflight' || path.endsWith('/pdf-preflight/index.html') || path.endsWith('/tools/pdf-Checker.html') || path.endsWith('/tools/preflight.html'))) return;

  let attempts = 0;
  let checkObserver = null;

  function restoreCheckLabel() {
    const check = document.getElementById('checkBtn');
    if (!check) return;
    const name = check.querySelector('.action-name');
    const desc = check.querySelector('.action-desc');
    const chip = check.querySelector('.action-chip');
    if (name && name.textContent !== '최대 10개 일괄 검수') name.textContent = '최대 10개 일괄 검수';
    if (desc && desc.textContent !== '등록한 PDF를 순서대로 검사하고 파일별 점수와 경고를 모아 보여줍니다.') {
      desc.textContent = '등록한 PDF를 순서대로 검사하고 파일별 점수와 경고를 모아 보여줍니다.';
    }
    if (chip && chip.textContent !== '일괄 점검') chip.textContent = '일괄 점검';
  }

  function wrapBusyState() {
    const original = window.setPageBusy;
    if (typeof original !== 'function' || original.__pdfUtilityFinalizedV1) return;
    const wrapped = function pdfUtilitySetPageBusy(busy, label) {
      const result = Reflect.apply(original, this, arguments);
      if (!busy) queueMicrotask(restoreCheckLabel);
      return result;
    };
    wrapped.__pdfUtilityFinalizedV1 = true;
    wrapped.__pdfUtilityDelegate = original;
    window.setPageBusy = wrapped;
  }

  function observeCheckLabel() {
    const check = document.getElementById('checkBtn');
    if (!check || checkObserver) return;
    checkObserver = new MutationObserver(() => {
      const utility = window.PdfUtility;
      if (!utility || utility.state?.busy) return;
      restoreCheckLabel();
      window.runCheck = utility.runBatchCheck;
    });
    checkObserver.observe(check, { subtree: true, childList: true, characterData: true });
  }

  function loadWideLayout() {
    if (document.getElementById('pdfUtilityWideLayoutScriptV1')) return;
    const script = document.createElement('script');
    script.id = 'pdfUtilityWideLayoutScriptV1';
    script.src = '/js/pdf-utility-wide-layout.js?v=20260818-1';
    script.async = false;
    document.head.appendChild(script);
  }

  function loadCostGuard() {
    if (document.getElementById('pdfUtilityCostGuardScriptV2')) return;
    const script = document.createElement('script');
    script.id = 'pdfUtilityCostGuardScriptV2';
    script.src = '/js/pdf-utility-cost-guard-v2.js?v=20260818-1';
    script.async = false;
    document.head.appendChild(script);
  }

  function finalize() {
    attempts += 1;
    const utility = window.PdfUtility;
    const legacyGuardReady = document.getElementById('pdfToolsResetBelowStyle');
    if (!utility || !legacyGuardReady) {
      if (attempts < 80) setTimeout(finalize, 75);
      return;
    }

    document.title = 'PDF유틸리티 · Program Studio';
    const description = document.querySelector('meta[name="description"]');
    if (description) description.content = '최대 10개 PDF 일괄 검수, PDF 합치기, 배경색 제거, 용량 줄이기, 복구와 암호 기능을 제공하는 PDF유틸리티입니다.';
    const navTitle = document.querySelector('.nav-title');
    if (navTitle) navTitle.textContent = 'PDF유틸리티';
    const badge = document.querySelector('.hero-badge');
    if (badge) badge.textContent = '📄 PDF UTILITY';
    const title = document.querySelector('.hero h1');
    if (title) title.textContent = 'PDF유틸리티';
    const hero = document.querySelector('.hero p');
    if (hero) hero.textContent = '여러 PDF를 한 번에 검사하고, 합치기·배경색 제거·용량 줄이기·복구·암호 작업까지 한 곳에서 처리하세요.';
    const uploadSub = document.querySelector('.upload-sub');
    if (uploadSub) uploadSub.innerHTML = '클릭하거나 여러 PDF를 끌어다 놓으세요.<br>최대 10개 · 파일당/전체 합계 500MB · PDF 형식만 지원';
    const input = document.getElementById('fileInput');
    if (input) {
      input.multiple = true;
      input.setAttribute('multiple', 'multiple');
    }

    restoreCheckLabel();
    wrapBusyState();
    observeCheckLabel();
    window.runCheck = utility.runBatchCheck;
    document.documentElement.dataset.pdfUtilityFinalized = '1';
    loadWideLayout();
    loadCostGuard();
  }

  finalize();
})();
