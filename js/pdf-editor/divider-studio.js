// Full-screen divider editor with multiline title, background presets, text and shape layers.
(function () {
  'use strict';
  if (window.__pdfDividerStudioV2) return;
  window.__pdfDividerStudioV2 = true;

  const $ = (id) => document.getElementById(id);
  const MAX_EXTRAS = 30;
  const MAX_SHAPES = 24;
  const MAX_TEXT_LENGTH = 500;
  const MAX_TITLE_LENGTH = 240;
  let extras = [];
  let shapes = [];
  let nextExtraId = 1;
  let nextShapeId = 1;

  function esc(value) {
    return String(value ?? '').replace(/[<>&"']/g, (ch) => ({
      '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;', "'": '&#39;'
    }[ch]));
  }

  function clamp(value, min, max, fallback) {
    const number = Number(value);
    return Number.isFinite(number) ? Math.max(min, Math.min(max, number)) : fallback;
  }

  function validColor(value, fallback) {
    return /^#[0-9a-f]{6}$/i.test(String(value || '')) ? String(value) : fallback;
  }

  function requestPreview() {
    try {
      if (typeof window.updateDividerPreview === 'function') window.updateDividerPreview();
    } catch (error) {
      console.warn('[divider-studio] preview update failed', error);
    }
  }

  function normalizeTitle(value) {
    const raw = String(value || '').replace(/\r/g, '').slice(0, MAX_TITLE_LENGTH);
    const parts = raw.split('\n');
    if (parts.length <= 2) return raw;
    return `${parts[0]}\n${parts.slice(1).join(' ')}`.slice(0, MAX_TITLE_LENGTH);
  }

  function ensureMultilineTitleInput() {
    const current = $('dividerTitle');
    if (!current) return false;
    if (current.tagName === 'TEXTAREA') return true;
    const textarea = document.createElement('textarea');
    textarea.id = 'dividerTitle';
    textarea.rows = 2;
    textarea.maxLength = MAX_TITLE_LENGTH;
    textarea.placeholder = current.placeholder || '예) 제1장';
    textarea.value = normalizeTitle(current.value);
    textarea.className = current.className;
    textarea.setAttribute('aria-label', '간지 제목, 최대 두 줄');
    current.replaceWith(textarea);
    textarea.addEventListener('keydown', (event) => {
      if (event.key === 'Enter' && textarea.value.includes('\n')) event.preventDefault();
    });
    textarea.addEventListener('input', () => {
      const normalized = normalizeTitle(textarea.value);
      if (normalized !== textarea.value) textarea.value = normalized;
      requestPreview();
    });
    return true;
  }

  function defaultExtra(index) {
    return {
      id: `extra_${Date.now().toString(36)}_${nextExtraId++}`,
      text: '', size: 18, color: '#111827', weight: 400, italic: false,
      align: 'center', x: 50, y: Math.min(88, 64 + index * 7), opacity: 1,
      rotation: 0, hidden: false, locked: false,
    };
  }

  function normalizeExtra(item, index) {
    const output = Object.assign(defaultExtra(index), item || {});
    output.id = String(output.id || `extra_${Date.now().toString(36)}_${index}`);
    output.text = String(output.text || '').slice(0, MAX_TEXT_LENGTH);
    output.size = clamp(output.size, 6, 96, 18);
    output.color = validColor(output.color, '#111827');
    output.weight = Number(output.weight) >= 700 ? 700 : 400;
    output.italic = Boolean(output.italic);
    output.align = ['left', 'center', 'right'].includes(output.align) ? output.align : 'center';
    output.x = clamp(output.x, 0, 100, 50);
    output.y = clamp(output.y, 0, 100, 70);
    output.opacity = clamp(output.opacity, 0.05, 1, 1);
    output.rotation = clamp(output.rotation, -180, 180, 0);
    output.hidden = Boolean(output.hidden);
    output.locked = Boolean(output.locked);
    return output;
  }

  function defaultShape(kind = 'roundRect', index = 0) {
    const titleBox = kind === 'titleBox';
    return {
      id: `shape_${Date.now().toString(36)}_${nextShapeId++}`,
      kind: titleBox ? 'roundRect' : kind,
      name: titleBox ? '타이틀 박스' : '도형',
      x: 50,
      y: titleBox ? 45 : Math.min(78, 30 + index * 7),
      width: titleBox ? 76 : (kind === 'line' ? 72 : 40),
      height: titleBox ? 15 : (kind === 'line' ? 1.5 : 12),
      fill: titleBox ? '#ffffff' : '#dbeafe',
      stroke: titleBox ? '#ffffff' : '#2563eb',
      strokeWidth: titleBox ? 0 : 1,
      radius: titleBox ? 5 : 3,
      opacity: titleBox ? 0.18 : 0.85,
      rotation: 0,
      hidden: false,
      locked: false,
    };
  }

  function normalizeShape(item, index) {
    const output = Object.assign(defaultShape(item?.kind || 'roundRect', index), item || {});
    const allowed = ['rect', 'roundRect', 'outline', 'pill', 'line', 'circle'];
    output.kind = allowed.includes(output.kind) ? output.kind : 'roundRect';
    output.id = String(output.id || `shape_${Date.now().toString(36)}_${index}`);
    output.name = String(output.name || '도형').slice(0, 40);
    output.x = clamp(output.x, 0, 100, 50);
    output.y = clamp(output.y, 0, 100, 45);
    output.width = clamp(output.width, 1, 100, 50);
    output.height = clamp(output.height, 0.3, 100, 12);
    output.fill = validColor(output.fill, '#ffffff');
    output.stroke = validColor(output.stroke, '#111827');
    output.strokeWidth = clamp(output.strokeWidth, 0, 12, 1);
    output.radius = clamp(output.radius, 0, 50, 4);
    output.opacity = clamp(output.opacity, 0, 1, 0.8);
    output.rotation = clamp(output.rotation, -180, 180, 0);
    output.hidden = Boolean(output.hidden);
    output.locked = Boolean(output.locked);
    return output;
  }

  function installStyles() {
    if ($('pdfDividerStudioStyles')) return;
    const style = document.createElement('style');
    style.id = 'pdfDividerStudioStyles';
    style.textContent = `
      #dividerModal.divider-studio-modal{position:fixed!important;inset:0!important;z-index:10020!important;padding:14px!important;background:rgba(15,23,42,.72)!important;align-items:stretch!important;justify-content:stretch!important;overflow:hidden!important}
      #dividerModal.divider-studio-modal .modal-box{width:100%!important;max-width:none!important;height:100%!important;max-height:none!important;margin:0!important;border-radius:14px!important;display:flex!important;flex-direction:column!important;overflow:hidden!important}
      #dividerModal .divider-studio-body{display:grid;grid-template-columns:minmax(320px,38%) minmax(0,62%);min-height:0;flex:1;overflow:hidden;background:#f1f5f9}
      #dividerModal .divider-studio-controls{overflow-y:auto;padding:14px 16px 20px;background:#fff;border-right:1px solid #dbe3ec}
      #dividerModal .divider-studio-preview{min-width:0;min-height:0;display:flex;align-items:center;justify-content:center;padding:18px;overflow:auto;background:#e8edf3}
      #dividerModal .divider-prev-wrap{width:min(76vh,92%)!important;max-width:760px!important;height:auto!important;aspect-ratio:210/297!important;margin:0 auto!important;background:#fff!important;box-shadow:0 12px 32px rgba(15,23,42,.20)!important;display:flex!important;align-items:center!important;justify-content:center!important;position:relative!important}
      #dividerModal #dividerPrevCanvas{display:block!important;width:100%!important;height:100%!important;max-width:none!important;max-height:none!important;object-fit:contain!important}
      #dividerModal .modal-footer{flex:0 0 auto!important;padding:10px 16px!important;background:#fff!important;border-top:1px solid #e2e8f0!important;display:flex!important;justify-content:flex-end!important;gap:8px!important}
      #dividerModal .divider-settings-card{border:1px solid #e2e8f0;border-radius:10px;background:#f8fafc;padding:10px;margin-bottom:10px}
      #dividerModal .divider-settings-title{font-size:11px;font-weight:900;color:#334155;margin-bottom:8px}
      #dividerModal textarea#dividerTitle{width:100%;min-height:58px;resize:vertical;border:1px solid #e5e7eb;border-radius:8px;padding:7px 10px;font:600 13px/1.45 inherit;outline:none;background:#fff}
      #dividerModal textarea#dividerTitle:focus{border-color:#2563eb;box-shadow:0 0 0 3px rgba(37,99,235,.08)}
      #dividerModal .divider-title-hint{font-size:9px;color:#64748b;margin-top:4px;line-height:1.4}
      #dividerModal .divider-extra-list,#dividerModal .divider-shape-list{display:flex;flex-direction:column;gap:8px;margin-top:8px}
      #dividerModal .divider-extra-card,#dividerModal .divider-shape-card{border:1px solid #d8b4fe;border-radius:10px;background:#faf5ff;padding:9px}
      #dividerModal .divider-shape-card{border-color:#bfdbfe;background:#eff6ff}
      #dividerModal .divider-extra-head{display:flex;align-items:center;gap:6px;margin-bottom:7px;flex-wrap:wrap}
      #dividerModal .divider-extra-name{font-size:11px;font-weight:900;color:#6b21a8;flex:1;min-width:90px}
      #dividerModal .divider-shape-card .divider-extra-name{color:#1d4ed8}
      #dividerModal .divider-extra-actions{display:flex;gap:4px;flex-wrap:wrap}
      #dividerModal .divider-extra-actions button{border:1px solid #d8b4fe;background:#fff;border-radius:6px;padding:3px 6px;font-size:10px;font-weight:900;cursor:pointer}
      #dividerModal .divider-shape-card .divider-extra-actions button{border-color:#bfdbfe}
      #dividerModal .divider-extra-actions button.danger{color:#b91c1c;border-color:#fecaca}
      #dividerModal .divider-extra-grid{display:grid;grid-template-columns:1fr 1fr;gap:6px}
      #dividerModal .divider-extra-grid .wide{grid-column:1/-1}
      #dividerModal .divider-extra-grid label{font-size:9px;margin-bottom:3px;display:block}
      #dividerModal .divider-extra-grid input,#dividerModal .divider-extra-grid select,#dividerModal .divider-extra-grid textarea{width:100%;padding:5px 7px;border:1px solid #d1d5db;border-radius:6px;font-size:11px;background:#fff;box-sizing:border-box}
      #dividerModal .divider-extra-grid input:disabled,#dividerModal .divider-extra-grid select:disabled{background:#e5e7eb;color:#6b7280}
      #dividerModal .divider-add-text-btn,#dividerModal .divider-add-shape-btn{width:100%;border:1.5px dashed #a78bfa;background:#f5f3ff;color:#6d28d9;border-radius:9px;padding:8px;font-size:11px;font-weight:900;cursor:pointer}
      #dividerModal .divider-add-shape-btn{border-color:#93c5fd;background:#eff6ff;color:#1d4ed8}
      #dividerModal .divider-add-text-btn:hover{background:#ede9fe} #dividerModal .divider-add-shape-btn:hover{background:#dbeafe}
      #dividerModal .divider-layer-button-grid{display:grid;grid-template-columns:1fr 1fr;gap:5px}
      #dividerModal .divider-bg-style-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:5px}
      #dividerModal .divider-bg-style-btn{border:1px solid #cbd5e1;border-radius:7px;background:#fff;padding:6px 4px;font-size:9px;font-weight:800;color:#475569;cursor:pointer}
      #dividerModal .divider-bg-style-btn.active{border-color:#2563eb;color:#1d4ed8;background:#eff6ff}
      #dividerModal #dividerBg,#dividerModal #dividerNoBg{display:inline-block!important}
      @media(max-width:850px){#dividerModal.divider-studio-modal{padding:6px!important}#dividerModal .divider-studio-body{grid-template-columns:1fr;grid-template-rows:minmax(280px,52%) minmax(240px,48%)}#dividerModal .divider-studio-controls{border-right:0;border-bottom:1px solid #dbe3ec}#dividerModal .divider-prev-wrap{width:min(40vh,88%)!important}}
    `;
    document.head.appendChild(style);
  }

  function buildExtraCard(item, index) {
    const card = document.createElement('div');
    card.className = 'divider-extra-card';
    card.dataset.extraId = item.id;
    card.innerHTML = `
      <div class="divider-extra-head"><div class="divider-extra-name">추가 텍스트 ${index + 1}</div><div class="divider-extra-actions">
        <button type="button" data-action="up">위로</button><button type="button" data-action="down">아래로</button><button type="button" data-action="hide">${item.hidden ? '표시' : '숨김'}</button><button type="button" data-action="lock">${item.locked ? '잠금해제' : '잠금'}</button><button type="button" class="danger" data-action="delete">삭제</button>
      </div></div>
      <div class="divider-extra-grid">
        <div class="wide"><label>내용</label><input data-key="text" maxlength="${MAX_TEXT_LENGTH}" type="text" value="${esc(item.text)}" placeholder="추가할 문구를 입력하세요"></div>
        <div><label>글자 크기</label><input data-key="size" type="number" min="6" max="96" value="${item.size}"></div><div><label>글자색</label><input data-key="color" type="color" value="${item.color}"></div>
        <div><label>가로 위치 (%)</label><input data-key="x" type="number" min="0" max="100" value="${item.x}"></div><div><label>세로 위치 (%)</label><input data-key="y" type="number" min="0" max="100" value="${item.y}"></div>
        <div><label>정렬</label><select data-key="align"><option value="left" ${item.align === 'left' ? 'selected' : ''}>왼쪽</option><option value="center" ${item.align === 'center' ? 'selected' : ''}>가운데</option><option value="right" ${item.align === 'right' ? 'selected' : ''}>오른쪽</option></select></div>
        <div><label>굵기</label><select data-key="weight"><option value="400" ${item.weight < 700 ? 'selected' : ''}>보통</option><option value="700" ${item.weight >= 700 ? 'selected' : ''}>굵게</option></select></div>
        <div><label>기울임</label><select data-key="italic"><option value="0" ${!item.italic ? 'selected' : ''}>사용 안 함</option><option value="1" ${item.italic ? 'selected' : ''}>기울임</option></select></div><div><label>회전 (°)</label><input data-key="rotation" type="number" min="-180" max="180" value="${item.rotation}"></div>
        <div class="wide"><label>투명도</label><input data-key="opacity" type="range" min="0.05" max="1" step="0.05" value="${item.opacity}"></div>
      </div>`;
    card.querySelectorAll('[data-key]').forEach((control) => { control.disabled = item.locked; });
    card.addEventListener('input', (event) => {
      const key = event.target?.dataset?.key || '';
      if (!key) return;
      const target = extras.find((entry) => entry.id === item.id);
      if (!target || target.locked) return;
      let value = event.target.value;
      if (['size', 'x', 'y', 'rotation', 'opacity', 'weight'].includes(key)) value = Number(value);
      if (key === 'italic') value = value === '1';
      target[key] = value;
      requestPreview();
    });
    card.addEventListener('change', requestPreview);
    card.addEventListener('click', (event) => {
      const button = event.target.closest('button[data-action]');
      if (!button) return;
      const currentIndex = extras.findIndex((entry) => entry.id === item.id);
      if (currentIndex < 0) return;
      const action = button.dataset.action;
      if (action === 'delete') extras.splice(currentIndex, 1);
      else if (action === 'up' && currentIndex > 0) [extras[currentIndex - 1], extras[currentIndex]] = [extras[currentIndex], extras[currentIndex - 1]];
      else if (action === 'down' && currentIndex < extras.length - 1) [extras[currentIndex + 1], extras[currentIndex]] = [extras[currentIndex], extras[currentIndex + 1]];
      else if (action === 'hide') extras[currentIndex].hidden = !extras[currentIndex].hidden;
      else if (action === 'lock') extras[currentIndex].locked = !extras[currentIndex].locked;
      renderExtraList(); requestPreview();
    });
    return card;
  }

  function shapeLabel(kind) {
    return ({rect:'사각형',roundRect:'둥근 사각형',outline:'외곽 박스',pill:'캡슐 박스',line:'라인',circle:'원/타원'})[kind] || '도형';
  }

  function buildShapeCard(item, index) {
    const card = document.createElement('div');
    card.className = 'divider-shape-card';
    card.dataset.shapeId = item.id;
    card.innerHTML = `
      <div class="divider-extra-head"><div class="divider-extra-name">${esc(item.name || shapeLabel(item.kind))} ${index + 1}</div><div class="divider-extra-actions">
        <button type="button" data-action="up">위로</button><button type="button" data-action="down">아래로</button><button type="button" data-action="hide">${item.hidden ? '표시' : '숨김'}</button><button type="button" data-action="lock">${item.locked ? '잠금해제' : '잠금'}</button><button type="button" class="danger" data-action="delete">삭제</button>
      </div></div>
      <div class="divider-extra-grid">
        <div class="wide"><label>도형 스타일</label><select data-key="kind"><option value="rect" ${item.kind==='rect'?'selected':''}>사각형</option><option value="roundRect" ${item.kind==='roundRect'?'selected':''}>둥근 사각형</option><option value="outline" ${item.kind==='outline'?'selected':''}>외곽 박스</option><option value="pill" ${item.kind==='pill'?'selected':''}>캡슐 박스</option><option value="line" ${item.kind==='line'?'selected':''}>라인</option><option value="circle" ${item.kind==='circle'?'selected':''}>원/타원</option></select></div>
        <div><label>가로 위치 (%)</label><input data-key="x" type="number" min="0" max="100" value="${item.x}"></div><div><label>세로 위치 (%)</label><input data-key="y" type="number" min="0" max="100" value="${item.y}"></div>
        <div><label>너비 (%)</label><input data-key="width" type="number" min="1" max="100" value="${item.width}"></div><div><label>높이 (%)</label><input data-key="height" type="number" min="0.3" max="100" step="0.5" value="${item.height}"></div>
        <div><label>채우기</label><input data-key="fill" type="color" value="${item.fill}"></div><div><label>테두리</label><input data-key="stroke" type="color" value="${item.stroke}"></div>
        <div><label>테두리 두께</label><input data-key="strokeWidth" type="number" min="0" max="12" step="0.5" value="${item.strokeWidth}"></div><div><label>모서리</label><input data-key="radius" type="number" min="0" max="50" value="${item.radius}"></div>
        <div><label>회전 (°)</label><input data-key="rotation" type="number" min="-180" max="180" value="${item.rotation}"></div><div><label>투명도</label><input data-key="opacity" type="range" min="0" max="1" step="0.05" value="${item.opacity}"></div>
      </div>`;
    card.querySelectorAll('[data-key]').forEach((control) => { control.disabled = item.locked; });
    card.addEventListener('input', (event) => {
      const key = event.target?.dataset?.key || '';
      if (!key) return;
      const target = shapes.find((entry) => entry.id === item.id);
      if (!target || target.locked) return;
      let value = event.target.value;
      if (['x','y','width','height','strokeWidth','radius','rotation','opacity'].includes(key)) value = Number(value);
      target[key] = value;
      requestPreview();
    });
    card.addEventListener('change', requestPreview);
    card.addEventListener('click', (event) => {
      const button = event.target.closest('button[data-action]');
      if (!button) return;
      const currentIndex = shapes.findIndex((entry) => entry.id === item.id);
      if (currentIndex < 0) return;
      const action = button.dataset.action;
      if (action === 'delete') shapes.splice(currentIndex, 1);
      else if (action === 'up' && currentIndex < shapes.length - 1) [shapes[currentIndex + 1], shapes[currentIndex]] = [shapes[currentIndex], shapes[currentIndex + 1]];
      else if (action === 'down' && currentIndex > 0) [shapes[currentIndex - 1], shapes[currentIndex]] = [shapes[currentIndex], shapes[currentIndex - 1]];
      else if (action === 'hide') shapes[currentIndex].hidden = !shapes[currentIndex].hidden;
      else if (action === 'lock') shapes[currentIndex].locked = !shapes[currentIndex].locked;
      renderShapeList(); requestPreview();
    });
    return card;
  }

  function renderExtraList() {
    const list = $('dividerExtraList'); if (!list) return;
    list.innerHTML = ''; extras.forEach((item, index) => list.appendChild(buildExtraCard(item, index)));
    if ($('dividerExtraEmpty')) $('dividerExtraEmpty').style.display = extras.length ? 'none' : 'block';
    if ($('dividerAddTextBtn')) $('dividerAddTextBtn').disabled = extras.length >= MAX_EXTRAS;
  }

  function renderShapeList() {
    const list = $('dividerShapeList'); if (!list) return;
    list.innerHTML = ''; shapes.forEach((item, index) => list.appendChild(buildShapeCard(item, index)));
    if ($('dividerShapeEmpty')) $('dividerShapeEmpty').style.display = shapes.length ? 'none' : 'block';
    document.querySelectorAll('[data-add-shape]').forEach((button) => { button.disabled = shapes.length >= MAX_SHAPES; });
  }

  function addBackgroundUi(left) {
    if ($('dividerBackgroundStudioCard')) return;
    const card = document.createElement('div');
    card.id = 'dividerBackgroundStudioCard';
    card.className = 'divider-settings-card';
    card.innerHTML = `
      <div class="divider-settings-title">배경 스타일</div>
      <div class="divider-bg-style-grid" id="dividerBgStyleGrid">
        <button type="button" class="divider-bg-style-btn active" data-bg-style="solid">단색</button><button type="button" class="divider-bg-style-btn" data-bg-style="gradient">그라데이션</button><button type="button" class="divider-bg-style-btn" data-bg-style="soft">소프트</button>
        <button type="button" class="divider-bg-style-btn" data-bg-style="diagonal">사선</button><button type="button" class="divider-bg-style-btn" data-bg-style="grid">그리드</button><button type="button" class="divider-bg-style-btn" data-bg-style="spotlight">스포트</button>
      </div>
      <div class="field" style="margin-top:8px"><label>보조 배경색</label><input type="color" id="dividerBg2" value="#dbeafe"></div>`;
    left.appendChild(card);
    card.addEventListener('click', (event) => {
      const button = event.target.closest('[data-bg-style]'); if (!button) return;
      card.querySelectorAll('[data-bg-style]').forEach((entry) => entry.classList.toggle('active', entry === button)); requestPreview();
    });
    $('dividerBg2')?.addEventListener('input', requestPreview);
  }

  function addExtendedBaseStyles() {
    const row = $('dividerStyleRow'); if (!row || row.dataset.studioExtended === 'true') return;
    row.dataset.studioExtended = 'true';
    [['frame','프레임'],['corner','코너'],['modern','모던']].forEach(([value,label]) => {
      if (row.querySelector(`[data-style="${value}"]`)) return;
      const button = document.createElement('button'); button.type = 'button'; button.className = 'style-btn'; button.dataset.style = value; button.textContent = label; row.appendChild(button);
    });
    row.addEventListener('click', (event) => {
      const button = event.target.closest('[data-style]'); if (!button) return;
      row.querySelectorAll('[data-style]').forEach((entry) => entry.classList.toggle('active', entry === button)); requestPreview();
    });
  }

  function restructureModal() {
    const modal = $('dividerModal'); const box = modal?.querySelector('.modal-box');
    if (!modal || !box || modal.dataset.dividerStudioBuilt === 'true') return Boolean(modal && box);
    const head = box.querySelector('.modal-head'); const footer = box.querySelector('.modal-footer'); const previewWrap = box.querySelector('.divider-prev-wrap');
    if (!head || !previewWrap) return false;
    ensureMultilineTitleInput(); addExtendedBaseStyles();
    const titleField = $('dividerTitle')?.closest('.field');
    if (titleField && !titleField.querySelector('.divider-title-hint')) {
      const hint = document.createElement('div'); hint.className = 'divider-title-hint'; hint.textContent = '제목은 Enter로 최대 2줄까지 입력할 수 있으며, 긴 제목은 미리보기에서 자동으로 2줄 배치됩니다.'; titleField.appendChild(hint);
    }
    modal.dataset.dividerStudioBuilt = 'true'; modal.classList.add('divider-studio-modal');
    const controls = [...box.children].filter((element) => element !== head && element !== footer && element !== previewWrap);
    const body = document.createElement('div'); body.className = 'divider-studio-body';
    const left = document.createElement('div'); left.className = 'divider-studio-controls';
    const right = document.createElement('div'); right.className = 'divider-studio-preview';
    const intro = document.createElement('div'); intro.className = 'divider-settings-card'; intro.innerHTML = '<div class="divider-settings-title">기본 텍스트</div><div style="font-size:10px;color:#64748b;line-height:1.5">제목은 최대 2줄, 부제목·메모와 추가 텍스트/도형 레이어는 오른쪽에서 바로 확인할 수 있습니다.</div>';
    left.appendChild(intro); controls.forEach((element) => left.appendChild(element));
    addBackgroundUi(left);
    const shapeCard = document.createElement('div'); shapeCard.className = 'divider-settings-card';
    shapeCard.innerHTML = `<div class="divider-settings-title">도형 레이어 · 타이틀 박스</div><div class="divider-layer-button-grid"><button type="button" class="divider-add-shape-btn" data-add-shape="titleBox">+ 타이틀 박스</button><button type="button" class="divider-add-shape-btn" data-add-shape="roundRect">+ 둥근 박스</button><button type="button" class="divider-add-shape-btn" data-add-shape="line">+ 라인</button><button type="button" class="divider-add-shape-btn" data-add-shape="circle">+ 원/타원</button></div><div id="dividerShapeEmpty" style="font-size:10px;color:#94a3b8;text-align:center;padding:9px 0 2px">추가된 도형 레이어가 없습니다.</div><div class="divider-shape-list" id="dividerShapeList"></div>`;
    left.appendChild(shapeCard);
    shapeCard.addEventListener('click', (event) => {
      const button = event.target.closest('[data-add-shape]'); if (!button || shapes.length >= MAX_SHAPES) return;
      shapes.push(defaultShape(button.dataset.addShape, shapes.length)); renderShapeList(); requestPreview();
      setTimeout(() => left.scrollTo({ top: left.scrollHeight, behavior: 'smooth' }), 0);
    });
    const extrasCard = document.createElement('div'); extrasCard.className = 'divider-settings-card';
    extrasCard.innerHTML = `<div class="divider-settings-title">추가 텍스트 레이어</div><button type="button" class="divider-add-text-btn" id="dividerAddTextBtn">+ 텍스트 추가</button><div id="dividerExtraEmpty" style="font-size:10px;color:#94a3b8;text-align:center;padding:9px 0 2px">추가된 텍스트가 없습니다.</div><div class="divider-extra-list" id="dividerExtraList"></div>`;
    left.appendChild(extrasCard); right.appendChild(previewWrap); body.append(left, right); if (footer) box.insertBefore(body, footer); else box.appendChild(body);
    $('dividerAddTextBtn')?.addEventListener('click', () => { if (extras.length >= MAX_EXTRAS) return; extras.push(defaultExtra(extras.length)); renderExtraList(); requestPreview(); setTimeout(() => left.scrollTo({ top: left.scrollHeight, behavior: 'smooth' }), 0); });
    renderShapeList(); renderExtraList(); return true;
  }

  function collectExtras() { return extras.slice(0, MAX_EXTRAS).map((item, index) => normalizeExtra(item, index)); }
  function collectShapes() { return shapes.slice(0, MAX_SHAPES).map((item, index) => normalizeShape(item, index)); }

  function roundedRectPath(ctx, x, y, w, h, radius) {
    const r = Math.min(Math.abs(w)/2, Math.abs(h)/2, Math.max(0, radius));
    ctx.beginPath(); ctx.moveTo(x+r,y); ctx.lineTo(x+w-r,y); ctx.quadraticCurveTo(x+w,y,x+w,y+r); ctx.lineTo(x+w,y+h-r); ctx.quadraticCurveTo(x+w,y+h,x+w-r,y+h); ctx.lineTo(x+r,y+h); ctx.quadraticCurveTo(x,y+h,x,y+h-r); ctx.lineTo(x,y+r); ctx.quadraticCurveTo(x,y,x+r,y); ctx.closePath();
  }

  function drawShape(ctx, item, width, height) {
    if (item.hidden) return;
    const x = width * item.x / 100, y = height * item.y / 100, w = width * item.width / 100, h = height * item.height / 100;
    ctx.save(); ctx.translate(x,y); ctx.rotate(item.rotation*Math.PI/180); ctx.globalAlpha=item.opacity;
    const left=-w/2, top=-h/2; ctx.fillStyle=item.fill; ctx.strokeStyle=item.stroke; ctx.lineWidth=Math.max(0.5,item.strokeWidth*Math.min(width/595,height/842));
    if (item.kind === 'line') { ctx.beginPath(); ctx.moveTo(-w/2,0); ctx.lineTo(w/2,0); ctx.stroke(); }
    else if (item.kind === 'circle') { ctx.beginPath(); ctx.ellipse(0,0,w/2,h/2,0,0,Math.PI*2); ctx.fill(); if(item.strokeWidth>0)ctx.stroke(); }
    else {
      const radius = item.kind === 'pill' ? h/2 : (item.kind === 'rect' || item.kind === 'outline' ? 0 : Math.min(w,h)*item.radius/100);
      roundedRectPath(ctx,left,top,w,h,radius);
      if(item.kind !== 'outline')ctx.fill(); if(item.strokeWidth>0 || item.kind === 'outline')ctx.stroke();
    }
    ctx.restore();
  }

  function drawBackground(ctx, source, width, height) {
    if (source.noBg !== false) { ctx.fillStyle='#ffffff'; ctx.fillRect(0,0,width,height); return; }
    const bg=validColor(source.bg,'#1a365d'), bg2=validColor(source.bg2,'#dbeafe'), fg=validColor(source.fg,'#ffffff'), style=source.bgStyle||'solid';
    if(style==='gradient'){const g=ctx.createLinearGradient(0,0,width,height);g.addColorStop(0,bg);g.addColorStop(1,bg2);ctx.fillStyle=g;ctx.fillRect(0,0,width,height);return;}
    if(style==='soft'||style==='spotlight'){ctx.fillStyle=bg;ctx.fillRect(0,0,width,height);const g=ctx.createRadialGradient(width*(style==='spotlight'?.5:.25),height*(style==='spotlight'?.42:.2),0,width*.5,height*.45,Math.max(width,height)*.75);g.addColorStop(0,bg2);g.addColorStop(1,'rgba(255,255,255,0)');ctx.save();ctx.globalAlpha=style==='spotlight'?.78:.48;ctx.fillStyle=g;ctx.fillRect(0,0,width,height);ctx.restore();return;}
    ctx.fillStyle=bg;ctx.fillRect(0,0,width,height);
    if(style==='diagonal'){ctx.save();ctx.strokeStyle=fg;ctx.globalAlpha=.09;ctx.lineWidth=Math.max(1,width*.012);for(let x=-height;x<width+height;x+=Math.max(20,width*.08)){ctx.beginPath();ctx.moveTo(x,0);ctx.lineTo(x-height,height);ctx.stroke();}ctx.restore();}
    if(style==='grid'){ctx.save();ctx.strokeStyle=fg;ctx.globalAlpha=.10;ctx.lineWidth=Math.max(1,width*.0015);const step=Math.max(24,width*.08);for(let x=0;x<=width;x+=step){ctx.beginPath();ctx.moveTo(x,0);ctx.lineTo(x,height);ctx.stroke();}for(let y=0;y<=height;y+=step){ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(width,y);ctx.stroke();}ctx.restore();}
  }

  function wrapTwoLines(ctx, text, maxWidth) {
    const cleaned=normalizeTitle(text).trim(); if(!cleaned)return [];
    const explicit=cleaned.split('\n'); if(explicit.length>1)return explicit.slice(0,2);
    if(ctx.measureText(cleaned).width<=maxWidth)return [cleaned];
    let split=1; for(let i=1;i<cleaned.length;i++){if(ctx.measureText(cleaned.slice(0,i+1)).width>maxWidth){split=i;break;}}
    const before=cleaned.slice(0,split), ws=before.lastIndexOf(' '); if(ws>Math.floor(split*.45))split=ws;
    return [cleaned.slice(0,split).trim(),cleaned.slice(split).trim()].filter(Boolean).slice(0,2);
  }

  function drawBaseText(ctx, text, width, height, xPct, yPct, size, color, opacity, weight, multiline=false) {
    if (!text) return;
    const x=width*clamp(xPct,0,100,50)/100, y=height*clamp(yPct,0,100,50)/100, align=xPct<=20?'left':xPct>=80?'right':'center';
    ctx.save(); ctx.globalAlpha=opacity; ctx.fillStyle=color; ctx.textAlign=align; ctx.textBaseline='middle'; ctx.font=`${weight} ${size}px "Pretendard", "Malgun Gothic", sans-serif`;
    const lines=multiline?wrapTwoLines(ctx,text,width*.84):[String(text).slice(0,MAX_TEXT_LENGTH)]; const lineHeight=size*1.18; const start=y-(lines.length-1)*lineHeight/2;
    lines.forEach((line,index)=>ctx.fillText(line,x,start+index*lineHeight,width*.84)); ctx.restore();
  }

  function drawBaseStyle(ctx, source, width, height, foreground) {
    const style=source.style||'simple';
    if(style==='band'){ctx.save();ctx.globalAlpha=.16;ctx.fillStyle=foreground;ctx.fillRect(0,height*.34,width,height*.32);ctx.restore();}
    else if(style==='lines'){ctx.save();ctx.globalAlpha=.28;ctx.strokeStyle=foreground;ctx.lineWidth=Math.max(1,width*.002);ctx.beginPath();ctx.moveTo(width*.14,height*.36);ctx.lineTo(width*.86,height*.36);ctx.moveTo(width*.14,height*.66);ctx.lineTo(width*.86,height*.66);ctx.stroke();ctx.restore();}
    else if(style==='frame'){ctx.save();ctx.globalAlpha=.45;ctx.strokeStyle=foreground;ctx.lineWidth=Math.max(2,width*.006);ctx.strokeRect(width*.07,height*.05,width*.86,height*.90);ctx.globalAlpha=.16;ctx.lineWidth=Math.max(1,width*.002);ctx.strokeRect(width*.09,height*.07,width*.82,height*.86);ctx.restore();}
    else if(style==='corner'){ctx.save();ctx.strokeStyle=foreground;ctx.globalAlpha=.55;ctx.lineWidth=Math.max(2,width*.007);const x=width*.12,y=height*.18,l=width*.16;ctx.beginPath();ctx.moveTo(x,y+l);ctx.lineTo(x,y);ctx.lineTo(x+l,y);ctx.stroke();ctx.restore();}
    else if(style==='modern'){ctx.save();ctx.fillStyle=foreground;ctx.globalAlpha=.10;ctx.fillRect(width*.08,height*.34,width*.84,height*.25);ctx.globalAlpha=.65;ctx.fillRect(width*.08,height*.34,width*.018,height*.25);ctx.restore();}
  }

  function renderStudioCanvas(content, width, height) {
    const source=content||{}, canvas=document.createElement('canvas'); canvas.width=width; canvas.height=height; const ctx=canvas.getContext('2d');
    const foreground=source.noBg!==false?'#111827':validColor(source.fg,'#ffffff'), scale=Math.min(width/595,height/842);
    drawBackground(ctx,source,width,height); drawBaseStyle(ctx,source,width,height,foreground);
    (Array.isArray(source.shapeLayers)?source.shapeLayers:[]).slice(0,MAX_SHAPES).map(normalizeShape).forEach(item=>drawShape(ctx,item,width,height));
    const offset=clamp(source.textVOffset,-40,40,0);
    drawBaseText(ctx,source.title,width,height,source.titleX??50,clamp(source.titleY,0,100,45)+offset,Math.max(12,42*scale),foreground,1,'700',true);
    drawBaseText(ctx,source.subtitle,width,height,source.subtitleX??50,clamp(source.subtitleY,0,100,56)+offset,Math.max(10,24*scale),foreground,.82,'400');
    drawBaseText(ctx,source.note,width,height,source.noteX??50,clamp(source.noteY,0,100,88)+offset,Math.max(8,15*scale),foreground,.68,'400');
    (Array.isArray(source.extraTexts)?source.extraTexts:[]).slice(0,MAX_EXTRAS).map(normalizeExtra).forEach((item)=>{if(!item.text||item.hidden)return;const x=width*item.x/100,y=height*item.y/100,size=Math.max(6,item.size*scale);ctx.save();ctx.translate(x,y);ctx.rotate(item.rotation*Math.PI/180);ctx.globalAlpha=item.opacity;ctx.fillStyle=item.color;ctx.textAlign=item.align;ctx.textBaseline='middle';ctx.font=`${item.italic?'italic ':''}${item.weight>=700?'700 ':'400 '}${size}px "Pretendard", "Malgun Gothic", sans-serif`;ctx.fillText(item.text,0,0,width*.88);ctx.restore();});
    return canvas;
  }

  function activeBgStyle(){return $('dividerBgStyleGrid')?.querySelector('[data-bg-style].active')?.dataset.bgStyle||'solid';}
  function setBgStyle(value){const style=String(value||'solid');$('dividerBgStyleGrid')?.querySelectorAll('[data-bg-style]').forEach((button)=>button.classList.toggle('active',button.dataset.bgStyle===style));}

  function patchFunctions() {
    if (!window.__pdfDividerStudioGetPatchedV3 && typeof window.getDividerContent === 'function') {
      const originalGet=window.getDividerContent;
      window.getDividerContent=function(){const content=originalGet.apply(this,arguments)||{};content.title=normalizeTitle($('dividerTitle')?.value||content.title||'');content.noBg=$('dividerNoBg')?$('dividerNoBg').checked:content.noBg!==false;content.bg=$('dividerBg')?.value||content.bg||'#ffffff';content.bg2=$('dividerBg2')?.value||content.bg2||'#dbeafe';content.bgStyle=activeBgStyle();content.fg=$('dividerFg')?.value||content.fg||'#111827';content.style=$('dividerStyleRow')?.querySelector('[data-style].active')?.dataset.style||content.style||'simple';content.extraTexts=collectExtras();content.shapeLayers=collectShapes();return content;};
      window.__pdfDividerStudioGetPatchedV3=true;
    }
    if (!window.__pdfDividerStudioRenderPatchedV3 && typeof window.renderDividerCanvas === 'function') { window.renderDividerCanvas=(content,width,height)=>renderStudioCanvas(content,width,height); window.__pdfDividerStudioRenderPatchedV3=true; }
    if (!window.__pdfDividerStudioOpenPatchedV3 && typeof window.openDividerInsert === 'function' && typeof window.editDivider === 'function') {
      const oldOpen=window.openDividerInsert, oldEdit=window.editDivider;
      window.openDividerInsert=function(){extras=[];shapes=[];setBgStyle('solid');if($('dividerBg2'))$('dividerBg2').value='#dbeafe';const result=oldOpen.apply(this,arguments);renderExtraList();renderShapeList();requestPreview();return result;};
      window.editDivider=function(page){const content=page?.dividerContent||{};extras=(Array.isArray(content.extraTexts)?content.extraTexts:[]).slice(0,MAX_EXTRAS).map(normalizeExtra);shapes=(Array.isArray(content.shapeLayers)?content.shapeLayers:[]).slice(0,MAX_SHAPES).map(normalizeShape);const result=oldEdit.apply(this,arguments);if($('dividerTitle'))$('dividerTitle').value=normalizeTitle(content.title||'');if($('dividerNoBg'))$('dividerNoBg').checked=content.noBg!==false;if($('dividerBg'))$('dividerBg').value=content.bg||'#ffffff';if($('dividerBg2'))$('dividerBg2').value=content.bg2||'#dbeafe';if($('dividerFg'))$('dividerFg').value=content.fg||'#111827';if($('dividerBg'))$('dividerBg').disabled=Boolean($('dividerNoBg')?.checked);setBgStyle(content.bgStyle||'solid');renderExtraList();renderShapeList();requestPreview();return result;};
      window.__pdfDividerStudioOpenPatchedV3=true;
    }
  }

  function bindDefaults() {
    const noBg=$('dividerNoBg'), bg=$('dividerBg');
    if(noBg&&noBg.dataset.studioBoundV3!=='true'){noBg.dataset.studioBoundV3='true';noBg.addEventListener('change',()=>{if(bg)bg.disabled=noBg.checked;requestPreview();});if(bg)bg.disabled=noBg.checked;}
    ['dividerTitle','dividerSubtitle','dividerNote','dividerBg','dividerBg2','dividerFg','dividerVOffset','dividerTitleY','dividerSubtitleY','dividerNoteY'].forEach((id)=>{const element=$(id);if(!element||element.dataset.studioPreviewBoundV3==='true')return;element.dataset.studioPreviewBoundV3='true';element.addEventListener('input',requestPreview);element.addEventListener('change',requestPreview);});
  }

  function boot(attempt=0) {
    installStyles(); ensureMultilineTitleInput(); addExtendedBaseStyles(); const ready=restructureModal(); patchFunctions(); bindDefaults(); if(!ready&&attempt<16)setTimeout(()=>boot(attempt+1),120+attempt*40);
  }

  window.PdfDividerStudio={boot:()=>boot(0),getExtras:()=>collectExtras(),getShapes:()=>collectShapes(),stage:'divider-studio-v3-layers-background-multiline'};
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>boot(0),{once:true}); else boot(0);
})();
