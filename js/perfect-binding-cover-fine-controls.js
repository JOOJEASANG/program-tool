// Precision interaction patch for the perfect-binding cover maker.
// Adds movable spine text and replaces coarse canvas interaction with fine-grained controls.
(function () {
  if (window.__perfectBindingFineControlsV5) return;
  window.__perfectBindingFineControlsV5 = true;

  function boot(attempt) {
    if (typeof state === 'undefined' || typeof $ !== 'function' || typeof renderCover !== 'function') {
      if (attempt < 40) setTimeout(() => boot(attempt + 1), 100);
      return;
    }

    const fineCanvas = $('previewCanvas');
    if (!fineCanvas) return;

    DEFAULT_LAYOUT.spineTitle = DEFAULT_LAYOUT.spineTitle || { x: 50, y: 50, scale: 100 };
    state.layout.spineTitle = state.layout.spineTitle || { ...DEFAULT_LAYOUT.spineTitle };

    const targetSelect = $('editTarget');
    if (targetSelect && !targetSelect.querySelector('option[value="spineTitle"]')) {
      const option = document.createElement('option');
      option.value = 'spineTitle';
      option.textContent = '책등 제목';
      targetSelect.appendChild(option);
    }

    const hint = document.querySelector('.layout-hint');
    if (hint) {
      hint.textContent = '미리보기에서 대상을 클릭한 뒤 천천히 드래그해 이동합니다. Shift를 누르면 더 정밀하게 움직이고, 방향키는 0.2%씩 미세 이동합니다. 이미지 선택 시 마우스 휠로 부드럽게 확대·축소할 수 있습니다.';
    }

    isImageTarget = function (key) {
      return key === 'frontImage' || key === 'backImage';
    };

    labelFor = function (key) {
      return {
        frontImage: '앞표지 이미지',
        backImage: '뒤표지 이미지',
        frontTitle: '앞표지 제목',
        frontSubtitle: '앞표지 부제목',
        publisher: '기관명·발행 연도',
        backText: '뒤표지 문구',
        spineTitle: '책등 제목',
      }[key] || key;
    };

    configureRanges = function () {
      const key = state.active;
      const image = isImageTarget(key);
      const spine = key === 'spineTitle';
      const x = $('posX');
      const y = $('posY');
      const scale = $('itemScale');

      x.disabled = spine;
      x.min = image ? -100 : 0;
      x.max = 100;
      x.step = 0.1;
      y.min = image ? -100 : (spine ? 5 : 0);
      y.max = image ? 100 : (spine ? 95 : 100);
      y.step = 0.1;
      scale.min = 50;
      scale.max = image ? 400 : 200;
      scale.step = 0.5;
    };

    syncControls = function () {
      configureRanges();
      const value = state.layout[state.active];
      if (!value) return;
      $('editTarget').value = state.active;
      $('posX').value = state.active === 'spineTitle' ? 50 : value.x;
      $('posY').value = value.y;
      $('itemScale').value = value.scale;
      $('posXVal').textContent = state.active === 'spineTitle' ? '고정' : Number(value.x).toFixed(1) + '%';
      $('posYVal').textContent = Number(value.y).toFixed(1) + '%';
      $('itemScaleVal').textContent = Number(value.scale).toFixed(1) + '%';
      $('editHint').textContent = labelFor(state.active) + ' 선택';
    };

    setActive = function (key) {
      if (!state.layout[key]) return;
      state.active = key;
      syncControls();
      requestRender();
    };

    // Replace the fixed-center spine renderer with a vertically movable renderer.
    drawSpine = function (ctx, spec, pxPerMm, spineX, bleed, trimH) {
      const title = $('spineTitle').value.trim();
      state.hitBoxes.spineTitle = null;
      if (!title || spec.spine < 2.2) return;

      const tr = state.layout.spineTitle || DEFAULT_LAYOUT.spineTitle;
      const mm = value => value * pxPerMm;
      const spine = spec.spine * pxPerMm;
      const direction = $('spineDirection').value;
      const cx = spineX + spine / 2;
      const cy = bleed + trimH * clamp((tr.y || 50) / 100, 0.05, 0.95);
      const sizeScale = clamp((tr.scale || 100) / 100, 0.5, 2);

      ctx.save();
      ctx.fillStyle = '#fff';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';

      let fontPt = Math.min(
        clamp(num('spineTextSize', 11), 5, 30),
        Math.max(5, spec.spine / MM_PER_PT * 0.56)
      );
      let fontPx = fontPt * pxPerMm * 25.4 / 72 * sizeScale;
      ctx.font = `800 ${fontPx}px Pretendard,"Malgun Gothic",sans-serif`;

      let selectionHeight;
      let selectionWidth;

      if (direction === 'vertical') {
        const chars = [...title.replace(/\s+/g, '')];
        const maxHeight = trimH - mm(20);
        const gap = Math.min(fontPx * 1.08, maxHeight / Math.max(1, chars.length));
        chars.forEach((ch, index) => {
          ctx.fillText(ch, cx, cy - (chars.length - 1) * gap / 2 + index * gap);
        });
        selectionHeight = Math.max(fontPx * 1.4, (chars.length - 1) * gap + fontPx * 1.25);
        selectionWidth = Math.max(spine, fontPx * 1.35);
      } else {
        const maxWidth = trimH - mm(20);
        while (ctx.measureText(title).width > maxWidth && fontPx > mm(1.5)) {
          fontPx *= 0.95;
          ctx.font = `800 ${fontPx}px Pretendard,"Malgun Gothic",sans-serif`;
        }
        const textLength = ctx.measureText(title).width;
        ctx.translate(cx, cy);
        ctx.rotate(direction === 'topToBottom' ? Math.PI / 2 : -Math.PI / 2);
        ctx.fillText(title, 0, 0);
        selectionHeight = textLength + fontPx * 0.8;
        selectionWidth = Math.max(spine, fontPx * 1.35);
      }
      ctx.restore();

      state.hitBoxes.spineTitle = {
        x: cx - selectionWidth / 2,
        y: cy - selectionHeight / 2,
        w: selectionWidth,
        h: selectionHeight,
      };
    };

    // Render once per animation frame. Use a lighter canvas while dragging.
    let renderQueued = false;
    renderPreview = async function () {
      updateCalculation();
      await document.fonts.ready;
      renderCover(fineCanvas, state.drag ? 78 : 110, state.showGuides, true);
      fitPreview();
    };
    requestRender = function () {
      if (renderQueued) return;
      renderQueued = true;
      requestAnimationFrame(() => {
        renderQueued = false;
        renderPreview().catch(error => setStatus(error.message, 'err'));
      });
    };

    function canvasPoint(event) {
      const rect = fineCanvas.getBoundingClientRect();
      return {
        x: (event.clientX - rect.left) * fineCanvas.width / Math.max(1, rect.width),
        y: (event.clientY - rect.top) * fineCanvas.height / Math.max(1, rect.height),
      };
    }

    function pointIn(point, box, padding) {
      const pad = padding || 0;
      return !!box &&
        point.x >= box.x - pad && point.x <= box.x + box.w + pad &&
        point.y >= box.y - pad && point.y <= box.y + box.h + pad;
    }

    function pickTarget(point) {
      const ordered = ['spineTitle', 'frontTitle', 'frontSubtitle', 'publisher', 'backText'];
      for (const key of ordered) {
        if (pointIn(point, state.hitBoxes[key], 12)) return key;
      }
      if (pointIn(point, state.hitBoxes.frontImage)) return 'frontImage';
      if (pointIn(point, state.hitBoxes.backImage)) return 'backImage';
      return null;
    }

    function panelCssSize(key) {
      const rect = fineCanvas.getBoundingClientRect();
      const spec = getSpec();
      const pxPerMm = fineCanvas.width / spec.totalW;
      const scaleX = rect.width / Math.max(1, fineCanvas.width);
      const scaleY = rect.height / Math.max(1, fineCanvas.height);
      const image = isImageTarget(key);
      return {
        w: image
          ? ((spec.trimW + spec.bleed) * pxPerMm * scaleX)
          : ((key === 'spineTitle' ? Math.max(spec.spine, 2.2) : spec.trimW) * pxPerMm * scaleX),
        h: (image ? spec.totalH : spec.trimH) * pxPerMm * scaleY,
      };
    }

    function sensitivity(event, normal, precise) {
      if (event.altKey) return precise * 0.35;
      if (event.shiftKey) return precise;
      return normal;
    }

    function rounded(value) {
      return Math.round(value * 10) / 10;
    }

    function stopOldHandler(event) {
      event.stopImmediatePropagation();
      event.stopPropagation();
    }

    fineCanvas.addEventListener('pointerdown', event => {
      stopOldHandler(event);
      if (event.button !== 0) return;

      const point = canvasPoint(event);
      const currentSelection = state.selectionBox;
      const handleSize = currentSelection?.handleSize || 12;
      const onHandle = currentSelection &&
        point.x >= currentSelection.x + currentSelection.w - handleSize &&
        point.x <= currentSelection.x + currentSelection.w + handleSize &&
        point.y >= currentSelection.y + currentSelection.h - handleSize &&
        point.y <= currentSelection.y + currentSelection.h + handleSize;

      let key = state.active;
      let mode = onHandle ? 'resize' : 'move';

      if (!onHandle) {
        const picked = pickTarget(point);
        if (picked) {
          key = picked;
          state.active = key;
          syncControls();
        }
      }

      const hit = state.hitBoxes[key];
      const value = state.layout[key];
      if (!hit || !value) return;

      state.drag = {
        pointerId: event.pointerId,
        key,
        mode,
        startClientX: event.clientX,
        startClientY: event.clientY,
        initial: { ...value },
        panel: panelCssSize(key),
      };
      fineCanvas.setPointerCapture(event.pointerId);
      fineCanvas.classList.add('dragging');
      event.preventDefault();
    }, true);

    fineCanvas.addEventListener('pointermove', event => {
      stopOldHandler(event);
      const drag = state.drag;
      if (!drag || drag.pointerId !== event.pointerId) return;

      const value = state.layout[drag.key];
      const dx = event.clientX - drag.startClientX;
      const dy = event.clientY - drag.startClientY;

      if (drag.mode === 'resize') {
        const rate = sensitivity(event, isImageTarget(drag.key) ? 0.18 : 0.12, 0.035);
        value.scale = rounded(clamp(
          drag.initial.scale + ((dx + dy) / 2) * rate,
          50,
          isImageTarget(drag.key) ? 400 : 200
        ));
      } else if (drag.key === 'spineTitle') {
        const rate = sensitivity(event, 0.48, 0.14);
        value.x = 50;
        value.y = rounded(clamp(
          drag.initial.y + (dy / Math.max(1, drag.panel.h)) * 100 * rate,
          5,
          95
        ));
      } else if (isImageTarget(drag.key)) {
        const rate = sensitivity(event, 0.34, 0.10);
        value.x = rounded(clamp(
          drag.initial.x + (dx / Math.max(1, drag.panel.w)) * 200 * rate,
          -100,
          100
        ));
        value.y = rounded(clamp(
          drag.initial.y + (dy / Math.max(1, drag.panel.h)) * 200 * rate,
          -100,
          100
        ));
      } else {
        const rate = sensitivity(event, 0.52, 0.15);
        value.x = rounded(clamp(
          drag.initial.x + (dx / Math.max(1, drag.panel.w)) * 100 * rate,
          0,
          100
        ));
        value.y = rounded(clamp(
          drag.initial.y + (dy / Math.max(1, drag.panel.h)) * 100 * rate,
          0,
          100
        ));
      }

      syncControls();
      requestRender();
      event.preventDefault();
    }, true);

    function finishDrag(event) {
      stopOldHandler(event);
      if (!state.drag || state.drag.pointerId !== event.pointerId) return;
      state.drag = null;
      fineCanvas.classList.remove('dragging');
      try { fineCanvas.releasePointerCapture(event.pointerId); } catch (_) {}
      requestRender();
      event.preventDefault();
    }

    fineCanvas.addEventListener('pointerup', finishDrag, true);
    fineCanvas.addEventListener('pointercancel', finishDrag, true);

    fineCanvas.addEventListener('wheel', event => {
      stopOldHandler(event);
      if (!isImageTarget(state.active)) return;
      const value = state.layout[state.active];
      const raw = clamp(-event.deltaY * 0.018, -3, 3);
      const multiplier = event.shiftKey ? 0.25 : 1;
      value.scale = rounded(clamp(value.scale + raw * multiplier, 50, 400));
      syncControls();
      requestRender();
      event.preventDefault();
    }, { capture: true, passive: false });

    fineCanvas.addEventListener('dblclick', event => {
      stopOldHandler(event);
      state.layout[state.active] = { ...DEFAULT_LAYOUT[state.active] };
      syncControls();
      requestRender();
      event.preventDefault();
    }, true);

    // Arrow keys provide deterministic sub-percent positioning.
    document.addEventListener('keydown', event => {
      const tag = String(event.target?.tagName || '').toLowerCase();
      if (tag === 'input' || tag === 'textarea' || tag === 'select') return;
      if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(event.key)) return;
      const value = state.layout[state.active];
      if (!value) return;

      const step = event.altKey ? 0.05 : (event.shiftKey ? 1 : 0.2);
      if (state.active !== 'spineTitle') {
        if (event.key === 'ArrowLeft') value.x -= step;
        if (event.key === 'ArrowRight') value.x += step;
      }
      if (event.key === 'ArrowUp') value.y -= step;
      if (event.key === 'ArrowDown') value.y += step;

      if (state.active === 'spineTitle') {
        value.x = 50;
        value.y = rounded(clamp(value.y, 5, 95));
      } else if (isImageTarget(state.active)) {
        value.x = rounded(clamp(value.x, -100, 100));
        value.y = rounded(clamp(value.y, -100, 100));
      } else {
        value.x = rounded(clamp(value.x, 0, 100));
        value.y = rounded(clamp(value.y, 0, 100));
      }

      syncControls();
      requestRender();
      event.preventDefault();
    });

    // Existing slider handlers continue to work, now with decimal steps.
    syncControls();
    requestRender();
  }

  boot(0);
})();
