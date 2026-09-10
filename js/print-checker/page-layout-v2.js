/* page-layout-v2.js — large front/back page placement boards for leaflet and booklet */
(function () {
  'use strict';
  if (window.__printCheckerPageLayoutV2) return;
  window.__printCheckerPageLayoutV2 = true;

  const FOLDS = Object.freeze({
    '2fold':  { label: '반접기 (2단)', outside: [4, 1], inside: [2, 3], cover: 1, back: 4 },
    '3roll':  { label: '말아접기 (3단)', outside: [6, 5, 1], inside: [2, 3, 4], cover: 1, back: 6 },
    '3zfold': { label: 'Z접기 (3단)', outside: [1, 2, 3], inside: [6, 5, 4], cover: 1, back: 6 },
    '4fold':  { label: '4단 접기', outside: [8, 7, 6, 1], inside: [2, 3, 4, 5], cover: 1, back: 8 },
  });

  const byId = (id) => document.getElementById(id);
  let timer = 0;
  let guideObserver = null;

  function checker() {
    try {
      if (typeof PrintChecker !== 'undefined') return PrintChecker;
    } catch (_) {}
    return window.PrintChecker || null;
  }

  function state() {
    try { return checker()?.getState?.() || {}; } catch (_) { return {}; }
  }

  function pageCell(page, fold) {
    const role = page === fold.cover ? '앞표지' : page === fold.back ? '뒷면' : '';
    return `<div class="pc-layout-page${role ? ' is-key-page' : ''}"><strong>P${page}</strong>${role ? `<span>${role}</span>` : '<span>내지</span>'}</div>`;
  }

  function sidePanel(title, subtitle, body, side) {
    return `<section class="pc-layout-side pc-layout-${side}"><header><span>${side === 'front' ? 'LEFT' : 'RIGHT'}</span><div><h4>${title}</h4><p>${subtitle}</p></div></header>${body}</section>`;
  }

  function renderLeaflet(current) {
    const target = byId('leafletGuide');
    if (!target) return;
    if (current.product !== 'leaflet') {
      target.hidden = true;
      target.classList.remove('pc-page-layout-board');
      return;
    }
    const key = current.specs?.foldType || byId('foldType')?.value || '3roll';
    const fold = FOLDS[key] || FOLDS['3roll'];
    const outside = `<div class="pc-layout-panel-grid panels-${fold.outside.length}">${fold.outside.map((page) => pageCell(page, fold)).join('')}</div>`;
    const inside = `<div class="pc-layout-panel-grid panels-${fold.inside.length}">${fold.inside.map((page) => pageCell(page, fold)).join('')}</div>`;
    target.classList.add('pc-page-layout-board');
    target.innerHTML = `<div class="pc-layout-heading"><div><span class="pc-layout-kicker">리플렛 페이지 배치</span><h3>${fold.label}</h3></div><p>왼쪽은 앞면 인쇄, 오른쪽은 뒷면 인쇄입니다. 각 패널은 왼쪽→오른쪽 순서입니다.</p></div><div class="pc-layout-columns">${sidePanel('앞면 배치', '외부면 · 인쇄 1면', outside, 'front')}${sidePanel('뒷면 배치', '내부면 · 인쇄 2면', inside, 'back')}</div>`;
    target.hidden = false;
  }

  function fallbackBookletPlan(sourcePages) {
    const imp = checker()?.computeImposition?.(sourcePages);
    if (!imp) return null;
    return {
      ...imp,
      sourcePages,
      result: imp.result.map((sheet) => ({ sheet: sheet.sheet, front: sheet.front, back: sheet.back })),
      useLastPageAsBackCover: false,
    };
  }

  function bookletPlan(sourcePages) {
    try {
      const helper = window.PrintCheckerBookletLayoutOnly;
      if (helper?.buildLayoutPlan) return helper.buildLayoutPlan(sourcePages, Boolean(byId('bookletUseLastPageAsBackCover')?.checked));
    } catch (_) {}
    return fallbackBookletPlan(sourcePages);
  }

  function bookletPage(page, sourcePages, markBack) {
    const blank = page === null || page === undefined || Number(page) > Number(sourcePages || 0);
    if (blank) return '<div class="pc-booklet-page is-blank"><strong>빈 페이지</strong><span>자동 배치</span></div>';
    const isBack = markBack && Number(page) === Number(sourcePages);
    return `<div class="pc-booklet-page${isBack ? ' is-back-cover' : ''}"><strong>P${page}</strong><span>${isBack ? '뒤표지' : '페이지'}</span></div>`;
  }

  function bookletSheets(plan, side) {
    const rows = plan.result.map((sheet) => {
      const pages = side === 'front' ? sheet.front : sheet.back;
      return `<div class="pc-booklet-sheet"><div class="pc-booklet-sheet-title">시트 ${sheet.sheet}</div><div class="pc-booklet-pair">${bookletPage(pages[0], plan.sourcePages, plan.useLastPageAsBackCover)}${bookletPage(pages[1], plan.sourcePages, plan.useLastPageAsBackCover)}</div></div>`;
    }).join('');
    return `<div class="pc-booklet-sheets">${rows}</div>`;
  }

  function renderBooklet(current) {
    const target = byId('impositionGuide');
    if (!target) return;
    if (current.product !== 'booklet') {
      target.hidden = true;
      target.classList.remove('pc-page-layout-board');
      return;
    }

    const sourcePages = Math.max(1, parseInt(byId('bookletPages')?.value || current.specs?.bookletPages || 8, 10) || 8);
    const plan = bookletPlan(sourcePages);
    if (!plan) return;

    target.classList.remove('pc-booklet-only-hidden');
    target.classList.add('pc-page-layout-board');
    const blankText = plan.blank ? ` · 빈 페이지 ${plan.blank}p 자동 배치` : '';
    const coverText = plan.useLastPageAsBackCover ? ` · P${sourcePages} 뒤표지 고정` : '';
    target.innerHTML = `<div class="pc-layout-heading"><div><span class="pc-layout-kicker">소책자 페이지 배치</span><h3>${sourcePages}p → ${plan.pages}p / ${plan.sheets}장${blankText}${coverText}</h3></div><p>각 시트의 인쇄면을 크게 나눠 표시합니다. 왼쪽은 앞면, 오른쪽은 뒤집어 인쇄할 뒷면입니다.</p></div><div class="pc-layout-columns pc-booklet-layout-columns">${sidePanel('앞면 배치', '모든 시트의 앞면', bookletSheets(plan, 'front'), 'front')}${sidePanel('뒷면 배치', '모든 시트의 뒷면', bookletSheets(plan, 'back'), 'back')}</div>`;
    target.hidden = false;
  }

  function render() {
    const current = state();
    renderLeaflet(current);
    renderBooklet(current);
    document.documentElement.dataset.printCheckerPageLayout = 'v2-large-front-back';
  }

  function schedule(delay = 0) {
    window.clearTimeout(timer);
    timer = window.setTimeout(render, delay);
  }

  function keepBookletVisible() {
    const target = byId('impositionGuide');
    if (!target || guideObserver || typeof MutationObserver !== 'function') return;
    guideObserver = new MutationObserver(() => {
      if (state().product !== 'booklet') return;
      if (target.hidden || target.classList.contains('pc-booklet-only-hidden')) schedule(0);
    });
    guideObserver.observe(target, { attributes: true, attributeFilter: ['class', 'hidden'] });
  }

  function boot() {
    keepBookletVisible();
    document.addEventListener('click', (event) => {
      if (event.target.closest?.('.product-card')) schedule(20);
    });
    byId('specForm')?.addEventListener('input', () => schedule(20));
    byId('specForm')?.addEventListener('change', () => schedule(20));
    const form = byId('specForm');
    if (form && typeof MutationObserver === 'function') {
      new MutationObserver(() => schedule(20)).observe(form, { childList: true, subtree: true });
    }
    schedule(40);
  }

  window.PrintCheckerPageLayout = Object.freeze({ render, stage: 'v2-large-front-back' });
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once: true });
  else boot();
})();
