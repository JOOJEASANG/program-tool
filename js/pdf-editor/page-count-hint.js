// PDF editor page productivity helper.
// Adds explicit multi-selection without changing ordinary thumbnail click navigation.
(function () {
  'use strict';
  if (window.__pdfEditorPageProductivityV3) return;
  window.__pdfEditorPageProductivityV3 = true;

  const HISTORY_LIMIT = 30;
  const NUP_VALUES = [1, 2, 4, 6, 8, 9];
  const selectedIds = new Set();
  const undoStack = [];
  const redoStack = [];

  let selectionMode = false;
  let lastAnchorIndex = -1;
  let hintTimer = null;
  let decorateFrame = 0;
  let thumbObserver = null;
  let lastFileSignature = '';
  let internalMutation = false;

  const byId = (id) => document.getElementById(id);

  function editorReady() {
    try {
      return Array.isArray(parsedPages) && Array.isArray(uploadedFiles);
    } catch (_) {
      return false;
    }
  }

  function fileSignature() {
    if (!editorReady()) return '';
    return uploadedFiles.map((file) => [file?.name || '', file?.size || 0, file?.lastModified || 0].join(':')).join('|');
  }

  function activePages() {
    return editorReady() ? parsedPages.filter((page) => !page.excluded) : [];
  }

  function getActiveNup() {
    try {
      if (NUP_VALUES.includes(Number(nup))) return Number(nup);
    } catch (_) {}
    const active = document.querySelector('.nup-btn.active,[data-nup].active');
    const raw = active ? (active.dataset.nup || active.textContent || '') : '';
    const value = Number((String(raw).match(/\d+/) || [])[0]);
    return NUP_VALUES.includes(value) ? value : 1;
  }

  function estimateOutputPages() {
    const work = activePages().length;
    const nupValue = getActiveNup();
    const groups = window.PdfBookletPrintGuide?.outputPageGroups?.();
    const output = Array.isArray(groups)
      ? groups.length
      : Math.max(0, Math.ceil(work / Math.max(1, nupValue)));
    return { work, nup: nupValue, output };
  }

  function ensureCountHint() {
    let hint = byId('pdfPageCountHint');
    if (hint) return hint;
    const previewInfo = byId('previewInfo');
    if (!previewInfo || !previewInfo.parentElement) return null;
    hint = document.createElement('span');
    hint.id = 'pdfPageCountHint';
    hint.className = 'preview-page-count-hint';
    previewInfo.insertAdjacentElement('afterend', hint);
    return hint;
  }

  function renderCountHint() {
    const hint = ensureCountHint();
    if (!hint) return false;
    const { work, nup: nupValue, output } = estimateOutputPages();
    hint.textContent = work
      ? `작업 ${work}쪽 · ${nupValue}장 배치 · 출력 예상 ${output}쪽`
      : '작업 페이지와 출력 PDF 쪽수를 이곳에서 확인합니다.';
    hint.removeAttribute('title');
    return true;
  }

  function scheduleCountHint() {
    clearTimeout(hintTimer);
    hintTimer = setTimeout(renderCountHint, 120);
  }

  function installStyles() {
    if (byId('pdfPageProductivityStylesV3')) return;
    const style = document.createElement('style');
    style.id = 'pdfPageProductivityStylesV3';
    style.textContent = `
      .page-productivity-panel{margin-bottom:8px;padding:8px;border:1px solid #dbe3ef;border-radius:10px;background:#f8fafc}
      .page-productivity-top{display:flex;align-items:center;gap:5px;min-width:0}
      .page-productivity-top button,.page-productivity-actions button{border:1px solid #cbd5e1;border-radius:6px;background:#fff;color:#334155;font-family:inherit;font-size:9px;font-weight:800;cursor:pointer;padding:5px 6px;white-space:nowrap}
      .page-productivity-top button:hover,.page-productivity-actions button:hover{background:#eff6ff;border-color:#93c5fd;color:#1d4ed8}
      .page-productivity-top button.active{background:#1d4ed8;border-color:#1d4ed8;color:#fff}
      .page-productivity-top button:disabled,.page-productivity-actions button:disabled{opacity:.42;cursor:not-allowed}
      .page-selection-count{margin-left:auto;min-width:48px;color:#1d4ed8;font-size:9px;font-weight:900;text-align:right;white-space:nowrap}
      .page-productivity-jump{display:grid;grid-template-columns:minmax(0,1fr) auto auto auto;gap:4px;margin-top:6px}
      .page-productivity-jump input{min-width:0;width:100%;padding:5px 7px!important;border-radius:6px!important;font-size:10px!important}
      .page-productivity-jump button{border:1px solid #cbd5e1;border-radius:6px;background:#fff;color:#334155;font-family:inherit;font-size:9px;font-weight:800;padding:5px 7px;cursor:pointer}
      .page-productivity-actions{display:none;grid-template-columns:repeat(4,minmax(0,1fr));gap:4px;margin-top:6px}
      .page-productivity-panel.selecting .page-productivity-actions{display:grid}
      .page-productivity-actions button{min-width:0;padding:5px 2px;overflow:hidden;text-overflow:ellipsis}
      #thumbArea .thumb-item{position:relative}
      #thumbArea .page-select-check{display:none;position:absolute;top:3px;left:3px;z-index:12;width:17px;height:17px;margin:0;accent-color:#2563eb;cursor:pointer;filter:drop-shadow(0 1px 2px rgba(0,0,0,.22))}
      #thumbArea.selection-mode .page-select-check{display:block}
      #thumbArea .thumb-item[data-batch-selected="true"] .thumb-wrap{border-color:#2563eb!important;box-shadow:0 0 0 2px rgba(37,99,235,.24)!important}
      #thumbArea .thumb-item[data-batch-selected="true"]::after{content:'선택';position:absolute;right:3px;top:3px;z-index:11;padding:1px 4px;border-radius:4px;background:#2563eb;color:#fff;font-size:7px;font-weight:900;pointer-events:none}
      @media(max-width:720px){.page-productivity-actions{grid-template-columns:repeat(3,minmax(0,1fr))}.page-productivity-jump{grid-template-columns:minmax(0,1fr) auto auto}.page-productivity-jump .redo-button{grid-column:auto}}
    `;
    document.head.appendChild(style);
  }

  function ensurePanel() {
    let panel = byId('pageProductivityPanelV3');
    if (panel) return panel;
    const area = byId('thumbArea');
    if (!area?.parentElement) return null;

    panel = document.createElement('div');
    panel.id = 'pageProductivityPanelV3';
    panel.className = 'page-productivity-panel';

    const top = document.createElement('div');
    top.className = 'page-productivity-top';

    const modeButton = document.createElement('button');
    modeButton.type = 'button';
    modeButton.id = 'pageSelectionModeBtnV3';
    modeButton.textContent = '다중 선택';
    modeButton.title = '일반 클릭 미리보기 이동은 유지하고 체크박스로 여러 페이지를 선택합니다.';
    modeButton.addEventListener('click', () => setSelectionMode(!selectionMode));

    const allButton = document.createElement('button');
    allButton.type = 'button';
    allButton.textContent = '전체';
    allButton.addEventListener('click', selectAllPages);

    const clearButton = document.createElement('button');
    clearButton.type = 'button';
    clearButton.textContent = '해제';
    clearButton.addEventListener('click', clearSelection);

    const count = document.createElement('span');
    count.id = 'pageSelectionCountV3';
    count.className = 'page-selection-count';
    count.textContent = '선택 0';
    top.append(modeButton, allButton, clearButton, count);

    const jump = document.createElement('div');
    jump.className = 'page-productivity-jump';
    const input = document.createElement('input');
    input.id = 'pageJumpInputV3';
    input.type = 'number';
    input.min = '1';
    input.placeholder = '페이지 번호';
    input.setAttribute('aria-label', '이동할 작업 페이지 번호');
    input.addEventListener('keydown', (event) => {
      if (event.key === 'Enter') jumpToOrdinal(Number(input.value));
    });

    const goButton = document.createElement('button');
    goButton.type = 'button';
    goButton.textContent = '이동';
    goButton.addEventListener('click', () => jumpToOrdinal(Number(input.value)));

    const undoButton = document.createElement('button');
    undoButton.type = 'button';
    undoButton.id = 'pageUndoBtnV3';
    undoButton.textContent = '↶ 취소';
    undoButton.title = '일괄 작업 취소 (Ctrl+Z)';
    undoButton.addEventListener('click', undo);

    const redoButton = document.createElement('button');
    redoButton.type = 'button';
    redoButton.id = 'pageRedoBtnV3';
    redoButton.className = 'redo-button';
    redoButton.textContent = '↷ 다시';
    redoButton.title = '일괄 작업 다시 실행 (Ctrl+Y 또는 Ctrl+Shift+Z)';
    redoButton.addEventListener('click', redo);
    jump.append(input, goButton, undoButton, redoButton);

    const actions = document.createElement('div');
    actions.className = 'page-productivity-actions';
    const actionDefinitions = [
      ['↶ 90°', () => rotateSelected(-90), '선택 페이지 왼쪽 회전'],
      ['↷ 90°', () => rotateSelected(90), '선택 페이지 오른쪽 회전'],
      ['숨김', () => setSelectedHidden(true), '선택 페이지 숨기기'],
      ['표시', () => setSelectedHidden(false), '선택 페이지 숨김 해제'],
      ['복제', duplicateSelected, '선택 페이지 복제'],
      ['맨 앞', () => moveSelected(true), '선택 페이지 맨 앞으로 이동'],
      ['맨 뒤', () => moveSelected(false), '선택 페이지 맨 뒤로 이동'],
      ['삭제', deleteSelected, '선택 페이지 삭제'],
    ];
    actionDefinitions.forEach(([label, handler, title]) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.dataset.batchAction = 'true';
      button.textContent = label;
      button.title = title;
      button.addEventListener('click', handler);
      actions.appendChild(button);
    });

    panel.append(top, jump, actions);
    area.insertAdjacentElement('beforebegin', panel);
    updatePanelState();
    return panel;
  }

  function pageIndexById(id) {
    if (!editorReady()) return -1;
    return parsedPages.findIndex((page) => page.id === id);
  }

  function setSelectionMode(enabled) {
    selectionMode = Boolean(enabled);
    if (!selectionMode) clearSelection();
    updatePanelState();
    queueDecorateThumbnails();
  }

  function selectAllPages() {
    if (!editorReady()) return;
    selectionMode = true;
    parsedPages.forEach((page) => selectedIds.add(page.id));
    lastAnchorIndex = parsedPages.length ? parsedPages.length - 1 : -1;
    updatePanelState();
    queueDecorateThumbnails();
  }

  function clearSelection() {
    selectedIds.clear();
    lastAnchorIndex = -1;
    updatePanelState();
    queueDecorateThumbnails();
  }

  function toggleSelectedPage(id, checked, shiftKey) {
    const index = pageIndexById(id);
    if (index < 0) return;
    if (shiftKey && lastAnchorIndex >= 0) {
      const start = Math.min(lastAnchorIndex, index);
      const end = Math.max(lastAnchorIndex, index);
      for (let position = start; position <= end; position += 1) {
        const pageId = parsedPages[position]?.id;
        if (!pageId) continue;
        if (checked) selectedIds.add(pageId);
        else selectedIds.delete(pageId);
      }
    } else if (checked) {
      selectedIds.add(id);
    } else {
      selectedIds.delete(id);
    }
    lastAnchorIndex = index;
    updatePanelState();
    queueDecorateThumbnails();
  }

  function decorateThumbnails() {
    decorateFrame = 0;
    const area = byId('thumbArea');
    if (!area || !editorReady()) return;
    area.classList.toggle('selection-mode', selectionMode);

    document.querySelectorAll('#thumbArea .thumb-item').forEach((item) => {
      const id = item.dataset.id;
      if (!id) return;
      let checkbox = item.querySelector(':scope > .page-select-check');
      if (!checkbox) {
        checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.className = 'page-select-check';
        checkbox.setAttribute('aria-label', '일괄 작업 페이지 선택');
        checkbox.addEventListener('click', (event) => {
          event.stopPropagation();
          toggleSelectedPage(id, checkbox.checked, event.shiftKey);
        });
        item.appendChild(checkbox);
      }
      checkbox.checked = selectedIds.has(id);
      checkbox.tabIndex = selectionMode ? 0 : -1;
      item.dataset.batchSelected = selectedIds.has(id) ? 'true' : 'false';
    });
  }

  function queueDecorateThumbnails() {
    if (decorateFrame) return;
    decorateFrame = requestAnimationFrame(decorateThumbnails);
  }

  function cloneDividerContent(content) {
    if (!content) return content;
    try {
      return JSON.parse(JSON.stringify(content));
    } catch (_) {
      return { ...content };
    }
  }

  function captureSnapshot(label) {
    return {
      label,
      pages: parsedPages.map((page) => ({
        page,
        excluded: Boolean(page.excluded),
        rotation: Number(page.rotation || 0),
        nupOverride: page.nupOverride ?? null,
        nupDisabled: Boolean(page.nupDisabled),
        groupBreak: Boolean(page.groupBreak),
        dividerContent: cloneDividerContent(page.dividerContent),
      })),
      selected: [...selectedIds],
    };
  }

  function restoreSnapshot(snapshot) {
    internalMutation = true;
    snapshot.pages.forEach((entry) => {
      entry.page.excluded = entry.excluded;
      entry.page.rotation = entry.rotation;
      entry.page.nupOverride = entry.nupOverride;
      entry.page.nupDisabled = entry.nupDisabled;
      entry.page.groupBreak = entry.groupBreak;
      entry.page.dividerContent = cloneDividerContent(entry.dividerContent);
    });
    parsedPages = snapshot.pages.map((entry) => entry.page);
    selectedIds.clear();
    snapshot.selected.forEach((id) => {
      if (parsedPages.some((page) => page.id === id)) selectedIds.add(id);
    });
    internalMutation = false;
    refreshAfterMutation(snapshot.label || '작업 복원');
  }

  function pushUndoSnapshot(label) {
    undoStack.push(captureSnapshot(label));
    while (undoStack.length > HISTORY_LIMIT) undoStack.shift();
    redoStack.length = 0;
  }

  function commitBatchAction(label, mutator) {
    if (!editorReady() || !selectedIds.size) return;
    pushUndoSnapshot(label);
    internalMutation = true;
    try {
      mutator();
    } finally {
      internalMutation = false;
    }
    refreshAfterMutation(label);
  }

  function selectedPagesInOrder() {
    return editorReady() ? parsedPages.filter((page) => selectedIds.has(page.id)) : [];
  }

  function rotateSelected(delta) {
    commitBatchAction('선택 페이지 회전', () => {
      selectedPagesInOrder().forEach((page) => {
        page.rotation = ((Number(page.rotation || 0) + delta) % 360 + 360) % 360;
      });
    });
  }

  function setSelectedHidden(hidden) {
    commitBatchAction(hidden ? '선택 페이지 숨김' : '선택 페이지 표시', () => {
      selectedPagesInOrder().forEach((page) => { page.excluded = hidden; });
    });
  }

  function duplicateSelected() {
    commitBatchAction('선택 페이지 복제', () => {
      const nextPages = [];
      const copiedIds = [];
      parsedPages.forEach((page) => {
        nextPages.push(page);
        if (!selectedIds.has(page.id)) return;
        const copy = {
          ...page,
          id: typeof makeId === 'function' ? makeId() : `copy_${Date.now()}_${copiedIds.length}`,
          dividerContent: cloneDividerContent(page.dividerContent),
          groupBreak: false,
        };
        nextPages.push(copy);
        copiedIds.push(copy.id);
      });
      parsedPages = nextPages;
      selectedIds.clear();
      copiedIds.forEach((id) => selectedIds.add(id));
    });
  }

  function moveSelected(toFront) {
    commitBatchAction(toFront ? '선택 페이지 맨 앞으로 이동' : '선택 페이지 맨 뒤로 이동', () => {
      const chosen = selectedPagesInOrder();
      const remaining = parsedPages.filter((page) => !selectedIds.has(page.id));
      parsedPages = toFront ? [...chosen, ...remaining] : [...remaining, ...chosen];
    });
  }

  function deleteSelected() {
    commitBatchAction('선택 페이지 삭제', () => {
      parsedPages = parsedPages.filter((page) => !selectedIds.has(page.id));
      selectedIds.clear();
    });
  }

  function undo() {
    if (!undoStack.length || !editorReady()) return;
    redoStack.push(captureSnapshot('다시 실행'));
    const snapshot = undoStack.pop();
    restoreSnapshot(snapshot);
  }

  function redo() {
    if (!redoStack.length || !editorReady()) return;
    undoStack.push(captureSnapshot('실행 취소'));
    while (undoStack.length > HISTORY_LIMIT) undoStack.shift();
    const snapshot = redoStack.pop();
    restoreSnapshot(snapshot);
  }

  function resetHistoryForNewFiles() {
    const signature = fileSignature();
    if (!lastFileSignature) {
      lastFileSignature = signature;
      return;
    }
    if (!internalMutation && signature !== lastFileSignature) {
      undoStack.length = 0;
      redoStack.length = 0;
      selectedIds.clear();
      lastAnchorIndex = -1;
    }
    lastFileSignature = signature;
  }

  function refreshAfterMutation(label) {
    if (typeof renderThumbs === 'function') renderThumbs();
    if (parsedPages.length) {
      if (byId('previewBtn')) byId('previewBtn').disabled = false;
      if (byId('downloadBtn')) byId('downloadBtn').disabled = false;
      if (typeof schedulePreview === 'function') schedulePreview(80);
    } else {
      if (byId('previewBtn')) byId('previewBtn').disabled = true;
      if (byId('downloadBtn')) byId('downloadBtn').disabled = true;
      const scroll = byId('previewScroll');
      if (scroll) scroll.innerHTML = '<div class="empty-state"><div class="icon">📄</div><p>편집할 PDF를 불러와 주세요.</p></div>';
    }
    updatePanelState();
    queueDecorateThumbnails();
    scheduleCountHint();
    if (typeof showStatus === 'function') {
      showStatus(`${label} 완료`, 'success');
      if (typeof hideStatus === 'function') setTimeout(hideStatus, 1200);
    }
  }

  function updatePanelState() {
    const panel = ensurePanel();
    if (!panel) return;
    panel.classList.toggle('selecting', selectionMode);
    const modeButton = byId('pageSelectionModeBtnV3');
    if (modeButton) {
      modeButton.classList.toggle('active', selectionMode);
      modeButton.textContent = selectionMode ? '선택 종료' : '다중 선택';
    }
    const count = byId('pageSelectionCountV3');
    if (count) count.textContent = `선택 ${selectedIds.size}`;
    panel.querySelectorAll('[data-batch-action="true"]').forEach((button) => {
      button.disabled = selectedIds.size === 0;
    });
    const undoButton = byId('pageUndoBtnV3');
    const redoButton = byId('pageRedoBtnV3');
    if (undoButton) undoButton.disabled = undoStack.length === 0;
    if (redoButton) redoButton.disabled = redoStack.length === 0;
  }

  function jumpToOrdinal(ordinal) {
    if (!editorReady() || !Number.isInteger(ordinal) || ordinal < 1 || ordinal > parsedPages.length) {
      if (typeof showStatus === 'function') showStatus(`1부터 ${parsedPages.length || 0} 사이의 페이지 번호를 입력하세요.`, 'error');
      return;
    }
    const page = parsedPages[ordinal - 1];
    const item = document.querySelector(`#thumbArea .thumb-item[data-id="${CSS.escape(String(page.id))}"]`);
    const wrap = item?.querySelector('.thumb-wrap');
    item?.scrollIntoView({ behavior: 'auto', block: 'center' });
    if (wrap) wrap.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, view: window }));
  }

  function installKeyboardShortcuts() {
    if (window.__pdfPageProductivityKeyboardV3) return;
    window.__pdfPageProductivityKeyboardV3 = true;
    document.addEventListener('keydown', (event) => {
      const target = event.target;
      if (target?.matches?.('input,textarea,select') || target?.isContentEditable) return;
      if (!(event.ctrlKey || event.metaKey) || event.altKey) return;
      const key = event.key.toLowerCase();
      if (key === 'z' && event.shiftKey) {
        event.preventDefault();
        redo();
      } else if (key === 'z') {
        event.preventDefault();
        undo();
      } else if (key === 'y') {
        event.preventDefault();
        redo();
      }
    }, true);
  }

  function installObserver() {
    const area = byId('thumbArea');
    if (!area || thumbObserver) return;
    thumbObserver = new MutationObserver(() => {
      resetHistoryForNewFiles();
      queueDecorateThumbnails();
      scheduleCountHint();
      updatePanelState();
    });
    thumbObserver.observe(area, { childList: true, subtree: true });
  }

  function installEvents() {
    if (window.__pdfPageProductivityEventsV3) return;
    window.__pdfPageProductivityEventsV3 = true;
    document.addEventListener('change', scheduleCountHint, true);
    document.addEventListener('click', (event) => {
      if (event.target?.closest('.nup-btn,.orient-btn,#bookletCheck')) scheduleCountHint();
    }, true);
  }

  function boot(attempt = 0) {
    installStyles();
    ensurePanel();
    installKeyboardShortcuts();
    installEvents();
    installObserver();
    resetHistoryForNewFiles();
    queueDecorateThumbnails();
    renderCountHint();
    updatePanelState();
    const ready = editorReady() && byId('thumbArea') && byId('previewInfo');
    if (!ready && attempt < 12) setTimeout(() => boot(attempt + 1), 160 + attempt * 60);
  }

  window.PdfPageProductivity = {
    setSelectionMode,
    selectAllPages,
    clearSelection,
    selectedIds,
    undo,
    redo,
    jumpToOrdinal,
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => boot(0), { once: true });
  } else {
    boot(0);
  }
})();
