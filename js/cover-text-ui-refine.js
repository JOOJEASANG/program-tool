// Refine cover text inputs and color palettes without replacing the renderer.
(function () {
  'use strict';
  if (window.__coverTextUiRefineV5) return;
  window.__coverTextUiRefineV5 = true;
  if (!location.pathname.includes('perfect-binding-cover')) return;

  const COLORS = ['#ffffff','#f8fafc','#e2e8f0','#94a3b8','#475569','#111827','#000000','#12396d','#1d4ed8','#0ea5e9','#0f766e','#16a34a','#65a30d','#ca8a04','#ea580c','#dc2626','#be123c','#9333ea','#7c3aed','#6d4c41'];
  const SAMPLE_TITLES = [
    '2026학년도 방과후학교 운영 계획서',
    '2026학년도 방과후학교운영 계획서',
    '2026학년도 방과후학교 운영계획서',
    '2026학년도 방과후학교운영계획서',
    '제목을 입력하세요',
    '책등 글자를 입력하세요'
  ];
  const SPINE_MIGRATION_KEY = 'programTool.coverTextZones.spineClean.v4';
  const DEMO_MIGRATION_KEY = 'programTool.coverTextZones.demoClean.v5';
  const AUTOSAVE_KEYS = [
    'programTool.coverEditor.autosave.v3',
    'programTool.coverEditor.autosave.v2'
  ];
  const LEGACY_TEXT_IDS = [
    'frontTitle', 'institutionName', 'issuerName', 'publishYearLine',
    'spineTop', 'spineCenter', 'spineBottom', 'publisher',
    'publishYear', 'spineTitle'
  ];
  const ZONES = ['top', 'center', 'bottom'];
  const Y = { top: 18, center: 50, bottom: 84 };
  const $ = (selector, root = document) => root.querySelector(selector);
  const text = value => String(value || '').trim();
  const isSampleTitle = value => SAMPLE_TITLES.includes(text(value));

  function hasDemoSignature(fields) {
    if (!fields || typeof fields !== 'object') return false;
    if (isSampleTitle(fields.frontTitle) || isSampleTitle(fields.spineTitle)) return true;
    if (text(fields.institutionName) === '한국초등학교' && text(fields.publishYearLine) === '2026') return true;
    return text(fields.spineTop) === '2026' && Boolean(text(fields.spineCenter) || text(fields.spineBottom));
  }

  function cleanAutosavePayload(payload) {
    if (!payload || typeof payload !== 'object' || !payload.fields || !hasDemoSignature(payload.fields)) {
      return { changed: false, payload };
    }
    const fields = { ...payload.fields };
    for (const id of LEGACY_TEXT_IDS) fields[id] = '';
    return { changed: true, payload: { ...payload, fields } };
  }

  function dispatchValue(input, value) {
    if (!input) return;
    input.value = value;
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.dispatchEvent(new Event('change', { bubbles: true }));
  }

  function cleanLegacyDemoState() {
    let migrated = false;
    try { migrated = localStorage.getItem(DEMO_MIGRATION_KEY) === 'done'; } catch (_) {}
    let cleanedStoredState = false;

    if (!migrated) {
      for (const key of AUTOSAVE_KEYS) {
        try {
          const raw = localStorage.getItem(key);
          if (!raw) continue;
          const result = cleanAutosavePayload(JSON.parse(raw));
          if (!result.changed) continue;
          localStorage.setItem(key, JSON.stringify(result.payload));
          cleanedStoredState = true;
        } catch (_) {}
      }
    }

    const liveFields = {};
    for (const id of LEGACY_TEXT_IDS) liveFields[id] = document.getElementById(id)?.value || '';
    const cleanLiveState = cleanedStoredState || hasDemoSignature(liveFields);
    if (cleanLiveState) {
      for (const id of LEGACY_TEXT_IDS) {
        const input = document.getElementById(id);
        if (input) dispatchValue(input, '');
      }
    } else {
      for (const id of ['frontTitle', 'spineTitle']) {
        const input = document.getElementById(id);
        if (input && isSampleTitle(input.value)) dispatchValue(input, '');
      }
    }

    try { localStorage.setItem(DEMO_MIGRATION_KEY, 'done'); } catch (_) {}
    return cleanLiveState;
  }

  function dispatchInput(input, color) {
    dispatchValue(input, color);
  }

  function palette(input, id, label) {
    if (!input || document.getElementById(id)) return;
    const box = document.createElement('div');
    box.id = id;
    box.className = 'cover-color-palette';
    box.innerHTML = `<div class="cover-color-palette-label">${label}</div><div class="cover-color-swatches"></div>`;
    const grid = $('.cover-color-swatches', box);
    COLORS.forEach(color => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'cover-color-swatch';
      button.title = color;
      button.style.background = color;
      button.addEventListener('click', event => {
        event.preventDefault();
        event.stopPropagation();
        if (!input.disabled) dispatchInput(input, color);
      });
      grid.appendChild(button);
    });
    input.parentElement?.appendChild(box);
  }

  function installStyles() {
    if ($('#coverTextUiRefineStyles')) return;
    const style = document.createElement('style');
    style.id = 'coverTextUiRefineStyles';
    style.textContent = `
      .cover-color-palette{grid-column:1/-1;margin-top:7px;padding-top:7px;border-top:1px solid #dbe5ee}
      .cover-color-palette-label{font-size:8px;font-weight:850;color:#64748b;margin-bottom:5px}
      .cover-color-swatches{display:grid;grid-template-columns:repeat(10,1fr);gap:4px}
      .cover-color-swatch{width:100%;aspect-ratio:1;border:1px solid #cbd5e1;border-radius:5px;cursor:pointer;box-shadow:inset 0 0 0 1px rgba(255,255,255,.35)}
      .cover-color-swatch:hover{outline:2px solid #1d9bb2;outline-offset:1px}
      .cover-spine-fixed .cover-zone-add{display:none!important}
      .cover-spine-fixed .cover-text-row{grid-template-columns:minmax(0,1fr) 58px!important}
      .cover-spine-fixed .cover-text-delete{display:none!important}
      .cover-reset-row{margin-top:7px}
      .cover-reset-btn{width:100%;border:1px solid #fecaca;background:#fff;color:#b91c1c;border-radius:8px;padding:8px 10px;font-size:9px;font-weight:900;cursor:pointer}
      .cover-reset-btn:hover{background:#fff1f2;border-color:#fca5a5}
    `;
    document.head.appendChild(style);
  }

  function makeSpineItem(zone, source) {
    const item = source || {
      id: `coverText_spine_${zone}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2,7)}`,
      text: '', size: 10, color: '#ffffff', weight: 700, x: 50, scale: 100
    };
    item.side = 'spine';
    item.zone = zone;
    item.y = Y[zone];
    item.x = 50;
    item.size = Number(item.size) || 10;
    item.color = item.color || '#ffffff';
    item.scale = Number(item.scale) || 100;
    return item;
  }

  function disableLegacySpine() {
    const legacy = document.getElementById('spineTitle');
    if (!legacy) return;
    legacy.value = '';
    legacy.defaultValue = '';
    legacy.removeAttribute('value');
    legacy.setAttribute('autocomplete', 'off');
    const field = legacy.closest('.field');
    if (field) field.style.display = 'none';
  }

  function normalizeData(clearLegacySpine = false) {
    const api = window.CoverTextZones;
    if (!api?.data) return;

    for (const side of ['front', 'back']) {
      for (const zone of ZONES) {
        for (const item of api.data[side]?.[zone] || []) {
          if (isSampleTitle(item.text)) item.text = '';
        }
      }
    }

    const spine = api.data.spine;
    if (spine) {
      const oldCenter = spine.center?.[0] || spine.top?.[0] || spine.bottom?.[0] || null;
      spine.top = [makeSpineItem('top', spine.top?.[0])];
      spine.center = [makeSpineItem('center', spine.center?.[0] || oldCenter)];
      spine.bottom = [makeSpineItem('bottom', spine.bottom?.[0])];

      let firstCleanup = false;
      try { firstCleanup = localStorage.getItem(SPINE_MIGRATION_KEY) !== 'done'; } catch (_) {}
      for (const zone of ZONES) {
        const item = spine[zone][0];
        if (clearLegacySpine || firstCleanup || isSampleTitle(item.text)) item.text = '';
      }
      if (firstCleanup) {
        try { localStorage.setItem(SPINE_MIGRATION_KEY, 'done'); } catch (_) {}
      }
    }
    api.save?.();
  }

  function refineInputs() {
    disableLegacySpine();
    const panel = $('#coverTextZonePanel');
    if (!panel) return;
    const active = $('.cover-text-side-tab.active', panel)?.dataset.side;
    panel.classList.toggle('cover-spine-fixed', active === 'spine');

    panel.querySelectorAll('.cover-zone').forEach(zone => { zone.style.display = ''; });
    panel.querySelectorAll('.cover-text-row input[type="text"]').forEach(input => {
      input.placeholder = active === 'spine' ? '책등 글자를 입력하세요' : '제목을 입력하세요';
      if (isSampleTitle(input.value)) dispatchValue(input, '');
    });

    const note = $('.card-note', panel);
    if (active === 'spine') {
      panel.querySelectorAll('.cover-zone-add').forEach(button => button.style.display = 'none');
      panel.querySelectorAll('.cover-text-delete').forEach(button => button.style.display = 'none');
      if (note) note.textContent = '책등은 상단·중앙·하단에 각각 한 개씩 입력합니다.';
    } else {
      panel.querySelectorAll('.cover-zone-add').forEach(button => button.style.display = '');
      panel.querySelectorAll('.cover-text-delete').forEach(button => button.style.display = '');
      if (note) note.textContent = '앞·뒤표지는 상단·중앙·하단에 필요한 만큼 글자를 추가합니다.';
    }
  }

  function addPalettes() {
    const selected = $('#coverSelectedTextColor');
    if (selected) palette(selected, 'coverSelectedTextPalette', '글자색 빠른 선택');
    [
      ['#coverColor', 'coverMainColorPalette', '표지색 빠른 선택'],
      ['#bgColor', 'coverBgColorPalette', '배경색 빠른 선택'],
      ['#spineColor', 'coverSpineColorPalette', '책등색 빠른 선택'],
      ['#textColor', 'coverLegacyTextPalette', '기본 글자색 빠른 선택']
    ].forEach(([selector, id, label]) => palette($(selector), id, label));
  }

  function resetCover() {
    if (!window.confirm('표지 제작 내용을 모두 초기화하시겠습니까?')) return;
    [
      'programTool.coverTextZones.v3',
      'programTool.coverTextZones.v2',
      'programTool.coverTextZones.v1',
      'programTool.coverEditor.autosave.v3',
      'programTool.coverEditor.autosave.v2',
      'programTool.coverEditor.imageTools.v1',
      SPINE_MIGRATION_KEY,
      DEMO_MIGRATION_KEY
    ].forEach(key => {
      try { localStorage.removeItem(key); } catch (_) {}
    });
    disableLegacySpine();
    location.reload();
  }

  function addResetButton() {
    const card = $('.download-card');
    if (!card || $('#coverResetBtn')) return;
    const row = document.createElement('div');
    row.className = 'cover-reset-row';
    row.innerHTML = '<button type="button" class="cover-reset-btn" id="coverResetBtn">표지 제작 초기화</button>';
    card.appendChild(row);
    $('#coverResetBtn')?.addEventListener('click', resetCover);
  }

  function boot() {
    installStyles();
    const clearedDemoState = cleanLegacyDemoState();
    disableLegacySpine();
    normalizeData(clearedDemoState);
    refineInputs();
    addPalettes();
    addResetButton();
    let scheduled = false;
    const observer = new MutationObserver(() => {
      if (scheduled) return;
      scheduled = true;
      requestAnimationFrame(() => {
        scheduled = false;
        disableLegacySpine();
        refineInputs();
        addPalettes();
        addResetButton();
      });
    });
    observer.observe(document.querySelector('.settings') || document.body, { childList: true, subtree: true });
  }

  window.CoverSampleTextCleanup = {
    hasDemoSignature,
    cleanAutosavePayload
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => setTimeout(boot, 900));
  else setTimeout(boot, 900);
})();