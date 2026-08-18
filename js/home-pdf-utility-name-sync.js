// Keep the PDF Utility card name consistent even when the managed catalog is late or unavailable.
(function () {
  'use strict';
  if (window.__homePdfUtilityNameSyncV1) return;
  window.__homePdfUtilityNameSyncV1 = true;

  const path = location.pathname.replace(/\/+$/, '') || '/';
  if (path !== '/' && path !== '/index.html') return;

  const LEGACY_NAMES = new Set([
    'PDF 인쇄 검수',
    'PDF 검사',
    'PDF 인쇄 검수기',
    'PDF 검사기'
  ]);

  function isPdfUtility(program) {
    const name = String(program?.name || '').trim();
    const url = String(program?.url || '').toLowerCase();
    return LEGACY_NAMES.has(name) || /(?:^|\/)pdf-preflight\/?(?:index\.html)?(?:$|[?#])/.test(url);
  }

  function normalizeProgram(program) {
    if (!program || !isPdfUtility(program)) return false;
    const currentName = String(program.name || '').trim();
    if (!LEGACY_NAMES.has(currentName)) return false;
    program.name = 'PDF유틸리티';
    program.icon = '🧰';
    program.desc = '최대 10개 PDF 일괄 검수, 합치기, 배경색 제거, 용량 줄이기, 복구와 암호 작업을 한 곳에서 처리합니다.';
    program.tags = ['PDF 검수', 'PDF 합치기', '배경 제거', '용량 줄이기', 'PDF 복구', '암호'];
    return true;
  }

  function normalizeHome() {
    if (typeof CATEGORIES === 'undefined') return false;
    let changed = false;
    Object.values(CATEGORIES).forEach((category) => {
      const programs = Array.isArray(category?.programs) ? category.programs : [];
      programs.forEach((program) => { changed = normalizeProgram(program) || changed; });
    });
    if (changed && typeof switchCategory === 'function' && typeof active === 'string' && CATEGORIES[active]) {
      switchCategory(active, false);
    }
    document.documentElement.dataset.pdfUtilityHomeName = '1';
    return true;
  }

  function install() {
    let attempts = 0;
    const tryInstall = () => {
      attempts += 1;
      if (normalizeHome() || attempts >= 30) return;
      setTimeout(tryInstall, 80);
    };
    tryInstall();
  }

  window.addEventListener('program-catalog-applied', () => setTimeout(normalizeHome, 0));
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', install, { once: true });
  else install();
})();
