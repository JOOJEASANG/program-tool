(() => {
  'use strict';

  const $ = id => document.getElementById(id);
  const state = { programId: '', tab: 'quick', demoIndex: 0, demoTimer: null, demoPlaying: false };
  const prefersReducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches === true;

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
    stopDemo();
    state.programId = manual.id;
    state.demoIndex = 0;
    const url = new URL(location.href);
    url.searchParams.set('program', manual.id);
    history[replace ? 'replaceState' : 'pushState'](null, '', `${url.pathname}${url.search}${url.hash}`);
    renderProgramList();
    renderManual();
    window.scrollTo({ top: 0, behavior: prefersReducedMotion ? 'auto' : 'smooth' });
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
      const icon = node('span', 'pm-program-icon', manual.icon || '•');
      const label = node('span', '', manual.name);
      button.append(icon, label);
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

  function renderQuick(manual) {
    const target = $('quickPanel');
    target.replaceChildren();

    const prep = node('section', 'pm-note');
    prep.appendChild(node('strong', '', '작업 시작 전에 확인하세요'));
    const ul = node('ul');
    (manual.before || []).forEach(text => ul.appendChild(node('li', '', text)));
    prep.appendChild(ul);
    target.appendChild(prep);

    const quickCard = node('section', 'pm-section-card');
    quickCard.appendChild(node('h2', '', '가장 빠른 사용 순서'));
    quickCard.appendChild(node('p', 'pm-section-lead', '처음 사용하는 경우 아래 순서대로 한 번만 따라 해보면 전체 흐름을 이해하기 쉽습니다.'));
    const quick = node('div', 'pm-quick');
    (manual.quickStart || []).forEach((step, index) => {
      const card = node('article', 'pm-quick-step');
      card.appendChild(node('span', 'pm-quick-no', index + 1));
      card.appendChild(node('strong', '', step.title));
      card.appendChild(node('p', '', step.text));
      quick.appendChild(card);
    });
    quickCard.appendChild(quick);
    target.appendChild(quickCard);

    const note = node('section', 'pm-section-card');
    note.appendChild(node('h2', '', '처음 사용할 때 권장하는 방법'));
    note.appendChild(node('p', 'pm-section-lead', '중요한 실제 파일보다 복사본이나 테스트 PDF로 먼저 한 번 실행해 보는 것이 좋습니다. 특히 양면, 소책자, 재단, 암호처럼 결과가 출력 방식에 영향을 받는 기능은 시험 결과를 확인한 뒤 본 작업에 적용합니다.'));
    target.appendChild(note);
  }

  function renderDetails(manual) {
    const target = $('detailsPanel');
    target.replaceChildren();
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

  function renderTrouble(manual) {
    const target = $('troublePanel');
    target.replaceChildren();

    const card = node('section', 'pm-section-card');
    card.appendChild(node('h2', '', '자주 발생하는 문제와 해결 방법'));
    card.appendChild(node('p', 'pm-section-lead', '결과가 이상할 때는 원본 파일, 프로그램 설정, 최종 PDF, 프린터 설정을 순서대로 나누어 확인하면 원인을 빨리 찾을 수 있습니다.'));
    const faq = node('div', 'pm-faq');
    for (const item of manual.troubleshooting || []) {
      const details = node('details');
      details.appendChild(node('summary', '', item.q));
      details.appendChild(node('p', '', item.a));
      faq.appendChild(details);
    }
    card.appendChild(faq);
    target.appendChild(card);

    const glossaryCard = node('section', 'pm-section-card');
    glossaryCard.appendChild(node('h2', '', '용어 정리'));
    glossaryCard.appendChild(node('p', 'pm-section-lead', '설정 이름이 헷갈릴 때 참고하세요.'));
    const glossary = node('div', 'pm-glossary');
    for (const entry of manual.glossary || []) {
      const term = node('article', 'pm-term');
      term.appendChild(node('strong', '', entry[0]));
      term.appendChild(node('span', '', entry[1]));
      glossary.appendChild(term);
    }
    glossaryCard.appendChild(glossary);
    target.appendChild(glossaryCard);
  }

  function renderDemo(manual) {
    const target = $('demoPanel');
    target.replaceChildren();
    const wrap = node('div', 'pm-demo-wrap');

    const stage = node('section', 'pm-demo-stage');
    stage.id = 'demoStage';
    const windowBox = node('div', 'pm-demo-window');
    const side = node('div', 'pm-demo-side');
    side.append(node('div', 'pm-demo-dot short'), node('div', 'pm-demo-dot mid'), node('div', 'pm-demo-action'), node('div', 'pm-demo-dot'), node('div', 'pm-demo-dot mid'), node('div', 'pm-demo-dot short'));
    const main = node('div', 'pm-demo-main');
    const paper = node('div', 'pm-demo-paper');
    for (let i = 0; i < 6; i += 1) paper.appendChild(node('span', 'pm-demo-piece'));
    main.appendChild(paper);
    windowBox.append(side, main);
    stage.append(windowBox, node('span', 'pm-demo-focus'), node('span', 'pm-demo-cursor'));

    const card = node('section', 'pm-demo-card');
    card.appendChild(node('h2', '', '자동 시연'));
    card.appendChild(node('div', 'pm-demo-step-label', 'STEP 1'));
    const title = node('h3', '', '');
    title.id = 'demoTitle';
    const text = node('p', '', '');
    text.id = 'demoText';
    const progress = node('div', 'pm-demo-progress');
    const progressBar = node('span');
    progressBar.id = 'demoProgress';
    progress.appendChild(progressBar);
    const controls = node('div', 'pm-demo-controls');
    const prev = node('button', '', '이전');
    prev.type = 'button';
    prev.id = 'demoPrev';
    const play = node('button', 'pm-play', prefersReducedMotion ? '다음 단계' : '자동 재생');
    play.type = 'button';
    play.id = 'demoPlay';
    const next = node('button', '', '다음');
    next.type = 'button';
    next.id = 'demoNext';
    controls.append(prev, play, next);
    card.append(title, text, progress, controls);
    wrap.append(stage, card);
    target.appendChild(wrap);

    prev.addEventListener('click', () => moveDemo(-1));
    next.addEventListener('click', () => moveDemo(1));
    play.addEventListener('click', () => {
      if (prefersReducedMotion) return moveDemo(1);
      if (state.demoPlaying) stopDemo(); else startDemo();
      updateDemo();
    });
    updateDemo();
  }

  function updateDemo() {
    const manual = currentManual();
    const steps = manual?.demo || [];
    if (!steps.length || !$('demoStage')) return;
    state.demoIndex = ((state.demoIndex % steps.length) + steps.length) % steps.length;
    const step = steps[state.demoIndex];
    $('demoStage').dataset.scene = step.scene || 'inspect';
    const label = document.querySelector('.pm-demo-step-label');
    if (label) label.textContent = `STEP ${state.demoIndex + 1} / ${steps.length}`;
    $('demoTitle').textContent = step.title;
    $('demoText').textContent = step.text;
    $('demoProgress').style.width = `${((state.demoIndex + 1) / steps.length) * 100}%`;
    if ($('demoPlay')) $('demoPlay').textContent = prefersReducedMotion ? '다음 단계' : state.demoPlaying ? '일시정지' : '자동 재생';
  }

  function moveDemo(delta) {
    stopDemo();
    const steps = currentManual()?.demo || [];
    if (!steps.length) return;
    state.demoIndex = (state.demoIndex + delta + steps.length) % steps.length;
    updateDemo();
  }

  function startDemo() {
    if (prefersReducedMotion) return;
    stopDemo();
    state.demoPlaying = true;
    state.demoTimer = window.setInterval(() => {
      const steps = currentManual()?.demo || [];
      if (!steps.length) return;
      state.demoIndex = (state.demoIndex + 1) % steps.length;
      updateDemo();
    }, 3600);
  }

  function stopDemo() {
    if (state.demoTimer) window.clearInterval(state.demoTimer);
    state.demoTimer = null;
    state.demoPlaying = false;
    if ($('demoPlay')) $('demoPlay').textContent = prefersReducedMotion ? '다음 단계' : '자동 재생';
  }

  function switchTab(tab) {
    state.tab = tab;
    document.querySelectorAll('.pm-tab').forEach(button => {
      const active = button.dataset.tab === tab;
      button.classList.toggle('active', active);
      button.setAttribute('aria-selected', String(active));
    });
    document.querySelectorAll('.pm-panel').forEach(panel => { panel.hidden = panel.dataset.panel !== tab; });
    if (tab === 'demo' && !prefersReducedMotion) startDemo(); else stopDemo();
  }

  function renderManual() {
    const manual = currentManual();
    if (!manual) {
      $('manualContent').replaceChildren(node('div', 'pm-empty', '사용설명서 데이터를 불러오지 못했습니다.'));
      return;
    }
    renderHero(manual);
    renderQuick(manual);
    renderDetails(manual);
    renderDemo(manual);
    renderTrouble(manual);
    switchTab(state.tab);
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
    document.querySelectorAll('.pm-tab').forEach(button => button.addEventListener('click', () => switchTab(button.dataset.tab)));
    $('menuBtn')?.addEventListener('click', openMobileMenu);
    $('mobileOverlay')?.addEventListener('click', closeMobileMenu);
    $('printManual')?.addEventListener('click', () => window.print());
    window.addEventListener('popstate', () => {
      const requested = new URL(location.href).searchParams.get('program');
      if (window.ProgramManuals?.get(requested)) {
        state.programId = requested;
        state.demoIndex = 0;
        renderProgramList();
        renderManual();
      }
    });
    document.addEventListener('keydown', event => {
      if (event.key === 'Escape') closeMobileMenu();
      if (state.tab !== 'demo' || /INPUT|TEXTAREA|SELECT/.test(document.activeElement?.tagName || '')) return;
      if (event.key === 'ArrowLeft') moveDemo(-1);
      if (event.key === 'ArrowRight') moveDemo(1);
    });
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
