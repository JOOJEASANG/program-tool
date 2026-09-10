(() => {
  'use strict';
  if (window.ProgramManualHomeModal) return;

  const VERSION = '20260910-1';
  const SCRIPT_BY_PROGRAM = Object.freeze({
    'print-checker': '/js/program-manuals/print-checker.js',
    'smart-print-layout': '/js/program-manuals/smart-print-layout.js',
    'pdf-editor': '/js/program-manuals/pdf-editor.js',
    'pdf-editor-advanced': '/js/program-manuals/pdf-editor-advanced.js',
    'pdf-suite': '/js/program-manuals/pdf-suite.js',
  });
  const loading = new Map();
  let layer = null;
  let body = null;
  let title = null;
  let icon = null;
  let summary = null;
  let openProgram = null;
  let lastFocus = null;

  function node(tag, className, text) {
    const element = document.createElement(tag);
    if (className) element.className = className;
    if (text !== undefined && text !== null) element.textContent = String(text);
    return element;
  }

  function loadScript(id, src) {
    if (document.getElementById(id)) return Promise.resolve();
    if (loading.has(id)) return loading.get(id);
    const promise = new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.id = id;
      script.src = `${src}?v=${VERSION}`;
      script.async = true;
      script.onload = () => resolve();
      script.onerror = () => reject(new Error(`설명서 자산을 불러오지 못했습니다: ${src}`));
      document.head.appendChild(script);
    }).finally(() => loading.delete(id));
    loading.set(id, promise);
    return promise;
  }

  async function ensureManual(programId) {
    if (!window.ProgramManuals) {
      await loadScript('programManualCatalogLazy', '/js/program-manuals/catalog.js');
    }
    const existing = window.ProgramManuals?.get(programId);
    if (existing) return existing;
    const src = SCRIPT_BY_PROGRAM[programId];
    if (!src) throw new Error('해당 프로그램의 설명서를 찾을 수 없습니다.');
    await loadScript(`programManualLazy-${programId}`, src);
    const manual = window.ProgramManuals?.get(programId);
    if (!manual) throw new Error('설명서 데이터가 등록되지 않았습니다.');
    return manual;
  }

  function close() {
    if (!layer || !layer.classList.contains('open')) return;
    layer.classList.remove('open');
    document.body.style.overflow = '';
    if (lastFocus && typeof lastFocus.focus === 'function') lastFocus.focus();
  }

  function buildLayer() {
    if (layer) return;
    layer = node('div', 'ps-manual-layer');
    layer.id = 'programManualLayer';
    layer.setAttribute('role', 'dialog');
    layer.setAttribute('aria-modal', 'true');
    layer.setAttribute('aria-labelledby', 'programManualLayerTitle');

    const dialog = node('div', 'ps-manual-dialog');
    const head = node('div', 'ps-manual-head');
    icon = node('div', 'ps-manual-icon', '📘');
    const copy = node('div', 'ps-manual-head-copy');
    copy.appendChild(node('div', 'ps-manual-kicker', 'PROGRAM MANUAL'));
    title = node('h2', 'ps-manual-title', '사용설명서');
    title.id = 'programManualLayerTitle';
    summary = node('p', 'ps-manual-summary', '');
    copy.append(title, summary);
    const closeButton = node('button', 'ps-manual-close', '×');
    closeButton.type = 'button';
    closeButton.setAttribute('aria-label', '사용설명서 닫기');
    closeButton.addEventListener('click', close);
    head.append(icon, copy, closeButton);

    body = node('div', 'ps-manual-body');
    body.appendChild(node('div', 'ps-manual-loading', '설명서를 불러오는 중입니다.'));

    const actions = node('div', 'ps-manual-actions');
    openProgram = node('a', 'ps-manual-open', '프로그램 열기 →');
    openProgram.href = '/';
    actions.appendChild(openProgram);

    dialog.append(head, body, actions);
    layer.appendChild(dialog);
    layer.addEventListener('click', event => { if (event.target === layer) close(); });
    document.addEventListener('keydown', event => {
      if (event.key === 'Escape' && layer?.classList.contains('open')) close();
    });
    document.body.appendChild(layer);
  }

  function renderChecks(manual, target) {
    if (!(manual.before || []).length) return;
    const section = node('section', 'ps-manual-section');
    section.appendChild(node('h3', '', '작업 전에 확인하세요'));
    const list = node('ul', 'ps-manual-checks');
    manual.before.forEach(text => list.appendChild(node('li', '', text)));
    section.appendChild(list);
    target.appendChild(section);
  }

  function renderQuick(manual, target) {
    if (!(manual.quickStart || []).length) return;
    const section = node('section', 'ps-manual-section');
    section.appendChild(node('h3', '', '사용 순서'));
    section.appendChild(node('p', 'ps-manual-section-lead', '처음 사용할 때는 아래 순서대로 진행하면 됩니다.'));
    const grid = node('div', 'ps-manual-steps');
    manual.quickStart.forEach((step, index) => {
      const item = node('article', 'ps-manual-step');
      item.appendChild(node('span', 'ps-manual-step-no', index + 1));
      const copy = node('div');
      copy.appendChild(node('strong', '', step.title));
      copy.appendChild(node('p', '', step.text));
      item.appendChild(copy);
      grid.appendChild(item);
    });
    section.appendChild(grid);
    target.appendChild(section);
  }

  function renderDetails(manual, target) {
    for (const manualSection of manual.sections || []) {
      const section = node('section', 'ps-manual-section');
      section.appendChild(node('h3', '', manualSection.title));
      if (manualSection.lead) section.appendChild(node('p', 'ps-manual-section-lead', manualSection.lead));
      const grid = node('div', 'ps-manual-detail-grid');
      for (const item of manualSection.items || []) {
        const detail = node('article', 'ps-manual-detail');
        detail.appendChild(node('strong', '', item.label));
        detail.appendChild(node('p', '', item.body));
        grid.appendChild(detail);
      }
      section.appendChild(grid);
      target.appendChild(section);
    }
  }

  function renderTrouble(manual, target) {
    if (!(manual.troubleshooting || []).length) return;
    const section = node('section', 'ps-manual-section');
    section.appendChild(node('h3', '', '문제 해결'));
    const faq = node('div', 'ps-manual-faq');
    for (const item of manual.troubleshooting) {
      const detail = node('details');
      detail.appendChild(node('summary', '', item.q));
      detail.appendChild(node('p', '', item.a));
      faq.appendChild(detail);
    }
    section.appendChild(faq);
    target.appendChild(section);
  }

  function renderGlossary(manual, target) {
    if (!(manual.glossary || []).length) return;
    const section = node('section', 'ps-manual-section');
    section.appendChild(node('h3', '', '용어 정리'));
    const grid = node('div', 'ps-manual-glossary');
    for (const entry of manual.glossary) {
      const term = node('article', 'ps-manual-term');
      term.appendChild(node('strong', '', entry[0]));
      term.appendChild(node('span', '', entry[1]));
      grid.appendChild(term);
    }
    section.appendChild(grid);
    target.appendChild(section);
  }

  function renderManual(manual) {
    icon.textContent = manual.icon || '📘';
    title.textContent = `${manual.name} 사용설명서`;
    summary.textContent = manual.summary || '';
    openProgram.href = manual.href || '/';
    const fragment = document.createDocumentFragment();
    const meta = node('div', 'ps-manual-meta');
    if (manual.audience) meta.appendChild(node('span', '', `추천 사용자 · ${manual.audience}`));
    if (manual.updated) meta.appendChild(node('span', '', `업데이트 · ${manual.updated}`));
    fragment.appendChild(meta);
    renderChecks(manual, fragment);
    renderQuick(manual, fragment);
    renderDetails(manual, fragment);
    renderTrouble(manual, fragment);
    renderGlossary(manual, fragment);
    body.replaceChildren(fragment);
    body.scrollTop = 0;
  }

  async function open(programId, trigger = document.activeElement) {
    buildLayer();
    lastFocus = trigger instanceof HTMLElement ? trigger : null;
    layer.classList.add('open');
    document.body.style.overflow = 'hidden';
    body.replaceChildren(node('div', 'ps-manual-loading', '설명서를 불러오는 중입니다.'));
    try {
      const manual = await ensureManual(programId);
      renderManual(manual);
      layer.querySelector('.ps-manual-close')?.focus();
    } catch (error) {
      body.replaceChildren(node('div', 'ps-manual-error', error?.message || '설명서를 불러오지 못했습니다.'));
    }
  }

  window.ProgramManualHomeModal = Object.freeze({ open, close, ensureManual, version: VERSION });
})();
