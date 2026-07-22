// Flexible text zones for the perfect-binding cover editor.
(function () {
  'use strict';
  if (window.__coverTextZonesV1) return;
  window.__coverTextZonesV1 = true;
  if (!location.pathname.includes('perfect-binding-cover')) return;

  const STORE_KEY = 'programTool.coverTextZones.v1';
  const ZONES = ['top', 'center', 'bottom'];
  const ZONE_LABEL = { top: '상단', center: '중앙', bottom: '하단' };
  const SIDE_LABEL = { front: '앞표지', back: '뒤표지' };
  const DEFAULT_Y = { top: 18, center: 50, bottom: 84 };
  let seq = 1;
  let selectedId = null;
  let drag = null;
  let renderWrapped = false;

  const $ = id => document.getElementById(id);
  const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
  const uid = () => `coverText_${Date.now().toString(36)}_${seq++}`;
  const data = { front: { top: [], center: [], bottom: [] }, back: { top: [], center: [], bottom: [] } };

  function item(side, zone, text, size, color, index) {
    const id = uid();
    return {
      id, side, zone, text: text || '', size: size || 22, color: color || '#12396d',
      weight: zone === 'top' ? 800 : 700,
      x: 50, y: clamp(DEFAULT_Y[zone] + (index || 0) * 6, 5, 95), scale: 100,
    };
  }

  function seedFromLegacy() {
    const textColor = $('textColor')?.value || '#12396d';
    const title = $('frontTitle')?.value || '2026학년도 방과후학교 운영 계획서';
    const subtitle = $('frontSubtitle')?.value || '';
    const publisher = [$('publisher')?.value, $('publishYear')?.value].filter(Boolean).join(' · ');
    const back = $('backText')?.value || '';
    data.front.top.push(item('front', 'top', title, Number($('titleSize')?.value) || 28, textColor, 0));
    if (subtitle) data.front.center.push(item('front', 'center', subtitle, 16, textColor, 0));
    if (publisher) data.front.bottom.push(item('front', 'bottom', publisher, 12, textColor, 0));
    if (back) data.back.center.push(item('back', 'center', back, 13, textColor, 0));
  }

  function load() {
    try {
      const saved = JSON.parse(localStorage.getItem(STORE_KEY) || 'null');
      if (saved?.front && saved?.back) {
        for (const side of ['front', 'back']) for (const zone of ZONES) {
          data[side][zone] = (saved[side]?.[zone] || []).map(raw => ({ ...item(side, zone), ...raw, side, zone }));
        }
        return;
      }
    } catch (_) {}
    seedFromLegacy();
  }

  function save() {
    try { localStorage.setItem(STORE_KEY, JSON.stringify(data)); } catch (_) {}
  }

  function allItems() {
    return ['front', 'back'].flatMap(side => ZONES.flatMap(zone => data[side][zone]));
  }

  function findItem(id) { return allItems().find(entry => entry.id === id) || null; }
  function request() { try { window.requestRender?.(); } catch (_) {} }

  function ensureLayout(entry) {
    if (typeof window.state === 'undefined') return;
    state.layout[entry.id] = state.layout[entry.id] || { x: entry.x, y: entry.y, scale: entry.scale || 100 };
    const layout = state.layout[entry.id];
    entry.x = Number(layout.x); entry.y = Number(layout.y); entry.scale = Number(layout.scale);
  }

  function syncFromLayout(entry) {
    if (typeof window.state === 'undefined') return;
    const layout = state.layout[entry.id];
    if (!layout) return;
    entry.x = Number(layout.x); entry.y = Number(layout.y); entry.scale = Number(layout.scale);
  }

  function buildStyles() {
    if ($('coverTextZoneStyles')) return;
    const style = document.createElement('style');
    style.id = 'coverTextZoneStyles';
    style.textContent = `
      .cover-text-card .card-note{font-size:9px}.cover-text-side-tabs{display:grid;grid-template-columns:1fr 1fr;gap:6px;margin-bottom:10px}
      .cover-text-side-tab{border:1px solid #cbd5e1;background:#fff;border-radius:8px;padding:8px;font-size:10px;font-weight:900;cursor:pointer}
      .cover-text-side-tab.active{border-color:#1d9bb2;background:#ecfeff;color:#0e7490}
      .cover-zone{border:1px solid #e2e8f0;border-radius:10px;margin-bottom:8px;overflow:hidden;background:#fbfdff}
      .cover-zone-head{display:flex;align-items:center;justify-content:space-between;padding:8px 9px;background:#f1f5f9}
      .cover-zone-head strong{font-size:10px;color:#334155}.cover-zone-add{border:1px solid #a5d8e2;background:#fff;color:#0e7490;border-radius:6px;padding:5px 8px;font-size:9px;font-weight:900;cursor:pointer}
      .cover-zone-list{padding:7px}.cover-text-row{display:grid;grid-template-columns:minmax(0,1fr) 55px 27px;gap:5px;align-items:center;margin-bottom:6px;padding:6px;border:1px solid #e2e8f0;border-radius:8px;background:#fff}
      .cover-text-row:last-child{margin-bottom:0}.cover-text-row.selected{border-color:#1d9bb2;box-shadow:0 0 0 2px rgba(29,155,178,.12)}
      .cover-text-row input[type=text]{width:100%;border:1px solid #dbe5ee;border-radius:6px;padding:6px;font-size:10px}.cover-text-row input[type=number]{width:100%;border:1px solid #dbe5ee;border-radius:6px;padding:6px 3px;font-size:9px;text-align:center}
      .cover-text-delete{border:0;background:#fff1f2;color:#be123c;border-radius:6px;height:28px;cursor:pointer;font-weight:900}.cover-zone-empty{font-size:9px;color:#94a3b8;text-align:center;padding:7px}
      .cover-selected-color{display:grid;grid-template-columns:1fr 70px;gap:8px;align-items:center;margin-top:10px;padding:9px;border:1px solid #bae6fd;background:#f0f9ff;border-radius:9px}
      .cover-selected-color strong{font-size:10px;color:#0c4a6e}.cover-selected-color span{display:block;font-size:8px;color:#64748b;margin-top:3px}.cover-selected-color input{width:100%;height:34px;border:1px solid #cbd5e1;border-radius:7px;padding:3px;background:#fff}
      #spineIndependentPanel{border:1px solid #cbd5e1!important;border-radius:12px!important;background:#fff!important;padding:12px!important;box-shadow:none!important}
      #spineIndependentPanel .range-line{grid-template-columns:58px minmax(0,1fr) 46px!important;gap:8px!important;padding:5px 0!important}
      #spineIndependentPanel input[type=range]{width:100%!important;accent-color:#12396d!important}
      #spinePartButtons{display:grid!important;grid-template-columns:repeat(3,minmax(0,1fr))!important;gap:6px!important;margin-bottom:9px!important}
      #spinePartButtons button{min-height:32px!important;border-radius:8px!important;font-size:9px!important;white-space:normal!important;line-height:1.25!important}
    `;
    document.head.appendChild(style);
  }

  let activeSide = 'front';
  function buildUi() {
    buildStyles();
    const settings = document.querySelector('.settings');
    if (!settings || $('coverTextZonePanel')) return;
    const oldCard = [...settings.querySelectorAll('.card')].find(card => card.querySelector('.card-title')?.textContent.trim() === '표지 글자');
    if (oldCard) oldCard.style.display = 'none';

    const panel = document.createElement('section');
    panel.className = 'card cover-text-card'; panel.id = 'coverTextZonePanel';
    panel.innerHTML = `<div class="card-head"><span class="step">4</span><div><div class="card-title">표지 글자</div><div class="card-note">앞·뒤표지를 상단·중앙·하단으로 나누어 필요한 만큼 글자를 추가합니다.</div></div></div><div class="cover-text-side-tabs"><button type="button" class="cover-text-side-tab active" data-side="front">앞표지</button><button type="button" class="cover-text-side-tab" data-side="back">뒤표지</button></div><div id="coverTextZones"></div><div class="cover-selected-color"><div><strong id="coverSelectedTextName">미리보기에서 글자를 선택하세요</strong><span>선택한 글자 하나에만 색상이 적용됩니다.</span></div><input type="color" id="coverSelectedTextColor" value="#12396d" disabled></div>`;
    if (oldCard) oldCard.after(panel); else settings.appendChild(panel);

    panel.querySelectorAll('[data-side]').forEach(button => button.addEventListener('click', () => {
      activeSide = button.dataset.side;
      panel.querySelectorAll('[data-side]').forEach(node => node.classList.toggle('active', node === button));
      renderUi();
    }));
    $('coverSelectedTextColor').addEventListener('input', event => {
      const selected = findItem(selectedId); if (!selected) return;
      selected.color = event.target.value; save(); renderUi(); request();
    });
    renderUi();
  }

  function renderUi() {
    const root = $('coverTextZones'); if (!root) return;
    root.innerHTML = '';
    for (const zone of ZONES) {
      const section = document.createElement('div'); section.className = 'cover-zone';
      section.innerHTML = `<div class="cover-zone-head"><strong>${ZONE_LABEL[zone]}</strong><button type="button" class="cover-zone-add">＋ 글씨 추가</button></div><div class="cover-zone-list"></div>`;
      const list = section.querySelector('.cover-zone-list');
      const entries = data[activeSide][zone];
      if (!entries.length) list.innerHTML = '<div class="cover-zone-empty">등록된 글씨가 없습니다.</div>';
      entries.forEach(entry => {
        ensureLayout(entry);
        const row = document.createElement('div'); row.className = 'cover-text-row' + (entry.id === selectedId ? ' selected' : '');
        row.dataset.textId = entry.id;
        row.innerHTML = `<input type="text" value="${String(entry.text).replace(/&/g,'&amp;').replace(/"/g,'&quot;').replace(/</g,'&lt;')}" placeholder="글씨 입력"><input type="number" min="6" max="80" value="${entry.size}" title="글자 크기"><button type="button" class="cover-text-delete" title="삭제">×</button>`;
        const [textInput, sizeInput] = row.querySelectorAll('input');
        textInput.addEventListener('focus', () => select(entry.id));
        textInput.addEventListener('input', event => { entry.text = event.target.value; save(); request(); });
        sizeInput.addEventListener('focus', () => select(entry.id));
        sizeInput.addEventListener('input', event => { entry.size = clamp(Number(event.target.value) || 10, 6, 80); save(); request(); });
        row.querySelector('button').addEventListener('click', () => {
          data[activeSide][zone] = entries.filter(node => node.id !== entry.id);
          if (typeof window.state !== 'undefined') { delete state.layout[entry.id]; delete state.hitBoxes[entry.id]; }
          if (selectedId === entry.id) selectedId = null;
          save(); renderUi(); syncSelectedColor(); request();
        });
        list.appendChild(row);
      });
      section.querySelector('.cover-zone-add').addEventListener('click', () => {
        const entry = item(activeSide, zone, '', zone === 'top' ? 24 : 15, '#12396d', entries.length);
        data[activeSide][zone].push(entry); ensureLayout(entry); selectedId = entry.id; save(); renderUi(); syncSelectedColor(); request();
        setTimeout(() => panelFocus(entry.id), 0);
      });
      root.appendChild(section);
    }
    syncSelectedColor();
  }

  function panelFocus(id) { document.querySelector(`[data-text-id="${id}"] input`)?.focus(); }
  function select(id) {
    const entry = findItem(id); if (!entry) return;
    selectedId = id; activeSide = entry.side;
    if (typeof window.state !== 'undefined') { ensureLayout(entry); state.active = id; }
    document.querySelectorAll('.cover-text-side-tab').forEach(node => node.classList.toggle('active', node.dataset.side === activeSide));
    renderUi(); syncSelectedColor(); request();
  }

  function syncSelectedColor() {
    const input = $('coverSelectedTextColor'), name = $('coverSelectedTextName'); if (!input || !name) return;
    const entry = findItem(selectedId);
    input.disabled = !entry;
    if (entry) { input.value = entry.color; name.textContent = `${SIDE_LABEL[entry.side]} ${ZONE_LABEL[entry.zone]} · ${entry.text || '새 글씨'}`; }
    else name.textContent = '미리보기에서 글자를 선택하세요';
  }

  function wrapText(ctx, text, maxWidth) {
    const lines = []; String(text || '').split(/\n/).forEach(part => {
      if (!part) { lines.push(''); return; }
      let line = '';
      for (const ch of part) { const next = line + ch; if (line && ctx.measureText(next).width > maxWidth) { lines.push(line); line = ch; } else line = next; }
      if (line) lines.push(line);
    }); return lines;
  }

  function drawTexts(canvas, dpi, interactive) {
    if (typeof window.state === 'undefined' || typeof window.getSpec !== 'function') return;
    const ctx = canvas.getContext('2d'); const spec = getSpec(); const ppm = dpi / 25.4;
    const bleed = spec.bleed * ppm, trimW = spec.trimW * ppm, trimH = spec.trimH * ppm;
    const spineX = bleed + trimW, frontX = spineX + spec.spine * ppm;
    const panels = { back: { x: bleed, y: bleed, w: trimW, h: trimH }, front: { x: frontX, y: bleed, w: trimW, h: trimH } };
    for (const entry of allItems()) {
      ensureLayout(entry); syncFromLayout(entry);
      if (!String(entry.text || '').trim()) { state.hitBoxes[entry.id] = null; continue; }
      const panel = panels[entry.side], layout = state.layout[entry.id];
      const x = panel.x + panel.w * clamp(layout.x / 100, 0, 1), y = panel.y + panel.h * clamp(layout.y / 100, 0, 1);
      const fontPx = entry.size * dpi / 72 * clamp((layout.scale || 100) / 100, .5, 2);
      ctx.save(); ctx.fillStyle = entry.color; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.font = `${entry.weight || 700} ${fontPx}px Pretendard,"Malgun Gothic",sans-serif`;
      const lines = wrapText(ctx, entry.text, panel.w * .82); let widest = 0;
      lines.forEach(line => { widest = Math.max(widest, ctx.measureText(line).width); });
      const lineH = fontPx * 1.25, totalH = Math.max(fontPx, lines.length * lineH);
      lines.forEach((line, index) => ctx.fillText(line, x, y + (index - (lines.length - 1) / 2) * lineH)); ctx.restore();
      state.hitBoxes[entry.id] = { x: x - widest / 2 - 9, y: y - totalH / 2 - 7, w: widest + 18, h: totalH + 14 };
    }
    if (interactive && selectedId && state.hitBoxes[selectedId]) {
      const box = state.hitBoxes[selectedId]; ctx.save(); ctx.strokeStyle = '#1d9bb2'; ctx.lineWidth = Math.max(2, dpi / 60); ctx.setLineDash([6, 4]); ctx.strokeRect(box.x, box.y, box.w, box.h); ctx.restore();
    }
  }

  function blankLegacy(run) {
    const ids = ['frontTitle','frontSubtitle','publisher','publishYear','backText']; const values = {};
    ids.forEach(id => { const el = $(id); if (el) { values[id] = el.value; el.value = ''; } });
    try { return run(); } finally { ids.forEach(id => { if ($(id)) $(id).value = values[id]; }); }
  }

  function wrapRenderer() {
    if (renderWrapped || typeof window.renderCover !== 'function') return false;
    const original = window.renderCover;
    window.renderCover = function (canvas, dpi = 110, withGuides, interactive) {
      const result = blankLegacy(() => original.apply(this, arguments));
      drawTexts(canvas, dpi, interactive === undefined ? canvas.id === 'previewCanvas' : interactive);
      return result;
    };
    renderWrapped = true; return true;
  }

  function canvasPoint(event, canvas) {
    const rect = canvas.getBoundingClientRect();
    return { x: (event.clientX - rect.left) * canvas.width / rect.width, y: (event.clientY - rect.top) * canvas.height / rect.height };
  }
  function hit(point, box, pad = 10) { return box && point.x >= box.x-pad && point.x <= box.x+box.w+pad && point.y >= box.y-pad && point.y <= box.y+box.h+pad; }

  function bindCanvas() {
    const canvas = $('previewCanvas'), parent = canvas?.parentElement;
    if (!canvas || !parent || parent.dataset.coverTextZonesBound) return;
    parent.dataset.coverTextZonesBound = '1';
    parent.addEventListener('pointerdown', event => {
      if (event.target !== canvas || event.button !== 0 || typeof window.state === 'undefined') return;
      const point = canvasPoint(event, canvas); const picked = [...allItems()].reverse().find(entry => hit(point, state.hitBoxes[entry.id]));
      if (!picked) return;
      event.stopPropagation(); event.preventDefault(); select(picked.id); ensureLayout(picked);
      drag = { pointerId: event.pointerId, id: picked.id, startX: event.clientX, startY: event.clientY, initial: { ...state.layout[picked.id] } };
      canvas.setPointerCapture(event.pointerId);
    }, true);
    parent.addEventListener('pointermove', event => {
      if (!drag || drag.pointerId !== event.pointerId) return;
      event.stopPropagation(); event.preventDefault();
      const entry = findItem(drag.id); if (!entry) return;
      const rect = canvas.getBoundingClientRect(), spec = getSpec(); const panelCssW = rect.width * spec.trimW / spec.totalW, panelCssH = rect.height * spec.trimH / spec.totalH;
      const layout = state.layout[entry.id]; layout.x = clamp(drag.initial.x + (event.clientX-drag.startX)/Math.max(1,panelCssW)*100, 0, 100); layout.y = clamp(drag.initial.y + (event.clientY-drag.startY)/Math.max(1,panelCssH)*100, 0, 100);
      syncFromLayout(entry); save(); request();
    }, true);
    const finish = event => { if (!drag || drag.pointerId !== event.pointerId) return; event.stopPropagation(); drag = null; try { canvas.releasePointerCapture(event.pointerId); } catch (_) {} save(); request(); };
    parent.addEventListener('pointerup', finish, true); parent.addEventListener('pointercancel', finish, true);
    parent.addEventListener('click', event => {
      if (event.target !== canvas || typeof window.state === 'undefined') return;
      const point = canvasPoint(event, canvas); const picked = [...allItems()].reverse().find(entry => hit(point, state.hitBoxes[entry.id])); if (picked) select(picked.id);
    }, true);
  }

  function moveImagePanel() {
    const imagePanel = $('coverImageToolPanel'); const upload = $('frontUploadBox')?.closest('.card') || $('backUploadBox')?.closest('.card');
    if (imagePanel && upload && imagePanel.previousElementSibling !== upload) upload.after(imagePanel);
  }

  function tidySpine() {
    const panel = $('spineIndependentPanel'); if (!panel) return;
    const title = panel.querySelector('.card-title,.panel-title,strong');
    if (title && !title.dataset.renamed) { title.dataset.renamed = '1'; title.textContent = '책등 요소 편집'; }
  }

  function boot() {
    load(); buildUi(); allItems().forEach(ensureLayout); wrapRenderer(); bindCanvas(); moveImagePanel(); tidySpine(); request();
    setInterval(() => { wrapRenderer(); bindCanvas(); moveImagePanel(); tidySpine(); }, 700);
    window.CoverTextZones = { data, allItems, findItem, select, save };
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => setTimeout(boot, 500));
  else setTimeout(boot, 500);
})();