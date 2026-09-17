/* print-checker AI design beta — editable vector background + text layers */
'use strict';

(() => {
  if (window.__printCheckerAiDesignBetaV1) return;
  window.__printCheckerAiDesignBetaV1 = true;

  const MM_TO_PREVIEW = 2.4;
  const SAFE_MARGIN_MM = 7;
  const MAX_EXPORT_PIXELS = 42_000_000;
  const FIELD_LABELS = Object.freeze({
    title: '제목', subtitle: '부제', date: '일시', venue: '장소', target: '대상',
    organizer: '주최', host: '주관', contact: '문의', body: '본문', back_text: '뒤표지 글',
    spine_title: '책등 제목', logo: '로고',
  });
  const DEFAULT_VALUES = Object.freeze({
    document_type: 'cover', trim_width_mm: 176, trim_height_mm: 248, spine_mm: 8, bleed_mm: 3,
  });

  const state = {
    layout: null,
    selectedId: '',
    logoUrl: '',
    logoFile: null,
    work: null,
    layers: new Map(),
    dragging: null,
  };

  const $ = (id) => document.getElementById(id);
  const clamp = (v, min, max) => Math.max(min, Math.min(max, Number(v) || 0));
  const px = (n) => `${Number(n || 0).toFixed(2)}px`;

  function installLauncher() {
    if ($('aiDesignLaunch')) return;
    const productSection = $('productGrid')?.closest('.sb-section');
    if (!productSection) return;
    const button = document.createElement('button');
    button.id = 'aiDesignLaunch';
    button.type = 'button';
    button.className = 'ai-design-launch';
    button.innerHTML = 'AI 인쇄 디자인 <span class="ai-design-badge">BETA</span><small>배경 자동 디자인 · 글자 직접 편집</small>';
    button.addEventListener('click', openEditor);
    productSection.appendChild(button);
  }

  function createShell() {
    if ($('aiDesignShell')) return;
    const shell = document.createElement('section');
    shell.id = 'aiDesignShell';
    shell.className = 'ai-design-shell';
    shell.hidden = true;
    shell.innerHTML = `
      <aside class="ai-design-sidebar">
        <div class="ai-design-head"><div><strong>AI 인쇄 디자인</strong><span class="ai-design-badge">BETA</span></div><button id="aiDesignClose" class="ai-design-close" type="button" aria-label="AI 디자인 닫기">×</button></div>
        <form id="aiDesignForm" class="ai-design-form" onsubmit="return false">
          <div class="ai-design-group">
            <label class="ai-design-label" for="aiDocType">디자인 종류</label>
            <select class="ai-design-field" id="aiDocType"><option value="cover">책/보고서 표지</option><option value="poster">포스터·안내문</option></select>
          </div>
          <div class="ai-design-group">
            <span class="ai-design-label">완성 규격</span>
            <div class="ai-design-grid2">
              <label class="ai-design-inline"><input class="ai-design-field" id="aiTrimW" inputmode="decimal" value="176"><span class="ai-design-unit">가로 mm</span></label>
              <label class="ai-design-inline"><input class="ai-design-field" id="aiTrimH" inputmode="decimal" value="248"><span class="ai-design-unit">세로 mm</span></label>
            </div>
            <div class="ai-design-grid2" style="margin-top:7px">
              <label class="ai-design-inline" id="aiSpineWrap"><input class="ai-design-field" id="aiSpine" inputmode="decimal" value="8"><span class="ai-design-unit">책등 mm</span></label>
              <label class="ai-design-inline"><input class="ai-design-field" id="aiBleed" inputmode="decimal" value="3"><span class="ai-design-unit">도련 mm</span></label>
            </div>
            <div class="ai-design-hint" id="aiGeometryHint"></div>
          </div>
          <div class="ai-design-group"><label class="ai-design-label" for="aiTitle">제목 *</label><input class="ai-design-field" id="aiTitle" maxlength="180" placeholder="예: 2026 마을교육 운영사례집"></div>
          <div class="ai-design-group"><label class="ai-design-label" for="aiSubtitle">부제</label><input class="ai-design-field" id="aiSubtitle" maxlength="220"></div>
          <div class="ai-design-grid2">
            <div class="ai-design-group"><label class="ai-design-label" for="aiDate">일시</label><input class="ai-design-field" id="aiDate" maxlength="160"></div>
            <div class="ai-design-group"><label class="ai-design-label" for="aiVenue">장소</label><input class="ai-design-field" id="aiVenue" maxlength="160"></div>
          </div>
          <div class="ai-design-grid2">
            <div class="ai-design-group"><label class="ai-design-label" for="aiTarget">대상</label><input class="ai-design-field" id="aiTarget" maxlength="180"></div>
            <div class="ai-design-group"><label class="ai-design-label" for="aiContact">문의</label><input class="ai-design-field" id="aiContact" maxlength="180"></div>
          </div>
          <div class="ai-design-grid2">
            <div class="ai-design-group"><label class="ai-design-label" for="aiOrganizer">주최</label><input class="ai-design-field" id="aiOrganizer" maxlength="180"></div>
            <div class="ai-design-group"><label class="ai-design-label" for="aiHost">주관</label><input class="ai-design-field" id="aiHost" maxlength="180"></div>
          </div>
          <div class="ai-design-group"><label class="ai-design-label" for="aiBody">본문/설명</label><textarea class="ai-design-field" id="aiBody" maxlength="500"></textarea></div>
          <div class="ai-design-group" id="aiBackTextWrap"><label class="ai-design-label" for="aiBackText">뒤표지 글</label><textarea class="ai-design-field" id="aiBackText" maxlength="500" placeholder="뒤표지에 넣을 소개문이나 문구"></textarea></div>
          <div class="ai-design-group"><span class="ai-design-label">하단 로고</span><div class="ai-design-logo-box"><img class="ai-design-logo-thumb" id="aiLogoThumb" alt="로고 미리보기" hidden><input type="file" id="aiLogo" accept="image/png,image/jpeg,image/webp"></div></div>
          <div class="ai-design-group"><label class="ai-design-label" for="aiStyle">디자인 요구사항</label><textarea class="ai-design-field" id="aiStyle" maxlength="1200" placeholder="예: 밝고 고급스럽게, 교육기관 보고서 느낌, 제목은 강하게, 하단 여백은 충분히"></textarea><div class="ai-design-hint">AI는 배경과 배치만 설계합니다. 글자는 생성 후 직접 수정할 수 있습니다.</div></div>
          <div class="ai-design-actions"><button id="aiGenerate" class="ai-design-generate" type="button">AI 디자인 생성</button><div id="aiStatus" class="ai-design-status">내용을 입력한 뒤 생성 버튼을 누르세요.</div></div>
        </form>
      </aside>
      <div class="ai-design-workspace">
        <div class="ai-design-toolbar">
          <button class="ai-design-tool" id="aiBold" type="button" aria-pressed="false" disabled>굵게</button>
          <select class="ai-design-size" id="aiFontSize" aria-label="글자 크기" disabled><option>9</option><option>10</option><option>11</option><option>12</option><option>14</option><option>16</option><option>18</option><option>22</option><option>26</option><option>30</option><option>34</option><option>40</option><option>48</option><option>56</option><option>64</option><option>72</option></select>
          <input class="ai-design-color" id="aiTextColor" type="color" value="#172033" title="글자색" disabled>
          <span class="sep"></span>
          <button class="ai-design-tool" data-ai-align="left" type="button" disabled>왼쪽</button><button class="ai-design-tool" data-ai-align="center" type="button" disabled>가운데</button><button class="ai-design-tool" data-ai-align="right" type="button" disabled>오른쪽</button>
          <span class="sep"></span>
          <button class="ai-design-tool" id="aiExportPng" type="button" disabled>PNG 300dpi 저장</button>
          <span id="aiMeta" class="ai-design-meta"></span>
        </div>
        <div class="ai-design-stage-scroll" id="aiStageScroll">
          <div class="ai-design-stage" id="aiStage">
            <canvas id="aiBgCanvas"></canvas>
            <div class="ai-design-empty" id="aiEmpty">왼쪽에 내용을 입력하고<br>AI 디자인 생성을 실행하세요.</div>
            <div class="ai-design-note" id="aiStyleNote"></div>
          </div>
        </div>
      </div>`;
    document.body.appendChild(shell);
    bindShell();
    syncGeometryHint();
    resizeEmptyStage();
  }

  function bindShell() {
    $('aiDesignClose')?.addEventListener('click', closeEditor);
    $('aiGenerate')?.addEventListener('click', generateDesign);
    $('aiDocType')?.addEventListener('change', () => { syncDocumentUi(); syncGeometryHint(); resizeEmptyStage(); });
    ['aiTrimW', 'aiTrimH', 'aiSpine', 'aiBleed'].forEach((id) => $(id)?.addEventListener('input', () => { syncGeometryHint(); if (!state.layout) resizeEmptyStage(); }));
    ['aiTitle','aiSubtitle','aiDate','aiVenue','aiTarget','aiOrganizer','aiHost','aiContact','aiBody','aiBackText'].forEach((id) => $(id)?.addEventListener('input', syncFieldToLayer));
    $('aiLogo')?.addEventListener('change', handleLogo);
    $('aiBold')?.addEventListener('click', toggleBold);
    $('aiFontSize')?.addEventListener('change', updateSelectedFontSize);
    $('aiTextColor')?.addEventListener('input', updateSelectedColor);
    document.querySelectorAll('[data-ai-align]').forEach((button) => button.addEventListener('click', () => updateSelectedAlign(button.dataset.aiAlign)));
    $('aiExportPng')?.addEventListener('click', exportPng);
    document.addEventListener('pointermove', onDragMove);
    document.addEventListener('pointerup', stopDrag);
  }

  function openEditor() {
    createShell();
    $('aiDesignShell').hidden = false;
    document.body.style.overflow = 'hidden';
    syncDocumentUi();
  }

  function closeEditor() {
    const shell = $('aiDesignShell');
    if (shell) shell.hidden = true;
    document.body.style.overflow = '';
  }

  function syncDocumentUi() {
    const cover = $('aiDocType')?.value === 'cover';
    $('aiSpineWrap').style.display = cover ? '' : 'none';
    $('aiBackTextWrap').style.display = cover ? '' : 'none';
  }

  function num(id, fallback) {
    const n = Number($(id)?.value);
    return Number.isFinite(n) ? n : fallback;
  }

  function getWorkSpec() {
    const type = $('aiDocType')?.value === 'poster' ? 'poster' : 'cover';
    const trimW = clamp(num('aiTrimW', DEFAULT_VALUES.trim_width_mm), 50, 1000);
    const trimH = clamp(num('aiTrimH', DEFAULT_VALUES.trim_height_mm), 50, 1000);
    const bleed = clamp(num('aiBleed', DEFAULT_VALUES.bleed_mm), 0, 20);
    const spine = type === 'cover' ? clamp(num('aiSpine', DEFAULT_VALUES.spine_mm), 0, 100) : 0;
    const workW = type === 'cover' ? trimW * 2 + spine + bleed * 2 : trimW + bleed * 2;
    const workH = trimH + bleed * 2;
    return { type, trimW, trimH, bleed, spine, workW, workH };
  }

  function syncGeometryHint() {
    const spec = getWorkSpec();
    const hint = $('aiGeometryHint');
    if (!hint) return;
    hint.textContent = spec.type === 'cover'
      ? `전체 작업판 ${spec.workW.toFixed(1)} × ${spec.workH.toFixed(1)} mm · 뒤표지 ${spec.trimW.toFixed(1)} + 책등 ${spec.spine.toFixed(1)} + 앞표지 ${spec.trimW.toFixed(1)} mm`
      : `전체 작업판 ${spec.workW.toFixed(1)} × ${spec.workH.toFixed(1)} mm · 완성 ${spec.trimW.toFixed(1)} × ${spec.trimH.toFixed(1)} mm`;
  }

  function resizeEmptyStage() {
    const spec = getWorkSpec();
    const maxW = Math.min(1080, Math.max(560, window.innerWidth - 430));
    const maxH = Math.min(760, Math.max(420, window.innerHeight - 130));
    const scale = Math.min(maxW / spec.workW, maxH / spec.workH, MM_TO_PREVIEW);
    const stage = $('aiStage');
    if (!stage) return;
    stage.style.width = px(spec.workW * scale);
    stage.style.height = px(spec.workH * scale);
    const canvas = $('aiBgCanvas');
    canvas.width = Math.max(1, Math.round(spec.workW * scale * 2));
    canvas.height = Math.max(1, Math.round(spec.workH * scale * 2));
  }

  function collectFields() {
    const mapping = {
      title: 'aiTitle', subtitle: 'aiSubtitle', date: 'aiDate', venue: 'aiVenue', target: 'aiTarget',
      organizer: 'aiOrganizer', host: 'aiHost', contact: 'aiContact', body: 'aiBody', back_text: 'aiBackText',
    };
    const fields = {};
    Object.entries(mapping).forEach(([key, id]) => {
      const value = ($(id)?.value || '').trim();
      if (value && !($('aiDocType')?.value === 'poster' && key === 'back_text')) fields[key] = value;
    });
    return fields;
  }

  async function authFetch(url, options = {}) {
    const user = window.auth?.currentUser;
    if (!user) throw new Error('로그인이 필요합니다.');
    const token = await user.getIdToken();
    const headers = new Headers(options.headers || {});
    headers.set('Authorization', `Bearer ${token}`);
    headers.set('Content-Type', 'application/json');
    const response = await fetch(url, { ...options, headers });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.detail || 'AI 디자인 요청에 실패했습니다.');
    return data;
  }

  async function generateDesign() {
    const fields = collectFields();
    if (!fields.title) {
      setStatus('제목을 먼저 입력해 주세요.', 'error');
      $('aiTitle')?.focus();
      return;
    }
    const spec = getWorkSpec();
    const button = $('aiGenerate');
    button.disabled = true;
    setStatus('GPT-5.6 Sol이 배경과 요소 배치를 설계하고 있습니다…');
    try {
      const layout = await authFetch('/api/preflight/ai-design/layout', {
        method: 'POST',
        body: JSON.stringify({
          document_type: spec.type,
          trim_width_mm: spec.trimW,
          trim_height_mm: spec.trimH,
          spine_mm: spec.spine,
          bleed_mm: spec.bleed,
          fields,
          has_logo: Boolean(state.logoFile),
          style_request: ($('aiStyle')?.value || '').trim(),
        }),
      });
      state.layout = layout;
      state.work = spec;
      renderDesign(fields);
      const tokenText = layout.meta ? ` · 입력 ${layout.meta.input_tokens || 0} / 출력 ${layout.meta.output_tokens || 0} tokens` : '';
      $('aiMeta').textContent = `${layout.meta?.model || 'GPT-5.6 Sol'}${tokenText}`;
      setStatus('디자인 생성 완료. 글자를 클릭해 직접 수정하고, 선택된 요소의 ● 손잡이로 위치를 옮길 수 있습니다.', 'ok');
    } catch (error) {
      setStatus(error?.message || 'AI 디자인 생성에 실패했습니다.', 'error');
    } finally {
      button.disabled = false;
    }
  }

  function setStatus(text, tone = '') {
    const node = $('aiStatus');
    if (!node) return;
    node.textContent = text;
    node.className = `ai-design-status${tone ? ` is-${tone}` : ''}`;
  }

  function zoneRect(zone, spec, scale) {
    const b = spec.bleed * scale;
    const trimW = spec.trimW * scale;
    const trimH = spec.trimH * scale;
    const spine = spec.spine * scale;
    if (spec.type === 'poster') return { x: b, y: b, w: trimW, h: trimH };
    if (zone === 'back') return { x: b, y: b, w: trimW, h: trimH };
    if (zone === 'spine') return { x: b + trimW, y: b, w: spine, h: trimH };
    return { x: b + trimW + spine, y: b, w: trimW, h: trimH };
  }

  function stageScale(spec) {
    const width = $('aiStage')?.clientWidth || 1;
    return width / spec.workW;
  }

  function renderDesign(fields) {
    clearLayers();
    const spec = state.work;
    const maxW = Math.min(1080, Math.max(560, window.innerWidth - 430));
    const maxH = Math.min(760, Math.max(420, window.innerHeight - 130));
    const scale = Math.min(maxW / spec.workW, maxH / spec.workH, MM_TO_PREVIEW);
    const stage = $('aiStage');
    stage.style.width = px(spec.workW * scale);
    stage.style.height = px(spec.workH * scale);
    $('aiEmpty').hidden = true;
    drawBackground(scale);
    drawGuides(scale);
    const elements = Array.isArray(state.layout?.elements) ? state.layout.elements : [];
    elements.forEach((item) => createLayer(item, fields, scale));
    $('aiStyleNote').textContent = state.layout?.style_note || '';
    $('aiExportPng').disabled = false;
    selectLayer('');
  }

  function clearLayers() {
    state.layers.forEach((entry) => entry.node.remove());
    state.layers.clear();
    document.querySelectorAll('#aiStage .ai-design-guide,#aiStage .ai-design-guide-label').forEach((node) => node.remove());
  }

  function drawBackground(scale) {
    const canvas = $('aiBgCanvas');
    const spec = state.work;
    const dpr = 2;
    canvas.width = Math.max(1, Math.round(spec.workW * scale * dpr));
    canvas.height = Math.max(1, Math.round(spec.workH * scale * dpr));
    const ctx = canvas.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const w = spec.workW * scale, h = spec.workH * scale;
    const bg = state.layout?.background || {};
    ctx.fillStyle = bg.base_color || '#F7F8FA';
    ctx.fillRect(0, 0, w, h);
    (bg.shapes || []).forEach((shape) => paintShape(ctx, shape, w, h));
  }

  function paintShape(ctx, shape, width, height) {
    const x = width * Number(shape.x || 0) / 100;
    const y = height * Number(shape.y || 0) / 100;
    const w = width * Number(shape.w || 0) / 100;
    const h = height * Number(shape.h || 0) / 100;
    ctx.save();
    ctx.globalAlpha = clamp(shape.opacity, .03, 1);
    ctx.fillStyle = shape.color || '#1F4E79';
    ctx.strokeStyle = shape.color || '#1F4E79';
    ctx.translate(x + w / 2, y + h / 2);
    ctx.rotate((Number(shape.rotation || 0) * Math.PI) / 180);
    if (shape.kind === 'circle') {
      ctx.beginPath(); ctx.ellipse(0, 0, Math.abs(w / 2), Math.abs(h / 2), 0, 0, Math.PI * 2); ctx.fill();
    } else if (shape.kind === 'line') {
      ctx.lineWidth = Math.max(1, Math.min(16, Math.abs(h))); ctx.beginPath(); ctx.moveTo(-w / 2, 0); ctx.lineTo(w / 2, 0); ctx.stroke();
    } else {
      ctx.fillRect(-w / 2, -h / 2, w, h);
    }
    ctx.restore();
  }

  function drawGuides(scale) {
    const spec = state.work;
    const stage = $('aiStage');
    const b = spec.bleed * scale;
    const trimW = spec.trimW * scale;
    const trimH = spec.trimH * scale;
    const safe = SAFE_MARGIN_MM * scale;
    const trim = document.createElement('div');
    trim.className = 'ai-design-guide trim';
    if (spec.type === 'poster') {
      Object.assign(trim.style, { left:px(b), top:px(b), width:px(trimW), height:px(trimH) });
      stage.appendChild(trim);
      addSafeGuide({ x:b, y:b, w:trimW, h:trimH }, safe, '안전영역');
      return;
    }
    const back = { x:b, y:b, w:trimW, h:trimH };
    const spine = { x:b + trimW, y:b, w:spec.spine * scale, h:trimH };
    const front = { x:b + trimW + spec.spine * scale, y:b, w:trimW, h:trimH };
    [back, front].forEach((rect) => {
      const box = trim.cloneNode(); Object.assign(box.style,{left:px(rect.x),top:px(rect.y),width:px(rect.w),height:px(rect.h)}); stage.appendChild(box);
      addSafeGuide(rect, safe, '');
    });
    if (spine.w > 0) {
      const box = document.createElement('div'); box.className='ai-design-guide spine'; Object.assign(box.style,{left:px(spine.x),top:px(spine.y),width:px(spine.w),height:px(spine.h)}); stage.appendChild(box);
      addGuideLabel(spine.x + 2, spine.y + 2, `책등 ${spec.spine.toFixed(1)}mm`);
    }
    addGuideLabel(back.x + 4, back.y + 4, '뒤표지');
    addGuideLabel(front.x + 4, front.y + 4, '앞표지');
  }

  function addSafeGuide(rect, safe, label) {
    const node = document.createElement('div'); node.className='ai-design-guide safe';
    Object.assign(node.style,{left:px(rect.x+safe),top:px(rect.y+safe),width:px(Math.max(0,rect.w-safe*2)),height:px(Math.max(0,rect.h-safe*2))});
    $('aiStage').appendChild(node);
    if (label) addGuideLabel(rect.x + safe + 2, rect.y + safe + 2, label);
  }
  function addGuideLabel(x,y,text){ const n=document.createElement('div'); n.className='ai-design-guide-label'; n.textContent=text; Object.assign(n.style,{left:px(x),top:px(y)}); $('aiStage').appendChild(n); }

  function createLayer(item, fields, scale) {
    const id = item.id;
    if (!id || state.layers.has(id)) return;
    const zone = zoneRect(item.zone, state.work, scale);
    if (!zone.w || !zone.h) return;
    const node = document.createElement('div');
    node.className = 'ai-design-layer';
    node.dataset.id = id;
    node.dataset.kind = id === 'logo' ? 'logo' : 'text';
    node.dataset.zone = item.zone;
    node.dataset.align = item.align || 'left';
    node.style.left = px(zone.x + zone.w * item.x / 100);
    node.style.top = px(zone.y + zone.h * item.y / 100);
    node.style.width = px(zone.w * item.w / 100);
    node.style.minHeight = px(Math.max(18, zone.h * item.h / 100));
    node.style.fontSize = `${Number(item.font_size_pt || 14)}pt`;
    node.style.fontWeight = String(item.font_weight || 600);
    node.style.color = item.color || '#172033';
    node.style.transform = `rotate(${Number(item.rotate || 0)}deg)`;
    node.style.justifyContent = item.align === 'center' ? 'center' : item.align === 'right' ? 'flex-end' : 'flex-start';
    node.style.textAlign = item.align || 'left';
    const handle = document.createElement('span'); handle.className='ai-design-drag'; handle.textContent='●'; handle.title='드래그해서 이동';
    handle.addEventListener('pointerdown', (event) => startDrag(event, id));
    node.appendChild(handle);
    if (id === 'logo') {
      if (!state.logoUrl) return;
      const image = document.createElement('img'); image.src=state.logoUrl; image.alt='업로드 로고'; node.appendChild(image);
    } else {
      node.contentEditable = 'true';
      node.spellcheck = false;
      node.appendChild(document.createTextNode(id === 'spine_title' ? (fields.title || '') : (fields[id] || FIELD_LABELS[id] || id)));
      node.addEventListener('input', () => syncLayerToField(id, node));
      node.addEventListener('keydown', (event) => { if (event.key === 'Escape') node.blur(); });
    }
    node.addEventListener('pointerdown', () => selectLayer(id));
    node.addEventListener('focus', () => selectLayer(id));
    $('aiStage').appendChild(node);
    state.layers.set(id, { node, item: { ...item } });
  }

  function selectLayer(id) {
    state.selectedId = id || '';
    state.layers.forEach((entry, key) => entry.node.classList.toggle('is-selected', key === state.selectedId));
    const entry = state.layers.get(state.selectedId);
    const controls = [$('aiBold'), $('aiFontSize'), $('aiTextColor'), ...document.querySelectorAll('[data-ai-align]')];
    const editable = Boolean(entry && entry.node.dataset.kind === 'text');
    controls.forEach((control) => { if (control) control.disabled = !editable; });
    if (!editable) return;
    const style = getComputedStyle(entry.node);
    $('aiBold').setAttribute('aria-pressed', String(Number(style.fontWeight) >= 700));
    $('aiTextColor').value = rgbToHex(style.color);
    const pt = Math.round(parseFloat(style.fontSize) * .75);
    const select = $('aiFontSize');
    if (![...select.options].some((option) => Number(option.value) === pt)) { const option=document.createElement('option'); option.value=String(pt); option.textContent=String(pt); select.appendChild(option); }
    select.value = String(pt);
  }

  function rgbToHex(rgb) {
    if (rgb.startsWith('#')) return rgb.slice(0,7);
    const values = rgb.match(/\d+/g)?.slice(0,3).map(Number) || [23,32,51];
    return `#${values.map((v)=>v.toString(16).padStart(2,'0')).join('')}`;
  }

  function selectedTextEntry() {
    const entry = state.layers.get(state.selectedId);
    return entry?.node?.dataset.kind === 'text' ? entry : null;
  }
  function toggleBold(){ const entry=selectedTextEntry(); if(!entry)return; const bold=Number(getComputedStyle(entry.node).fontWeight)>=700; entry.node.style.fontWeight=bold?'500':'800'; $('aiBold').setAttribute('aria-pressed',String(!bold)); }
  function updateSelectedFontSize(){ const entry=selectedTextEntry(); if(entry) entry.node.style.fontSize=`${Number($('aiFontSize').value)||14}pt`; }
  function updateSelectedColor(){ const entry=selectedTextEntry(); if(entry) entry.node.style.color=$('aiTextColor').value; }
  function updateSelectedAlign(align){ const entry=selectedTextEntry(); if(!entry)return; entry.node.dataset.align=align; entry.node.style.textAlign=align; entry.node.style.justifyContent=align==='center'?'center':align==='right'?'flex-end':'flex-start'; }

  function startDrag(event, id) {
    event.preventDefault(); event.stopPropagation(); selectLayer(id);
    const entry = state.layers.get(id); if (!entry) return;
    state.dragging = { id, startX:event.clientX, startY:event.clientY, left:parseFloat(entry.node.style.left)||0, top:parseFloat(entry.node.style.top)||0 };
    event.currentTarget.setPointerCapture?.(event.pointerId);
  }
  function onDragMove(event) {
    if (!state.dragging) return;
    const entry = state.layers.get(state.dragging.id); if (!entry) return;
    const stage = $('aiStage'); const rect=stage.getBoundingClientRect();
    const left=clamp(state.dragging.left+event.clientX-state.dragging.startX,0,stage.clientWidth-entry.node.offsetWidth);
    const top=clamp(state.dragging.top+event.clientY-state.dragging.startY,0,stage.clientHeight-entry.node.offsetHeight);
    entry.node.style.left=px(left); entry.node.style.top=px(top);
  }
  function stopDrag(){ state.dragging=null; }

  function syncFieldToLayer(event) {
    const map={aiTitle:'title',aiSubtitle:'subtitle',aiDate:'date',aiVenue:'venue',aiTarget:'target',aiOrganizer:'organizer',aiHost:'host',aiContact:'contact',aiBody:'body',aiBackText:'back_text'};
    const id=map[event.target.id]; const entry=state.layers.get(id); if(entry) setLayerText(entry.node,event.target.value);
    if(id==='title'){ const spine=state.layers.get('spine_title'); if(spine) setLayerText(spine.node,event.target.value); }
  }
  function setLayerText(node,text){ const handle=node.querySelector('.ai-design-drag'); node.childNodes.forEach((child)=>{ if(child.nodeType===Node.TEXT_NODE) child.remove(); }); node.appendChild(document.createTextNode(text)); if(handle && handle.parentNode!==node) node.prepend(handle); }
  function syncLayerToField(id,node){
    if(id==='spine_title')return;
    const map={title:'aiTitle',subtitle:'aiSubtitle',date:'aiDate',venue:'aiVenue',target:'aiTarget',organizer:'aiOrganizer',host:'aiHost',contact:'aiContact',body:'aiBody',back_text:'aiBackText'};
    const field=$(map[id]); if(field) field.value=[...node.childNodes].filter((child)=>child.nodeType===Node.TEXT_NODE).map((child)=>child.textContent).join('').trim();
  }

  function handleLogo(event) {
    const file=event.target.files?.[0]; if(!file)return;
    if(!/^image\/(png|jpeg|webp)$/i.test(file.type||'')){ setStatus('로고는 PNG·JPEG·WEBP만 사용할 수 있습니다.','error'); event.target.value=''; return; }
    if(state.logoUrl) URL.revokeObjectURL(state.logoUrl);
    state.logoFile=file; state.logoUrl=URL.createObjectURL(file);
    const thumb=$('aiLogoThumb'); thumb.src=state.logoUrl; thumb.hidden=false;
    const entry=state.layers.get('logo'); if(entry){ const img=entry.node.querySelector('img'); if(img) img.src=state.logoUrl; }
  }

  function exportPng() {
    if (!state.layout || !state.work) return;
    const spec=state.work; const dpi=300; let scale=dpi/25.4;
    let width=Math.round(spec.workW*scale), height=Math.round(spec.workH*scale);
    if(width*height>MAX_EXPORT_PIXELS){ scale=Math.sqrt(MAX_EXPORT_PIXELS/(spec.workW*spec.workH)); width=Math.round(spec.workW*scale); height=Math.round(spec.workH*scale); }
    const canvas=document.createElement('canvas'); canvas.width=width; canvas.height=height; const ctx=canvas.getContext('2d');
    ctx.fillStyle=state.layout.background?.base_color||'#fff'; ctx.fillRect(0,0,width,height);
    (state.layout.background?.shapes||[]).forEach((shape)=>paintShape(ctx,shape,width,height));
    const previewScale=stageScale(spec);
    const promises=[];
    state.layers.forEach((entry,id)=>{
      const node=entry.node; const left=(parseFloat(node.style.left)||0)/previewScale*scale; const top=(parseFloat(node.style.top)||0)/previewScale*scale; const w=node.offsetWidth/previewScale*scale; const h=node.offsetHeight/previewScale*scale;
      if(id==='logo'){ const img=node.querySelector('img'); if(img?.complete) ctx.drawImage(img,left,top,w,h); else if(img) promises.push(new Promise((resolve)=>{img.onload=()=>{ctx.drawImage(img,left,top,w,h);resolve();};img.onerror=resolve;})); return; }
      const text=[...node.childNodes].filter((child)=>child.nodeType===Node.TEXT_NODE).map((child)=>child.textContent).join('').trim();
      if(!text)return;
      const style=getComputedStyle(node); const fontPx=parseFloat(style.fontSize)/previewScale*scale; ctx.fillStyle=style.color; ctx.font=`${style.fontWeight} ${fontPx}px Pretendard, Arial, sans-serif`; ctx.textBaseline='top';
      drawWrappedText(ctx,text,left,top,w,fontPx*1.18,node.dataset.align||'left');
    });
    Promise.all(promises).then(()=>{
      const link=document.createElement('a'); link.download=`ai-design-${Date.now()}.png`; link.href=canvas.toDataURL('image/png'); link.click();
    });
  }

  function drawWrappedText(ctx,text,x,y,maxWidth,lineHeight,align) {
    const paragraphs=String(text).split(/\n/); let cursorY=y;
    paragraphs.forEach((paragraph)=>{
      const chars=[...paragraph]; let line=''; const lines=[];
      chars.forEach((char)=>{ const test=line+char; if(line && ctx.measureText(test).width>maxWidth){ lines.push(line); line=char; } else line=test; }); if(line||!chars.length) lines.push(line);
      lines.forEach((value)=>{ let drawX=x; if(align==='center'){ctx.textAlign='center';drawX=x+maxWidth/2;}else if(align==='right'){ctx.textAlign='right';drawX=x+maxWidth;}else{ctx.textAlign='left';} ctx.fillText(value,drawX,cursorY); cursorY+=lineHeight; });
    });
  }

  function boot() { createShell(); installLauncher(); syncDocumentUi(); }
  window.PrintCheckerAiDesignBeta = Object.freeze({ open:openEditor, close:closeEditor, stage:'v1-editable-vector' });
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',boot,{once:true}); else boot();
})();
