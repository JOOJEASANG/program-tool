// Stable divider-editor interactions: wider sidebar, shape drag/delete, copy/edit.
(function () {
  'use strict';
  if (window.__pdfDividerInteractionStabilityV2) return;
  window.__pdfDividerInteractionStabilityV2 = true;

  // Claim the legacy interaction slot before divider-helper can load the older
  // interaction bundle. This file is loaded from the route manifest first.
  window.__pdfDividerStudioInteractionsV1 = true;

  const $ = (id) => document.getElementById(id);
  let activeShapeId = '';
  let dragState = null;
  let moveFrame = 0;
  let pendingMove = null;
  let previewWrapped = false;
  let menuWrapped = null;
  let attempts = 0;

  function clamp(value, min, max) {
    return Math.max(min, Math.min(max, Number(value) || 0));
  }

  function editorReady() {
    try { return Array.isArray(parsedPages); } catch (_) { return false; }
  }

  function pageId(page) {
    const value = Number(page && page.id);
    return Number.isFinite(value) ? value : null;
  }

  function pageById(id) {
    if (!editorReady()) return null;
    return parsedPages.find((page) => pageId(page) === Number(id)) || null;
  }

  function studioShapes() {
    try {
      const value = window.PdfDividerStudio?.getShapes?.();
      return Array.isArray(value) ? value : [];
    } catch (_) {
      return [];
    }
  }

  function shapeById(id) {
    return studioShapes().find((shape) => String(shape.id) === String(id)) || null;
  }

  function activeShape() {
    return shapeById(activeShapeId);
  }

  function installStyles() {
    if ($('pdfDividerInteractionStabilityStyles')) return;
    const style = document.createElement('style');
    style.id = 'pdfDividerInteractionStabilityStyles';
    style.textContent = `
      #dividerModal .divider-studio-body{grid-template-columns:minmax(500px,50%) minmax(0,50%)!important}
      #dividerModal .divider-studio-controls{min-width:0!important;padding:16px 18px 24px!important}
      #dividerModal .divider-studio-preview{min-width:0!important}
      #dividerModal .divider-shape-card.divider-shape-selected{border-color:#2563eb!important;box-shadow:0 0 0 3px rgba(37,99,235,.14)!important;background:#dbeafe!important}
      #dividerModal .divider-shape-card{cursor:pointer}
      #dividerModal .divider-shape-card input,#dividerModal .divider-shape-card select,#dividerModal .divider-shape-card button{cursor:auto}
      #dividerModal .divider-shape-drag-hint{font-size:10px;line-height:1.5;color:#475569;background:#fff;border:1px solid #dbeafe;border-radius:7px;padding:7px 8px;margin:0 0 8px}
      #dividerModal #dividerPrevCanvas{touch-action:none}
      #dividerModal .divider-shape-selection-overlay{position:absolute;inset:0;width:100%;height:100%;pointer-events:none;z-index:14}
      #dividerModal .divider-shape-delete-float{position:absolute;z-index:20;display:none;border:1px solid #fecaca;border-radius:7px;background:#fff;color:#b91c1c;padding:5px 8px;font:900 10px Pretendard,"Noto Sans KR",sans-serif;cursor:pointer;box-shadow:0 4px 14px rgba(15,23,42,.18);white-space:nowrap}
      #dividerModal .divider-shape-delete-float:hover{background:#fef2f2;border-color:#f87171}
      #dividerModal .divider-style-reset-btn{width:100%;margin-top:6px;border:1px solid #cbd5e1;border-radius:7px;background:#fff;color:#64748b;padding:6px 8px;font-size:10px;font-weight:900;cursor:pointer}
      #dividerModal .divider-style-reset-btn:hover{background:#f8fafc;color:#334155}
      @media(max-width:1100px) and (min-width:851px){#dividerModal .divider-studio-body{grid-template-columns:minmax(450px,48%) minmax(0,52%)!important}}
      @media(max-width:850px){#dividerModal .divider-studio-body{grid-template-columns:1fr!important;grid-template-rows:minmax(300px,54%) minmax(240px,46%)!important}}
    `;
    document.head.appendChild(style);
  }

  function ensureDragHint() {
    const list = $('dividerShapeList');
    const card = list?.closest('.divider-settings-card');
    if (!card || $('dividerShapeDragHint')) return;
    const hint = document.createElement('div');
    hint.id = 'dividerShapeDragHint';
    hint.className = 'divider-shape-drag-hint';
    hint.textContent = '도형·타이틀 박스는 오른쪽 미리보기에서 직접 잡아 이동할 수 있습니다. 도형 목록을 눌러 선택한 뒤 삭제 버튼 또는 Delete 키로 지울 수도 있습니다.';
    const grid = card.querySelector('.divider-layer-button-grid');
    if (grid) card.insertBefore(hint, grid);
    else card.insertBefore(hint, list);
  }

  function ensureStyleReset() {
    const row = $('dividerStyleRow');
    if (!row || $('dividerStyleResetBtn')) return;
    const button = document.createElement('button');
    button.type = 'button';
    button.id = 'dividerStyleResetBtn';
    button.className = 'divider-style-reset-btn';
    button.textContent = '스타일 제거 · 심플로 되돌리기';
    button.addEventListener('click', () => {
      const simple = row.querySelector('[data-style="simple"]');
      if (simple) simple.click();
    });
    row.insertAdjacentElement('afterend', button);
  }

  function ensureOverlay() {
    const canvas = $('dividerPrevCanvas');
    const wrap = canvas?.parentElement;
    if (!canvas || !wrap) return null;
    let overlay = $('dividerShapeSelectionOverlay');
    if (!overlay) {
      overlay = document.createElement('canvas');
      overlay.id = 'dividerShapeSelectionOverlay';
      overlay.className = 'divider-shape-selection-overlay';
      wrap.appendChild(overlay);
    }
    return overlay;
  }

  function ensureFloatingDelete() {
    const wrap = $('dividerPrevCanvas')?.parentElement;
    if (!wrap) return null;
    let button = $('dividerShapeDeleteFloat');
    if (button) return button;
    button = document.createElement('button');
    button.type = 'button';
    button.id = 'dividerShapeDeleteFloat';
    button.className = 'divider-shape-delete-float';
    button.textContent = '🗑 도형 삭제';
    button.addEventListener('pointerdown', (event) => {
      event.preventDefault();
      event.stopPropagation();
    });
    button.addEventListener('click', (event) => {
      event.preventDefault();
      event.stopPropagation();
      removeActiveShape();
    });
    wrap.appendChild(button);
    return button;
  }

  function shapeCard(id) {
    const escaped = window.CSS?.escape ? CSS.escape(String(id)) : String(id).replace(/["\\]/g, '\\$&');
    return document.querySelector(`#dividerShapeList .divider-shape-card[data-shape-id="${escaped}"]`);
  }

  function syncShapeSelectionUi(scrollIntoView = false) {
    document.querySelectorAll('#dividerShapeList .divider-shape-card').forEach((card) => {
      card.classList.toggle('divider-shape-selected', String(card.dataset.shapeId) === String(activeShapeId));
    });
    const shape = activeShape();
    const button = ensureFloatingDelete();
    if (!shape || shape.hidden) {
      if (button) button.style.display = 'none';
      return;
    }
    if (button) {
      button.style.display = 'block';
      button.style.left = `${clamp(shape.x, 4, 96)}%`;
      const top = clamp(Number(shape.y) - Math.max(2.5, Number(shape.height || 0) / 2) - 1.5, 5, 96);
      button.style.top = `${top}%`;
      button.style.transform = 'translate(-50%,-100%)';
      button.title = shape.locked ? '잠긴 도형도 삭제할 수 있습니다.' : '선택한 도형 삭제';
    }
    if (scrollIntoView) shapeCard(shape.id)?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }

  function drawSelectionOverlay() {
    const canvas = $('dividerPrevCanvas');
    const overlay = ensureOverlay();
    if (!canvas || !overlay) return;
    const width = Math.max(1, Number(canvas.width) || 1);
    const height = Math.max(1, Number(canvas.height) || 1);
    if (overlay.width !== width) overlay.width = width;
    if (overlay.height !== height) overlay.height = height;
    const ctx = overlay.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, overlay.width, overlay.height);
    const shape = activeShape();
    if (!shape || shape.hidden) {
      syncShapeSelectionUi(false);
      return;
    }
    const x = width * Number(shape.x || 0) / 100;
    const y = height * Number(shape.y || 0) / 100;
    const w = width * Number(shape.width || 0) / 100;
    const h = Math.max(4, height * Number(shape.height || 0) / 100);
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(Number(shape.rotation || 0) * Math.PI / 180);
    ctx.setLineDash([7, 5]);
    ctx.lineWidth = Math.max(2, Math.min(width, height) * 0.004);
    ctx.strokeStyle = shape.locked ? '#64748b' : '#2563eb';
    ctx.strokeRect(-w / 2 - 3, -h / 2 - 3, w + 6, h + 6);
    ctx.setLineDash([]);
    ctx.fillStyle = shape.locked ? '#64748b' : '#2563eb';
    ctx.beginPath();
    ctx.arc(0, 0, Math.max(3, ctx.lineWidth * 1.6), 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    syncShapeSelectionUi(false);
  }

  function queueSelectionOverlay() {
    requestAnimationFrame(drawSelectionOverlay);
  }

  function selectShape(id, scrollIntoView = false) {
    activeShapeId = id ? String(id) : '';
    syncShapeSelectionUi(scrollIntoView);
    queueSelectionOverlay();
  }

  function canvasPoint(event, canvas) {
    const rect = canvas.getBoundingClientRect();
    if (!rect.width || !rect.height) return null;
    return {
      x: (event.clientX - rect.left) / rect.width * canvas.width,
      y: (event.clientY - rect.top) / rect.height * canvas.height,
      xPct: (event.clientX - rect.left) / rect.width * 100,
      yPct: (event.clientY - rect.top) / rect.height * 100,
    };
  }

  function localPoint(shape, point, canvas) {
    const cx = canvas.width * Number(shape.x || 0) / 100;
    const cy = canvas.height * Number(shape.y || 0) / 100;
    const angle = -(Number(shape.rotation || 0) * Math.PI / 180);
    const dx = point.x - cx;
    const dy = point.y - cy;
    return {
      x: dx * Math.cos(angle) - dy * Math.sin(angle),
      y: dx * Math.sin(angle) + dy * Math.cos(angle),
    };
  }

  function hitShape(shape, point, canvas) {
    if (!shape || shape.hidden) return false;
    const local = localPoint(shape, point, canvas);
    const width = canvas.width * Number(shape.width || 0) / 100;
    const height = canvas.height * Number(shape.height || 0) / 100;
    const tolerance = Math.max(7, Math.min(canvas.width, canvas.height) * 0.012);
    if (shape.kind === 'line') return Math.abs(local.x) <= width / 2 + tolerance && Math.abs(local.y) <= tolerance;
    if (shape.kind === 'circle') {
      const rx = Math.max(1, width / 2 + tolerance);
      const ry = Math.max(1, height / 2 + tolerance);
      return (local.x * local.x) / (rx * rx) + (local.y * local.y) / (ry * ry) <= 1;
    }
    return Math.abs(local.x) <= width / 2 + tolerance && Math.abs(local.y) <= height / 2 + tolerance;
  }

  function hitTestShape(point, canvas) {
    const shapes = studioShapes();
    for (let index = shapes.length - 1; index >= 0; index -= 1) {
      if (hitShape(shapes[index], point, canvas)) return shapes[index];
    }
    return null;
  }

  function applyShapePosition(id, x, y) {
    const card = shapeCard(id);
    const xInput = card?.querySelector('[data-key="x"]');
    const yInput = card?.querySelector('[data-key="y"]');
    if (!xInput || !yInput || xInput.disabled || yInput.disabled) return false;
    xInput.value = String(Math.round(clamp(x, 0, 100) * 10) / 10);
    yInput.value = String(Math.round(clamp(y, 0, 100) * 10) / 10);
    xInput.dispatchEvent(new Event('input', { bubbles: true }));
    yInput.dispatchEvent(new Event('input', { bubbles: true }));
    queueSelectionOverlay();
    return true;
  }

  function scheduleShapePosition(id, x, y) {
    pendingMove = { id, x, y };
    if (moveFrame) return;
    moveFrame = requestAnimationFrame(() => {
      moveFrame = 0;
      const move = pendingMove;
      pendingMove = null;
      if (move) applyShapePosition(move.id, move.x, move.y);
    });
  }

  function flushPendingMove() {
    if (!pendingMove) return;
    if (moveFrame) cancelAnimationFrame(moveFrame);
    moveFrame = 0;
    const move = pendingMove;
    pendingMove = null;
    applyShapePosition(move.id, move.x, move.y);
  }

  function bindCanvasDrag() {
    const canvas = $('dividerPrevCanvas');
    if (!canvas || canvas.dataset.dividerShapeDragStableV2 === 'true') return Boolean(canvas);
    canvas.dataset.dividerShapeDragStableV2 = 'true';

    canvas.addEventListener('pointerdown', (event) => {
      if (event.button !== 0) return;
      const point = canvasPoint(event, canvas);
      if (!point) return;
      const shape = hitTestShape(point, canvas);
      if (!shape) {
        selectShape('', false);
        return; // Keep legacy text dragging available when no shape is hit.
      }
      event.preventDefault();
      event.stopImmediatePropagation();
      selectShape(shape.id, true);
      if (shape.locked) return;
      dragState = {
        id: String(shape.id),
        pointerId: event.pointerId,
        offsetX: Number(shape.x) - point.xPct,
        offsetY: Number(shape.y) - point.yPct,
      };
      try { canvas.setPointerCapture(event.pointerId); } catch (_) {}
      canvas.style.cursor = 'grabbing';
    }, true);

    canvas.addEventListener('pointermove', (event) => {
      const point = canvasPoint(event, canvas);
      if (!point) return;
      if (!dragState || dragState.pointerId !== event.pointerId) {
        const hover = hitTestShape(point, canvas);
        canvas.style.cursor = hover ? (hover.locked ? 'not-allowed' : 'grab') : 'default';
        return;
      }
      event.preventDefault();
      event.stopImmediatePropagation();
      scheduleShapePosition(dragState.id, point.xPct + dragState.offsetX, point.yPct + dragState.offsetY);
    }, true);

    const finish = (event) => {
      if (!dragState || dragState.pointerId !== event.pointerId) return;
      event.preventDefault();
      event.stopImmediatePropagation();
      flushPendingMove();
      const id = dragState.id;
      dragState = null;
      canvas.style.cursor = 'grab';
      try { canvas.releasePointerCapture(event.pointerId); } catch (_) {}
      selectShape(id, false);
    };
    canvas.addEventListener('pointerup', finish, true);
    canvas.addEventListener('pointercancel', finish, true);
    return true;
  }

  function bindShapeListSelection() {
    const list = $('dividerShapeList');
    if (!list || list.dataset.dividerShapeSelectStableV2 === 'true') return Boolean(list);
    list.dataset.dividerShapeSelectStableV2 = 'true';
    list.addEventListener('click', (event) => {
      const card = event.target.closest('.divider-shape-card');
      if (!card || !list.contains(card)) return;
      if (event.target.closest('button,input,select,textarea,label')) return;
      selectShape(card.dataset.shapeId, false);
    });
    new MutationObserver(() => {
      if (activeShapeId && !shapeById(activeShapeId)) activeShapeId = '';
      syncShapeSelectionUi(false);
      queueSelectionOverlay();
    }).observe(list, { childList: true, subtree: false });
    return true;
  }

  function removeActiveShape() {
    if (!activeShapeId) return false;
    const card = shapeCard(activeShapeId);
    const button = card?.querySelector('button[data-action="delete"]');
    if (!button) return false;
    const deleted = activeShapeId;
    activeShapeId = '';
    button.click();
    syncShapeSelectionUi(false);
    queueSelectionOverlay();
    try { document.documentElement.dataset.dividerShapeDeleted = deleted; } catch (_) {}
    return true;
  }

  function bindDeleteKey() {
    if (document.documentElement.dataset.dividerShapeDeleteKeyStableV2 === 'true') return;
    document.documentElement.dataset.dividerShapeDeleteKeyStableV2 = 'true';
    document.addEventListener('keydown', (event) => {
      if (event.key !== 'Delete' && event.key !== 'Backspace') return;
      if (!activeShapeId || !$('dividerModal') || $('dividerModal').style.display === 'none') return;
      const target = event.target;
      if (target?.matches?.('input,textarea,select,[contenteditable="true"]')) return;
      event.preventDefault();
      event.stopImmediatePropagation();
      removeActiveShape();
    }, true);
  }

  function wrapPreviewUpdate() {
    const current = window.updateDividerPreview;
    if (typeof current !== 'function') return false;
    if (current.__dividerStableOverlayV2) {
      previewWrapped = true;
      return true;
    }
    const wrapped = function updateDividerPreviewWithStableShapeOverlay() {
      const result = current.apply(this, arguments);
      queueSelectionOverlay();
      return result;
    };
    wrapped.__dividerStableOverlayV2 = true;
    wrapped.__dividerStableOverlayBase = current;
    window.updateDividerPreview = wrapped;
    try { updateDividerPreview = wrapped; } catch (_) {}
    previewWrapped = true;
    return true;
  }

  function deepClone(value) {
    try { return structuredClone(value); } catch (_) {}
    try { return JSON.parse(JSON.stringify(value)); } catch (_) { return Object.assign({}, value || {}); }
  }

  function refreshEditorAfterDividerChange(reason) {
    try { if (typeof renderThumbs === 'function') renderThumbs(); } catch (_) {}
    try {
      if (window.PdfEditorPageSelection?.refreshRightPreview) {
        window.PdfEditorPageSelection.refreshRightPreview(reason || 'divider-design-change');
        return;
      }
    } catch (_) {}
    try { if (typeof triggerPreview === 'function') { triggerPreview(); return; } } catch (_) {}
    try { if (typeof schedulePreview === 'function') schedulePreview(0); } catch (_) {}
  }

  function duplicateDividerPage(page) {
    if (!page || page.pageType !== 'divider' || !editorReady() || typeof makeDividerPageObj !== 'function') return null;
    const index = parsedPages.indexOf(page);
    if (index < 0) return null;
    const content = deepClone(page.dividerContent || {});
    const copy = makeDividerPageObj(content);
    copy.groupBreak = false;
    copy.excluded = false;
    parsedPages.splice(index + 1, 0, copy);
    try {
      const selection = window.PdfEditorPageSelection;
      if (selection) {
        selection.clearSelection?.();
        selection.selectedIds?.add?.(Number(copy.id));
        selection.syncSidebarSourceThumbs?.();
        selection.focusPage?.(copy.id);
      }
    } catch (_) {}
    refreshEditorAfterDividerChange('divider-design-duplicate');
    try {
      if (typeof showStatus === 'function') {
        showStatus('간지 디자인을 바로 다음 페이지에 복사했습니다. 복사본도 다시 수정할 수 있습니다.', 'success');
        if (typeof hideStatus === 'function') setTimeout(hideStatus, 1700);
      }
    } catch (_) {}
    document.documentElement.dataset.dividerDesignDuplicated = String(copy.id);
    return copy;
  }

  function editDividerPage(page) {
    if (!page || page.pageType !== 'divider') return false;
    try {
      if (typeof window.editDivider === 'function') {
        window.editDivider(page);
        document.documentElement.dataset.dividerDesignEditing = String(page.id);
        return true;
      }
    } catch (error) {
      console.warn('[divider-stability] divider edit failed', error);
    }
    return false;
  }

  function contextAction(icon, label, action, handler) {
    const element = document.createElement('div');
    element.className = 'ctx-item';
    element.dataset.dividerDesignAction = action;
    const iconElement = document.createElement('span');
    iconElement.className = 'ctx-icon';
    iconElement.textContent = icon;
    element.append(iconElement, document.createTextNode(label));
    element.addEventListener('click', (event) => {
      event.preventDefault();
      event.stopImmediatePropagation();
      $('thumbCtxMenu')?.classList.remove('open');
      handler();
    }, true);
    return element;
  }

  function decorateDividerContextMenu(page, event) {
    const menu = $('thumbCtxMenu');
    if (!menu || !page || page.pageType !== 'divider') return;
    menu.querySelectorAll('[data-divider-design-action]').forEach((node) => node.remove());
    menu.querySelectorAll('[data-divider-design-separator="true"]').forEach((node) => node.remove());
    const selectionCount = Number(menu.dataset.selectionCount || 1);
    if (selectionCount > 1) return;
    const first = menu.firstChild;
    const edit = contextAction('✎', '간지 디자인 수정', 'edit', () => editDividerPage(page));
    const copy = contextAction('⧉', '간지 디자인 복사', 'copy', () => duplicateDividerPage(page));
    const separator = document.createElement('div');
    separator.className = 'ctx-sep';
    separator.dataset.dividerDesignSeparator = 'true';
    if (first) {
      menu.insertBefore(separator, first);
      menu.insertBefore(copy, separator);
      menu.insertBefore(edit, copy);
    } else {
      menu.append(edit, copy, separator);
    }
    menu.classList.add('open');
    const vw = window.innerWidth, vh = window.innerHeight;
    const mw = menu.offsetWidth, mh = menu.offsetHeight;
    let x = Number.isFinite(event?.clientX) ? event.clientX : parseFloat(menu.style.left) || 6;
    let y = Number.isFinite(event?.clientY) ? event.clientY : parseFloat(menu.style.top) || 6;
    if (x + mw > vw) x = vw - mw - 6;
    if (y + mh > vh) y = vh - mh - 6;
    menu.style.left = `${Math.max(4, x)}px`;
    menu.style.top = `${Math.max(4, y)}px`;
  }

  function wrapContextMenu() {
    const current = window._openThumbCtxMenu;
    if (typeof current !== 'function') return false;
    if (current === menuWrapped && current.__dividerStableActionsV2) return true;
    if (current.__dividerStableActionsV2) {
      menuWrapped = current;
      return true;
    }
    const wrapped = function dividerStableContextMenu(event, page) {
      const result = current.apply(this, arguments);
      queueMicrotask(() => decorateDividerContextMenu(page, event));
      return result;
    };
    wrapped.__dividerStableActionsV2 = true;
    wrapped.__dividerStableActionBase = current;
    menuWrapped = wrapped;
    window._openThumbCtxMenu = wrapped;
    return true;
  }

  function bindDividerDoubleClick() {
    const area = $('thumbArea');
    if (!area || area.dataset.dividerDoubleClickEditStableV2 === 'true') return Boolean(area);
    area.dataset.dividerDoubleClickEditStableV2 = 'true';
    area.addEventListener('dblclick', (event) => {
      if (event.target.closest('button,input,select')) return;
      const item = event.target.closest('.thumb-item');
      if (!item || !area.contains(item)) return;
      const page = pageById(item.dataset.id);
      if (!page || page.pageType !== 'divider') return;
      event.preventDefault();
      event.stopImmediatePropagation();
      editDividerPage(page);
    }, true);
    return true;
  }

  function boot() {
    installStyles();
    ensureDragHint();
    ensureStyleReset();
    ensureOverlay();
    ensureFloatingDelete();
    wrapPreviewUpdate();
    bindCanvasDrag();
    bindShapeListSelection();
    bindDeleteKey();
    bindDividerDoubleClick();
    wrapContextMenu();
    queueSelectionOverlay();

    const studioReady = Boolean(window.PdfDividerStudio && $('dividerShapeList') && $('dividerPrevCanvas'));
    const menuReady = typeof window._openThumbCtxMenu === 'function';
    if ((!studioReady || !menuReady || !previewWrapped || window._openThumbCtxMenu !== menuWrapped) && attempts < 60) {
      attempts += 1;
      setTimeout(boot, Math.min(450, 90 + attempts * 12));
    }
  }

  window.PdfDividerStudioInteractions = {
    selectShape,
    removeActiveShape,
    duplicateDividerPage,
    editDividerPage,
    hitTestShape,
    applyShapePosition,
    get activeShapeId() { return activeShapeId; },
    stage: 'divider-sidebar-shape-interactions-stable-v2',
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once: true });
  else boot();
})();
