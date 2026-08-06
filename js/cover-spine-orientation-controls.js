// Per-layer writing direction controls for spine text in the cover editor.
(function () {
  'use strict';
  if (window.__coverSpineOrientationV1) return;
  window.__coverSpineOrientationV1 = true;
  if (!location.pathname.includes('perfect-binding-cover')) return;

  const ZONES = ['top', 'center', 'bottom'];
  const DIRECTIONS = ['bottomToTop', 'vertical', 'topToBottom'];
  const DIRECTION_LABELS = {
    bottomToTop: '아래→위 90°',
    vertical: '한 글자씩 세로',
    topToBottom: '위→아래 90°',
  };
  const INSTALL_DELAYS = [650, 900, 1300, 1900, 2600];
  const LEGACY_IDS = ['spineTop', 'spineCenter', 'spineBottom', 'spineTitle'];

  let rendererWrapped = false;
  let selectionObserver = null;
  let activeId = '';

  const byId = (id) => document.getElementById(id);
  const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

  function normalizeDirection(value, fallback = 'bottomToTop') {
    return DIRECTIONS.includes(value) ? value : (DIRECTIONS.includes(fallback) ? fallback : 'bottomToTop');
  }

  function legacyDirection() {
    return normalizeDirection(byId('spineDirection')?.value, 'bottomToTop');
  }

  function textApi() {
    return window.CoverTextZones || null;
  }

  function spineEntries() {
    const data = textApi()?.data?.spine;
    if (!data) return [];
    return ZONES.flatMap((zone) => (data[zone] || []).map((entry) => ({ entry, zone })));
  }

  function ensureEntry(entry) {
    if (!entry || entry.side !== 'spine') return entry;
    entry.direction = normalizeDirection(entry.direction, legacyDirection());
    return entry;
  }

  function ensureAllEntries() {
    let changed = false;
    for (const { entry } of spineEntries()) {
      const before = entry.direction;
      ensureEntry(entry);
      if (entry.direction !== before) changed = true;
    }
    if (changed) textApi()?.save?.();
    return changed;
  }

  function requestRenderSafe() {
    try { window.requestRender?.(); } catch (_) {}
  }

  function persist() {
    textApi()?.save?.();
    requestRenderSafe();
  }

  function setDirection(entry, direction) {
    if (!entry || entry.side !== 'spine') return false;
    entry.direction = normalizeDirection(direction, legacyDirection());
    persist();
    syncPanel();
    return true;
  }

  function applyToAll(direction) {
    const normalized = normalizeDirection(direction, legacyDirection());
    let count = 0;
    for (const { entry } of spineEntries()) {
      entry.direction = normalized;
      count += 1;
    }
    if (count) persist();
    syncPanel();
    return count;
  }

  function selectedEntry() {
    const selectedRow = document.querySelector('#coverTextZones .cover-text-row.selected');
    const id = selectedRow?.dataset?.textId || activeId;
    const entry = id ? textApi()?.findItem?.(id) : null;
    return entry?.side === 'spine' ? ensureEntry(entry) : null;
  }

  function installStyles() {
    if (byId('coverSpineOrientationStyles')) return;
    const style = document.createElement('style');
    style.id = 'coverSpineOrientationStyles';
    style.textContent = `
      .cover-spine-orientation{margin-top:9px;padding:9px;border:1px solid #c7dbe6;border-radius:10px;background:#f8fbfd}
      .cover-spine-orientation[hidden]{display:none!important}
      .cover-spine-orientation-head{display:flex;align-items:center;gap:7px;margin-bottom:7px}
      .cover-spine-orientation-head strong{font-size:10px;color:#334155}
      .cover-spine-orientation-name{margin-left:auto;max-width:145px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:8px;color:#64748b}
      .cover-spine-orientation-buttons{display:grid;grid-template-columns:repeat(3,1fr);gap:5px}
      .cover-spine-orientation-button{min-height:32px;border:1px solid #cbd5e1;border-radius:7px;background:#fff;color:#475569;padding:5px 3px;font-size:8px;font-weight:900;cursor:pointer}
      .cover-spine-orientation-button.active{border-color:#1d9bb2;background:#ecfeff;color:#0e7490;box-shadow:0 0 0 2px rgba(29,155,178,.1)}
      .cover-spine-orientation-apply{width:100%;margin-top:6px;border:1px solid #bae6fd;border-radius:7px;background:#eff6ff;color:#1d4ed8;padding:6px;font-size:8px;font-weight:900;cursor:pointer}
      .cover-spine-orientation-hint{margin-top:6px;font-size:8px;line-height:1.45;color:#64748b}
      @media(max-width:620px){.cover-spine-orientation-buttons{grid-template-columns:1fr}.cover-spine-orientation-button{min-height:29px}}
    `;
    document.head.appendChild(style);
  }

  function ensurePanel() {
    let panel = byId('coverSpineOrientationPanel');
    if (panel) return panel;
    const root = byId('coverTextZonePanel');
    if (!root) return null;

    panel = document.createElement('div');
    panel.id = 'coverSpineOrientationPanel';
    panel.className = 'cover-spine-orientation';
    panel.hidden = true;
    panel.innerHTML = `
      <div class="cover-spine-orientation-head">
        <strong>선택한 책등 글자 방향</strong>
        <span class="cover-spine-orientation-name" id="coverSpineOrientationName"></span>
      </div>
      <div class="cover-spine-orientation-buttons" role="group" aria-label="책등 글자 방향">
        <button type="button" class="cover-spine-orientation-button" data-spine-direction="bottomToTop">↶ 아래→위 90°</button>
        <button type="button" class="cover-spine-orientation-button" data-spine-direction="vertical">세로쓰기</button>
        <button type="button" class="cover-spine-orientation-button" data-spine-direction="topToBottom">↷ 위→아래 90°</button>
      </div>
      <button type="button" class="cover-spine-orientation-apply" id="coverSpineOrientationApplyAll">현재 방향을 모든 책등 글자에 적용</button>
      <div class="cover-spine-orientation-hint" id="coverSpineOrientationHint">책등 글자마다 방향을 따로 저장하며 미리보기·PNG·PDF에 동일하게 적용합니다.</div>
    `;

    const colorPanel = root.querySelector('.cover-selected-color');
    if (colorPanel?.nextSibling) root.insertBefore(panel, colorPanel.nextSibling);
    else root.appendChild(panel);

    panel.querySelectorAll('[data-spine-direction]').forEach((button) => {
      button.addEventListener('click', () => {
        const entry = selectedEntry();
        if (!entry) return;
        setDirection(entry, button.dataset.spineDirection);
      });
    });
    byId('coverSpineOrientationApplyAll')?.addEventListener('click', () => {
      const entry = selectedEntry();
      if (!entry) return;
      applyToAll(entry.direction);
    });
    return panel;
  }

  function syncPanel() {
    const panel = ensurePanel();
    if (!panel) return false;
    const entry = selectedEntry();
    panel.hidden = !entry;
    if (!entry) return false;

    activeId = entry.id;
    const direction = normalizeDirection(entry.direction, legacyDirection());
    panel.querySelectorAll('[data-spine-direction]').forEach((button) => {
      const active = button.dataset.spineDirection === direction;
      button.classList.toggle('active', active);
      button.setAttribute('aria-pressed', active ? 'true' : 'false');
    });
    const name = byId('coverSpineOrientationName');
    if (name) name.textContent = entry.text || '새 책등 글자';
    const hint = byId('coverSpineOrientationHint');
    if (hint) hint.textContent = `${DIRECTION_LABELS[direction]} · 이 글자에만 적용됨`;
    return true;
  }

  function bindSelectionTracking() {
    const root = byId('coverTextZonePanel');
    if (!root || root.dataset.spineOrientationBound === 'true') return false;
    root.dataset.spineOrientationBound = 'true';

    const remember = (event) => {
      const row = event.target?.closest?.('.cover-text-row');
      if (row?.dataset?.textId) activeId = row.dataset.textId;
      queueMicrotask(syncPanel);
    };
    root.addEventListener('click', remember);
    root.addEventListener('focusin', remember);
    root.addEventListener('input', remember);

    selectionObserver?.disconnect?.();
    selectionObserver = new MutationObserver(syncPanel);
    selectionObserver.observe(root, { childList: true, subtree: true, attributes: true, attributeFilter: ['class'] });
    return true;
  }

  function layoutFor(entry) {
    if (typeof state === 'undefined') return entry;
    return state.layout?.[entry.id] || entry;
  }

  function setFont(ctx, entry, fontPx) {
    ctx.font = `${entry.weight || 700} ${fontPx}px Pretendard,"Malgun Gothic",sans-serif`;
  }

  function drawVertical(ctx, entry, x, y, fontPx, maxLength) {
    const characters = [...String(entry.text || '').replace(/\s+/g, '')];
    if (!characters.length) return { width: fontPx, length: fontPx };
    let gap = fontPx * 1.08;
    const naturalLength = Math.max(fontPx, characters.length * gap);
    if (naturalLength > maxLength) gap = Math.max(fontPx * 0.58, maxLength / characters.length);
    const length = Math.max(fontPx, (characters.length - 1) * gap + fontPx);
    characters.forEach((character, index) => {
      ctx.fillText(character, x, y + (index - (characters.length - 1) / 2) * gap);
    });
    return { width: fontPx * 1.35, length };
  }

  function drawRotated(ctx, entry, x, y, fontPx, maxLength, direction) {
    ctx.translate(x, y);
    ctx.rotate(direction === 'topToBottom' ? Math.PI / 2 : -Math.PI / 2);
    const measured = ctx.measureText(String(entry.text || '')).width;
    ctx.fillText(String(entry.text || ''), 0, 0, maxLength);
    return { width: fontPx * 1.4, length: Math.min(measured + 16, maxLength + 16) };
  }

  function drawSpineEntries(canvas, dpi = 110, interactive = canvas?.id === 'previewCanvas') {
    if (!canvas || typeof getSpec !== 'function' || typeof state === 'undefined') return 0;
    const api = textApi();
    if (!api?.data?.spine) return 0;

    const spec = getSpec();
    const ppm = dpi / 25.4;
    const panel = {
      x: (spec.bleed + spec.trimW) * ppm,
      y: spec.bleed * ppm,
      w: spec.spine * ppm,
      h: spec.trimH * ppm,
    };
    const ctx = canvas.getContext('2d');
    const maxLength = panel.h * 0.28;
    let drawn = 0;

    for (const { entry } of spineEntries()) {
      ensureEntry(entry);
      const text = String(entry.text || '').trim();
      if (!text || spec.spine < 2.2) {
        state.hitBoxes[entry.id] = null;
        continue;
      }

      const layout = layoutFor(entry);
      const x = panel.x + panel.w / 2;
      const y = panel.y + panel.h * clamp(Number(layout?.y ?? entry.y ?? 50) / 100, 0, 1);
      const scale = clamp(Number(layout?.scale ?? entry.scale ?? 100) / 100, 0.5, 2);
      const fontPx = clamp(Number(entry.size) || 10, 5, 30) * dpi / 72 * scale;
      const direction = normalizeDirection(entry.direction, legacyDirection());

      ctx.save();
      ctx.fillStyle = entry.color || '#ffffff';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      setFont(ctx, entry, fontPx);
      const metrics = direction === 'vertical'
        ? drawVertical(ctx, entry, x, y, fontPx, maxLength)
        : drawRotated(ctx, entry, x, y, fontPx, maxLength, direction);
      ctx.restore();

      state.hitBoxes[entry.id] = {
        x: x - Math.max(panel.w, metrics.width) / 2,
        y: y - metrics.length / 2,
        w: Math.max(panel.w, metrics.width),
        h: metrics.length,
      };
      drawn += 1;

      if (interactive && state.active === entry.id) {
        const box = state.hitBoxes[entry.id];
        ctx.save();
        ctx.strokeStyle = '#1d9bb2';
        ctx.lineWidth = Math.max(2, dpi / 60);
        ctx.setLineDash([6, 4]);
        ctx.strokeRect(box.x, box.y, box.w, box.h);
        ctx.restore();
      }
    }
    return drawn;
  }

  function runWithoutNativeSpine(run) {
    const api = textApi();
    const savedZones = {};
    if (api?.data?.spine) {
      for (const zone of ZONES) {
        savedZones[zone] = api.data.spine[zone];
        api.data.spine[zone] = [];
      }
    }

    const savedLegacy = {};
    for (const id of LEGACY_IDS) {
      const element = byId(id);
      if (!element) continue;
      savedLegacy[id] = element.value;
      element.value = '';
    }

    try {
      return run();
    } finally {
      if (api?.data?.spine) for (const zone of ZONES) api.data.spine[zone] = savedZones[zone] || [];
      for (const [id, value] of Object.entries(savedLegacy)) if (byId(id)) byId(id).value = value;
    }
  }

  function wrapRenderer() {
    if (rendererWrapped || typeof renderCover !== 'function' || !textApi()?.data?.spine) return false;
    const original = renderCover;
    const wrapped = function coverSpineOrientationRenderer(canvas, dpi = 110, withGuides, interactive) {
      const result = runWithoutNativeSpine(() => original.apply(this, arguments));
      drawSpineEntries(canvas, dpi, interactive === undefined ? canvas?.id === 'previewCanvas' : interactive);
      return result;
    };
    wrapped.__coverSpineOrientationV1 = true;
    wrapped.__coverSpineOrientationDelegate = original;
    renderCover = wrapped;
    window.renderCover = wrapped;
    rendererWrapped = true;
    return true;
  }

  function install() {
    if (!textApi()?.data?.spine) return false;
    installStyles();
    ensureAllEntries();
    ensurePanel();
    bindSelectionTracking();
    syncPanel();
    wrapRenderer();
    return true;
  }

  window.CoverSpineOrientation = {
    directions: [...DIRECTIONS],
    normalizeDirection,
    ensureEntry,
    spineEntries,
    setDirection,
    applyToAll,
    drawSpineEntries,
    runWithoutNativeSpine,
    install,
    stage: 'per-layer-spine-writing-direction',
  };

  for (const delay of INSTALL_DELAYS) setTimeout(install, delay);
})();
