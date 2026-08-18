// Preview-first text inspector for front cover, spine and back cover text.
(function () {
  'use strict';
  if (window.__coverPreviewTextInspectorV1) return;
  window.__coverPreviewTextInspectorV1 = true;
  if (!location.pathname.includes('perfect-binding-cover')) return;

  const FONT_STACKS = {
    pretendard: 'Pretendard,"Noto Sans KR","Malgun Gothic",sans-serif',
    malgun: '"Malgun Gothic","맑은 고딕",sans-serif',
    batang: 'Batang,"바탕",serif',
    gulim: 'Gulim,"굴림",sans-serif',
  };
  const FONT_LABELS = {
    pretendard: '프리텐다드',
    malgun: '맑은 고딕',
    batang: '바탕/명조',
    gulim: '굴림',
  };
  const ALIGNMENTS = ['left', 'center', 'right'];
  const DIRECTIONS = ['bottomToTop', 'vertical', 'topToBottom'];
  const INSTALL_DELAYS = [0, 300, 700, 1200, 1900, 2700, 3600, 4800, 6500];
  let rendererWrapped = false;
  let syncFrame = 0;

  const byId = (id) => document.getElementById(id);
  const clamp = (value, min, max) => Math.max(min, Math.min(max, Number(value) || 0));
  const finite = (value, fallback) => Number.isFinite(Number(value)) ? Number(value) : fallback;

  function api() { return window.CoverTextZones || null; }
  function allItems() { return api()?.allItems?.() || []; }
  function selectedItem() {
    const id = typeof state !== 'undefined' ? String(state.active || '') : '';
    const item = api()?.findItem?.(id) || null;
    return item && ['front', 'spine', 'back'].includes(item.side) ? item : null;
  }
  function normalizeEntry(entry) {
    if (!entry) return null;
    if (!FONT_STACKS[entry.fontKey]) entry.fontKey = 'pretendard';
    if (!ALIGNMENTS.includes(entry.align)) entry.align = 'center';
    if (entry.side === 'spine' && !DIRECTIONS.includes(entry.direction)) {
      entry.direction = byId('spineDirection')?.value || 'bottomToTop';
    }
    entry.weight = clamp(finite(entry.weight, 700), 100, 900);
    return entry;
  }
  function ensureLayout(entry) {
    if (!entry || typeof state === 'undefined') return null;
    state.layout = state.layout || {};
    state.hitBoxes = state.hitBoxes || {};
    state.layout[entry.id] = state.layout[entry.id] || {
      x: finite(entry.x, 50), y: finite(entry.y, 50), scale: finite(entry.scale, 100),
    };
    const layout = state.layout[entry.id];
    layout.x = clamp(finite(layout.x, 50), 0, 100);
    layout.y = clamp(finite(layout.y, 50), 0, 100);
    layout.scale = clamp(finite(layout.scale, 100), 50, 200);
    entry.x = layout.x;
    entry.y = layout.y;
    entry.scale = layout.scale;
    return layout;
  }
  function fontStack(entry) { return FONT_STACKS[normalizeEntry(entry)?.fontKey] || FONT_STACKS.pretendard; }
  function saveAndRender(label, coalesce) {
    try { api()?.save?.(); } catch (_) {}
    try { window.requestRender?.(); } catch (_) {}
    document.dispatchEvent(new CustomEvent('cover-editor-change-committed', {
      detail: { label: label || '미리보기 글자 편집', coalesce: Boolean(coalesce) },
    }));
    queueSync();
  }

  function wrapText(ctx, text, maxWidth) {
    const lines = [];
    String(text || '').split(/\n/).forEach((part) => {
      if (!part) { lines.push(''); return; }
      let line = '';
      for (const ch of part) {
        const next = line + ch;
        if (line && ctx.measureText(next).width > maxWidth) {
          lines.push(line);
          line = ch;
        } else line = next;
      }
      if (line) lines.push(line);
    });
    return lines.length ? lines : [''];
  }

  function geometry(canvas, dpi) {
    if (!canvas || typeof getSpec !== 'function') return null;
    const spec = getSpec();
    const ppm = dpi / 25.4;
    const bleed = spec.bleed * ppm;
    const trimW = spec.trimW * ppm;
    const trimH = spec.trimH * ppm;
    const spineW = spec.spine * ppm;
    const spineX = bleed + trimW;
    return {
      spec,
      panels: {
        back: { x: bleed, y: bleed, w: trimW, h: trimH },
        spine: { x: spineX, y: bleed, w: spineW, h: trimH },
        front: { x: spineX + spineW, y: bleed, w: trimW, h: trimH },
      },
    };
  }

  function drawFrontBack(ctx, entry, layout, panel, dpi) {
    const fontPx = clamp(finite(entry.size, 18), 5, 100) * dpi / 72 * clamp(layout.scale / 100, 0.5, 2);
    const x = panel.x + panel.w * layout.x / 100;
    const y = panel.y + panel.h * layout.y / 100;
    const maxWidth = panel.w * 0.82;
    ctx.save();
    ctx.fillStyle = entry.color || '#12396d';
    ctx.textBaseline = 'middle';
    ctx.font = `${entry.weight || 700} ${fontPx}px ${fontStack(entry)}`;
    const lines = wrapText(ctx, entry.text, maxWidth);
    let widest = 0;
    lines.forEach((line) => { widest = Math.max(widest, ctx.measureText(line).width); });
    widest = Math.max(fontPx * 0.6, Math.min(widest, maxWidth));
    const align = ALIGNMENTS.includes(entry.align) ? entry.align : 'center';
    ctx.textAlign = align;
    const anchorX = align === 'left' ? x - widest / 2 : align === 'right' ? x + widest / 2 : x;
    const lineH = fontPx * 1.25;
    const totalH = Math.max(fontPx, lines.length * lineH);
    lines.forEach((line, index) => {
      ctx.fillText(line, anchorX, y + (index - (lines.length - 1) / 2) * lineH, maxWidth);
    });
    ctx.restore();
    state.hitBoxes[entry.id] = {
      x: x - widest / 2 - 9,
      y: y - totalH / 2 - 7,
      w: widest + 18,
      h: totalH + 14,
    };
  }

  function drawSpine(ctx, entry, layout, panel, dpi) {
    const text = String(entry.text || '').trim();
    const x = panel.x + panel.w * layout.x / 100;
    const y = panel.y + panel.h * layout.y / 100;
    const fontPx = clamp(finite(entry.size, 10), 5, 30) * dpi / 72 * clamp(layout.scale / 100, 0.5, 2);
    const direction = DIRECTIONS.includes(entry.direction)
      ? entry.direction
      : (byId('spineDirection')?.value || 'bottomToTop');
    const maxLength = panel.h * 0.82;
    ctx.save();
    ctx.fillStyle = entry.color || '#ffffff';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = `${entry.weight || 700} ${fontPx}px ${fontStack(entry)}`;
    let width = Math.max(panel.w, fontPx * 1.4);
    let length = fontPx;
    if (direction === 'vertical') {
      const chars = [...text.replace(/\s+/g, '')];
      let gap = fontPx * 1.08;
      if (chars.length * gap > maxLength) gap = Math.max(fontPx * 0.58, maxLength / Math.max(1, chars.length));
      length = Math.max(fontPx, (chars.length - 1) * gap + fontPx);
      chars.forEach((ch, index) => ctx.fillText(ch, x, y + (index - (chars.length - 1) / 2) * gap));
    } else {
      ctx.translate(x, y);
      ctx.rotate(direction === 'topToBottom' ? Math.PI / 2 : -Math.PI / 2);
      const measured = ctx.measureText(text).width;
      ctx.fillText(text, 0, 0, maxLength);
      length = Math.min(measured + 16, maxLength + 16);
    }
    ctx.restore();
    state.hitBoxes[entry.id] = { x: x - width / 2, y: y - length / 2, w: width, h: length };
  }

  function drawStyledTexts(canvas, dpi) {
    if (!canvas || typeof state === 'undefined') return;
    const geo = geometry(canvas, dpi);
    if (!geo) return;
    const ctx = canvas.getContext('2d');
    for (const raw of allItems()) {
      const entry = normalizeEntry(raw);
      const layout = ensureLayout(entry);
      const panel = geo.panels[entry.side];
      const text = String(entry.text || '').trim();
      if (!panel || !layout || !text || (entry.side === 'spine' && geo.spec.spine < 2.2)) {
        state.hitBoxes[entry.id] = null;
        continue;
      }
      if (entry.side === 'spine') drawSpine(ctx, entry, layout, panel, dpi);
      else drawFrontBack(ctx, entry, layout, panel, dpi);
    }
  }

  function wrapRenderer() {
    if (rendererWrapped || typeof window.renderCover !== 'function') return false;
    const controls = window.CoverTextCanvasControls;
    if (!controls) return false;
    try { controls.install?.(); } catch (_) {}
    if (!window.renderCover.__coverTextCanvasControlsV1 && !window.CoverRenderPipeline?.installed) return false;
    const original = window.renderCover;
    const wrapped = function coverPreviewTextInspectorRenderer(canvas, dpi = 110) {
      const items = allItems();
      const texts = items.map((entry) => entry.text);
      let result;
      try {
        items.forEach((entry) => { entry.text = ''; });
        result = Reflect.apply(original, this, arguments);
      } finally {
        items.forEach((entry, index) => { entry.text = texts[index]; });
      }
      drawStyledTexts(canvas, dpi);
      if (canvas?.id === 'previewCanvas') queueSync();
      return result;
    };
    wrapped.__coverPreviewTextInspectorV1 = true;
    wrapped.__coverPreviewTextInspectorDelegate = original;
    window.renderCover = wrapped;
    try { renderCover = wrapped; } catch (_) {}
    rendererWrapped = true;
    return true;
  }

  function installStyles() {
    if (byId('coverPreviewTextInspectorStyles')) return;
    const style = document.createElement('style');
    style.id = 'coverPreviewTextInspectorStyles';
    style.textContent = `
      #coverTextContextToolbar{width:min(720px,calc(100% - 8px));flex-wrap:wrap!important;white-space:normal!important;gap:4px!important;padding:7px!important;line-height:1.25!important}
      .cover-preview-text-inspector{order:-10;flex:1 0 100%;display:grid;grid-template-columns:minmax(150px,1fr) 112px auto auto 34px;gap:5px;align-items:center;padding-bottom:6px;margin-bottom:2px;border-bottom:1px solid #e2e8f0}
      .cover-preview-text-input,.cover-preview-font,.cover-preview-size{height:31px;border:1px solid #cbd5e1;border-radius:7px;background:#fff;color:#1e293b;font-size:10px;font-weight:750;padding:0 8px;min-width:0}
      .cover-preview-size-wrap{display:grid;grid-template-columns:27px 46px 27px;gap:3px}.cover-preview-size{width:46px;text-align:center;padding:0 2px}
      .cover-preview-text-inspector button{height:31px!important;min-width:31px!important;font-size:10px!important}
      .cover-preview-color{width:34px;height:31px;border:1px solid #cbd5e1;border-radius:7px;padding:2px;background:#fff;cursor:pointer}
      .cover-preview-text-options{order:-9;flex:1 0 100%;display:flex;align-items:center;gap:4px;padding-bottom:4px}
      .cover-preview-text-options .label{font-size:8px;font-weight:900;color:#64748b;margin-right:1px}
      .cover-preview-text-options button[aria-pressed="true"]{border-color:#0891b2!important;background:#ecfeff!important;color:#0e7490!important}
      .cover-preview-spine-direction{height:29px;border:1px solid #cbd5e1;border-radius:7px;background:#fff;padding:0 6px;font-size:9px;font-weight:800;color:#334155}
      .cover-preview-help{order:20;flex:1 0 100%;font-size:8px;color:#64748b;padding-top:3px;border-top:1px solid #eef2f7}
      @media(max-width:760px){#coverTextContextToolbar{width:min(96%,560px)}.cover-preview-text-inspector{grid-template-columns:minmax(130px,1fr) 96px auto 34px}.cover-preview-size-wrap{grid-column:1/3}.cover-preview-text-options{flex-wrap:wrap}.cover-preview-help{display:none}}
    `;
    document.head.appendChild(style);
  }

  function ensureInspector() {
    const toolbar = byId('coverTextContextToolbar');
    if (!toolbar || byId('coverPreviewTextInspector')) return Boolean(toolbar);
    installStyles();
    const inspector = document.createElement('div');
    inspector.id = 'coverPreviewTextInspector';
    inspector.className = 'cover-preview-text-inspector';
    inspector.innerHTML = `
      <input id="coverPreviewTextInput" class="cover-preview-text-input" type="text" maxlength="2000" aria-label="선택 글자 내용" placeholder="선택한 문구 수정">
      <select id="coverPreviewFont" class="cover-preview-font" aria-label="글꼴">${Object.entries(FONT_LABELS).map(([value,label]) => `<option value="${value}">${label}</option>`).join('')}</select>
      <div class="cover-preview-size-wrap"><button type="button" id="coverPreviewSizeDown" title="글자 크기 1pt 줄이기">−</button><input id="coverPreviewSize" class="cover-preview-size" type="number" min="5" max="100" step="1" aria-label="글자 크기 pt"><button type="button" id="coverPreviewSizeUp" title="글자 크기 1pt 늘리기">＋</button></div>
      <button type="button" id="coverPreviewBold" title="굵게">B</button>
      <input id="coverPreviewColor" class="cover-preview-color" type="color" aria-label="글자 색상">
    `;
    const options = document.createElement('div');
    options.id = 'coverPreviewTextOptions';
    options.className = 'cover-preview-text-options';
    options.innerHTML = `
      <span class="label">문단 정렬</span>
      <button type="button" data-cover-preview-align="left" title="왼쪽 정렬">왼쪽</button>
      <button type="button" data-cover-preview-align="center" title="가운데 정렬">가운데</button>
      <button type="button" data-cover-preview-align="right" title="오른쪽 정렬">오른쪽</button>
      <span class="label" id="coverPreviewSpineLabel" style="display:none">책등 방향</span>
      <select id="coverPreviewSpineDirection" class="cover-preview-spine-direction" style="display:none" aria-label="책등 글자 방향"><option value="bottomToTop">아래→위</option><option value="vertical">세로쓰기</option><option value="topToBottom">위→아래</option></select>
    `;
    const help = document.createElement('div');
    help.className = 'cover-preview-help';
    help.textContent = '글자를 드래그해 이동 · 모서리를 드래그해 크기 조절 · 아래 배치 버튼으로 안전 여백/가운데에 바로 정렬';
    toolbar.prepend(options);
    toolbar.prepend(inspector);
    toolbar.appendChild(help);
    bindInspector();
    return true;
  }

  function sidebarInput(entry, selector) {
    return document.querySelector(`[data-text-id="${CSS.escape(entry.id)}"] ${selector}`);
  }
  function syncSidebar(entry) {
    const text = sidebarInput(entry, 'input[type="text"]');
    const size = sidebarInput(entry, 'input[type="number"]');
    if (text && text.value !== entry.text) text.value = entry.text;
    if (size && Number(size.value) !== Number(entry.size)) size.value = String(entry.size);
    const color = byId('coverSelectedTextColor');
    if (color && color.value !== entry.color) color.value = entry.color;
    const name = byId('coverSelectedTextName');
    if (name) name.textContent = `${entry.side === 'front' ? '앞표지' : entry.side === 'back' ? '뒤표지' : '책등'} · ${entry.text || '새 글씨'}`;
  }

  function editSelected(mutator, label, coalesce) {
    const entry = normalizeEntry(selectedItem());
    if (!entry) return;
    mutator(entry);
    syncSidebar(entry);
    saveAndRender(label, coalesce);
  }

  function bindInspector() {
    const input = byId('coverPreviewTextInput');
    const font = byId('coverPreviewFont');
    const size = byId('coverPreviewSize');
    const color = byId('coverPreviewColor');
    input?.addEventListener('input', () => editSelected((entry) => { entry.text = input.value; }, '표지 글자 내용 변경', true));
    font?.addEventListener('change', () => editSelected((entry) => { entry.fontKey = FONT_STACKS[font.value] ? font.value : 'pretendard'; }, '표지 글꼴 변경'));
    size?.addEventListener('input', () => editSelected((entry) => { entry.size = clamp(size.value, 5, entry.side === 'spine' ? 30 : 100); }, '표지 글자 크기 변경', true));
    color?.addEventListener('input', () => editSelected((entry) => { entry.color = color.value; }, '표지 글자 색상 변경', true));
    byId('coverPreviewSizeDown')?.addEventListener('click', () => editSelected((entry) => { entry.size = clamp(finite(entry.size, 18) - 1, 5, entry.side === 'spine' ? 30 : 100); }, '표지 글자 크기 변경'));
    byId('coverPreviewSizeUp')?.addEventListener('click', () => editSelected((entry) => { entry.size = clamp(finite(entry.size, 18) + 1, 5, entry.side === 'spine' ? 30 : 100); }, '표지 글자 크기 변경'));
    byId('coverPreviewBold')?.addEventListener('click', () => editSelected((entry) => { entry.weight = finite(entry.weight, 700) >= 700 ? 400 : 800; }, '표지 글자 굵기 변경'));
    document.querySelectorAll('[data-cover-preview-align]').forEach((button) => button.addEventListener('click', () => editSelected((entry) => { entry.align = button.dataset.coverPreviewAlign; }, '표지 문단 정렬 변경')));
    byId('coverPreviewSpineDirection')?.addEventListener('change', (event) => editSelected((entry) => { if (entry.side === 'spine') entry.direction = DIRECTIONS.includes(event.target.value) ? event.target.value : 'bottomToTop'; }, '책등 글자 방향 변경'));
  }

  function syncInspector() {
    syncFrame = 0;
    ensureInspector();
    const entry = normalizeEntry(selectedItem());
    const root = byId('coverPreviewTextInspector');
    const options = byId('coverPreviewTextOptions');
    if (!root || !options) return;
    const enabled = Boolean(entry);
    root.querySelectorAll('input,select,button').forEach((control) => { control.disabled = !enabled; });
    options.querySelectorAll('select,button').forEach((control) => { control.disabled = !enabled; });
    if (!entry) return;
    const input = byId('coverPreviewTextInput');
    const font = byId('coverPreviewFont');
    const size = byId('coverPreviewSize');
    const color = byId('coverPreviewColor');
    const bold = byId('coverPreviewBold');
    if (document.activeElement !== input) input.value = entry.text || '';
    if (font.value !== entry.fontKey) font.value = entry.fontKey;
    if (document.activeElement !== size) size.value = String(Math.round(finite(entry.size, 18)));
    if (color.value !== entry.color) color.value = entry.color || '#12396d';
    bold.setAttribute('aria-pressed', finite(entry.weight, 700) >= 700 ? 'true' : 'false');
    document.querySelectorAll('[data-cover-preview-align]').forEach((button) => {
      button.setAttribute('aria-pressed', button.dataset.coverPreviewAlign === entry.align ? 'true' : 'false');
      button.style.display = entry.side === 'spine' ? 'none' : '';
    });
    const spineSelect = byId('coverPreviewSpineDirection');
    const spineLabel = byId('coverPreviewSpineLabel');
    const isSpine = entry.side === 'spine';
    spineSelect.style.display = isSpine ? '' : 'none';
    spineLabel.style.display = isSpine ? '' : 'none';
    if (isSpine) spineSelect.value = DIRECTIONS.includes(entry.direction) ? entry.direction : 'bottomToTop';
    syncSidebar(entry);
  }

  function queueSync() {
    if (syncFrame) return;
    syncFrame = requestAnimationFrame(syncInspector);
  }

  function updateSidebarHint() {
    const panel = byId('coverTextZonePanel');
    const note = panel?.querySelector('.card-note');
    if (note) note.textContent = '문구만 입력한 뒤 미리보기에서 글자를 클릭하세요. 이동·크기·폰트·정렬·색상은 미리보기에서 바로 편집할 수 있습니다.';
  }

  function install() {
    if (!api()?.data || typeof state === 'undefined') return false;
    normalizeAll();
    updateSidebarHint();
    const wrapped = wrapRenderer();
    ensureInspector();
    queueSync();
    return wrapped || rendererWrapped;
  }
  function normalizeAll() {
    let changed = false;
    for (const entry of allItems()) {
      const before = `${entry.fontKey || ''}|${entry.align || ''}|${entry.direction || ''}`;
      normalizeEntry(entry);
      const after = `${entry.fontKey || ''}|${entry.align || ''}|${entry.direction || ''}`;
      if (before !== after) changed = true;
    }
    if (changed) try { api()?.save?.(); } catch (_) {}
  }

  document.addEventListener('click', queueSync, true);
  document.addEventListener('focusin', queueSync, true);
  document.addEventListener('cover-history-restored', () => { normalizeAll(); queueSync(); });
  window.addEventListener('resize', queueSync);
  for (const delay of INSTALL_DELAYS) setTimeout(install, delay);

  window.CoverPreviewTextInspector = {
    fontStacks: FONT_STACKS,
    normalizeEntry,
    drawStyledTexts,
    install,
    stage: 'preview-first-text-font-size-align-color-spine-direction',
  };
})();
