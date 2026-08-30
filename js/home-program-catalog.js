// Apply the administrator-managed public program catalog to the home page.
(function () {
  'use strict';
  if (window.__homeProgramCatalogV1) return;
  window.__homeProgramCatalogV1 = true;
  const path = location.pathname.replace(/\/+$/, '') || '/';
  if (path !== '/' && path !== '/index.html') return;

  const DOC_ID = 'public_program_catalog';
  const text = (value) => String(value == null ? '' : value);
  const escapeHtml = (value) => text(value).replace(/[&<>"']/g, (char) => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[char]));
  const safeBreaks = (value) => escapeHtml(value).replace(/\r?\n/g, '<br>');

  const PROGRAM_ICONS = Object.freeze({
    design: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 19.5h4.3L19 8.8a2 2 0 0 0 0-2.8l-1-1a2 2 0 0 0-2.8 0L4.5 15.7 4 19.5Z"/><path d="m13.8 6.4 3.8 3.8"/><path d="M4 21h16"/></svg>',
    pdf: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 3.5h8l4 4V20H6z"/><path d="M14 3.5V8h4"/><rect x="8.5" y="11" width="3" height="3" rx=".5"/><rect x="13" y="11" width="3" height="3" rx=".5"/><rect x="8.5" y="15.5" width="3" height="2" rx=".5"/><rect x="13" y="15.5" width="3" height="2" rx=".5"/></svg>',
    check: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 3.5h8l4 4V12"/><path d="M14 3.5V8h4"/><path d="M6 3.5V20h7"/><circle cx="16.5" cy="16.5" r="3.5"/><path d="m15 16.5 1 1 2-2"/></svg>',
    image: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3.5" y="4.5" width="17" height="15" rx="2"/><circle cx="9" cy="10" r="1.6"/><path d="m5.5 17 4.2-4.2 2.8 2.8 2.2-2.2 3.8 3.6"/></svg>'
  });

  function catalogBindingsReady() {
    return window.ProgramCatalogCore && window.db && typeof CATEGORIES !== 'undefined' && typeof buildNav === 'function' && typeof switchCategory === 'function';
  }

  function toHomeCategory(category) {
    return {
      label: text(category.name),
      accent: category.accent,
      title: text(category.sectionTitle || category.name),
      badge: text(category.badge),
      heroTitle: `${escapeHtml(category.heroTitle || category.name)}${category.heroAccent ? ` <span>${escapeHtml(category.heroAccent)}</span>` : ''}`,
      lead: text(category.lead),
      copy: safeBreaks(category.copy),
      visual: [text(category.visualIcon || '🧰'), text(category.visualTitle || category.name), text(category.visualText)],
      programs: category.programs.map((program) => ({
        name: escapeHtml(program.name),
        icon: escapeHtml(program.icon || '🧰'),
        accent: program.accent,
        bg: program.bg,
        desc: escapeHtml(program.desc),
        url: window.ProgramCatalogCore.safeUrl(program.url),
        tags: program.tags.map(escapeHtml),
        coming: program.status !== 'active' || !window.ProgramCatalogCore.safeUrl(program.url)
      }))
    };
  }

  function iconKeyForCard(card) {
    const href = text(card.getAttribute('href')).toLowerCase();
    const name = text(card.querySelector('.name')?.textContent).replace(/\s+/g, '');
    if (href.includes('design-editor') || name.includes('디자인')) return 'design';
    if (href.includes('pdf-editor') || name.includes('PDF편집')) return 'pdf';
    if (href.includes('pdf-preflight') || name.includes('인쇄전검사') || name.includes('검사')) return 'check';
    if (href.includes('image-editor') || name.includes('이미지')) return 'image';
    return '';
  }

  function decorateProgramIcons() {
    const grid = document.getElementById('programGrid');
    if (!grid) return 0;
    let changed = 0;
    grid.querySelectorAll('.card').forEach((card) => {
      const icon = card.querySelector('.icon');
      const key = iconKeyForCard(card);
      if (!icon || !key || icon.dataset.programIconKey === key) return;
      icon.dataset.programIconKey = key;
      icon.setAttribute('aria-hidden', 'true');
      icon.innerHTML = PROGRAM_ICONS[key];
      changed += 1;
    });
    return changed;
  }

  function installProgramIconStyle() {
    if (document.getElementById('homeProgramIconStyleV1')) return;
    const style = document.createElement('style');
    style.id = 'homeProgramIconStyleV1';
    style.textContent = `
      #programGrid .card .icon{position:relative;overflow:hidden}
      #programGrid .card .icon svg{width:29px;height:29px;fill:none;stroke:currentColor;stroke-width:1.75;stroke-linecap:round;stroke-linejoin:round}
      #programGrid .card .icon:after{content:"";position:absolute;inset:5px;border-radius:12px;border:1px solid currentColor;opacity:.08;pointer-events:none}
    `;
    document.head.appendChild(style);
  }

  function installProgramIconObserver() {
    installProgramIconStyle();
    decorateProgramIcons();
    const grid = document.getElementById('programGrid');
    if (!grid || grid.dataset.programIconObserver === '1' || typeof MutationObserver !== 'function') return;
    grid.dataset.programIconObserver = '1';
    new MutationObserver(() => decorateProgramIcons()).observe(grid, { childList: true, subtree: true });
    window.addEventListener('program-catalog-applied', decorateProgramIcons);
  }

  function applyHeroTheme(categoryId) {
    const category = window.__programCatalogById?.[categoryId];
    const hero = document.getElementById('hero');
    if (!category || !hero) return;
    hero.style.background = `linear-gradient(145deg,#071a38,#0b2a55 50%,${category.accent})`;
  }

  function installSwitchTheme() {
    if (window.__programCatalogSwitchWrapped || typeof switchCategory !== 'function') return;
    const delegate = switchCategory;
    switchCategory = function managedCatalogSwitchCategory(key, scroll) {
      const result = delegate(key, scroll);
      applyHeroTheme(key);
      decorateProgramIcons();
      return result;
    };
    window.__programCatalogSwitchWrapped = true;
  }

  function applyCatalog(raw) {
    if (!catalogBindingsReady()) return false;
    const catalog = window.ProgramCatalogCore.publicCatalog(raw);
    if (!catalog.categories.length) return false;
    const next = {};
    const byId = {};
    for (const category of catalog.categories) {
      next[category.id] = toHomeCategory(category);
      byId[category.id] = category;
    }
    Object.keys(CATEGORIES).forEach((key) => delete CATEGORIES[key]);
    Object.assign(CATEGORIES, next);
    window.__programCatalogById = byId;
    installSwitchTheme();
    const nav = document.getElementById('studioNav');
    if (nav) nav.replaceChildren();
    const first = catalog.categories[0].id;
    active = first;
    buildNav();
    switchCategory(first, false);
    decorateProgramIcons();
    document.documentElement.dataset.managedProgramCatalog = '1';
    window.dispatchEvent(new CustomEvent('program-catalog-applied', { detail: { categories: catalog.categories.length } }));
    return true;
  }

  async function loadCatalog() {
    if (!catalogBindingsReady()) return false;
    try {
      const snapshot = await db.collection('settings').doc(DOC_ID).get();
      if (!snapshot.exists) return false;
      return applyCatalog(snapshot.data() || {});
    } catch (error) {
      console.warn('Managed program catalog load failed; static home catalog remains active.', error);
      return false;
    }
  }

  async function install() {
    installProgramIconObserver();
    for (let attempt = 0; attempt < 10; attempt += 1) {
      if (catalogBindingsReady()) return loadCatalog();
      await new Promise((resolve) => setTimeout(resolve, 180));
    }
    return false;
  }

  window.HomeProgramCatalog = { install, loadCatalog, applyCatalog, decorateProgramIcons, stage: 'admin-managed-home-navigation-and-programs-with-svg-icons' };
  install();
})();