// Interactive layout controls for the perfect-binding cover maker.
(function () {
  if (window.__perfectBindingControlsV1) return;
  window.__perfectBindingControlsV1 = true;

  const DEFAULT_LAYOUT = {
    frontImage: { x: 0, y: 0, scale: 100 },
    backImage: { x: 0, y: 0, scale: 100 },
    frontTitle: { x: 50, y: 39, scale: 100 },
    frontSubtitle: { x: 50, y: 52, scale: 100 },
    publisher: { x: 50, y: 90, scale: 100 },
    backText: { x: 50, y: 73, scale: 100 },
  };

  function cloneDefaults() {
    return Object.fromEntries(Object.entries(DEFAULT_LAYOUT).map(([key, value]) => [key, { ...value }]));
  }

  state.coverLayout = state.coverLayout || cloneDefaults();
  state.activeCoverTarget = state.activeCoverTarget || 'frontImage';
  state.coverDrag = null;

  function injectStyle() {
    if (document.getElementById('coverInteractiveStyle')) return;
    const style = document.createElement('style');
    style.id = 'coverInteractiveStyle';
    style.textContent = `
      .cover-layout-card .layout-target-row{display:grid;grid-template-columns:1fr auto;gap:7px;align-items:end}
      .cover-layout-card .range-box{margin-top:8px;padding:9px;background:#f8fafc;border:1px solid #e2e8f0;border-radius:9px}
      .cover-layout-card .range-line{display:grid;grid-template-columns:42px 1fr 40px;gap:6px;align-items:center;margin-bottom:7px}
      .cover-layout-card .range-line:last-child{margin-bottom:0}
      .cover-layout-card .range-line label{margin:0;font-size:9px}
      .cover-layout-card input[type=range]{width:100%;accent-color:#12396d}
      .cover-layout-card .range-value{font-size:9px;font-weight:900;color:#12396d;text-align:right}
      .cover-layout-card .preset-row{display:grid;grid-template-columns:repeat(3,1fr);gap:5px;margin-top:8px}
      .cover-layout-card .preset-btn{border:1px solid #cbd5e1;background:#fff;color:#475569;border-radius:7px;padding:7px 4px;font-size:9px;font-weight:850;cursor:pointer}
      .cover-layout-card .preset-btn:hover{border-color:#67c7d8;background:#ecfeff;color:#0e7490}
      .cover-layout-card .layout-actions{display:grid;grid-template-columns:1fr 1fr;gap:6px;margin-top:7px}
      .cover-layout-card .layout-hint{font-size:8px;line-height:1.5;color:#64748b;margin-top:8px;padding:7px 8px;border-radius:8px;background:#eff6ff;border:1px solid #bfdbfe}
      #previewCanvas.cover-interactive{cursor:grab;touch-action:none}
      #previewCanvas.cover-interactive.dragging{cursor:grabbing}
      .preview-edit-hint{font-size:8px;color:#0e7490;font-weight:850;background:#ecfeff;border:1px solid #a5e5ef;border-radius:999px;padding:4px 7px;white-space:nowrap}
      @media(max-width:620px){.cover-layout-card .layout-target-row{grid-template-columns:1fr}.preview-edit-hint{display:none}}
    `;
    document.head.appendChild(style);
  }

  function injectControls() {
    if (document.getElementById('coverLayoutCard')) return;
    const card = document.createElement('section');
    card.className = 'card cover-layout-card';
    card.id = 'coverLayoutCard';
    card.innerHTML = `
      <div class="card-head"><span class="step">5</span><div class="card-title">미리보기 배치 조절</div></div>
      <div class="layout-target-row">
        <div class="field" style="margin:0">
          <label for="coverEditTarget">편집 대상</label>
          <select id="coverEditTarget">
            <option value="frontImage">앞표지 이미지</option>
            <option value="backImage">뒤표지 이미지</option>
            <option value="frontTitle">앞표지 제목</option>
            <option value="frontSubtitle">앞표지 부제목</option>
            <option value="publisher">기관명·발행 연도</option>
            <option value="backText">뒤표지 문구</option>
          </select>
        </div>
        <button class="mini-btn" id="resetCoverTarget" type="button">선택 초기화</button>
      </div>
      <div class="range-box">
        <div class="range-line"><label for="coverPosX">가로</label><input id="coverPosX" type="range"><span class="range-value" id="coverPosXVal">0%</span></div>
        <div class="range-line"><label for="coverPosY">세로</label><input id="coverPosY" type="range"><span class="range-value" id="coverPosYVal">0%</span></div>
        <div class="range-line"><label for="coverScale">크기</label><input id="coverScale" type="range"><span class="range-value" id="coverScaleVal">100%</span></div>
      </div>
      <div class="preset-row">
        <button class="preset-btn" data-cover-preset="top" type="button">상단 자동 정렬</button>
        <button class="preset-btn" data-cover-preset="center" type="button">중앙 자동 정렬</button>
        <button class="preset-btn" data-cover-preset="bottom" type="button">하단 자동 정렬</button>
      </div>
      <div class="layout-actions"><button class="mini-btn" id="resetImageLayout" type="button">이미지 위치 초기화</button><button class="mini-btn" id="resetAllCoverLayout" type="button">전체 배치 초기화</button></div>
      <div class="layout-hint">미리보기에서 선택한 대상을 마우스로 드래그해 이동합니다. 이미지 선택 시 마우스 휠로 확대·축소할 수 있습니다. 이미지 맞춤은 원본 비율을 유지합니다.</div>
    `;
    document.querySelector('.settings')?.appendChild(card);

    const hint = document.createElement('span');
    hint.className = 'preview-edit-hint';
    hint.id = 'previewEditHint';
    hint.textContent = '앞표지 이미지 선택 · 드래그 이동 · 휠 확대';
    document.querySelector('.preview-actions')?.prepend(hint);
  }

  function isImageTarget(target) {
    return target === 'frontImage' || target === 'backImage';
  }

  function targetLabel(target) {
    return {
      frontImage: '앞표지 이미지',
      backImage: '뒤표지 이미지',
      frontTitle: '앞표지 제목',
      frontSubtitle: '앞표지 부제목',
      publisher: '기관명·발행 연도',
      backText: '뒤표지 문구',
    }[target] || target;
  }

  function setRangeMode() {
    const target = state.activeCoverTarget;
    const image = isImageTarget(target);
    const x = $('coverPosX');
    const y = $('coverPosY');
    const scale = $('coverScale');
    x.min = image ? -100 : 0;
    x.max = 100;
    x.step = 1;
    y.min = image ? -100 : 0;
    y.max = 100;
    y.step = 1;
    scale.min = image ? 50 : 50;
    scale.max = image ? 400 : 200;
    scale.step = image ? 5 : 1;
  }

  function syncControls() {
    const target = state.activeCoverTarget;
    const value = state.coverLayout[target];
    if (!value) return;
    setRangeMode();
    $('coverEditTarget').value = target;
    $('coverPosX').value = value.x;
    $('coverPosY').value = value.y;
    $('coverScale').value = value.scale;
    $('coverPosXVal').textContent = Math.round(value.x) + '%';
    $('coverPosYVal').textContent = Math.round(value.y) + '%';
    $('coverScaleVal').textContent = Math.round(value.scale) + '%';
    const hint = $('previewEditHint');
    if (hint) hint.textContent = targetLabel(target) + (isImageTarget(target) ? ' 선택 · 드래그 이동 · 휠 확대' : ' 선택 · 드래그 이동');
  }

  function updateFromControls() {
    const target = state.activeCoverTarget;
    const value = state.coverLayout[target];
    value.x = Number($('coverPosX').value);
    value.y = Number($('coverPosY').value);
    value.scale = Number($('coverScale').value);
    syncControls();
    requestRender();
  }

  function resetTarget(target) {
    state.coverLayout[target] = { ...DEFAULT_LAYOUT[target] };
    syncControls();
    requestRender();
  }

  function applyTextPreset(preset) {
    const layout = state.coverLayout;
    const positions = {
      top: { title: 22, subtitle: 36, publisher: 90 },
      center: { title: 39, subtitle: 52, publisher: 90 },
      bottom: { title: 58, subtitle: 72, publisher: 90 },
    }[preset] || { title: 39, subtitle: 52, publisher: 90 };
    layout.frontTitle.x = 50;
    layout.frontTitle.y = positions.title;
    layout.frontSubtitle.x = 50;
    layout.frontSubtitle.y = positions.subtitle;
    layout.publisher.x = 50;
    layout.publisher.y = positions.publisher;
    layout.backText.x = 50;
    layout.backText.y = 73;
    const titlePosition = $('titlePosition');
    if (titlePosition) titlePosition.value = preset;
    syncControls();
    requestRender();
  }

  function drawImageTransformed(ctx, img, x, y, w, h, mode, bg, transform) {
    ctx.save();
    ctx.fillStyle = bg;
    ctx.fillRect(x, y, w, h);
    if (img) {
      const baseScale = mode === 'contain'
        ? Math.min(w / img.width, h / img.height)
        : Math.max(w / img.width, h / img.height);
      const zoom = clamp((transform?.scale || 100) / 100, 0.5, 4);
      const scale = baseScale * zoom;
      const dw = img.width * scale;
      const dh = img.height * scale;
      const offsetX = ((transform?.x || 0) / 100) * w * 0.5;
      const offsetY = ((transform?.y || 0) / 100) * h * 0.5;
      const dx = x + (w - dw) / 2 + offsetX;
      const dy = y + (h - dh) / 2 + offsetY;
      ctx.beginPath();
      ctx.rect(x, y, w, h);
      ctx.clip();
      ctx.drawImage(img, dx, dy, dw, dh);
    }
    ctx.restore();
  }

  function drawTextAt(ctx, text, panel, transform, maxWidth, fontPx, color, lineGap, bold) {
    if (!String(text || '').trim()) return;
    const x = panel.x + panel.w * clamp((transform?.x ?? 50) / 100, 0, 1);
    const y = panel.y + panel.h * clamp((transform?.y ?? 50) / 100, 0, 1);
    const scale = clamp((transform?.scale || 100) / 100, 0.5, 2);
    drawCenteredLines(ctx, text, x, y, maxWidth, fontPx * scale, color, lineGap, bold);
  }

  const originalRenderCover = renderCover;
  renderCover = function enhancedRenderCover(canvas, dpi = 110, withGuides = state.showGuides) {
    const s = getSpec();
    const pxPerMm = dpi / 25.4;
    const w = Math.max(1, Math.round(s.totalW * pxPerMm));
    const h = Math.max(1, Math.round(s.totalH * pxPerMm));
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d', { alpha: false });
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';

    const mm = value => value * pxPerMm;
    const bleed = mm(s.bleed);
    const trimW = mm(s.trimW);
    const trimH = mm(s.trimH);
    const spine = mm(s.spine);
    const totalH = mm(s.totalH);
    const backX = 0;
    const spineX = bleed + trimW;
    const frontX = spineX + spine;
    const backPanel = { x: bleed, y: bleed, w: trimW, h: trimH };
    const frontPanel = { x: frontX, y: bleed, w: trimW, h: trimH };

    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, w, h);
    drawImageTransformed(ctx, state.backImage, backX, 0, bleed + trimW, totalH, $('imageFit').value, $('backColor').value, state.coverLayout.backImage);
    ctx.fillStyle = $('spineColor').value;
    ctx.fillRect(spineX, 0, Math.max(1, spine), totalH);
    drawImageTransformed(ctx, state.frontImage, frontX, 0, trimW + bleed, totalH, $('imageFit').value, $('frontColor').value, state.coverLayout.frontImage);

    const color = $('textColor').value;
    const titlePt = clamp(num('titleSize', 28), 10, 80);
    const titlePx = titlePt * dpi / 72;
    const maxTextW = trimW * 0.78;
    drawTextAt(ctx, $('frontTitle').value, frontPanel, state.coverLayout.frontTitle, maxTextW, titlePx, color, 1.25, true);
    drawTextAt(ctx, $('frontSubtitle').value, frontPanel, state.coverLayout.frontSubtitle, maxTextW, titlePx * 0.52, color, 1.2, false);
    const publisherText = [$('publisher').value.trim(), $('publishYear').value.trim()].filter(Boolean).join(' · ');
    drawTextAt(ctx, publisherText, frontPanel, state.coverLayout.publisher, maxTextW, titlePx * 0.42, color, 1.15, true);
    drawTextAt(ctx, $('backText').value, backPanel, state.coverLayout.backText, trimW * 0.72, titlePx * 0.42, color, 1.35, false);

    const spineTitle = $('spineTitle').value.trim();
    if (spineTitle && s.spine >= 2.2) {
      ctx.save();
      ctx.fillStyle = '#fff';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      let fontPt = Math.min(clamp(num('spineTextSize', 11), 5, 30), Math.max(5, s.spine / MM_PER_PT * 0.56));
      let fontPx = fontPt * dpi / 72;
      ctx.font = `800 ${fontPx}px Pretendard, sans-serif`;
      const cx = spineX + spine / 2;
      const cy = bleed + trimH / 2;
      const direction = $('spineDirection').value;
      if (direction === 'vertical') {
        const chars = [...spineTitle.replace(/\s+/g, '')];
        const maxHeight = trimH - mm(26);
        const gap = Math.min(fontPx * 1.08, maxHeight / Math.max(1, chars.length));
        chars.forEach((ch, index) => ctx.fillText(ch, cx, cy - (chars.length - 1) * gap / 2 + index * gap));
      } else {
        ctx.translate(cx, cy);
        ctx.rotate(direction === 'topToBottom' ? Math.PI / 2 : -Math.PI / 2);
        const maxWidth = trimH - mm(28);
        while (ctx.measureText(spineTitle).width > maxWidth && fontPx > mm(1.5)) {
          fontPx *= 0.95;
          ctx.font = `800 ${fontPx}px Pretendard, sans-serif`;
        }
        ctx.fillText(spineTitle, 0, 0);
      }
      ctx.restore();
    }

    if (withGuides) {
      ctx.save();
      ctx.lineWidth = Math.max(1, dpi / 100);
      ctx.setLineDash([mm(2), mm(1.2)]);
      ctx.strokeStyle = 'rgba(220,38,38,.92)';
      ctx.strokeRect(bleed, bleed, trimW, trimH);
      ctx.strokeRect(frontX, bleed, trimW, trimH);
      ctx.strokeStyle = 'rgba(37,99,235,.92)';
      ctx.beginPath();
      ctx.moveTo(spineX, bleed);
      ctx.lineTo(spineX, bleed + trimH);
      ctx.moveTo(frontX, bleed);
      ctx.lineTo(frontX, bleed + trimH);
      ctx.stroke();
      const safe = mm(s.safe);
      ctx.strokeStyle = 'rgba(21,128,61,.85)';
      ctx.strokeRect(bleed + safe, bleed + safe, trimW - safe * 2, trimH - safe * 2);
      ctx.strokeRect(frontX + safe, bleed + safe, trimW - safe * 2, trimH - safe * 2);
      ctx.setLineDash([]);
      ctx.font = `800 ${Math.max(9, dpi / 9)}px Pretendard, sans-serif`;
      ctx.textAlign = 'left';
      ctx.textBaseline = 'top';
      ctx.fillStyle = 'rgba(220,38,38,.95)';
      ctx.fillText('재단선', bleed + 4, bleed + 4);
      ctx.fillStyle = 'rgba(37,99,235,.95)';
      ctx.fillText('책등', spineX + 3, bleed + 4);
      ctx.fillStyle = 'rgba(21,128,61,.95)';
      ctx.fillText('안전 여백', frontX + safe + 4, bleed + safe + 4);
      ctx.restore();
    }

    if (canvas.id === 'previewCanvas') {
      const target = state.activeCoverTarget;
      const panel = target === 'backImage' || target === 'backText'
        ? { x: target === 'backImage' ? backX : backPanel.x, y: target === 'backImage' ? 0 : backPanel.y, w: target === 'backImage' ? bleed + trimW : backPanel.w, h: target === 'backImage' ? totalH : backPanel.h }
        : { x: target === 'frontImage' ? frontX : frontPanel.x, y: target === 'frontImage' ? 0 : frontPanel.y, w: target === 'frontImage' ? trimW + bleed : frontPanel.w, h: target === 'frontImage' ? totalH : frontPanel.h };
      ctx.save();
      ctx.strokeStyle = 'rgba(245,158,11,.95)';
      ctx.lineWidth = Math.max(2, dpi / 55);
      ctx.setLineDash([Math.max(5, dpi / 12), Math.max(4, dpi / 18)]);
      ctx.strokeRect(panel.x + 2, panel.y + 2, Math.max(1, panel.w - 4), Math.max(1, panel.h - 4));
      ctx.restore();
    }
    return s;
  };

  function canvasPoint(event) {
    const canvas = $('previewCanvas');
    const rect = canvas.getBoundingClientRect();
    return {
      x: (event.clientX - rect.left) * canvas.width / rect.width,
      y: (event.clientY - rect.top) * canvas.height / rect.height,
    };
  }

  function targetPanel(target) {
    const canvas = $('previewCanvas');
    const s = getSpec();
    const pxPerMm = canvas.width / s.totalW;
    const bleed = s.bleed * pxPerMm;
    const trimW = s.trimW * pxPerMm;
    const trimH = s.trimH * pxPerMm;
    const spine = s.spine * pxPerMm;
    const totalH = s.totalH * pxPerMm;
    const spineX = bleed + trimW;
    const frontX = spineX + spine;
    if (target === 'backImage') return { w: bleed + trimW, h: totalH };
    if (target === 'frontImage') return { w: trimW + bleed, h: totalH };
    return { w: trimW, h: trimH, front: target !== 'backText' };
  }

  function bindInteraction() {
    const canvas = $('previewCanvas');
    canvas.classList.add('cover-interactive');
    canvas.addEventListener('pointerdown', event => {
      if (event.button !== 0) return;
      const point = canvasPoint(event);
      const target = state.activeCoverTarget;
      const current = state.coverLayout[target];
      state.coverDrag = { pointerId: event.pointerId, start: point, initial: { ...current }, panel: targetPanel(target) };
      canvas.setPointerCapture(event.pointerId);
      canvas.classList.add('dragging');
      event.preventDefault();
    });
    canvas.addEventListener('pointermove', event => {
      const drag = state.coverDrag;
      if (!drag || drag.pointerId !== event.pointerId) return;
      const point = canvasPoint(event);
      const target = state.activeCoverTarget;
      const current = state.coverLayout[target];
      const dx = (point.x - drag.start.x) / Math.max(1, drag.panel.w) * 100;
      const dy = (point.y - drag.start.y) / Math.max(1, drag.panel.h) * 100;
      if (isImageTarget(target)) {
        current.x = clamp(drag.initial.x + dx * 2, -100, 100);
        current.y = clamp(drag.initial.y + dy * 2, -100, 100);
      } else {
        current.x = clamp(drag.initial.x + dx, 0, 100);
        current.y = clamp(drag.initial.y + dy, 0, 100);
      }
      syncControls();
      requestRender();
      event.preventDefault();
    });
    const finishDrag = event => {
      if (!state.coverDrag || state.coverDrag.pointerId !== event.pointerId) return;
      state.coverDrag = null;
      canvas.classList.remove('dragging');
      try { canvas.releasePointerCapture(event.pointerId); } catch (_) {}
    };
    canvas.addEventListener('pointerup', finishDrag);
    canvas.addEventListener('pointercancel', finishDrag);
    canvas.addEventListener('wheel', event => {
      const target = state.activeCoverTarget;
      if (!isImageTarget(target)) return;
      const current = state.coverLayout[target];
      current.scale = clamp(current.scale + (event.deltaY < 0 ? 10 : -10), 50, 400);
      syncControls();
      requestRender();
      event.preventDefault();
    }, { passive: false });
    canvas.addEventListener('dblclick', () => resetTarget(state.activeCoverTarget));
  }

  function bindControls() {
    $('coverEditTarget').addEventListener('change', event => {
      state.activeCoverTarget = event.target.value;
      syncControls();
      requestRender();
    });
    ['coverPosX', 'coverPosY', 'coverScale'].forEach(id => $(id).addEventListener('input', updateFromControls));
    $('resetCoverTarget').addEventListener('click', () => resetTarget(state.activeCoverTarget));
    $('resetImageLayout').addEventListener('click', () => {
      state.coverLayout.frontImage = { ...DEFAULT_LAYOUT.frontImage };
      state.coverLayout.backImage = { ...DEFAULT_LAYOUT.backImage };
      syncControls();
      requestRender();
    });
    $('resetAllCoverLayout').addEventListener('click', () => {
      state.coverLayout = cloneDefaults();
      syncControls();
      requestRender();
    });
    document.querySelectorAll('[data-cover-preset]').forEach(button => button.addEventListener('click', () => applyTextPreset(button.dataset.coverPreset)));
    $('titlePosition')?.addEventListener('change', event => applyTextPreset(event.target.value));
    $('copyFrontBtn')?.addEventListener('click', () => {
      state.coverLayout.backImage = { ...state.coverLayout.frontImage };
      if (state.activeCoverTarget === 'backImage') syncControls();
      requestRender();
    });
    $('clearImagesBtn')?.addEventListener('click', () => {
      state.coverLayout.frontImage = { ...DEFAULT_LAYOUT.frontImage };
      state.coverLayout.backImage = { ...DEFAULT_LAYOUT.backImage };
      syncControls();
    });
  }

  try {
    injectStyle();
    injectControls();
    bindControls();
    bindInteraction();
    syncControls();
    requestRender();
  } catch (error) {
    console.error('Cover interaction controls failed', error);
    renderCover = originalRenderCover;
  }
})();
