// Flexible front/back/spine text editor for the perfect-binding cover maker.
(function () {
  'use strict';
  if (window.__coverTextZonesV3) return;
  window.__coverTextZonesV3 = true;
  if (!location.pathname.includes('perfect-binding-cover')) return;

  const STORE_KEY = 'programTool.coverTextZones.v3';
  const OLD_KEYS = ['programTool.coverTextZones.v2', 'programTool.coverTextZones.v1'];
  const SIDES = ['front', 'spine', 'back'];
  const ZONES = ['top', 'center', 'bottom'];
  const SIDE_LABEL = { front: '앞표지', spine: '책등', back: '뒤표지' };
  const ZONE_LABEL = { top: '상단', center: '중앙', bottom: '하단' };
  const DEFAULT_Y = { top: 18, center: 50, bottom: 84 };
  const $ = id => document.getElementById(id);
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const data = Object.fromEntries(SIDES.map(side => [side, Object.fromEntries(ZONES.map(zone => [zone, []]))]));
  let activeSide = 'front', selectedId = null, seq = 1, drag = null, wrapped = false;

  function uid() { return `coverText_${Date.now().toString(36)}_${seq++}`; }
  function makeItem(side, zone, text = '', size = 18, color = '#12396d', index = 0) {
    return { id: uid(), side, zone, text, size, color, weight: zone === 'top' ? 800 : 700, x: 50, y: clamp(DEFAULT_Y[zone] + index * 6, 5, 95), scale: 100 };
  }
  function allItems() { return SIDES.flatMap(side => ZONES.flatMap(zone => data[side][zone])); }
  function findItem(id) { return allItems().find(item => item.id === id) || null; }
  function save() { try { localStorage.setItem(STORE_KEY, JSON.stringify(data)); } catch (_) {} }
  function request() { try { requestRender(); } catch (_) {} }
  function ensureLayout(entry) {
    if (typeof state === 'undefined') return;
    state.layout[entry.id] = state.layout[entry.id] || { x: entry.x, y: entry.y, scale: entry.scale || 100 };
    entry.x = Number(state.layout[entry.id].x); entry.y = Number(state.layout[entry.id].y); entry.scale = Number(state.layout[entry.id].scale);
  }

  function importOld() {
    for (const key of OLD_KEYS) {
      try {
        const old = JSON.parse(localStorage.getItem(key) || 'null');
        if (old?.front && old?.back) {
          for (const side of ['front', 'back']) for (const zone of ZONES) data[side][zone] = (old[side]?.[zone] || []).map(raw => ({ ...makeItem(side, zone), ...raw, side, zone }));
          return true;
        }
      } catch (_) {}
    }
    return false;
  }
  function load() {
    try {
      const saved = JSON.parse(localStorage.getItem(STORE_KEY) || 'null');
      if (saved?.front && saved?.spine && saved?.back) {
        for (const side of SIDES) for (const zone of ZONES) data[side][zone] = (saved[side]?.[zone] || []).map(raw => ({ ...makeItem(side, zone), ...raw, side, zone }));
        return;
      }
    } catch (_) {}
    importOld();
    if (!data.front.top.length) data.front.top.push(makeItem('front', 'top', $('frontTitle')?.value || '2026학년도 방과후학교 운영 계획서', Number($('titleSize')?.value) || 28, $('textColor')?.value || '#12396d'));
    if (!data.spine.center.length && $('spineTitle')?.value) data.spine.center.push(makeItem('spine', 'center', $('spineTitle').value, Number($('spineTextSize')?.value) || 11, '#ffffff'));
    save();
  }

  function removeLayerPropertyPanels() {
    ['coverLayerPanel','coverMultiPanel','coverLayerStylePanel','coverPropertyPanel','layerPanel','propertyPanel'].forEach(id => $(id)?.remove());
    document.querySelectorAll('.settings .card, .settings section').forEach(panel => {
      const title = panel.querySelector('.card-title,.panel-title,h2,h3,strong')?.textContent?.trim();
      if (title === '레이어' || title === '속성' || title === '레이어와 속성' || title === '레이어 및 속성') panel.remove();
    });
    document.querySelectorAll('script[src*="cover-editor-layer"],script[src*="cover-editor-multiselect"],script[src*="layer-style"]').forEach(script => script.remove());
  }

  function installStyles() {
    if ($('coverTextZoneStylesV3')) return;
    const style = document.createElement('style'); style.id = 'coverTextZoneStylesV3';
    style.textContent = `.cover-text-side-tabs{display:grid;grid-template-columns:repeat(3,1fr);gap:6px;margin-bottom:10px}.cover-text-side-tab{border:1px solid #cbd5e1;background:#fff;border-radius:8px;padding:8px 3px;font-size:10px;font-weight:900;cursor:pointer}.cover-text-side-tab.active{border-color:#1d9bb2;background:#ecfeff;color:#0e7490}.cover-zone{border:1px solid #e2e8f0;border-radius:10px;margin-bottom:8px;overflow:hidden;background:#fbfdff}.cover-zone-head{display:flex;align-items:center;justify-content:space-between;padding:8px 9px;background:#f1f5f9}.cover-zone-head strong{font-size:10px;color:#334155}.cover-zone-add{border:1px solid #a5d8e2;background:#fff;color:#0e7490;border-radius:6px;padding:5px 8px;font-size:9px;font-weight:900;cursor:pointer}.cover-zone-list{padding:7px}.cover-text-row{display:grid;grid-template-columns:minmax(0,1fr) 55px 27px;gap:5px;align-items:center;margin-bottom:6px;padding:6px;border:1px solid #e2e8f0;border-radius:8px;background:#fff}.cover-text-row.selected{border-color:#1d9bb2;box-shadow:0 0 0 2px rgba(29,155,178,.12)}.cover-text-row input{width:100%;border:1px solid #dbe5ee;border-radius:6px;padding:6px;font-size:10px}.cover-text-row input[type=number]{text-align:center}.cover-text-delete{border:0;background:#fff1f2;color:#be123c;border-radius:6px;height:28px;cursor:pointer;font-weight:900}.cover-zone-empty{font-size:9px;color:#94a3b8;text-align:center;padding:7px}.cover-selected-color{display:grid;grid-template-columns:1fr 70px;gap:8px;align-items:center;margin-top:10px;padding:9px;border:1px solid #bae6fd;background:#f0f9ff;border-radius:9px}.cover-selected-color strong{font-size:10px;color:#0c4a6e}.cover-selected-color span{display:block;font-size:8px;color:#64748b;margin-top:3px}.cover-selected-color input{width:100%;height:34px;border:1px solid #cbd5e1;border-radius:7px;padding:3px;background:#fff}`;
    document.head.appendChild(style);
  }

  function syncSelectionUi() {
    document.querySelectorAll('.cover-text-row').forEach(row => row.classList.toggle('selected', row.dataset.textId === selectedId));
    document.querySelectorAll('.cover-text-side-tab').forEach(tab => tab.classList.toggle('active', tab.dataset.side === activeSide));
    const color = $('coverSelectedTextColor'), name = $('coverSelectedTextName'), entry = findItem(selectedId);
    if (!color || !name) return;
    color.disabled = !entry;
    if (entry) { color.value = entry.color; name.textContent = `${SIDE_LABEL[entry.side]} ${ZONE_LABEL[entry.zone]} · ${entry.text || '새 글씨'}`; }
    else name.textContent = '미리보기에서 글자를 선택하세요';
  }
  function select(id, rebuild = true) {
    const entry = findItem(id); if (!entry) return;
    const changed = activeSide !== entry.side; selectedId = id; activeSide = entry.side; ensureLayout(entry);
    if (typeof state !== 'undefined') state.active = id;
    if (changed && rebuild) renderRows(); else syncSelectionUi(); request();
  }

  function renderRows() {
    const root = $('coverTextZones'); if (!root) return; root.innerHTML = '';
    for (const zone of ZONES) {
      const section = document.createElement('div'); section.className = 'cover-zone';
      section.innerHTML = `<div class="cover-zone-head"><strong>${ZONE_LABEL[zone]}</strong><button type="button" class="cover-zone-add">＋ 글씨 추가</button></div><div class="cover-zone-list"></div>`;
      const list = section.querySelector('.cover-zone-list'), entries = data[activeSide][zone];
      if (!entries.length) list.innerHTML = '<div class="cover-zone-empty">등록된 글씨가 없습니다.</div>';
      entries.forEach(entry => {
        ensureLayout(entry); const row = document.createElement('div'); row.className = 'cover-text-row'; row.dataset.textId = entry.id;
        const text = document.createElement('input'); text.type = 'text'; text.placeholder = '글씨 입력'; text.value = entry.text;
        const size = document.createElement('input'); size.type = 'number'; size.min = '5'; size.max = activeSide === 'spine' ? '30' : '80'; size.value = String(entry.size); size.title = '글자 크기';
        const del = document.createElement('button'); del.type = 'button'; del.className = 'cover-text-delete'; del.textContent = '×'; del.title = '삭제';
        text.onfocus = () => select(entry.id, false); text.oninput = e => { entry.text = e.target.value; save(); syncSelectionUi(); request(); };
        size.onfocus = () => select(entry.id, false); size.oninput = e => { entry.size = clamp(Number(e.target.value) || 10, 5, activeSide === 'spine' ? 30 : 80); save(); request(); };
        del.onclick = () => { data[activeSide][zone] = data[activeSide][zone].filter(v => v.id !== entry.id); if (typeof state !== 'undefined') { delete state.layout[entry.id]; delete state.hitBoxes[entry.id]; } if (selectedId === entry.id) selectedId = null; save(); renderRows(); request(); };
        row.append(text, size, del); list.appendChild(row);
      });
      section.querySelector('.cover-zone-add').onclick = () => { const entry = makeItem(activeSide, zone, '', activeSide === 'spine' ? 10 : zone === 'top' ? 24 : 15, activeSide === 'spine' ? '#ffffff' : '#12396d', entries.length); data[activeSide][zone].push(entry); ensureLayout(entry); selectedId = entry.id; save(); renderRows(); request(); setTimeout(() => document.querySelector(`[data-text-id="${entry.id}"] input[type=text]`)?.focus(), 0); };
      root.appendChild(section);
    }
    syncSelectionUi();
  }

  function buildUi() {
    installStyles(); removeLayerPropertyPanels(); $('coverTextZonePanel')?.remove();
    const settings = document.querySelector('.settings'); if (!settings) return;
    const oldCard = [...settings.querySelectorAll('.card')].find(card => card.querySelector('.card-title')?.textContent.trim() === '표지 글자'); if (oldCard) oldCard.style.display = 'none';
    const legacySpine = $('spineTitle')?.closest('.field'); if (legacySpine) legacySpine.style.display = 'none';
    const panel = document.createElement('section'); panel.className = 'card cover-text-card'; panel.id = 'coverTextZonePanel';
    panel.innerHTML = `<div class="card-head"><span class="step">4</span><div><div class="card-title">표지 글자</div><div class="card-note">앞표지·책등·뒤표지를 각각 상단·중앙·하단으로 나누어 글자를 추가합니다.</div></div></div><div class="cover-text-side-tabs"><button type="button" class="cover-text-side-tab active" data-side="front">앞표지</button><button type="button" class="cover-text-side-tab" data-side="spine">책등</button><button type="button" class="cover-text-side-tab" data-side="back">뒤표지</button></div><div id="coverTextZones"></div><div class="cover-selected-color"><div><strong id="coverSelectedTextName">미리보기에서 글자를 선택하세요</strong><span>선택한 글자 하나에만 색상이 적용됩니다.</span></div><input type="color" id="coverSelectedTextColor" value="#12396d" disabled></div>`;
    if (oldCard) oldCard.after(panel); else settings.appendChild(panel);
    panel.querySelectorAll('[data-side]').forEach(button => button.onclick = () => { activeSide = button.dataset.side; renderRows(); });
    $('coverSelectedTextColor').oninput = e => { const entry = findItem(selectedId); if (!entry) return; entry.color = e.target.value; save(); request(); };
    renderRows();
  }

  function wrapText(ctx, text, maxWidth) {
    const lines = []; String(text || '').split(/\n/).forEach(part => { if (!part) { lines.push(''); return; } let line = ''; for (const ch of part) { const next = line + ch; if (line && ctx.measureText(next).width > maxWidth) { lines.push(line); line = ch; } else line = next; } if (line) lines.push(line); }); return lines;
  }
  function drawTexts(canvas, dpi, interactive) {
    if (typeof state === 'undefined' || typeof getSpec !== 'function') return;
    const ctx = canvas.getContext('2d'), spec = getSpec(), ppm = dpi / 25.4, bleed = spec.bleed * ppm, trimW = spec.trimW * ppm, trimH = spec.trimH * ppm, spineW = spec.spine * ppm, spineX = bleed + trimW, frontX = spineX + spineW;
    const panels = { back: { x: bleed, y: bleed, w: trimW, h: trimH }, front: { x: frontX, y: bleed, w: trimW, h: trimH }, spine: { x: spineX, y: bleed, w: spineW, h: trimH } };
    for (const entry of allItems()) {
      ensureLayout(entry); const layout = state.layout[entry.id], panel = panels[entry.side];
      if (!panel || !String(entry.text || '').trim() || (entry.side === 'spine' && spec.spine < 2.2)) { state.hitBoxes[entry.id] = null; continue; }
      const x = panel.x + panel.w / 2, y = panel.y + panel.h * clamp(layout.y / 100, 0, 1), fontPx = entry.size * dpi / 72 * clamp((layout.scale || 100) / 100, .5, 2);
      ctx.save(); ctx.fillStyle = entry.color; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.font = `${entry.weight || 700} ${fontPx}px Pretendard,"Malgun Gothic",sans-serif`;
      if (entry.side === 'spine') {
        const direction = $('spineDirection')?.value || 'bottomToTop'; ctx.translate(x, y); ctx.rotate(direction === 'topToBottom' ? Math.PI / 2 : -Math.PI / 2); ctx.fillText(entry.text, 0, 0, panel.h * .28); const width = Math.min(ctx.measureText(entry.text).width + 16, panel.h * .32); ctx.restore(); state.hitBoxes[entry.id] = { x: x - Math.max(panel.w, fontPx * 1.4) / 2, y: y - width / 2, w: Math.max(panel.w, fontPx * 1.4), h: width };
      } else {
        const drawX = panel.x + panel.w * clamp(layout.x / 100, 0, 1), lines = wrapText(ctx, entry.text, panel.w * .82); let widest = 0; lines.forEach(line => widest = Math.max(widest, ctx.measureText(line).width)); const lineH = fontPx * 1.25, totalH = Math.max(fontPx, lines.length * lineH); lines.forEach((line, i) => ctx.fillText(line, drawX, y + (i - (lines.length - 1) / 2) * lineH)); ctx.restore(); state.hitBoxes[entry.id] = { x: drawX - widest / 2 - 9, y: y - totalH / 2 - 7, w: widest + 18, h: totalH + 14 };
      }
    }
    if (interactive && selectedId && state.hitBoxes[selectedId]) { const box = state.hitBoxes[selectedId]; ctx.save(); ctx.strokeStyle = '#1d9bb2'; ctx.lineWidth = Math.max(2, dpi / 60); ctx.setLineDash([6,4]); ctx.strokeRect(box.x, box.y, box.w, box.h); ctx.restore(); }
  }
  function blankLegacy(run) {
    const ids = ['frontTitle','frontSubtitle','publisher','publishYear','backText','spineTitle'], values = {}; ids.forEach(id => { const el = $(id); if (el) { values[id] = el.value; el.value = ''; } });
    try { return run(); } finally { ids.forEach(id => { if ($(id)) $(id).value = values[id]; }); }
  }
  function wrapRenderer() {
    if (wrapped || typeof renderCover !== 'function') return false; const original = renderCover;
    renderCover = function(canvas, dpi = 110, withGuides, interactive) { const result = blankLegacy(() => original.apply(this, arguments)); drawTexts(canvas, dpi, interactive === undefined ? canvas.id === 'previewCanvas' : interactive); return result; };
    wrapped = true; return true;
  }

  function canvasPoint(e, canvas) { const r = canvas.getBoundingClientRect(); return { x: (e.clientX-r.left)*canvas.width/r.width, y: (e.clientY-r.top)*canvas.height/r.height }; }
  function hit(p,b,pad=10){return b&&p.x>=b.x-pad&&p.x<=b.x+b.w+pad&&p.y>=b.y-pad&&p.y<=b.y+b.h+pad}
  function bindCanvas() {
    const canvas = $('previewCanvas'), parent = canvas?.parentElement; if (!canvas || !parent || parent.dataset.coverTextZonesV3) return; parent.dataset.coverTextZonesV3='1';
    parent.addEventListener('pointerdown', e => { if(e.target!==canvas||e.button!==0||typeof state==='undefined')return; const p=canvasPoint(e,canvas), picked=[...allItems()].reverse().find(v=>hit(p,state.hitBoxes[v.id])); if(!picked)return; e.stopImmediatePropagation();e.preventDefault();select(picked.id);ensureLayout(picked);drag={id:e.pointerId,item:picked.id,startX:e.clientX,startY:e.clientY,initial:{...state.layout[picked.id]}};canvas.setPointerCapture(e.pointerId);},true);
    parent.addEventListener('pointermove',e=>{if(!drag||drag.id!==e.pointerId)return;e.stopImmediatePropagation();e.preventDefault();const entry=findItem(drag.item),rect=canvas.getBoundingClientRect(),spec=getSpec(),layout=state.layout[entry.id];if(entry.side!=='spine')layout.x=clamp(drag.initial.x+(e.clientX-drag.startX)/(rect.width*spec.trimW/spec.totalW)*100,0,100);layout.y=clamp(drag.initial.y+(e.clientY-drag.startY)/(rect.height*spec.trimH/spec.totalH)*100,0,100);entry.x=layout.x;entry.y=layout.y;save();request();},true);
    const end=e=>{if(!drag||drag.id!==e.pointerId)return;e.stopImmediatePropagation();drag=null;try{canvas.releasePointerCapture(e.pointerId)}catch(_){}save();request();};parent.addEventListener('pointerup',end,true);parent.addEventListener('pointercancel',end,true);
  }

  function stabilize(attempt = 0) {
    const rendererReady = wrapRenderer();
    bindCanvas();
    removeLayerPropertyPanels();
    const legacy = $('spineTitle')?.closest('.field');
    if (legacy) legacy.style.display = 'none';
    const canvasReady = document.querySelector('#previewCanvas')?.parentElement?.dataset.coverTextZonesV3 === '1';
    if ((!rendererReady || !canvasReady) && attempt < 20) {
      setTimeout(() => stabilize(attempt + 1), 150);
    }
  }

  function boot(){
    load();
    buildUi();
    allItems().forEach(ensureLayout);
    stabilize();
    request();
    const observer = new MutationObserver(() => {
      removeLayerPropertyPanels();
      bindCanvas();
    });
    observer.observe(document.querySelector('.settings') || document.body, { childList: true, subtree: true });
    window.CoverTextZones = { data, allItems, findItem, select, save };
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>setTimeout(boot,500));else setTimeout(boot,500);
})();
