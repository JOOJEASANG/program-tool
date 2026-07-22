// Full-screen divider editor with dynamic text layers.
(function () {
  'use strict';
  if (window.__pdfDividerStudioV1) return;
  window.__pdfDividerStudioV1 = true;

  const $ = (id) => document.getElementById(id);
  let extras = [];
  let nextExtraId = 1;

  function esc(value) {
    return String(value ?? '').replace(/[<>&"']/g, (ch) => ({
      '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;', "'": '&#39;'
    }[ch]));
  }
  function clamp(value, min, max, fallback) {
    const n = Number(value);
    return Number.isFinite(n) ? Math.max(min, Math.min(max, n)) : fallback;
  }
  function requestPreview() {
    try { if (typeof window.updateDividerPreview === 'function') window.updateDividerPreview(); } catch (_) {}
  }
  function defaultExtra(index) {
    return {
      id: 'extra_' + Date.now().toString(36) + '_' + (nextExtraId++),
      text: '', size: 18, color: '#000000', weight: 400, italic: false,
      align: 'center', x: 50, y: Math.min(82, 64 + index * 8), opacity: 1,
      rotation: 0, hidden: false, locked: false
    };
  }
  function normalizeExtra(item, index) {
    const out = Object.assign(defaultExtra(index), item || {});
    out.id = String(out.id || ('extra_' + Date.now().toString(36) + '_' + index));
    out.text = String(out.text || '');
    out.size = clamp(out.size, 6, 96, 18);
    out.color = out.color || '#000000';
    out.weight = Number(out.weight) >= 700 ? 700 : 400;
    out.italic = !!out.italic;
    out.align = ['left','center','right'].includes(out.align) ? out.align : 'center';
    out.x = clamp(out.x, 0, 100, 50);
    out.y = clamp(out.y, 0, 100, 70);
    out.opacity = clamp(out.opacity, 0.05, 1, 1);
    out.rotation = clamp(out.rotation, -180, 180, 0);
    out.hidden = !!out.hidden;
    out.locked = !!out.locked;
    return out;
  }

  function installStyles() {
    if ($('pdfDividerStudioStyles')) return;
    const style = document.createElement('style');
    style.id = 'pdfDividerStudioStyles';
    style.textContent = `
      #dividerModal.divider-studio-modal{position:fixed!important;inset:0!important;z-index:10020!important;padding:14px!important;background:rgba(15,23,42,.72)!important;align-items:stretch!important;justify-content:stretch!important;overflow:hidden!important}
      #dividerModal.divider-studio-modal .modal-box{width:100%!important;max-width:none!important;height:100%!important;max-height:none!important;margin:0!important;border-radius:14px!important;display:flex!important;flex-direction:column!important;overflow:hidden!important}
      #dividerModal .divider-studio-body{display:grid;grid-template-columns:minmax(300px,36%) minmax(0,64%);min-height:0;flex:1;overflow:hidden;background:#f1f5f9}
      #dividerModal .divider-studio-controls{overflow-y:auto;padding:14px 16px 20px;background:#fff;border-right:1px solid #dbe3ec}
      #dividerModal .divider-studio-preview{min-width:0;min-height:0;display:flex;align-items:center;justify-content:center;padding:18px;overflow:auto;background:#e8edf3}
      #dividerModal .divider-prev-wrap{width:min(76vh,92%)!important;max-width:760px!important;height:auto!important;aspect-ratio:210/297!important;margin:0 auto!important;background:#fff!important;box-shadow:0 12px 32px rgba(15,23,42,.20)!important;display:flex!important;align-items:center!important;justify-content:center!important;position:relative!important}
      #dividerModal #dividerPrevCanvas{display:block!important;width:100%!important;height:100%!important;max-width:none!important;max-height:none!important;object-fit:contain!important}
      #dividerModal .modal-footer{flex:0 0 auto!important;padding:10px 16px!important;background:#fff!important;border-top:1px solid #e2e8f0!important;display:flex!important;justify-content:flex-end!important;gap:8px!important}
      #dividerModal .divider-core-grid{display:grid;grid-template-columns:1fr;gap:8px}
      #dividerModal .divider-settings-card{border:1px solid #e2e8f0;border-radius:10px;background:#f8fafc;padding:10px;margin-bottom:10px}
      #dividerModal .divider-settings-title{font-size:11px;font-weight:900;color:#334155;margin-bottom:8px}
      #dividerModal .divider-extra-list{display:flex;flex-direction:column;gap:8px;margin-top:8px}
      #dividerModal .divider-extra-card{border:1px solid #d8b4fe;border-radius:10px;background:#faf5ff;padding:9px}
      #dividerModal .divider-extra-head{display:flex;align-items:center;gap:6px;margin-bottom:7px}
      #dividerModal .divider-extra-name{font-size:11px;font-weight:900;color:#6b21a8;flex:1}
      #dividerModal .divider-extra-actions{display:flex;gap:4px}
      #dividerModal .divider-extra-actions button{border:1px solid #d8b4fe;background:#fff;border-radius:6px;padding:3px 6px;font-size:10px;font-weight:900;cursor:pointer}
      #dividerModal .divider-extra-actions button.danger{color:#b91c1c;border-color:#fecaca}
      #dividerModal .divider-extra-grid{display:grid;grid-template-columns:1fr 1fr;gap:6px}
      #dividerModal .divider-extra-grid .wide{grid-column:1/-1}
      #dividerModal .divider-extra-grid label{font-size:9px;margin-bottom:3px}
      #dividerModal .divider-extra-grid input,#dividerModal .divider-extra-grid select{width:100%;padding:5px 7px;border:1px solid #d1d5db;border-radius:6px;font-size:11px;background:#fff}
      #dividerModal .divider-add-text-btn{width:100%;border:1.5px dashed #a78bfa;background:#f5f3ff;color:#6d28d9;border-radius:9px;padding:8px;font-size:11px;font-weight:900;cursor:pointer}
      #dividerModal .divider-add-text-btn:hover{background:#ede9fe}
      #dividerModal .divider-default-row{display:grid;grid-template-columns:1fr 1fr;gap:8px}
      #dividerModal .divider-bg-visible{display:flex!important}
      @media(max-width:850px){
        #dividerModal.divider-studio-modal{padding:6px!important}
        #dividerModal .divider-studio-body{grid-template-columns:1fr;grid-template-rows:minmax(260px,48%) minmax(260px,52%)}
        #dividerModal .divider-studio-controls{border-right:0;border-bottom:1px solid #dbe3ec}
        #dividerModal .divider-prev-wrap{width:min(40vh,88%)!important}
      }
    `;
    document.head.appendChild(style);
  }

  function buildExtraCard(item, index) {
    const card = document.createElement('div');
    card.className = 'divider-extra-card';
    card.dataset.extraId = item.id;
    card.innerHTML = `
      <div class="divider-extra-head">
        <div class="divider-extra-name">추가 텍스트 ${index + 1}</div>
        <div class="divider-extra-actions">
          <button type="button" data-action="up">위로</button>
          <button type="button" data-action="down">아래로</button>
          <button type="button" data-action="hide">${item.hidden ? '표시' : '숨김'}</button>
          <button type="button" data-action="lock">${item.locked ? '잠금해제' : '잠금'}</button>
          <button type="button" class="danger" data-action="delete">삭제</button>
        </div>
      </div>
      <div class="divider-extra-grid">
        <div class="wide"><label>내용</label><input data-key="text" type="text" value="${esc(item.text)}" placeholder="추가할 문구를 입력하세요"></div>
        <div><label>글자 크기</label><input data-key="size" type="number" min="6" max="96" value="${item.size}"></div>
        <div><label>글자색</label><input data-key="color" type="color" value="${item.color}"></div>
        <div><label>가로 위치</label><input data-key="x" type="number" min="0" max="100" value="${item.x}"></div>
        <div><label>세로 위치</label><input data-key="y" type="number" min="0" max="100" value="${item.y}"></div>
        <div><label>정렬</label><select data-key="align"><option value="left" ${item.align==='left'?'selected':''}>왼쪽</option><option value="center" ${item.align==='center'?'selected':''}>가운데</option><option value="right" ${item.align==='right'?'selected':''}>오른쪽</option></select></div>
        <div><label>굵기</label><select data-key="weight"><option value="400" ${item.weight<700?'selected':''}>보통</option><option value="700" ${item.weight>=700?'selected':''}>굵게</option></select></div>
        <div><label>기울임</label><select data-key="italic"><option value="0" ${!item.italic?'selected':''}>사용 안 함</option><option value="1" ${item.italic?'selected':''}>기울임</option></select></div>
        <div><label>회전</label><input data-key="rotation" type="number" min="-180" max="180" value="${item.rotation}"></div>
        <div class="wide"><label>투명도</label><input data-key="opacity" type="range" min="0.05" max="1" step="0.05" value="${item.opacity}"></div>
      </div>`;

    card.addEventListener('input', (event) => {
      const key = event.target && event.target.dataset ? event.target.dataset.key : '';
      if (!key) return;
      const target = extras.find((entry) => entry.id === item.id);
      if (!target || target.locked) return;
      let value = event.target.value;
      if (['size','x','y','rotation','opacity','weight'].includes(key)) value = Number(value);
      if (key === 'italic') value = value === '1';
      target[key] = value;
      requestPreview();
    });
    card.addEventListener('change', requestPreview);
    card.addEventListener('click', (event) => {
      const button = event.target.closest('button[data-action]');
      if (!button) return;
      const idx = extras.findIndex((entry) => entry.id === item.id);
      if (idx < 0) return;
      const action = button.dataset.action;
      if (action === 'delete') extras.splice(idx, 1);
      else if (action === 'up' && idx > 0) [extras[idx - 1], extras[idx]] = [extras[idx], extras[idx - 1]];
      else if (action === 'down' && idx < extras.length - 1) [extras[idx + 1], extras[idx]] = [extras[idx], extras[idx + 1]];
      else if (action === 'hide') extras[idx].hidden = !extras[idx].hidden;
      else if (action === 'lock') extras[idx].locked = !extras[idx].locked;
      renderExtraList();
      requestPreview();
    });
    return card;
  }

  function renderExtraList() {
    const list = $('dividerExtraList');
    if (!list) return;
    list.innerHTML = '';
    extras.forEach((item, index) => list.appendChild(buildExtraCard(item, index)));
    const empty = $('dividerExtraEmpty');
    if (empty) empty.style.display = extras.length ? 'none' : 'block';
  }

  function restructureModal() {
    const modal = $('dividerModal');
    const box = modal && modal.querySelector('.modal-box');
    if (!modal || !box || modal.dataset.dividerStudioBuilt) return;
    modal.dataset.dividerStudioBuilt = '1';
    modal.classList.add('divider-studio-modal');

    const head = box.querySelector('.modal-head');
    const footer = box.querySelector('.modal-footer');
    const previewWrap = box.querySelector('.divider-prev-wrap');
    const controls = [...box.children].filter((el) => el !== head && el !== footer && el !== previewWrap);

    const body = document.createElement('div');
    body.className = 'divider-studio-body';
    const left = document.createElement('div');
    left.className = 'divider-studio-controls';
    const right = document.createElement('div');
    right.className = 'divider-studio-preview';

    const intro = document.createElement('div');
    intro.className = 'divider-settings-card';
    intro.innerHTML = '<div class="divider-settings-title">기본 텍스트</div><div style="font-size:10px;color:#64748b;line-height:1.5">제목·부제목·하단메모와 추가 텍스트를 입력하면 오른쪽에서 바로 확인할 수 있습니다.</div>';
    left.appendChild(intro);
    controls.forEach((el) => left.appendChild(el));

    const extrasCard = document.createElement('div');
    extrasCard.className = 'divider-settings-card';
    extrasCard.innerHTML = `
      <div class="divider-settings-title">추가 텍스트 레이어</div>
      <button type="button" class="divider-add-text-btn" id="dividerAddTextBtn">+ 텍스트 추가</button>
      <div id="dividerExtraEmpty" style="font-size:10px;color:#94a3b8;text-align:center;padding:9px 0 2px">추가된 텍스트가 없습니다.</div>
      <div class="divider-extra-list" id="dividerExtraList"></div>`;
    left.appendChild(extrasCard);
    right.appendChild(previewWrap);
    body.append(left, right);
    if (footer) box.insertBefore(body, footer); else box.appendChild(body);

    $('dividerAddTextBtn').addEventListener('click', () => {
      extras.push(defaultExtra(extras.length));
      renderExtraList();
      requestPreview();
      setTimeout(() => left.scrollTo({ top: left.scrollHeight, behavior: 'smooth' }), 0);
    });

    // Requested defaults.
    if ($('dividerNoBg')) $('dividerNoBg').checked = true;
    if ($('dividerBg')) { $('dividerBg').value = '#ffffff'; $('dividerBg').disabled = true; }
    if ($('dividerFg')) $('dividerFg').value = '#000000';
    renderExtraList();
  }

  function collectExtras() {
    return extras.map((item, index) => normalizeExtra(item, index));
  }

  function patchFunctions() {
    if (!window.__pdfDividerStudioGetPatched && typeof window.getDividerContent === 'function') {
      const original = window.getDividerContent;
      window.getDividerContent = function () {
        const content = original.apply(this, arguments) || {};
        content.noBg = $('dividerNoBg') ? $('dividerNoBg').checked : true;
        content.bg = $('dividerBg') ? $('dividerBg').value : '#ffffff';
        content.fg = $('dividerFg') ? $('dividerFg').value : '#000000';
        content.extraTexts = collectExtras();
        return content;
      };
      window.__pdfDividerStudioGetPatched = true;
    }

    if (!window.__pdfDividerStudioRenderPatched && typeof window.renderDividerCanvas === 'function') {
      const fallback = window.renderDividerCanvas;
      window.renderDividerCanvas = function (content, width, height) {
        const base = fallback.call(this, content, width, height);
        const ctx = base.getContext('2d');
        const list = Array.isArray(content && content.extraTexts) ? content.extraTexts : [];
        list.map(normalizeExtra).forEach((item) => {
          if (!item.text || item.hidden) return;
          const x = width * item.x / 100;
          const y = height * item.y / 100;
          const size = Math.max(6, item.size * Math.min(width / 595, height / 842));
          ctx.save();
          ctx.translate(x, y);
          ctx.rotate(item.rotation * Math.PI / 180);
          ctx.globalAlpha = item.opacity;
          ctx.fillStyle = item.color;
          ctx.textAlign = item.align;
          ctx.textBaseline = 'middle';
          ctx.font = `${item.italic ? 'italic ' : ''}${item.weight >= 700 ? '700 ' : '400 '}${size}px "Pretendard", "Malgun Gothic", sans-serif`;
          ctx.fillText(item.text, 0, 0, width * .88);
          ctx.restore();
        });
        return base;
      };
      window.__pdfDividerStudioRenderPatched = true;
    }

    if (!window.__pdfDividerStudioOpenPatched && typeof window.openDividerInsert === 'function' && typeof window.editDivider === 'function') {
      const oldOpen = window.openDividerInsert;
      const oldEdit = window.editDivider;
      window.openDividerInsert = function () {
        extras = [];
        const result = oldOpen.apply(this, arguments);
        if ($('dividerNoBg')) $('dividerNoBg').checked = true;
        if ($('dividerBg')) { $('dividerBg').value = '#ffffff'; $('dividerBg').disabled = true; }
        if ($('dividerFg')) $('dividerFg').value = '#000000';
        renderExtraList();
        requestPreview();
        return result;
      };
      window.editDivider = function (page) {
        const source = page && page.dividerContent && Array.isArray(page.dividerContent.extraTexts)
          ? page.dividerContent.extraTexts : [];
        extras = source.map(normalizeExtra);
        const result = oldEdit.apply(this, arguments);
        if ($('dividerNoBg')) $('dividerNoBg').checked = page?.dividerContent?.noBg !== false;
        if ($('dividerFg')) $('dividerFg').value = page?.dividerContent?.fg || '#000000';
        if ($('dividerBg')) $('dividerBg').disabled = !!$('dividerNoBg')?.checked;
        renderExtraList();
        requestPreview();
        return result;
      };
      window.__pdfDividerStudioOpenPatched = true;
    }
  }

  function bindDefaults() {
    const noBg = $('dividerNoBg');
    const bg = $('dividerBg');
    if (noBg && !noBg.dataset.studioBound) {
      noBg.dataset.studioBound = '1';
      noBg.addEventListener('change', () => {
        if (bg) bg.disabled = noBg.checked;
        requestPreview();
      });
    }
    ['dividerTitle','dividerSubtitle','dividerNote','dividerBg','dividerFg','dividerVOffset'].forEach((id) => {
      const el = $(id);
      if (!el || el.dataset.studioPreviewBound) return;
      el.dataset.studioPreviewBound = '1';
      el.addEventListener('input', requestPreview);
      el.addEventListener('change', requestPreview);
    });
  }

  function boot() {
    installStyles();
    restructureModal();
    patchFunctions();
    bindDefaults();
  }

  document.addEventListener('DOMContentLoaded', boot);
  setTimeout(boot, 650);
  setInterval(boot, 1200);
})();