(() => {
  'use strict';

  const FIELD_IDS = {
    title: 'fieldTitle', subtitle: 'fieldSubtitle', body: 'fieldBody', date: 'fieldDate',
    place: 'fieldPlace', target: 'fieldTarget', host: 'fieldHost', organizer: 'fieldOrganizer',
    operator: 'fieldOperator', contact: 'fieldContact', spine_title: 'fieldSpineTitle',
  };
  const FIELD_LABELS = {
    title: '제목', subtitle: '부제', body: '설명·본문', date: '일시', place: '장소', target: '대상',
    host: '주최', organizer: '주관', operator: '운영', contact: '문의', logo: '로고', spine_title: '책등 제목',
  };
  const state = {
    documentType: 'poster',
    layout: null,
    elements: [],
    backgroundDataUrl: '',
    logoDataUrl: '',
    selectedField: '',
    busy: false,
  };

  const $ = id => document.getElementById(id);
  const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
  const numberValue = (id, fallback) => {
    const value = Number($(id)?.value);
    return Number.isFinite(value) ? value : fallback;
  };

  function spec() {
    const widthMm = clamp(numberValue('widthMm', 210), 50, 1000);
    const heightMm = clamp(numberValue('heightMm', 297), 50, 1000);
    const bleedMm = clamp(numberValue('bleedMm', 3), 0, 20);
    const safeMm = clamp(numberValue('safeMm', 10), 2, 50);
    const spineMm = state.documentType === 'cover' ? clamp(numberValue('spineMm', 8), 0, 100) : 0;
    const totalWidthMm = state.documentType === 'cover'
      ? widthMm * 2 + spineMm + bleedMm * 2
      : widthMm + bleedMm * 2;
    const totalHeightMm = heightMm + bleedMm * 2;
    return { widthMm, heightMm, bleedMm, safeMm, spineMm, totalWidthMm, totalHeightMm };
  }

  function fields() {
    const result = {};
    Object.entries(FIELD_IDS).forEach(([field, id]) => {
      const value = String($(id)?.value || '').trim();
      if (value) result[field] = value;
    });
    if (state.documentType === 'cover' && spec().spineMm >= 4 && !result.spine_title && result.title) {
      result.spine_title = result.title;
    }
    if (state.logoDataUrl) result.logo = 'uploaded-logo';
    return result;
  }

  function stylePrompt() {
    return String($('stylePrompt')?.value || '').trim() || '깔끔하고 전문적이며 여백이 충분한 현대적인 인쇄 디자인';
  }

  function setStatus(message, tone = '') {
    const node = $('generationStatus');
    if (!node) return;
    node.textContent = message;
    node.className = `status-box${tone ? ` is-${tone}` : ''}`;
  }

  function setBusy(busy) {
    state.busy = busy;
    const generate = $('generateBtn');
    const background = $('backgroundBtn');
    if (generate) generate.disabled = busy;
    if (background) background.disabled = busy || !state.layout;
  }

  async function apiPost(path, payload) {
    const user = window.auth?.currentUser;
    if (!user) throw new Error('로그인이 필요합니다.');
    const token = await user.getIdToken();
    const response = await fetch(path, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      cache: 'no-store',
    });
    if (!response.ok) {
      const body = await response.json().catch(() => null);
      throw new Error(body?.detail || `AI 서버 오류 (${response.status})`);
    }
    return response.json();
  }

  function layoutPayload() {
    const current = spec();
    return {
      document_type: state.documentType,
      width_mm: current.widthMm,
      height_mm: current.heightMm,
      spine_mm: current.spineMm,
      bleed_mm: current.bleedMm,
      safe_mm: current.safeMm,
      style_prompt: stylePrompt(),
      fields: {
        title: String($('fieldTitle')?.value || '').trim(),
        subtitle: String($('fieldSubtitle')?.value || '').trim(),
        body: String($('fieldBody')?.value || '').trim(),
        date: String($('fieldDate')?.value || '').trim(),
        place: String($('fieldPlace')?.value || '').trim(),
        target: String($('fieldTarget')?.value || '').trim(),
        host: String($('fieldHost')?.value || '').trim(),
        organizer: String($('fieldOrganizer')?.value || '').trim(),
        operator: String($('fieldOperator')?.value || '').trim(),
        contact: String($('fieldContact')?.value || '').trim(),
        logo: state.logoDataUrl ? 'uploaded-logo' : '',
        spine_title: state.documentType === 'cover' && current.spineMm >= 4
          ? (String($('fieldSpineTitle')?.value || '').trim() || String($('fieldTitle')?.value || '').trim())
          : '',
      },
    };
  }

  function backgroundPayload() {
    const current = spec();
    return {
      document_type: state.documentType,
      width_mm: current.widthMm,
      height_mm: current.heightMm,
      spine_mm: current.spineMm,
      bleed_mm: current.bleedMm,
      style_prompt: stylePrompt(),
      background_prompt: state.layout?.background_prompt || '',
      quality: $('imageQuality')?.value === 'medium' ? 'medium' : 'high',
    };
  }

  function zoneRect(zone) {
    const s = spec();
    const base = { x: s.bleedMm, y: s.bleedMm, w: s.widthMm, h: s.heightMm };
    if (state.documentType !== 'cover' || zone === 'page') return base;
    if (zone === 'back') return base;
    if (zone === 'spine') return { x: s.bleedMm + s.widthMm, y: s.bleedMm, w: s.spineMm, h: s.heightMm };
    if (zone === 'front') return { x: s.bleedMm + s.widthMm + s.spineMm, y: s.bleedMm, w: s.widthMm, h: s.heightMm };
    return base;
  }

  function elementRectMm(item) {
    const zone = zoneRect(item.zone);
    return {
      x: zone.x + zone.w * item.x_pct,
      y: zone.y + zone.h * item.y_pct,
      w: zone.w * item.w_pct,
      h: zone.h * item.h_pct,
    };
  }

  function fallbackElement(field, index, total) {
    const isCover = state.documentType === 'cover';
    const zone = field === 'body' && isCover ? 'back' : (field === 'spine_title' ? 'spine' : (isCover ? 'front' : 'page'));
    const titleLike = field === 'title';
    const subtitleLike = field === 'subtitle';
    const logo = field === 'logo';
    const lowerIndex = Math.max(0, index - 2);
    return {
      field, zone,
      x_pct: logo ? 0.66 : 0.1,
      y_pct: titleLike ? 0.12 : subtitleLike ? 0.28 : logo ? 0.82 : clamp(0.53 + lowerIndex * (0.31 / Math.max(1, total - 2)), 0.42, 0.86),
      w_pct: logo ? 0.24 : 0.8,
      h_pct: titleLike ? 0.17 : subtitleLike ? 0.11 : logo ? 0.1 : 0.07,
      font_size_pt: titleLike ? 30 : subtitleLike ? 15 : 10,
      font_weight: titleLike ? 800 : subtitleLike ? 600 : 500,
      align: 'left', color: '#172033', letter_spacing_em: 0, line_height: 1.25,
    };
  }

  function normalizedElements(layout) {
    const currentFields = fields();
    const usable = Array.isArray(layout?.elements) ? layout.elements.filter(item => currentFields[item.field]) : [];
    const present = new Set(usable.map(item => item.field));
    const expected = Object.keys(currentFields);
    expected.forEach((field, index) => {
      if (!present.has(field)) usable.push(fallbackElement(field, index, expected.length));
    });
    return usable.map(item => ({
      ...item,
      x_pct: clamp(Number(item.x_pct) || 0, 0, 1),
      y_pct: clamp(Number(item.y_pct) || 0, 0, 1),
      w_pct: clamp(Number(item.w_pct) || 0.3, 0.05, 1),
      h_pct: clamp(Number(item.h_pct) || 0.08, 0.02, 1),
      font_size_pt: clamp(Number(item.font_size_pt) || 11, 6, 72),
      font_weight: [400,500,600,700,800,900].includes(Number(item.font_weight)) ? Number(item.font_weight) : 500,
      align: ['left','center','right'].includes(item.align) ? item.align : 'left',
      color: /^#[0-9a-f]{6}$/i.test(item.color || '') ? item.color : '#172033',
      letter_spacing_em: clamp(Number(item.letter_spacing_em) || 0, -0.08, 0.25),
      line_height: clamp(Number(item.line_height) || 1.25, 0.9, 2),
      text: item.field === 'logo' ? '' : currentFields[item.field],
    }));
  }

  function renderSpec() {
    const s = spec();
    const artboard = $('artboard');
    if (artboard) artboard.style.aspectRatio = `${s.totalWidthMm}/${s.totalHeightMm}`;
    const summary = $('specSummary');
    if (summary) {
      summary.textContent = state.documentType === 'cover'
        ? `펼침 작업판 ${s.totalWidthMm.toFixed(1)} × ${s.totalHeightMm.toFixed(1)}mm · 뒤표지 ${s.widthMm} + 책등 ${s.spineMm} + 앞표지 ${s.widthMm} · 도련 포함`
        : `작업판 ${s.totalWidthMm.toFixed(1)} × ${s.totalHeightMm.toFixed(1)}mm · 완성 ${s.widthMm} × ${s.heightMm}mm · 도련 포함`;
    }
    renderGuides();
    if (state.elements.length) renderElements();
  }

  function pct(value, total) { return `${(value / total) * 100}%`; }

  function renderGuides() {
    const holder = $('printGuides');
    if (!holder) return;
    holder.replaceChildren();
    const s = spec();
    const trim = document.createElement('div');
    trim.className = 'guide-line guide-trim';
    trim.style.left = pct(s.bleedMm, s.totalWidthMm);
    trim.style.top = pct(s.bleedMm, s.totalHeightMm);
    trim.style.width = pct(s.totalWidthMm - s.bleedMm * 2, s.totalWidthMm);
    trim.style.height = pct(s.totalHeightMm - s.bleedMm * 2, s.totalHeightMm);
    holder.appendChild(trim);

    if (state.documentType === 'poster') {
      const safe = document.createElement('div');
      safe.className = 'guide-line guide-safe';
      safe.style.left = pct(s.bleedMm + s.safeMm, s.totalWidthMm);
      safe.style.top = pct(s.bleedMm + s.safeMm, s.totalHeightMm);
      safe.style.width = pct(Math.max(1, s.widthMm - s.safeMm * 2), s.totalWidthMm);
      safe.style.height = pct(Math.max(1, s.heightMm - s.safeMm * 2), s.totalHeightMm);
      holder.appendChild(safe);
      return;
    }

    const boundaries = [
      { x: s.bleedMm + s.widthMm, label: '책등 시작' },
      { x: s.bleedMm + s.widthMm + s.spineMm, label: '앞표지 시작' },
    ];
    boundaries.forEach(info => {
      const line = document.createElement('div');
      line.className = 'guide-line guide-fold';
      line.style.left = pct(info.x, s.totalWidthMm);
      holder.appendChild(line);
      const label = document.createElement('span');
      label.className = 'guide-label';
      label.style.left = pct(info.x, s.totalWidthMm);
      label.textContent = info.label;
      holder.appendChild(label);
    });
  }

  function itemStyle(item, node) {
    const s = spec();
    const rect = elementRectMm(item);
    node.style.left = pct(rect.x, s.totalWidthMm);
    node.style.top = pct(rect.y, s.totalHeightMm);
    node.style.width = pct(rect.w, s.totalWidthMm);
    node.style.height = pct(rect.h, s.totalHeightMm);
    const artboardWidth = $('artboard')?.getBoundingClientRect().width || 800;
    const pxPerMm = artboardWidth / s.totalWidthMm;
    const fontPx = item.font_size_pt * 0.352778 * pxPerMm;
    node.style.fontSize = `${Math.max(7, fontPx)}px`;
    node.style.fontWeight = String(item.font_weight);
    node.style.textAlign = item.align;
    node.style.color = item.color;
    node.style.letterSpacing = `${item.letter_spacing_em}em`;
    node.style.lineHeight = String(item.line_height);
  }

  function selectField(field) {
    state.selectedField = field;
    renderElements();
    syncInspector();
  }

  function bindDrag(handle, item) {
    handle.addEventListener('pointerdown', event => {
      event.preventDefault();
      event.stopPropagation();
      selectField(item.field);
      const artboard = $('artboard').getBoundingClientRect();
      const zone = zoneRect(item.zone);
      const s = spec();
      const zoneWidthPx = artboard.width * zone.w / s.totalWidthMm;
      const zoneHeightPx = artboard.height * zone.h / s.totalHeightMm;
      const startX = event.clientX;
      const startY = event.clientY;
      const originX = item.x_pct;
      const originY = item.y_pct;
      handle.setPointerCapture?.(event.pointerId);
      const move = moveEvent => {
        const dx = (moveEvent.clientX - startX) / Math.max(1, zoneWidthPx);
        const dy = (moveEvent.clientY - startY) / Math.max(1, zoneHeightPx);
        item.x_pct = clamp(originX + dx, 0, Math.max(0, 1 - item.w_pct));
        item.y_pct = clamp(originY + dy, 0, Math.max(0, 1 - item.h_pct));
        const node = document.querySelector(`.design-item[data-field="${CSS.escape(item.field)}"]`);
        if (node) itemStyle(item, node);
      };
      const up = () => {
        window.removeEventListener('pointermove', move);
        window.removeEventListener('pointerup', up);
      };
      window.addEventListener('pointermove', move);
      window.addEventListener('pointerup', up, { once: true });
    });
  }

  function renderElements() {
    const holder = $('designElements');
    if (!holder) return;
    holder.replaceChildren();
    const empty = $('emptyArtboard');
    if (empty) empty.hidden = state.elements.length > 0;

    state.elements.forEach(item => {
      if (item.field === 'logo' && !state.logoDataUrl) return;
      const wrapper = document.createElement('div');
      wrapper.className = `design-item${state.selectedField === item.field ? ' selected' : ''}`;
      wrapper.dataset.field = item.field;
      itemStyle(item, wrapper);
      wrapper.addEventListener('click', event => {
        event.stopPropagation();
        selectField(item.field);
      });

      const handle = document.createElement('button');
      handle.type = 'button';
      handle.className = 'move-handle';
      handle.textContent = '↕';
      handle.setAttribute('aria-label', `${FIELD_LABELS[item.field] || item.field} 이동`);
      bindDrag(handle, item);
      wrapper.appendChild(handle);

      if (item.field === 'logo') {
        const image = document.createElement('img');
        image.className = 'design-logo';
        image.src = state.logoDataUrl;
        image.alt = '사용자 로고';
        wrapper.appendChild(image);
      } else {
        const text = document.createElement('div');
        text.className = 'design-text';
        text.contentEditable = 'true';
        text.spellcheck = false;
        text.textContent = item.text || '';
        if (item.field === 'spine_title') {
          text.style.writingMode = 'vertical-rl';
          text.style.textOrientation = 'mixed';
          text.style.display = 'flex';
          text.style.alignItems = 'center';
        }
        text.addEventListener('input', () => {
          item.text = text.innerText;
          if (FIELD_IDS[item.field] && $(FIELD_IDS[item.field])) $(FIELD_IDS[item.field]).value = item.text;
        });
        wrapper.appendChild(text);
      }
      holder.appendChild(wrapper);
    });
  }

  function selectedItem() {
    return state.elements.find(item => item.field === state.selectedField) || null;
  }

  function syncInspector() {
    const item = selectedItem();
    $('noSelection').hidden = Boolean(item);
    $('selectionControls').hidden = !item;
    if (!item) return;
    $('selectedName').textContent = FIELD_LABELS[item.field] || item.field;
    $('fontSizeControl').disabled = item.field === 'logo';
    $('fontColorControl').disabled = item.field === 'logo';
    $('fontWeightControl').disabled = item.field === 'logo';
    $('fontSizeControl').value = String(item.font_size_pt);
    $('fontSizeOutput').textContent = `${Math.round(item.font_size_pt)} pt`;
    $('fontColorControl').value = /^#[0-9a-f]{6}$/i.test(item.color) ? item.color : '#172033';
    $('fontWeightControl').value = String(item.font_weight);
    document.querySelectorAll('[data-align]').forEach(button => {
      button.classList.toggle('active', button.dataset.align === item.align);
      button.disabled = item.field === 'logo';
    });
  }

  function renderPalette() {
    const colors = Array.isArray(state.layout?.palette) ? state.layout.palette : [];
    const section = $('paletteSection');
    const holder = $('palette');
    if (!section || !holder) return;
    section.hidden = !colors.length;
    holder.replaceChildren();
    colors.forEach(color => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'palette-swatch';
      button.style.background = color;
      button.dataset.color = color;
      button.title = `${color} 선택 요소에 적용`;
      button.addEventListener('click', () => {
        const item = selectedItem();
        if (!item || item.field === 'logo') return;
        item.color = color;
        renderElements();
        syncInspector();
      });
      holder.appendChild(button);
    });
  }

  async function generateBackground() {
    if (!state.layout) return;
    setBusy(true);
    setStatus('AI가 글자 없는 배경을 생성하고 있습니다…');
    try {
      const result = await apiPost('/api/preflight/ai-design/background', backgroundPayload());
      state.backgroundDataUrl = result.image_data_url || '';
      const image = $('backgroundImage');
      if (image && state.backgroundDataUrl) {
        image.onload = () => setStatus('배경 생성 완료. 글자는 캔버스에서 직접 수정할 수 있습니다.', 'success');
        image.src = state.backgroundDataUrl;
        image.hidden = false;
      }
      $('downloadPngBtn').disabled = !state.backgroundDataUrl;
    } catch (error) {
      setStatus(`배치는 유지했습니다. 배경 생성 실패: ${error.message}`, 'error');
    } finally {
      setBusy(false);
    }
  }

  async function generateDesign() {
    const title = String($('fieldTitle')?.value || '').trim();
    if (!title) {
      setStatus('제목은 입력해 주세요. AI가 정보 계층을 잡는 기준이 됩니다.', 'error');
      $('fieldTitle')?.focus();
      return;
    }
    setBusy(true);
    setStatus('GPT-5.6 Sol이 입력 내용과 인쇄 규격을 분석해 배치를 설계하고 있습니다…');
    try {
      const layout = await apiPost('/api/preflight/ai-design/layout', layoutPayload());
      state.layout = layout;
      state.elements = normalizedElements(layout);
      state.selectedField = 'title';
      renderPalette();
      renderElements();
      syncInspector();
      $('backgroundBtn').disabled = false;
      setStatus('배치 완료. 이어서 AI 배경을 생성합니다…');
    } catch (error) {
      setStatus(error.message || 'AI 배치를 생성하지 못했습니다.', 'error');
      setBusy(false);
      return;
    }
    setBusy(false);
    await generateBackground();
  }

  function updateType(nextType) {
    state.documentType = nextType === 'cover' ? 'cover' : 'poster';
    document.querySelectorAll('[data-doc-type]').forEach(button => button.classList.toggle('active', button.dataset.docType === state.documentType));
    $('spineField').hidden = state.documentType !== 'cover';
    $('spineTitleField').hidden = state.documentType !== 'cover';
    if (state.documentType === 'cover') {
      if (numberValue('widthMm', 210) === 210) $('widthMm').value = '176';
      if (numberValue('heightMm', 297) === 297) $('heightMm').value = '248';
    }
    renderSpec();
  }

  function readLogo(file) {
    if (!file) {
      state.logoDataUrl = '';
      $('logoFileName').textContent = '선택된 로고 없음';
      return;
    }
    if (!/^image\/(png|jpeg|webp|svg\+xml)$/i.test(file.type || '')) {
      setStatus('로고는 PNG·JPEG·WEBP·SVG 이미지만 사용할 수 있습니다.', 'error');
      $('logoInput').value = '';
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      state.logoDataUrl = String(reader.result || '');
      $('logoFileName').textContent = file.name;
      if (state.elements.length) {
        const current = fields();
        if (!state.elements.some(item => item.field === 'logo') && current.logo) {
          state.elements.push(fallbackElement('logo', state.elements.length, state.elements.length + 1));
        }
        renderElements();
      }
    };
    reader.readAsDataURL(file);
  }

  function bindInspector() {
    $('fontSizeControl')?.addEventListener('input', event => {
      const item = selectedItem();
      if (!item || item.field === 'logo') return;
      item.font_size_pt = Number(event.target.value);
      $('fontSizeOutput').textContent = `${Math.round(item.font_size_pt)} pt`;
      renderElements();
    });
    $('fontColorControl')?.addEventListener('input', event => {
      const item = selectedItem();
      if (!item || item.field === 'logo') return;
      item.color = event.target.value;
      renderElements();
    });
    $('fontWeightControl')?.addEventListener('change', event => {
      const item = selectedItem();
      if (!item || item.field === 'logo') return;
      item.font_weight = Number(event.target.value);
      renderElements();
    });
    document.querySelectorAll('[data-align]').forEach(button => button.addEventListener('click', () => {
      const item = selectedItem();
      if (!item || item.field === 'logo') return;
      item.align = button.dataset.align;
      renderElements();
      syncInspector();
    }));
  }

  function loadImage(src) {
    return new Promise((resolve, reject) => {
      const image = new Image();
      image.onload = () => resolve(image);
      image.onerror = reject;
      image.src = src;
    });
  }

  function wrapLines(ctx, text, maxWidth) {
    const paragraphs = String(text || '').split(/\n/);
    const lines = [];
    paragraphs.forEach((paragraph, paragraphIndex) => {
      if (!paragraph) {
        lines.push('');
      } else {
        let line = '';
        for (const char of paragraph) {
          const test = line + char;
          if (line && ctx.measureText(test).width > maxWidth) {
            lines.push(line);
            line = char;
          } else {
            line = test;
          }
        }
        if (line) lines.push(line);
      }
      if (paragraphIndex < paragraphs.length - 1 && lines[lines.length - 1] !== '') lines.push('');
    });
    return lines;
  }

  function drawText(ctx, item, rect, dpi) {
    const fontPx = item.font_size_pt / 72 * dpi;
    ctx.save();
    ctx.fillStyle = item.color;
    ctx.font = `${item.font_weight} ${fontPx}px Pretendard, Arial, sans-serif`;
    ctx.textBaseline = 'top';
    ctx.textAlign = item.align;
    const x = item.align === 'center' ? rect.x + rect.w / 2 : item.align === 'right' ? rect.x + rect.w : rect.x;
    const lineHeight = fontPx * item.line_height;
    const lines = wrapLines(ctx, item.text, rect.w);
    lines.slice(0, Math.max(1, Math.floor(rect.h / lineHeight))).forEach((line, index) => ctx.fillText(line, x, rect.y + index * lineHeight, rect.w));
    ctx.restore();
  }

  async function downloadPng() {
    const s = spec();
    const targetDpi = 300;
    const rawWidth = s.totalWidthMm / 25.4 * targetDpi;
    const rawHeight = s.totalHeightMm / 25.4 * targetDpi;
    const cap = Math.min(1, 6500 / Math.max(rawWidth, rawHeight));
    const dpi = targetDpi * cap;
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(s.totalWidthMm / 25.4 * dpi));
    canvas.height = Math.max(1, Math.round(s.totalHeightMm / 25.4 * dpi));
    const ctx = canvas.getContext('2d');
    const pxPerMm = dpi / 25.4;

    const gradient = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
    const palette = Array.isArray(state.layout?.palette) && state.layout.palette.length ? state.layout.palette : ['#f8fafc','#dbeafe','#fef3c7'];
    gradient.addColorStop(0, palette[0]);
    gradient.addColorStop(.6, palette[1] || palette[0]);
    gradient.addColorStop(1, palette[2] || palette[0]);
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    if (state.backgroundDataUrl) {
      try {
        const bg = await loadImage(state.backgroundDataUrl);
        const scale = Math.max(canvas.width / bg.width, canvas.height / bg.height);
        const w = bg.width * scale;
        const h = bg.height * scale;
        ctx.drawImage(bg, (canvas.width - w) / 2, (canvas.height - h) / 2, w, h);
      } catch (_) {}
    }

    let logoImage = null;
    if (state.logoDataUrl) {
      try { logoImage = await loadImage(state.logoDataUrl); } catch (_) {}
    }

    state.elements.forEach(item => {
      const mm = elementRectMm(item);
      const rect = { x:mm.x*pxPerMm, y:mm.y*pxPerMm, w:mm.w*pxPerMm, h:mm.h*pxPerMm };
      if (item.field === 'logo') {
        if (!logoImage) return;
        const ratio = Math.min(rect.w / logoImage.width, rect.h / logoImage.height);
        const w = logoImage.width * ratio;
        const h = logoImage.height * ratio;
        ctx.drawImage(logoImage, rect.x + (rect.w - w) / 2, rect.y + (rect.h - h) / 2, w, h);
        return;
      }
      if (item.field === 'spine_title') {
        ctx.save();
        ctx.translate(rect.x + rect.w / 2, rect.y + rect.h / 2);
        ctx.rotate(Math.PI / 2);
        drawText(ctx, item, { x:-rect.h/2, y:-rect.w/2, w:rect.h, h:rect.w }, dpi);
        ctx.restore();
      } else {
        drawText(ctx, item, rect, dpi);
      }
    });

    const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/png'));
    if (!blob) throw new Error('PNG 파일을 만들지 못했습니다.');
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    const safeTitle = String($('fieldTitle')?.value || 'ai-design').replace(/[\\/:*?"<>|]+/g, '_').slice(0, 80);
    anchor.href = url;
    anchor.download = `${safeTitle}_${Math.round(dpi)}dpi.png`;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1500);
  }

  function bindEvents() {
    document.querySelectorAll('[data-doc-type]').forEach(button => button.addEventListener('click', () => updateType(button.dataset.docType)));
    ['widthMm','heightMm','bleedMm','safeMm','spineMm'].forEach(id => $(id)?.addEventListener('input', renderSpec));
    $('logoInput')?.addEventListener('change', event => readLogo(event.target.files?.[0]));
    $('generateBtn')?.addEventListener('click', generateDesign);
    $('backgroundBtn')?.addEventListener('click', generateBackground);
    $('downloadPngBtn')?.addEventListener('click', () => downloadPng().catch(error => setStatus(error.message, 'error')));
    $('artboard')?.addEventListener('click', event => {
      if (event.target === $('artboard') || event.target === $('backgroundImage') || event.target === $('backgroundFallback')) {
        state.selectedField = '';
        renderElements();
        syncInspector();
      }
    });
    $('logoutBtn')?.addEventListener('click', () => window.auth?.signOut().then(() => location.replace('/')));
    window.addEventListener('resize', () => { if (state.elements.length) renderElements(); });
    bindInspector();
  }

  async function boot() {
    try {
      await Promise.resolve(window.authPersistenceReady);
      const access = await window.ProgramAccess?.guardTool?.({
        programId: 'print-checker', loginUrl: '/login.html', waitingUrl: '/approval-waiting.html', timeoutMs: 8000,
      });
      if (!access) return;
      const user = window.auth?.currentUser;
      if ($('userName')) $('userName').textContent = user?.displayName || user?.email || '승인 회원';
      bindEvents();
      updateType('poster');
      document.documentElement.style.visibility = '';
    } catch (error) {
      console.error('[ai-design] boot failed', error);
      document.documentElement.style.visibility = '';
      setStatus('AI 디자인 화면을 준비하지 못했습니다.', 'error');
    }
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once: true });
  else boot();
})();
