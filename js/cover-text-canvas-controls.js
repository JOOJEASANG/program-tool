// Direct preview controls, resize handles, alignment and magnetic snapping for cover text.
(function () {
  'use strict';
  if (window.__coverTextCanvasControlsV1) return;
  window.__coverTextCanvasControlsV1 = true;
  if (!location.pathname.includes('perfect-binding-cover')) return;

  const INSTALL_DELAYS = [1900, 2400, 2750, 3000, 3150];
  const SNAP_STORAGE_KEY = 'programTool.coverTextCanvas.snap.v1';
  const ZONES = ['top', 'center', 'bottom'];
  const HANDLE_NAMES = ['nw', 'ne', 'sw', 'se'];
  const MIN_SCALE = 50;
  const MAX_SCALE = 200;

  let installed = false;
  let rendererWrapped = false;
  let drag = null;
  let activeId = '';
  let guideState = null;
  let overlayFrame = 0;
  let overlayDismissed = false;
  let snapping = readSnapSetting();

  const byId = (id) => document.getElementById(id);
  const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
  const finite = (value, fallback = 0) => Number.isFinite(Number(value)) ? Number(value) : fallback;

  function textApi() {
    return window.CoverTextZones || null;
  }

  function allItems() {
    return textApi()?.allItems?.() || [];
  }

  function findItem(id) {
    return textApi()?.findItem?.(id) || null;
  }

  function selectedItem() {
    const stateId = typeof state !== 'undefined' ? String(state.active || '') : '';
    const item = findItem(stateId) || findItem(activeId);
    return item && ['front', 'spine', 'back'].includes(item.side) ? item : null;
  }

  function ensureLayout(entry) {
    if (!entry || typeof state === 'undefined') return null;
    state.layout = state.layout || {};
    state.layout[entry.id] = state.layout[entry.id] || {
      x: finite(entry.x, 50),
      y: finite(entry.y, 50),
      scale: finite(entry.scale, 100),
    };
    const layout = state.layout[entry.id];
    layout.x = clamp(finite(layout.x, finite(entry.x, 50)), 0, 100);
    layout.y = clamp(finite(layout.y, finite(entry.y, 50)), 0, 100);
    layout.scale = clamp(finite(layout.scale, finite(entry.scale, 100)), MIN_SCALE, MAX_SCALE);
    return layout;
  }

  function isLocked() {
    return Boolean(
      window.CoverLayoutLock?.locked ||
      document.documentElement?.dataset?.coverLayoutLocked === '1'
    );
  }

  function readSnapSetting() {
    try { return localStorage.getItem(SNAP_STORAGE_KEY) !== '0'; }
    catch (_) { return true; }
  }

  function writeSnapSetting() {
    try { localStorage.setItem(SNAP_STORAGE_KEY, snapping ? '1' : '0'); }
    catch (_) {}
  }

  function saveAndRender() {
    textApi()?.save?.();
    try { window.requestRender?.(); } catch (_) {}
    scheduleOverlay();
  }

  function selectItem(entry) {
    if (!entry) return false;
    overlayDismissed = false;
    activeId = entry.id;
    ensureLayout(entry);
    textApi()?.select?.(entry.id);
    if (typeof state !== 'undefined') state.active = entry.id;
    scheduleOverlay();
    return true;
  }

  function canvasPoint(event, canvas = byId('previewCanvas')) {
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    return {
      x: (event.clientX - rect.left) * canvas.width / Math.max(1, rect.width),
      y: (event.clientY - rect.top) * canvas.height / Math.max(1, rect.height),
    };
  }

  function geometry(canvas = byId('previewCanvas')) {
    if (!canvas || typeof getSpec !== 'function') return null;
    const spec = getSpec();
    const ppm = canvas.width / Math.max(1, finite(spec.totalW, 1));
    const bleed = finite(spec.bleed, 0) * ppm;
    const trimW = finite(spec.trimW, 210) * ppm;
    const trimH = finite(spec.trimH, 297) * ppm;
    const spineW = finite(spec.spine, 0) * ppm;
    const spineX = bleed + trimW;
    return {
      canvas,
      spec,
      ppm,
      panels: {
        back: { x: bleed, y: bleed, w: trimW, h: trimH },
        spine: { x: spineX, y: bleed, w: spineW, h: trimH },
        front: { x: spineX + spineW, y: bleed, w: trimW, h: trimH },
      },
    };
  }

  function anchorFor(entry, layout, panel) {
    return {
      x: panel.x + panel.w * clamp(finite(layout?.x, 50) / 100, 0, 1),
      y: panel.y + panel.h * clamp(finite(layout?.y, 50) / 100, 0, 1),
    };
  }

  function boxOffsets(entry, layout, panel) {
    const anchor = anchorFor(entry, layout, panel);
    const box = typeof state !== 'undefined' ? state.hitBoxes?.[entry.id] : null;
    if (!box) {
      return {
        left: 0, centerX: 0, right: 0,
        top: 0, centerY: 0, bottom: 0,
      };
    }
    return {
      left: finite(box.x) - anchor.x,
      centerX: finite(box.x) + finite(box.w) / 2 - anchor.x,
      right: finite(box.x) + finite(box.w) - anchor.x,
      top: finite(box.y) - anchor.y,
      centerY: finite(box.y) + finite(box.h) / 2 - anchor.y,
      bottom: finite(box.y) + finite(box.h) - anchor.y,
    };
  }

  function axisFeatures(axis, anchor, offsets) {
    return axis === 'x'
      ? [
          { name: 'left', value: anchor + offsets.left },
          { name: 'center', value: anchor + offsets.centerX },
          { name: 'right', value: anchor + offsets.right },
        ]
      : [
          { name: 'top', value: anchor + offsets.top },
          { name: 'center', value: anchor + offsets.centerY },
          { name: 'bottom', value: anchor + offsets.bottom },
        ];
  }

  function snapAxis(anchor, features, targets, threshold) {
    let best = null;
    for (const feature of features || []) {
      for (const target of targets || []) {
        const delta = finite(target.value) - finite(feature.value);
        const distance = Math.abs(delta);
        if (distance > threshold || (best && distance >= best.distance)) continue;
        best = { anchor: anchor + delta, distance, target, feature };
      }
    }
    return best || { anchor, distance: Infinity, target: null, feature: null };
  }

  function otherBoxTargets(entry, axis) {
    const targets = [];
    if (typeof state === 'undefined') return targets;
    for (const other of allItems()) {
      if (!other || other.id === entry.id || other.side !== entry.side) continue;
      const box = state.hitBoxes?.[other.id];
      if (!box) continue;
      if (axis === 'x') {
        targets.push(
          { value: box.x, label: '다른 글자 왼쪽', kind: 'text' },
          { value: box.x + box.w / 2, label: '다른 글자 중앙', kind: 'text' },
          { value: box.x + box.w, label: '다른 글자 오른쪽', kind: 'text' },
        );
      } else {
        targets.push(
          { value: box.y, label: '다른 글자 위', kind: 'text' },
          { value: box.y + box.h / 2, label: '다른 글자 중앙', kind: 'text' },
          { value: box.y + box.h, label: '다른 글자 아래', kind: 'text' },
        );
      }
    }
    return targets;
  }

  function panelTargets(entry, geo, axis) {
    const panel = geo.panels[entry.side];
    if (!panel) return [];
    const safeMm = Math.max(0, finite(byId('safeMargin')?.value, 10));
    const safePx = axis === 'x'
      ? Math.min(panel.w * 0.32, safeMm * geo.ppm)
      : Math.min(panel.h * 0.32, safeMm * geo.ppm);
    if (axis === 'x') {
      if (entry.side === 'spine') {
        const spineInset = Math.min(panel.w * 0.18, 0.7 * geo.ppm);
        return [
          { value: panel.x + spineInset, label: '책등 왼쪽', kind: 'panel' },
          { value: panel.x + panel.w / 2, label: '책등 중앙', kind: 'panel' },
          { value: panel.x + panel.w - spineInset, label: '책등 오른쪽', kind: 'panel' },
        ];
      }
      return [
        { value: panel.x + safePx, label: '안전 여백 왼쪽', kind: 'panel' },
        { value: panel.x + panel.w / 2, label: '표지 가로 중앙', kind: 'panel' },
        { value: panel.x + panel.w - safePx, label: '안전 여백 오른쪽', kind: 'panel' },
      ];
    }
    return [
      { value: panel.y + safePx, label: '안전 여백 위', kind: 'panel' },
      { value: panel.y + panel.h / 2, label: '표지 세로 중앙', kind: 'panel' },
      { value: panel.y + panel.h - safePx, label: '안전 여백 아래', kind: 'panel' },
    ];
  }

  function snapLayout(entry, proposed, geo, thresholdCss = 8) {
    const panel = geo?.panels?.[entry?.side];
    if (!entry || !panel) return { layout: proposed, guides: null };
    const current = ensureLayout(entry);
    const offsets = boxOffsets(entry, current, panel);
    const proposedAnchor = anchorFor(entry, proposed, panel);
    const canvasRect = geo.canvas.getBoundingClientRect();
    const thresholdX = thresholdCss * geo.canvas.width / Math.max(1, canvasRect.width);
    const thresholdY = thresholdCss * geo.canvas.height / Math.max(1, canvasRect.height);

    const xTargets = [...panelTargets(entry, geo, 'x'), ...otherBoxTargets(entry, 'x')];
    const yTargets = [...panelTargets(entry, geo, 'y'), ...otherBoxTargets(entry, 'y')];
    const xSnap = snapAxis(
      proposedAnchor.x,
      axisFeatures('x', proposedAnchor.x, offsets),
      xTargets,
      thresholdX,
    );
    const ySnap = snapAxis(
      proposedAnchor.y,
      axisFeatures('y', proposedAnchor.y, offsets),
      yTargets,
      thresholdY,
    );

    const layout = {
      ...proposed,
      x: clamp((xSnap.anchor - panel.x) / Math.max(1, panel.w) * 100, 0, 100),
      y: clamp((ySnap.anchor - panel.y) / Math.max(1, panel.h) * 100, 0, 100),
    };
    const guides = {
      x: xSnap.target ? { value: xSnap.target.value, label: xSnap.target.label } : null,
      y: ySnap.target ? { value: ySnap.target.value, label: ySnap.target.label } : null,
    };
    return { layout, guides };
  }

  function alignmentLayout(entry, axis, position, geo) {
    const panel = geo?.panels?.[entry?.side];
    const layout = ensureLayout(entry);
    if (!panel || !layout) return layout;
    const offsets = boxOffsets(entry, layout, panel);
    const targets = panelTargets(entry, geo, axis);
    const index = position === 'start' ? 0 : position === 'end' ? 2 : 1;
    const target = targets[index];
    if (!target) return layout;
    const featureOffset = axis === 'x'
      ? (position === 'start' ? offsets.left : position === 'end' ? offsets.right : offsets.centerX)
      : (position === 'start' ? offsets.top : position === 'end' ? offsets.bottom : offsets.centerY);
    const anchor = target.value - featureOffset;
    if (axis === 'x') layout.x = clamp((anchor - panel.x) / Math.max(1, panel.w) * 100, 0, 100);
    else layout.y = clamp((anchor - panel.y) / Math.max(1, panel.h) * 100, 0, 100);
    entry.x = layout.x;
    entry.y = layout.y;
    return layout;
  }

  function hit(point, box, padding = 10) {
    return Boolean(
      box &&
      point.x >= box.x - padding && point.x <= box.x + box.w + padding &&
      point.y >= box.y - padding && point.y <= box.y + box.h + padding
    );
  }

  function pickedText(point) {
    if (typeof state === 'undefined') return null;
    return [...allItems()].reverse().find((entry) => hit(point, state.hitBoxes?.[entry.id], 10)) || null;
  }

  function installStyles() {
    if (byId('coverTextCanvasControlsStyles')) return;
    const style = document.createElement('style');
    style.id = 'coverTextCanvasControlsStyles';
    style.textContent = `
      .cover-text-canvas-layer{position:absolute;inset:0;z-index:12;pointer-events:none;line-height:1}
      .cover-text-selection-box{position:absolute;display:none;border:1.5px solid #0ea5e9;box-shadow:0 0 0 1px rgba(255,255,255,.9),0 0 0 3px rgba(14,165,233,.15);pointer-events:none}
      .cover-text-resize-handle{position:absolute;width:13px;height:13px;border:2px solid #fff;border-radius:3px;background:#0284c7;box-shadow:0 1px 5px rgba(15,23,42,.28);pointer-events:auto;touch-action:none;padding:0}
      .cover-text-resize-handle[data-handle="nw"]{left:-7px;top:-7px;cursor:nwse-resize}
      .cover-text-resize-handle[data-handle="ne"]{right:-7px;top:-7px;cursor:nesw-resize}
      .cover-text-resize-handle[data-handle="sw"]{left:-7px;bottom:-7px;cursor:nesw-resize}
      .cover-text-resize-handle[data-handle="se"]{right:-7px;bottom:-7px;cursor:nwse-resize}
      .cover-text-context-toolbar{position:absolute;display:none;align-items:center;gap:3px;max-width:calc(100% - 8px);padding:5px;border:1px solid #cbd5e1;border-radius:9px;background:rgba(255,255,255,.97);box-shadow:0 8px 22px rgba(15,23,42,.18);pointer-events:auto;white-space:nowrap}
      .cover-text-context-toolbar button{height:27px;min-width:27px;border:1px solid #dbe5ee;border-radius:6px;background:#fff;color:#334155;padding:0 6px;font-size:9px;font-weight:900;cursor:pointer}
      .cover-text-context-toolbar button:hover{border-color:#67c7d8;background:#ecfeff;color:#0e7490}
      .cover-text-context-toolbar button[aria-pressed="true"]{border-color:#f59e0b;background:#fffbeb;color:#92400e}
      .cover-text-toolbar-size{min-width:39px;text-align:center;font-size:8px;font-weight:900;color:#475569}
      .cover-text-toolbar-divider{width:1px;height:20px;background:#e2e8f0;margin:0 2px}
      .cover-text-smart-guide{position:absolute;display:none;background:#06b6d4;box-shadow:0 0 0 1px rgba(255,255,255,.82);pointer-events:none}
      .cover-text-smart-guide.x{top:0;width:1.5px;height:100%}
      .cover-text-smart-guide.y{left:0;width:100%;height:1.5px}
      .cover-text-guide-label{position:absolute;display:none;border-radius:5px;background:#0891b2;color:#fff;padding:3px 5px;font-size:8px;font-weight:900;white-space:nowrap;pointer-events:none}
      html[data-cover-layout-locked="1"] .cover-text-selection-box,
      html[data-cover-layout-locked="1"] .cover-text-context-toolbar{display:none!important}
      @media(max-width:620px){.cover-text-context-toolbar{gap:2px;padding:4px}.cover-text-context-toolbar button{height:29px;min-width:29px;padding:0 5px}.cover-text-toolbar-divider{display:none}}
    `;
    document.head.appendChild(style);
  }

  function ensureOverlay() {
    let root = byId('coverTextCanvasControlLayer');
    const wrap = document.querySelector('.canvas-wrap');
    if (root || !wrap) return root;
    root = document.createElement('div');
    root.id = 'coverTextCanvasControlLayer';
    root.className = 'cover-text-canvas-layer';
    root.innerHTML = `
      <div id="coverTextSelectionBox" class="cover-text-selection-box">
        ${HANDLE_NAMES.map((name) => `<button type="button" class="cover-text-resize-handle" data-cover-text-handle data-handle="${name}" aria-label="글자 크기 조절"></button>`).join('')}
      </div>
      <div id="coverTextContextToolbar" class="cover-text-context-toolbar" role="toolbar" aria-label="선택한 글자 배치 도구">
        <button type="button" data-text-scale="-5" title="글자 축소">−</button>
        <span id="coverTextToolbarSize" class="cover-text-toolbar-size">100%</span>
        <button type="button" data-text-scale="5" title="글자 확대">＋</button>
        <span class="cover-text-toolbar-divider"></span>
        <button type="button" data-align-axis="x" data-align-position="start" title="왼쪽 안전 여백 정렬">⇤</button>
        <button type="button" data-align-axis="x" data-align-position="center" title="가로 가운데 정렬">↔</button>
        <button type="button" data-align-axis="x" data-align-position="end" title="오른쪽 안전 여백 정렬">⇥</button>
        <button type="button" data-align-axis="y" data-align-position="start" title="위쪽 안전 여백 정렬">⇡</button>
        <button type="button" data-align-axis="y" data-align-position="center" title="세로 가운데 정렬">↕</button>
        <button type="button" data-align-axis="y" data-align-position="end" title="아래쪽 안전 여백 정렬">⇣</button>
        <span class="cover-text-toolbar-divider"></span>
        <button type="button" id="coverTextSnapToggle" title="자석 자동정렬 켜기 또는 끄기">자석</button>
      </div>
      <div id="coverTextGuideX" class="cover-text-smart-guide x"></div>
      <div id="coverTextGuideY" class="cover-text-smart-guide y"></div>
      <div id="coverTextGuideLabelX" class="cover-text-guide-label"></div>
      <div id="coverTextGuideLabelY" class="cover-text-guide-label"></div>
    `;
    wrap.appendChild(root);
    bindToolbar(root);
    return root;
  }

  function bindToolbar(root) {
    if (!root || root.dataset.bound === '1') return;
    root.dataset.bound = '1';
    root.querySelectorAll('[data-text-scale]').forEach((button) => {
      button.addEventListener('click', () => {
        if (isLocked()) return;
        const entry = selectedItem();
        const layout = ensureLayout(entry);
        if (!entry || !layout) return;
        layout.scale = clamp(layout.scale + finite(button.dataset.textScale), MIN_SCALE, MAX_SCALE);
        entry.scale = layout.scale;
        saveAndRender();
      });
    });
    root.querySelectorAll('[data-align-axis]').forEach((button) => {
      button.addEventListener('click', () => {
        if (isLocked()) return;
        const entry = selectedItem();
        const geo = geometry();
        if (!entry || !geo) return;
        alignmentLayout(entry, button.dataset.alignAxis, button.dataset.alignPosition, geo);
        guideState = null;
        saveAndRender();
      });
    });
    byId('coverTextSnapToggle')?.addEventListener('click', () => {
      snapping = !snapping;
      writeSnapSetting();
      updateSnapButton();
    });
    root.querySelectorAll('[data-cover-text-handle]').forEach((handle) => {
      handle.addEventListener('pointerdown', startHandleResize);
    });
  }

  function updateSnapButton() {
    const button = byId('coverTextSnapToggle');
    if (!button) return;
    button.setAttribute('aria-pressed', snapping ? 'true' : 'false');
    button.textContent = snapping ? '자석 ON' : '자석 OFF';
  }

  function canvasCssBox(box, canvas, wrap) {
    const canvasRect = canvas.getBoundingClientRect();
    const wrapRect = wrap.getBoundingClientRect();
    return {
      left: canvasRect.left - wrapRect.left + box.x * canvasRect.width / Math.max(1, canvas.width),
      top: canvasRect.top - wrapRect.top + box.y * canvasRect.height / Math.max(1, canvas.height),
      width: box.w * canvasRect.width / Math.max(1, canvas.width),
      height: box.h * canvasRect.height / Math.max(1, canvas.height),
      canvasLeft: canvasRect.left - wrapRect.left,
      canvasTop: canvasRect.top - wrapRect.top,
      canvasWidth: canvasRect.width,
      canvasHeight: canvasRect.height,
      scaleX: canvasRect.width / Math.max(1, canvas.width),
      scaleY: canvasRect.height / Math.max(1, canvas.height),
    };
  }

  function hideOverlay() {
    const box = byId('coverTextSelectionBox');
    const toolbar = byId('coverTextContextToolbar');
    if (box) box.style.display = 'none';
    if (toolbar) toolbar.style.display = 'none';
    hideGuides();
  }

  function hideGuides() {
    for (const id of ['coverTextGuideX', 'coverTextGuideY', 'coverTextGuideLabelX', 'coverTextGuideLabelY']) {
      const element = byId(id);
      if (element) element.style.display = 'none';
    }
  }

  function updateGuides(css, geo) {
    hideGuides();
    if (!guideState || !geo) return;
    if (guideState.x) {
      const line = byId('coverTextGuideX');
      const label = byId('coverTextGuideLabelX');
      const left = css.canvasLeft + guideState.x.value * css.scaleX;
      if (line) {
        line.style.display = 'block';
        line.style.left = `${left}px`;
        line.style.top = `${css.canvasTop}px`;
        line.style.height = `${css.canvasHeight}px`;
      }
      if (label) {
        label.style.display = 'block';
        label.style.left = `${left + 4}px`;
        label.style.top = `${css.canvasTop + 5}px`;
        label.textContent = guideState.x.label;
      }
    }
    if (guideState.y) {
      const line = byId('coverTextGuideY');
      const label = byId('coverTextGuideLabelY');
      const top = css.canvasTop + guideState.y.value * css.scaleY;
      if (line) {
        line.style.display = 'block';
        line.style.left = `${css.canvasLeft}px`;
        line.style.top = `${top}px`;
        line.style.width = `${css.canvasWidth}px`;
      }
      if (label) {
        label.style.display = 'block';
        label.style.left = `${css.canvasLeft + 5}px`;
        label.style.top = `${top + 4}px`;
        label.textContent = guideState.y.label;
      }
    }
  }

  function updateOverlay() {
    overlayFrame = 0;
    ensureOverlay();
    updateSnapButton();
    if (overlayDismissed) {
      hideOverlay();
      return false;
    }
    const canvas = byId('previewCanvas');
    const wrap = document.querySelector('.canvas-wrap');
    const entry = selectedItem();
    const box = entry && typeof state !== 'undefined' ? state.hitBoxes?.[entry.id] : null;
    if (!canvas || !wrap || !entry || !box || isLocked()) {
      hideOverlay();
      return false;
    }

    const css = canvasCssBox(box, canvas, wrap);
    const selection = byId('coverTextSelectionBox');
    const toolbar = byId('coverTextContextToolbar');
    if (!selection || !toolbar) return false;
    selection.style.display = 'block';
    selection.style.left = `${css.left}px`;
    selection.style.top = `${css.top}px`;
    selection.style.width = `${Math.max(4, css.width)}px`;
    selection.style.height = `${Math.max(4, css.height)}px`;

    toolbar.style.display = 'flex';
    const toolbarWidth = toolbar.offsetWidth || 300;
    const toolbarHeight = toolbar.offsetHeight || 38;
    const left = clamp(css.left + css.width / 2 - toolbarWidth / 2, 4, Math.max(4, wrap.clientWidth - toolbarWidth - 4));
    let top = css.top - toolbarHeight - 8;
    if (top < 4) top = css.top + css.height + 8;
    toolbar.style.left = `${left}px`;
    toolbar.style.top = `${top}px`;
    const layout = ensureLayout(entry);
    const size = byId('coverTextToolbarSize');
    if (size) size.textContent = `${Math.round(layout?.scale || 100)}%`;
    updateGuides(css, geometry(canvas));
    return true;
  }

  function scheduleOverlay() {
    if (overlayFrame) return;
    overlayFrame = requestAnimationFrame(updateOverlay);
  }

  function startMove(event, entry, canvas) {
    const geo = geometry(canvas);
    const panel = geo?.panels?.[entry.side];
    const layout = ensureLayout(entry);
    if (!geo || !panel || !layout) return false;
    const point = canvasPoint(event, canvas);
    drag = {
      pointerId: event.pointerId,
      mode: 'move',
      entryId: entry.id,
      startPoint: point,
      initial: { ...layout },
      geo,
    };
    try { canvas.setPointerCapture(event.pointerId); } catch (_) {}
    return true;
  }

  function startHandleResize(event) {
    if (isLocked()) return;
    const entry = selectedItem();
    const canvas = byId('previewCanvas');
    const layout = ensureLayout(entry);
    const box = entry && typeof state !== 'undefined' ? state.hitBoxes?.[entry.id] : null;
    if (!entry || !canvas || !layout || !box) return;
    const canvasRect = canvas.getBoundingClientRect();
    const center = {
      x: canvasRect.left + (box.x + box.w / 2) * canvasRect.width / Math.max(1, canvas.width),
      y: canvasRect.top + (box.y + box.h / 2) * canvasRect.height / Math.max(1, canvas.height),
    };
    drag = {
      pointerId: event.pointerId,
      mode: 'resize',
      entryId: entry.id,
      center,
      initialScale: layout.scale,
      startDistance: Math.max(8, Math.hypot(event.clientX - center.x, event.clientY - center.y)),
    };
    event.preventDefault();
    event.stopImmediatePropagation();
    event.stopPropagation();
  }

  function handlePointerDown(event) {
    if (isLocked() || event.button !== 0 || event.target !== byId('previewCanvas')) return;
    const canvas = byId('previewCanvas');
    const point = canvasPoint(event, canvas);
    const entry = pickedText(point);
    if (!entry) {
      overlayDismissed = true;
      guideState = null;
      hideOverlay();
      return;
    }
    overlayDismissed = false;
    event.preventDefault();
    event.stopImmediatePropagation();
    event.stopPropagation();
    selectItem(entry);
    startMove(event, entry, canvas);
  }

  function handlePointerMove(event) {
    if (!drag || drag.pointerId !== event.pointerId) return;
    const entry = findItem(drag.entryId);
    const layout = ensureLayout(entry);
    if (!entry || !layout || isLocked()) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    event.stopPropagation();

    if (drag.mode === 'resize') {
      const distance = Math.max(5, Math.hypot(event.clientX - drag.center.x, event.clientY - drag.center.y));
      layout.scale = clamp(drag.initialScale * distance / drag.startDistance, MIN_SCALE, MAX_SCALE);
      entry.scale = layout.scale;
      guideState = null;
    } else {
      const point = canvasPoint(event, drag.geo.canvas);
      const panel = drag.geo.panels[entry.side];
      let proposed = {
        ...layout,
        x: clamp(drag.initial.x + (point.x - drag.startPoint.x) / Math.max(1, panel.w) * 100, 0, 100),
        y: clamp(drag.initial.y + (point.y - drag.startPoint.y) / Math.max(1, panel.h) * 100, 0, 100),
      };
      if (snapping) {
        const snapped = snapLayout(entry, proposed, drag.geo);
        proposed = snapped.layout;
        guideState = snapped.guides;
      } else guideState = null;
      layout.x = proposed.x;
      layout.y = proposed.y;
      entry.x = layout.x;
      entry.y = layout.y;
    }
    try { window.requestRender?.(); } catch (_) {}
    scheduleOverlay();
  }

  function endPointer(event) {
    if (!drag || drag.pointerId !== event.pointerId) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    event.stopPropagation();
    const canvas = byId('previewCanvas');
    try { canvas?.releasePointerCapture?.(event.pointerId); } catch (_) {}
    drag = null;
    guideState = null;
    saveAndRender();
  }

  function handleKeydown(event) {
    if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(event.key)) return;
    const tag = String(event.target?.tagName || '').toUpperCase();
    if (['INPUT', 'TEXTAREA', 'SELECT'].includes(tag) || event.target?.isContentEditable) return;
    const entry = selectedItem();
    const layout = ensureLayout(entry);
    if (!entry || !layout || isLocked()) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    event.stopPropagation();
    const step = event.shiftKey ? 2 : 0.5;
    if (event.key === 'ArrowLeft') layout.x = clamp(layout.x - step, 0, 100);
    if (event.key === 'ArrowRight') layout.x = clamp(layout.x + step, 0, 100);
    if (event.key === 'ArrowUp') layout.y = clamp(layout.y - step, 0, 100);
    if (event.key === 'ArrowDown') layout.y = clamp(layout.y + step, 0, 100);
    entry.x = layout.x;
    entry.y = layout.y;
    saveAndRender();
  }

  function setSpineFont(ctx, entry, fontPx) {
    ctx.font = `${entry.weight || 700} ${fontPx}px Pretendard,"Malgun Gothic",sans-serif`;
  }

  function drawSpineEntries(canvas, dpi = 110) {
    const api = textApi();
    if (!canvas || !api?.data?.spine || typeof getSpec !== 'function' || typeof state === 'undefined') return 0;
    const geo = geometry(canvas);
    const panel = geo?.panels?.spine;
    if (!panel || geo.spec.spine < 2.2) return 0;
    const ctx = canvas.getContext('2d');
    const maxLength = panel.h * 0.28;
    let count = 0;

    for (const zone of ZONES) {
      for (const entry of api.data.spine[zone] || []) {
        const text = String(entry.text || '').trim();
        const layout = ensureLayout(entry);
        if (!text || !layout) {
          state.hitBoxes[entry.id] = null;
          continue;
        }
        const x = panel.x + panel.w * clamp(layout.x / 100, 0, 1);
        const y = panel.y + panel.h * clamp(layout.y / 100, 0, 1);
        const fontPx = clamp(finite(entry.size, 10), 5, 30) * dpi / 72 * clamp(layout.scale / 100, 0.5, 2);
        const direction = ['bottomToTop', 'vertical', 'topToBottom'].includes(entry.direction)
          ? entry.direction
          : (byId('spineDirection')?.value || 'bottomToTop');
        ctx.save();
        ctx.fillStyle = entry.color || '#ffffff';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        setSpineFont(ctx, entry, fontPx);
        let width = fontPx * 1.4;
        let length = fontPx;
        if (direction === 'vertical') {
          const characters = [...text.replace(/\s+/g, '')];
          let gap = fontPx * 1.08;
          if (characters.length * gap > maxLength) gap = Math.max(fontPx * 0.58, maxLength / Math.max(1, characters.length));
          length = Math.max(fontPx, (characters.length - 1) * gap + fontPx);
          characters.forEach((character, index) => {
            ctx.fillText(character, x, y + (index - (characters.length - 1) / 2) * gap);
          });
        } else {
          ctx.translate(x, y);
          ctx.rotate(direction === 'topToBottom' ? Math.PI / 2 : -Math.PI / 2);
          const measured = ctx.measureText(text).width;
          ctx.fillText(text, 0, 0, maxLength);
          length = Math.min(measured + 16, maxLength + 16);
        }
        ctx.restore();
        state.hitBoxes[entry.id] = {
          x: x - Math.max(panel.w, width) / 2,
          y: y - length / 2,
          w: Math.max(panel.w, width),
          h: length,
        };
        count += 1;
      }
    }
    return count;
  }

  function withoutSpineEntries(run) {
    const data = textApi()?.data?.spine;
    if (!data) return run();
    const saved = {};
    for (const zone of ZONES) {
      saved[zone] = data[zone];
      data[zone] = [];
    }
    try { return run(); }
    finally { for (const zone of ZONES) data[zone] = saved[zone] || []; }
  }

  function wrapRenderer() {
    if (rendererWrapped || typeof window.renderCover !== 'function' || window.CoverRenderPipeline?.installed) return false;
    const original = window.renderCover;
    const wrapped = function coverTextCanvasRenderer(canvas, dpi = 110, withGuides, interactive) {
      const result = withoutSpineEntries(() => Reflect.apply(original, this, arguments));
      drawSpineEntries(canvas, dpi);
      if (canvas?.id === 'previewCanvas') scheduleOverlay();
      return result;
    };
    wrapped.__coverTextCanvasControlsV1 = true;
    wrapped.__coverTextCanvasDelegate = original;
    window.renderCover = wrapped;
    try { renderCover = wrapped; } catch (_) {}
    rendererWrapped = true;
    return true;
  }

  function installEvents() {
    if (installed) return;
    installed = true;
    document.addEventListener('pointerdown', handlePointerDown, true);
    document.addEventListener('pointermove', handlePointerMove, true);
    document.addEventListener('pointerup', endPointer, true);
    document.addEventListener('pointercancel', endPointer, true);
    document.addEventListener('keydown', handleKeydown, true);
    document.addEventListener('click', (event) => {
      const row = event.target?.closest?.('.cover-text-row');
      if (row?.dataset?.textId) {
        activeId = row.dataset.textId;
        overlayDismissed = false;
      }
      scheduleOverlay();
    }, true);
    document.addEventListener('focusin', (event) => {
      const row = event.target?.closest?.('.cover-text-row');
      if (row?.dataset?.textId) {
        activeId = row.dataset.textId;
        overlayDismissed = false;
      }
      scheduleOverlay();
    }, true);
    document.addEventListener('cover-layout-lock-change', scheduleOverlay);
    window.addEventListener('resize', scheduleOverlay);
    if (typeof ResizeObserver === 'function') {
      const observer = new ResizeObserver(scheduleOverlay);
      const canvas = byId('previewCanvas');
      if (canvas) observer.observe(canvas);
    }
  }

  function install() {
    if (!textApi()?.data || typeof state === 'undefined') return false;
    installStyles();
    ensureOverlay();
    installEvents();
    wrapRenderer();
    updateSnapButton();
    scheduleOverlay();
    return true;
  }

  window.CoverTextCanvasControls = {
    geometry,
    anchorFor,
    boxOffsets,
    snapAxis,
    snapLayout,
    alignmentLayout,
    drawSpineEntries,
    withoutSpineEntries,
    install,
    get snapping() { return snapping; },
    setSnapping(value) { snapping = Boolean(value); writeSnapSetting(); updateSnapButton(); return snapping; },
    stage: 'direct-text-move-resize-align-magnetic-snap',
  };

  for (const delay of INSTALL_DELAYS) setTimeout(install, delay);
})();
