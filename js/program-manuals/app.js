(() => {
  'use strict';

  const $ = id => document.getElementById(id);
  const state = { programId: '' };

  function node(tag, className, text) {
    const element = document.createElement(tag);
    if (className) element.className = className;
    if (text !== undefined && text !== null) element.textContent = String(text);
    return element;
  }

  function currentManual() {
    return window.ProgramManuals?.get(state.programId) || window.ProgramManuals?.all()?.[0] || null;
  }

  function setProgram(id, { replace = false } = {}) {
    const manual = window.ProgramManuals?.get(id) || window.ProgramManuals?.all()?.[0];
    if (!manual) return;
    state.programId = manual.id;
    const url = new URL(location.href);
    url.searchParams.set('program', manual.id);
    history[replace ? 'replaceState' : 'pushState'](null, '', `${url.pathname}${url.search}${url.hash}`);
    renderProgramList();
    renderManual();
    window.scrollTo({ top: 0, behavior: 'auto' });
  }

  function renderProgramList() {
    const list = $('programList');
    if (!list) return;
    list.replaceChildren();
    for (const manual of window.ProgramManuals?.all?.() || []) {
      const button = node('button', `pm-program-btn${manual.id === state.programId ? ' active' : ''}`);
      button.type = 'button';
      button.dataset.program = manual.id;
      button.setAttribute('aria-current', manual.id === state.programId ? 'page' : 'false');
      button.append(node('span', 'pm-program-icon', manual.icon || '•'), node('span', '', manual.name));
      button.addEventListener('click', () => {
        setProgram(manual.id);
        closeMobileMenu();
      });
      list.appendChild(button);
    }
  }

  function renderHero(manual) {
    $('currentTitle').textContent = `${manual.name} 사용설명서`;
    $('openProgram').href = manual.href;
    $('heroIcon').textContent = manual.icon || '📘';
    $('heroTitle').textContent = manual.name;
    $('heroSummary').textContent = manual.summary;
    $('heroAudience').textContent = `추천 사용자 · ${manual.audience}`;
    $('heroUpdated').textContent = `설명서 업데이트 · ${manual.updated}`;
  }

  function renderBefore(manual, target) {
    const prep = node('section', 'pm-note');
    prep.appendChild(node('strong', '', '작업 시작 전에 확인하세요'));
    const ul = node('ul');
    (manual.before || []).forEach(text => ul.appendChild(node('li', '', text)));
    prep.appendChild(ul);
    target.appendChild(prep);
  }

  function renderQuick(manual, target) {
    const card = node('section', 'pm-section-card');
    card.appendChild(node('h2', '', '사용 순서'));
    card.appendChild(node('p', 'pm-section-lead', '처음 사용하는 경우 아래 순서대로 진행하면 전체 흐름을 빠르게 이해할 수 있습니다.'));
    const quick = node('div', 'pm-quick');
    (manual.quickStart || []).forEach((step, index) => {
      const item = node('article', 'pm-quick-step');
      item.appendChild(node('span', 'pm-quick-no', index + 1));
      item.appendChild(node('strong', '', step.title));
      item.appendChild(node('p', '', step.text));
      quick.appendChild(item);
    });
    card.appendChild(quick);
    target.appendChild(card);
  }

  function renderDetails(manual, target) {
    for (const section of manual.sections || []) {
      const card = node('section', 'pm-section-card');
      card.appendChild(node('h2', '', section.title));
      if (section.lead) card.appendChild(node('p', 'pm-section-lead', section.lead));
      const grid = node('div', 'pm-detail-grid');
      for (const item of section.items || []) {
        const detail = node('article', 'pm-detail');
        detail.appendChild(node('strong', '', item.label));
        detail.appendChild(node('p', '', item.body));
        grid.appendChild(detail);
      }
      card.appendChild(grid);
      target.appendChild(card);
    }
  }

  function renderTrouble(manual, target) {
    if ((manual.troubleshooting || []).length) {
      const card = node('section', 'pm-section-card');
      card.appendChild(node('h2', '', '문제 해결'));
      card.appendChild(node('p', 'pm-section-lead', '결과가 이상할 때는 아래 항목을 순서대로 확인하세요.'));
      const faq = node('div', 'pm-faq');
      for (const item of manual.troubleshooting) {
        const details = node('details');
        details.appendChild(node('summary', '', item.q));
        details.appendChild(node('p', '', item.a));
        faq.appendChild(details);
      }
      card.appendChild(faq);
      target.appendChild(card);
    }

    if ((manual.glossary || []).length) {
      const glossaryCard = node('section', 'pm-section-card');
      glossaryCard.appendChild(node('h2', '', '용어 정리'));
      const glossary = node('div', 'pm-glossary');
      for (const entry of manual.glossary) {
        const term = node('article', 'pm-term');
        term.appendChild(node('strong', '', entry[0]));
        term.appendChild(node('span', '', entry[1]));
        glossary.appendChild(term);
      }
      glossaryCard.appendChild(glossary);
      target.appendChild(glossaryCard);
    }
  }

  function renderManual() {
    const manual = currentManual();
    if (!manual) {
      $('manualContent')?.replaceChildren(node('div', 'pm-empty', '사용설명서 데이터를 불러오지 못했습니다.'));
      return;
    }
    renderHero(manual);
    const target = $('manualBody');
    if (!target) return;
    target.replaceChildren();
    renderBefore(manual, target);
    renderQuick(manual, target);
    renderDetails(manual, target);
    renderTrouble(manual, target);
  }

  function openMobileMenu() {
    $('manualSidebar')?.classList.add('open');
    $('mobileOverlay')?.classList.add('open');
  }

  function closeMobileMenu() {
    $('manualSidebar')?.classList.remove('open');
    $('mobileOverlay')?.classList.remove('open');
  }

  function installEvents() {
    $('menuBtn')?.addEventListener('click', openMobileMenu);
    $('mobileOverlay')?.addEventListener('click', closeMobileMenu);
    $('printManual')?.addEventListener('click', () => window.print());
    window.addEventListener('popstate', () => {
      const requested = new URL(location.href).searchParams.get('program');
      if (window.ProgramManuals?.get(requested)) {
        state.programId = requested;
        renderProgramList();
        renderManual();
      }
    });
    document.addEventListener('keydown', event => { if (event.key === 'Escape') closeMobileMenu(); });
  }

  function boot() {
    const manuals = window.ProgramManuals?.all?.() || [];
    if (!manuals.length) return;
    installEvents();
    const requested = new URL(location.href).searchParams.get('program');
    state.programId = window.ProgramManuals.get(requested)?.id || manuals[0].id;
    renderProgramList();
    renderManual();
    const url = new URL(location.href);
    if (!url.searchParams.get('program')) {
      url.searchParams.set('program', state.programId);
      history.replaceState(null, '', `${url.pathname}${url.search}${url.hash}`);
    }
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once: true }); else boot();
})();
