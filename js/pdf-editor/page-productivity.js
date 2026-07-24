// Undo/redo, page jump, and selected-page productivity actions.
(function () {
  'use strict';
  if (window.__pdfPageProductivityV1) return;
  window.__pdfPageProductivityV1 = true;

  const HISTORY_LIMIT = 30;
  const byId = (id) => document.getElementById(id);
  const undoStack = [];
  const redoStack = [];
  let baseline = null;
  let baselineSignature = '';
  let currentFileSignature = '';
  let checkpointTimer = null;
  let restoring = false;
  let renderPatched = false;
  let menuPatched = false;
  let attempts = 0;

  function editorReady() {
    try {
      return Array.isArray(parsedPages) && Array.isArray(uploadedFiles) && typeof renderThumbs === 'function';
    } catch (_) {
      return false;
    }
  }

  function pageId(page) {
    const value = Number(page && page.id);
    return Number.isFinite(value) ? value : null;
  }

  function fileSignature() {
    if (!editorReady()) return '';
    return uploadedFiles.map((file) => `${file?.name || ''}:${Number(file?.size || 0)}:${Number(file?.lastModified || 0)}`).join('|');
  }

  function cloneState(page) {
    return {
      excluded: !!page.excluded,
      rotation: Number(page.rotation || 0),
      nupOverride: page.nupOverride ?? null,
      nupDisabled: !!page.nupDisabled,
      groupBreak: !!page.groupBreak,
      pageType: page.pageType || 'pdf',
      dividerContent: page.dividerContent ? { ...page.dividerContent } : null,
      sourceFile: page.sourceFile || '',
      file_index: page.file_index,
      page_index: page.page_index,
      lightweight: !!page.lightweight,
    };
  }

  function captureSnapshot() {
    return {
      files: fileSignature(),
      pages: parsedPages.map((page) => ({ ref: page, id: pageId(page), state: cloneState(page) })),
    };
  }

  function snapshotSignature(snapshot) {
    return (snapshot?.pages || []).map((entry) => {
      const state = entry.state;
      return [
        entry.id,
        state.excluded ? 1 : 0,
        state.rotation,
        state.nupOverride ?? '',
        state.nupDisabled ? 1 : 0,
        state.groupBreak ? 1 : 0,
        state.pageType,
        state.file_index ?? '',
        state.page_index ?? '',
        JSON.stringify(state.dividerContent || null),
      ].join(':');
    }).join('|');
  }

  function resetHistory() {
    undoStack.length = 0;
    redoStack.length = 0;
    baseline = captureSnapshot();
    baselineSignature = snapshotSignature(baseline);
    currentFileSignature = baseline.files;
    updateControls();
  }

  function checkpoint() {
    if (!editorReady() || restoring) return;
    const nextFiles = fileSignature();
    if (nextFiles !== currentFileSignature) {
      resetHistory();
      return;
    }
    const next = captureSnapshot();
    const nextSignature = snapshotSignature(next);
    if (!baseline) {
      baseline = next;
      baselineSignature = nextSignature;
      currentFileSignature = nextFiles;
      updateControls();
      return;
    }
    if (nextSignature === baselineSignature) return;
    undoStack.push(baseline);
    if (undoStack.length > HISTORY_LIMIT) undoStack.shift();
    redoStack.length = 0;
    baseline = next;
    baselineSignature = nextSignature;
    updateControls();
  }

  function scheduleCheckpoint(delay) {
    clearTimeout(checkpointTimer);
    checkpointTimer = setTimeout(checkpoint, delay == null ? 90 : delay);
  }

  function restoreSnapshot(snapshot) {
    if (!snapshot || snapshot.files !== fileSignature()) {
      resetHistory();
      return false;
    }
    restoring = true;
    try {
      parsedPages = snapshot.pages.map((entry) => {
        const page = entry.ref;
        Object.assign(page, entry.state);
        if (entry.state.dividerContent) page.dividerContent = { ...entry.state.dividerContent };
        return page;
      });
      window.PdfEditorPageSelection?.clearSelection?.();
      renderThumbs();
      baseline = captureSnapshot();
      baselineSignature = snapshotSignature(baseline);
      currentFileSignature = baseline.files;
      requestPreview();
      updateControls();
      return true;
    } finally {
      requestAnimationFrame(() => { restoring = false; });
    }
  }

  function undo() {
    if (!undoStack.length || !editorReady()) return false;
    const target = undoStack.pop();
    redoStack.push(captureSnapshot());
    const restored = restoreSnapshot(target);
    showMessage(restored ? '이전 페이지 편집 상태로 되돌렸습니다.' : '실행 취소할 수 없습니다.');
    return restored;
  }

  function redo() {
    if (!redoStack.length || !editorReady()) return false;
    const target = redoStack.pop();
    undoStack.push(captureSnapshot());
    const restored = restoreSnapshot(target);
    showMessage(restored ? '취소했던 페이지 편집을 다시 적용했습니다.' : '다시 실행할 수 없습니다.');
    return restored;
  }

  function selectedIds() {
    const selection = window.PdfEditorPageSelection?.selectedIds;
    return selection instanceof Set ? selection : new Set();
  }

  function selectedPages() {
    const ids = selectedIds();
    return editorReady() ? parsedPages.filter((page) => ids.has(pageId(page))) : [];
  }

  function clonePage(page) {
    return {
      ...page,
      id: typeof makeId === 'function' ? makeId() : Date.now() + Math.random(),
      dividerContent: page.dividerContent ? { ...page.dividerContent } : null,
      groupBreak: false,
      hiCanvas: page.hiCanvas || null,
    };
  }

  function duplicateSelected() {
    const targets = selectedPages();
    if (!targets.length) return false;
    const indexes = targets.map((page) => parsedPages.indexOf(page)).filter((index) => index >= 0);
    const insertIndex = Math.max(...indexes) + 1;
    const copies = targets.map(clonePage);
    parsedPages.splice(insertIndex, 0, ...copies);
    renderThumbs();
    requestPreview();
    showMessage(`선택한 ${copies.length}페이지를 복제했습니다.`);
    setTimeout(() => jumpToId(pageId(copies[0])), 30);
    return true;
  }

  function moveSelected(where) {
    const targets = selectedPages();
    if (!targets.length) return false;
    const ids = new Set(targets.map(pageId));
    const remaining = parsedPages.filter((page) => !ids.has(pageId(page)));
    parsedPages = where === 'start' ? [...targets, ...remaining] : [...remaining, ...targets];
    renderThumbs();
    requestPreview();
    showMessage(`선택한 ${targets.length}페이지를 ${where === 'start' ? '맨 앞으로' : '맨 뒤로'} 이동했습니다.`);
    setTimeout(() => jumpToId(pageId(targets[0])), 30);
    return true;
  }

  function requestPreview() {
    if (window.PdfPreviewController) {
      window.PdfPreviewController.request(180, false);
      return;
    }
    try { if (typeof schedulePreview === 'function') schedulePreview(180); } catch (_) {}
  }

  function showMessage(message) {
    try {
      if (typeof showStatus === 'function') {
        showStatus(message, 'success');
        setTimeout(() => { try { hideStatus(); } catch (_) {} }, 1600);
      }
    } catch (_) {}
  }

  function jumpToId(id) {
    if (id === null) return false;
    const item = document.querySelector(`#thumbArea .thumb-item[data-id="${id}"]`);
    const wrap = item?.querySelector('.thumb-wrap');
    if (!item || !wrap) return false;
    item.scrollIntoView({ block: 'center', behavior: 'smooth' });
    wrap.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
    return true;
  }

  function jumpToOrdinal(value) {
    if (!editorReady() || !parsedPages.length) return false;
    const ordinal = Math.max(1, Math.min(parsedPages.length, Number.parseInt(value, 10) || 1));
    const input = byId('pageJumpInput');
    if (input) input.value = String(ordinal);
    return jumpToId(pageId(parsedPages[ordinal - 1]));
  }

  function installStyles() {
    if (byId('pdfPageProductivityStyles')) return;
    const style = document.createElement('style');
    style.id = 'pdfPageProductivityStyles';
    style.textContent = `
      .page-productivity-toolbar{display:grid;grid-template-columns:auto auto minmax(44px,1fr) auto;gap:5px;align-items:center;margin-bottom:7px;padding:6px 7px;border:1px solid #dbe5ef;border-radius:9px;background:#fff}
      .page-productivity-btn{min-height:28px;border:1px solid #cbd5e1;border-radius:7px;background:#f8fafc;color:#334155;padding:4px 7px;font:800 10px Pretendard,"Noto Sans KR",sans-serif;cursor:pointer;white-space:nowrap}
      .page-productivity-btn:hover:not(:disabled){border-color:#93c5fd;background:#eff6ff;color:#1d4ed8}
      .page-productivity-btn:disabled{opacity:.38;cursor:not-allowed}
      .page-jump-input{min-width:0!important;height:28px!important;padding:4px 6px!important;border-radius:7px!important;text-align:center;font-size:11px!important;font-weight:800!important}
      @media(max-width:390px){.page-productivity-toolbar{grid-template-columns:auto auto 1fr}.page-productivity-toolbar [data-action="jump"]{grid-column:1/-1}.page-jump-input{grid-column:3}}
    `;
    document.head.appendChild(style);
  }

  function ensureToolbar() {
    const area = byId('thumbArea');
    if (!area || byId('pageProductivityToolbar')) return false;
    const toolbar = document.createElement('div');
    toolbar.id = 'pageProductivityToolbar';
    toolbar.className = 'page-productivity-toolbar';
    toolbar.innerHTML = `
      <button type="button" class="page-productivity-btn" id="pageUndoBtn" title="실행 취소 (Ctrl+Z)">↶ 취소</button>
      <button type="button" class="page-productivity-btn" id="pageRedoBtn" title="다시 실행 (Ctrl+Y)">↷ 다시</button>
      <input type="number" class="page-jump-input" id="pageJumpInput" min="1" value="1" aria-label="이동할 페이지 번호">
      <button type="button" class="page-productivity-btn" data-action="jump" id="pageJumpBtn">이동</button>`;
    area.parentElement.insertBefore(toolbar, area);
    byId('pageUndoBtn').addEventListener('click', undo);
    byId('pageRedoBtn').addEventListener('click', redo);
    byId('pageJumpBtn').addEventListener('click', () => jumpToOrdinal(byId('pageJumpInput').value));
    byId('pageJumpInput').addEventListener('keydown', (event) => {
      if (event.key === 'Enter') jumpToOrdinal(event.currentTarget.value);
    });
    updateControls();
    return true;
  }

  function updateControls() {
    const undoButton = byId('pageUndoBtn');
    const redoButton = byId('pageRedoBtn');
    const input = byId('pageJumpInput');
    if (undoButton) undoButton.disabled = undoStack.length === 0;
    if (redoButton) redoButton.disabled = redoStack.length === 0;
    if (input && editorReady()) {
      input.max = String(Math.max(1, parsedPages.length));
      input.title = `1~${Math.max(1, parsedPages.length)} 페이지`;
    }
  }

  function menuItem(menu, label, handler) {
    const item = document.createElement('div');
    item.className = 'ctx-item';
    item.textContent = label;
    item.addEventListener('click', (event) => {
      event.stopPropagation();
      menu.classList.remove('open');
      handler();
    });
    return item;
  }

  function separator() {
    const line = document.createElement('div');
    line.className = 'ctx-sep';
    return line;
  }

  function repositionMenu(menu) {
    const rect = menu.getBoundingClientRect();
    if (rect.right > window.innerWidth - 4) menu.style.left = `${Math.max(4, window.innerWidth - rect.width - 6)}px`;
    if (rect.bottom > window.innerHeight - 4) menu.style.top = `${Math.max(4, window.innerHeight - rect.height - 6)}px`;
  }

  function patchContextMenu() {
    if (menuPatched) return true;
    const original = window._openThumbCtxMenu;
    if (typeof original !== 'function') return false;
    if (original.__pageProductivityPatchedV1) {
      menuPatched = true;
      return true;
    }
    const wrapped = function openContextMenuWithProductivity() {
      const result = original.apply(this, arguments);
      setTimeout(() => {
        const menu = byId('thumbCtxMenu');
        const count = selectedPages().length;
        if (!menu || !count || menu.querySelector('[data-productivity-actions]')) return;
        const marker = document.createElement('div');
        marker.dataset.productivityActions = '1';
        marker.appendChild(separator());
        marker.appendChild(menuItem(menu, `선택 페이지 복제 (${count})`, duplicateSelected));
        marker.appendChild(menuItem(menu, '선택 페이지 맨 앞으로 이동', () => moveSelected('start')));
        marker.appendChild(menuItem(menu, '선택 페이지 맨 뒤로 이동', () => moveSelected('end')));
        menu.appendChild(marker);
        repositionMenu(menu);
      }, 0);
      return result;
    };
    wrapped.__pageProductivityPatchedV1 = true;
    window._openThumbCtxMenu = wrapped;
    menuPatched = true;
    return true;
  }

  function patchRenderThumbs() {
    if (renderPatched) return true;
    if (typeof renderThumbs !== 'function') return false;
    if (renderThumbs.__pageProductivityPatchedV1) {
      renderPatched = true;
      return true;
    }
    const original = renderThumbs;
    const wrapped = function renderThumbsWithProductivity() {
      const result = original.apply(this, arguments);
      setTimeout(() => {
        ensureToolbar();
        updateControls();
        scheduleCheckpoint(80);
      }, 0);
      return result;
    };
    wrapped.__pageProductivityPatchedV1 = true;
    renderThumbs = wrapped;
    window.renderThumbs = wrapped;
    renderPatched = true;
    return true;
  }

  function installKeyboard() {
    if (window.__pdfPageProductivityKeyboardV1) return;
    window.__pdfPageProductivityKeyboardV1 = true;
    document.addEventListener('keydown', (event) => {
      if (!(event.ctrlKey || event.metaKey) || event.altKey) return;
      const target = event.target;
      if (target && (target.matches('input,textarea,select') || target.isContentEditable)) return;
      const key = event.key.toLowerCase();
      if (key === 'z' && !event.shiftKey) {
        event.preventDefault();
        undo();
      } else if (key === 'y' || (key === 'z' && event.shiftKey)) {
        event.preventDefault();
        redo();
      }
    }, true);
  }

  function installObserver() {
    const area = byId('thumbArea');
    if (!area || area.dataset.productivityObservedV1) return;
    area.dataset.productivityObservedV1 = '1';
    new MutationObserver(() => scheduleCheckpoint(100)).observe(area, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['class', 'data-id'],
    });
  }

  function boot() {
    if (!editorReady()) {
      if (attempts < 14) {
        attempts += 1;
        setTimeout(boot, 170 + attempts * 60);
      }
      return;
    }
    installStyles();
    ensureToolbar();
    patchRenderThumbs();
    patchContextMenu();
    installKeyboard();
    installObserver();
    if (!baseline) resetHistory();
    if ((!renderPatched || !menuPatched) && attempts < 14) {
      attempts += 1;
      setTimeout(boot, 170 + attempts * 60);
    }
  }

  window.PdfPageProductivity = {
    undo,
    redo,
    duplicateSelected,
    moveSelected,
    jumpToOrdinal,
    resetHistory,
    canUndo: () => undoStack.length > 0,
    canRedo: () => redoStack.length > 0,
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once: true });
  else boot();
})();
