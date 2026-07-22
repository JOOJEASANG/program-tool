// Refine cover text inputs and color palettes without replacing the renderer.
(function () {
  'use strict';
  if (window.__coverTextUiRefineV1) return;
  window.__coverTextUiRefineV1 = true;
  if (!location.pathname.includes('perfect-binding-cover')) return;

  const COLORS = ['#ffffff','#f8fafc','#e2e8f0','#94a3b8','#475569','#111827','#000000','#12396d','#1d4ed8','#0ea5e9','#0f766e','#16a34a','#65a30d','#ca8a04','#ea580c','#dc2626','#be123c','#9333ea','#7c3aed','#6d4c41'];
  const DEFAULT_TITLE = '2026학년도 방과후학교 운영 계획서';
  const $ = (selector, root = document) => root.querySelector(selector);

  function dispatchInput(input, color) {
    input.value = color;
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.dispatchEvent(new Event('change', { bubbles: true }));
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
      .cover-spine-simple .cover-zone-head{display:none!important}
      .cover-spine-simple .cover-zone{border:0!important;background:transparent!important;margin:0!important}
      .cover-spine-simple .cover-zone-list{padding:0!important}
      .cover-spine-simple .cover-text-row{grid-template-columns:minmax(0,1fr) 58px!important;margin:0!important}
      .cover-spine-simple .cover-text-delete{display:none!important}
      .cover-spine-simple .cover-zone-empty{display:none!important}
    `;
    document.head.appendChild(style);
  }

  function normalizeData() {
    const api = window.CoverTextZones;
    if (!api?.data) return;

    for (const side of ['front', 'back']) {
      for (const zone of ['top', 'center', 'bottom']) {
        for (const item of api.data[side]?.[zone] || []) {
          if (item.text === DEFAULT_TITLE) item.text = '';
        }
      }
    }

    const spine = api.data.spine;
    if (spine) {
      const existing = [...(spine.center || []), ...(spine.top || []), ...(spine.bottom || [])][0];
      const item = existing || {
        id: `coverText_spine_${Date.now().toString(36)}`,
        side: 'spine', zone: 'center', text: '', size: 10, color: '#ffffff', weight: 700,
        x: 50, y: 50, scale: 100
      };
      item.side = 'spine'; item.zone = 'center'; item.y = Number.isFinite(Number(item.y)) ? Number(item.y) : 50;
      spine.top = []; spine.center = [item]; spine.bottom = [];
    }
    api.save?.();
  }

  function refineInputs() {
    const panel = $('#coverTextZonePanel');
    if (!panel) return;
    const active = $('.cover-text-side-tab.active', panel)?.dataset.side;
    panel.classList.toggle('cover-spine-simple', active === 'spine');

    const zones = [...panel.querySelectorAll('.cover-zone')];
    zones.forEach((zone, index) => {
      if (active === 'spine' && index !== 1) zone.style.display = 'none';
      else zone.style.display = '';
    });

    panel.querySelectorAll('.cover-text-row input[type="text"]').forEach(input => {
      input.placeholder = active === 'spine' ? '책등 제목을 입력하세요' : '제목을 입력하세요';
      if (input.value === DEFAULT_TITLE) {
        input.value = '';
        input.dispatchEvent(new Event('input', { bubbles: true }));
      }
    });

    if (active === 'spine') {
      panel.querySelectorAll('.cover-zone-add').forEach(button => button.style.display = 'none');
      const note = $('.card-note', panel);
      if (note) note.textContent = '앞·뒤표지는 위치별로 추가하고, 책등은 기본 제목 한 개만 입력합니다.';
    } else {
      panel.querySelectorAll('.cover-zone-add').forEach(button => button.style.display = '');
    }
  }

  function addPalettes() {
    const selected = $('#coverSelectedTextColor');
    if (selected) palette(selected, 'coverSelectedTextPalette', '글자색 빠른 선택');

    const candidates = [
      ['#coverColor', 'coverMainColorPalette', '표지색 빠른 선택'],
      ['#bgColor', 'coverBgColorPalette', '배경색 빠른 선택'],
      ['#spineColor', 'coverSpineColorPalette', '책등색 빠른 선택'],
      ['#textColor', 'coverLegacyTextPalette', '기본 글자색 빠른 선택']
    ];
    candidates.forEach(([selector, id, label]) => palette($(selector), id, label));
  }

  function run() {
    installStyles();
    normalizeData();
    refineInputs();
    addPalettes();
  }

  function boot() {
    run();
    let scheduled = false;
    const observer = new MutationObserver(() => {
      if (scheduled) return;
      scheduled = true;
      requestAnimationFrame(() => { scheduled = false; refineInputs(); addPalettes(); });
    });
    observer.observe(document.querySelector('.settings') || document.body, { childList: true, subtree: true });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => setTimeout(boot, 900));
  else setTimeout(boot, 900);
})();
