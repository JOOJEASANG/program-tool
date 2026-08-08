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
    for (let attempt = 0; attempt < 10; attempt += 1) {
      if (catalogBindingsReady()) return loadCatalog();
      await new Promise((resolve) => setTimeout(resolve, 180));
    }
    return false;
  }

  window.HomeProgramCatalog = { install, loadCatalog, applyCatalog, stage: 'admin-managed-home-navigation-and-programs' };
  install();
})();
