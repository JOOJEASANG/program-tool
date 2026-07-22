// PDF editor divider helper module.
(function () {
  if (window.__pdfEditorDividerHelperV2) return;
  window.__pdfEditorDividerHelperV2 = true;

  function $(id) { return document.getElementById(id); }
  const snapPoints = [
    { value: 10, key: 'left', label: '왼쪽' },
    { value: 50, key: 'center', label: '가운데' },
    { value: 90, key: 'right', label: '오른쪽' },
  ];
  let activePart = 'title';
  let drag = null;
  let threshold = 5;
  let latched = null;

  function n(id, fallback) {
    const value = Number($(id) && $(id).value);
    return Number.isFinite(value) ? value : fallback;
  }
  function values() {
    return {
      titleY: n('dividerTitleY', 45), subtitleY: n('dividerSubtitleY', 55), noteY: n('dividerNoteY', 88),
      titleX: n('dividerTitleX', 50), subtitleX: n('dividerSubtitleX', 50), noteX: n('dividerNoteX', 50),
    };
  }
  function patchContent(content) {
    const patched = Object.assign({}, content || {}, values());
    patched.noBg = true; patched.bg = '#ffffff'; patched.fg = '#111827';
    ['titleY','subtitleY','noteY','titleX','subtitleX','noteX'].forEach(key => {
      const fallback = key.endsWith('X') ? 50 : (key === 'titleY' ? 45 : key === 'subtitleY' ? 55 : 88);
      if (!Number.isFinite(Number(patched[key]))) patched[key] = fallback;
    });
    return patched;
  }
  window.PdfDividerHelper = { patchContent };

  function addRange(id, anchorId, label, value, min=5, max=95) {
    if ($(id)) return $(id);
    const input = document.createElement('input');
    input.type = 'range'; input.min = String(min); input.max = String(max); input.step = '1'; input.id = id; input.value = String(value); input.style.width = '100%';
    const wrap = document.createElement('div'); wrap.className = 'field helper-divider-pos';
    wrap.innerHTML = `<label style="font-size:11px;font-weight:800;color:#374151;">${label}</label>`;
    wrap.appendChild(input);
    const anchor = $(anchorId);
    anchor && anchor.closest('.field') && anchor.closest('.field').insertAdjacentElement('afterend', wrap);
    input.addEventListener('input', () => { if (typeof window.updateDividerPreview === 'function') window.updateDividerPreview(); });
    return input;
  }
  function installDefaultsUi() {
    const modal = $('dividerModal');
    if (!modal || modal.dataset.dividerHelperPatched) return;
    modal.dataset.dividerHelperPatched = '1';
    const style = document.createElement('style');
    style.textContent = `#dividerBg,label[for="dividerBg"]{display:none!important}#dividerNoBg,label:has(#dividerNoBg){display:none!important}.divider-magnet-help{font-size:10px;color:#64748b;background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:8px;margin:8px 0}.divider-prev-wrap{position:relative}.divider-guide-x{position:absolute;top:0;bottom:0;width:2px;background:#ec4899;pointer-events:none;display:none;z-index:8}.divider-guide-label{position:absolute;top:7px;background:#ec4899;color:#fff;border-radius:999px;padding:3px 6px;font-size:9px;font-weight:900;pointer-events:none;display:none;z-index:9;white-space:nowrap}`;
    document.head.appendChild(style);
    if ($('dividerNoBg')) $('dividerNoBg').checked = true;
    if ($('dividerBg')) $('dividerBg').value = '#ffffff';
    if ($('dividerFg')) $('dividerFg').value = '#111827';
    addRange('dividerTitleY', 'dividerTitle', '제목 세로 위치', 45);
    addRange('dividerSubtitleY', 'dividerSubtitle', '부제목 세로 위치', 55);
    addRange('dividerNoteY', 'dividerNote', '하단 메모 세로 위치', 88);
    ['dividerTitleX','dividerSubtitleX','dividerNoteX'].forEach((id, index) => {
      const input = document.createElement('input'); input.type = 'hidden'; input.id = id; input.value = '50'; modal.appendChild(input);
    });
    const help = document.createElement('div'); help.className = 'divider-magnet-help'; help.textContent = '미리보기의 제목·부제목·메모를 마우스로 좌우 이동하면 왼쪽·가운데·오른쪽에 자석처럼 맞춰집니다.';
    $('dividerPrevCanvas')?.parentElement?.insertAdjacentElement('afterend', help);
    const wrap = $('dividerPrevCanvas')?.parentElement;
    if (wrap) {
      const line = document.createElement('div'); line.className = 'divider-guide-x'; line.id = 'dividerGuideX';
      const label = document.createElement('div'); label.className = 'divider-guide-label'; label.id = 'dividerGuideLabel';
      wrap.append(line, label);
    }
  }

  function renderPatched(content, w, h) {
    const p = patchContent(content), c = document.createElement('canvas'); c.width = w; c.height = h;
    const ctx = c.getContext('2d'); ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, w, h); ctx.fillStyle = '#111827'; ctx.textBaseline = 'middle';
    const draw = (part, text, xPct, yPct, size, weight, alpha=1) => {
      if (!text) return;
      const x = w * xPct / 100, y = h * yPct / 100;
      ctx.save(); ctx.globalAlpha = alpha; ctx.textAlign = xPct <= 20 ? 'left' : xPct >= 80 ? 'right' : 'center';
      ctx.font = `${weight ? weight + ' ' : ''}${size}px "Pretendard", "Malgun Gothic", sans-serif`;
      ctx.fillText(text, x, y, w * .8); ctx.restore();
    };
    draw('title', p.title, p.titleX, p.titleY, Math.min(w*.1,h*.1,90), 'bold');
    draw('subtitle', p.subtitle, p.subtitleX, p.subtitleY, Math.min(w*.055,h*.055,50), '', .82);
    draw('note', p.note, p.noteX, p.noteY, Math.min(w*.035,h*.035,30), '', .62);
    return c;
  }

  function setPositions(content) {
    const p = patchContent(content || {});
    ['titleX','subtitleX','noteX','titleY','subtitleY','noteY'].forEach(key => {
      const el = $('divider' + key[0].toUpperCase() + key.slice(1)); if (el) el.value = p[key];
    });
  }
  function wrapFunctions() {
    if (!window.__dividerContentWrappedV2 && typeof window.getDividerContent === 'function') {
      const originalGet = window.getDividerContent;
      window.getDividerContent = function () { return patchContent(originalGet.call(this)); };
      window.__dividerContentWrappedV2 = true;
    }
    if (!window.__dividerCanvasWrappedV2 && typeof window.renderDividerCanvas === 'function') {
      window.renderDividerCanvas = function (content, w, h) { return renderPatched(content, w, h); };
      window.__dividerCanvasWrappedV2 = true;
    }
    if (!window.__dividerOpenWrappedV2 && typeof window.editDivider === 'function' && typeof window.openDividerInsert === 'function') {
      const oldEdit = window.editDivider, oldOpen = window.openDividerInsert;
      window.editDivider = function (page) { setPositions(page && page.dividerContent); return oldEdit.apply(this, arguments); };
      window.openDividerInsert = function () { setPositions({titleX:50,subtitleX:50,noteX:50,titleY:45,subtitleY:55,noteY:88}); return oldOpen.apply(this, arguments); };
      window.__dividerOpenWrappedV2 = true;
    }
  }

  function partAt(y, h) {
    const points = [['title',n('dividerTitleY',45)],['subtitle',n('dividerSubtitleY',55)],['note',n('dividerNoteY',88)]];
    points.sort((a,b)=>Math.abs(y/h*100-a[1])-Math.abs(y/h*100-b[1]));
    return points[0][0];
  }
  function nearest(value) {
    let best = null;
    for (const p of snapPoints) { const d = Math.abs(value-p.value); if (d <= threshold && (!best || d < best.d)) best = Object.assign({d},p); }
    return best;
  }
  function showGuide(point) {
    const line=$('dividerGuideX'),label=$('dividerGuideLabel'); if(!line||!label)return;
    line.style.display='block'; line.style.left=point.value+'%'; label.style.display='block'; label.style.left=`calc(${point.value}% + 6px)`; label.textContent=point.label+' 정렬';
  }
  function clearGuide(){const l=$('dividerGuideX'),t=$('dividerGuideLabel');if(l)l.style.display='none';if(t)t.style.display='none'}
  function setPartX(part, raw) {
    let point = null;
    if (latched) { const p=snapPoints.find(v=>v.key===latched); if(p&&Math.abs(raw-p.value)<=threshold+4)point=p; else latched=null; }
    if (!point) point=nearest(raw);
    const value=point?point.value:Math.max(5,Math.min(95,raw));
    const el=$('divider'+part[0].toUpperCase()+part.slice(1)+'X'); if(el)el.value=value;
    if(point){latched=point.key;showGuide(point)}else clearGuide();
    if(typeof window.updateDividerPreview==='function')window.updateDividerPreview();
  }
  function bindDrag() {
    const c=$('dividerPrevCanvas'); if(!c||c.dataset.magneticDivider)return; c.dataset.magneticDivider='1'; c.style.cursor='grab'; c.style.touchAction='none';
    const point=e=>{const r=c.getBoundingClientRect();return{x:(e.clientX-r.left)/r.width*c.width,y:(e.clientY-r.top)/r.height*c.height}};
    c.addEventListener('pointerdown',e=>{if(e.button!==0)return;const p=point(e);activePart=partAt(p.y,c.height);drag={id:e.pointerId};latched=null;c.setPointerCapture(e.pointerId);c.style.cursor='grabbing';setPartX(activePart,p.x/c.width*100);e.preventDefault()});
    c.addEventListener('pointermove',e=>{if(!drag||drag.id!==e.pointerId)return;const p=point(e);setPartX(activePart,p.x/c.width*100);e.preventDefault()});
    const end=e=>{if(!drag||drag.id!==e.pointerId)return;drag=null;latched=null;c.style.cursor='grab';setTimeout(clearGuide,450);try{c.releasePointerCapture(e.pointerId)}catch(_){}};
    c.addEventListener('pointerup',end);c.addEventListener('pointercancel',end);
  }

  function boot() { installDefaultsUi(); wrapFunctions(); bindDrag(); }
  document.addEventListener('DOMContentLoaded', boot);
  setInterval(boot, 700);
})();