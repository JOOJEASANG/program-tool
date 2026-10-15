// Page selection, batch context actions, and preview focus preservation.
(function () {
  'use strict';
  if (window.__pdfEditorPageSelectionV2) return;
  window.__pdfEditorPageSelectionV2 = true;
  window.__pdfEditorPageSelectionV1 = true;

  const selectedIds = new Set();
  let anchorId = null;
  let primaryId = null;
  let contextSelectionIds = [];
  let renderPatched = false;
  let previewPatched = false;
  let attempts = 0;
  let dragSelectMode = false;
  let dragSelectPointer = null;
  let dragSelectLastId = null;
  const byId = (id) => document.getElementById(id);

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

  function pagesForIds(ids) {
    if (!editorReady()) return [];
    const wanted = new Set((ids || []).map(Number).filter(Number.isFinite));
    return parsedPages.filter((page) => wanted.has(pageId(page)));
  }

  function orderedSelectedPages() {
    return pagesForIds([...selectedIds]);
  }

  function cleanupSelection() {
    if (!editorReady()) return;
    const valid = new Set(parsedPages.map(pageId).filter((id) => id !== null));
    [...selectedIds].forEach((id) => { if (!valid.has(id)) selectedIds.delete(id); });
    contextSelectionIds = contextSelectionIds.filter((id) => valid.has(Number(id)));
    if (!valid.has(anchorId)) anchorId = null;
    if (!valid.has(primaryId)) primaryId = selectedIds.size ? [...selectedIds][0] : null;
  }

  function snapshotSelectedIds() {
    cleanupSelection();
    return orderedSelectedPages().map(pageId).filter((id) => id !== null);
  }

  function installStyles() {
    if (byId('pdfPageSelectionStyles')) return;
    const style = document.createElement('style');
    style.id = 'pdfPageSelectionStyles';
    style.textContent = `
      .page-selection-toolbar{display:flex;flex-wrap:wrap;align-items:center;gap:5px;margin-bottom:7px;padding:7px;border:1px solid #dbe5ef;border-radius:9px;background:#f8fafc}
      .page-selection-heading{display:flex;gap:5px;align-items:center;width:100%}
      .page-selection-heading .page-selection-count{flex:1}
      .page-selection-range{width:100%;display:grid;gap:5px;padding-top:5px;border-top:1px solid #e2e8f0}
      .page-selection-range select,.page-selection-range input{box-sizing:border-box;width:100%;min-width:0;min-height:29px;padding:5px 7px;border:1px solid #cbd5e1;border-radius:7px;background:#fff;color:#334155;font:750 10px Pretendard,"Noto Sans KR",sans-serif}
      .page-selection-range input{font-size:11px}
      .page-selection-actions{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:5px}
      .page-selection-quick{display:flex;flex-wrap:wrap;gap:5px}
      .page-selection-quick .page-selection-btn{flex:1;white-space:nowrap}
      .page-selection-status{min-height:12px;font-size:9px;line-height:1.5;color:#64748b;word-break:keep-all}
      .page-selection-status[data-error="true"]{color:#b91c1c}
      .page-selection-btn[aria-pressed="true"]{background:#dbeafe;border-color:#60a5fa;color:#1d4ed8}
      #thumbArea[data-drag-select="true"] .thumb-item{cursor:crosshair!important}
      #thumbArea[data-drag-select="true"] .thumb-wrap{cursor:crosshair!important;user-select:none;touch-action:pan-y}
      .page-selection-count{font-size:9px;font-weight:900;color:#334155;margin-right:auto;white-space:nowrap}
      .page-selection-btn{border:1px solid #cbd5e1;border-radius:7px;background:#fff;color:#475569;padding:4px 7px;font:800 9px Pretendard,"Noto Sans KR",sans-serif;cursor:pointer}
      .page-selection-btn:hover{border-color:#93c5fd;background:#eff6ff;color:#1d4ed8}
      .pdf-page-select-checkbox{position:absolute;left:7px;top:7px;z-index:8;width:18px;height:18px;accent-color:#2563eb;cursor:pointer;background:#fff;border-radius:3px;box-shadow:0 0 0 2px rgba(255,255,255,.8)}
      /* Keep the editor's original compact multi-column .thumb-area grid.
         Selection controls must never force one full-width thumbnail per row. */
      #thumbArea .thumb-wrap{width:100%!important;aspect-ratio:210/297!important;display:flex!important;align-items:center!important;justify-content:center!important;background:#fff!important;overflow:hidden!important}
      #thumbArea .thumb-wrap canvas{width:100%!important;height:100%!important;object-fit:contain!important;transform:none!important;background:#fff!important}
      #thumbArea .thumb-wrap .divider-thumb{width:100%!important;height:100%!important;aspect-ratio:auto!important}
      .thumb-item.page-selected .thumb-wrap{outline:3px solid #2563eb!important;outline-offset:2px;box-shadow:0 0 0 5px rgba(37,99,235,.12)!important}
      .thumb-item.page-selected .thumb-num{background:#2563eb!important;color:#fff!important}
      .thumb-item.page-selection-anchor .thumb-wrap{outline-color:#0f766e!important}
      .page-selection-mark{position:absolute;right:4px;top:4px;width:18px;height:18px;border-radius:999px;background:#2563eb;color:#fff;display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:900;z-index:6;box-shadow:0 2px 7px rgba(15,23,42,.22)}
      #thumbCtxMenu .ctx-heading{padding:7px 13px 5px;font-size:10px;font-weight:900;color:#0f172a;background:#f8fafc;border-bottom:1px solid #e2e8f0}
      #thumbCtxMenu .ctx-item.disabled{opacity:.45;pointer-events:none}
      #previewScroll .page-preview.preview-selection-target{outline:4px solid #2563eb;outline-offset:4px;box-shadow:0 10px 28px rgba(37,99,235,.25)}
    `;
    document.head.appendChild(style);
  }

  function ensureToolbar() {
    const area = byId('thumbArea');
    if (!area) return;
    if (byId('pageSelectionToolbar')) {
      syncRangeScopeOptions();
      return;
    }
    const toolbar = document.createElement('div');
    toolbar.id = 'pageSelectionToolbar';
    toolbar.className = 'page-selection-toolbar';
    toolbar.innerHTML = `
      <div class="page-selection-heading">
        <span class="page-selection-count" id="pageSelectionCount">선택 0개</span>
        <button type="button" class="page-selection-btn" data-selection-action="all">전체선택</button>
        <button type="button" class="page-selection-btn" data-selection-action="clear">선택해제</button>
      </div>
      <div class="page-selection-range">
        <select id="pageSelectionRangeScope" aria-label="페이지 선택 범위 기준">
          <option value="all">전체 작업 · 현재 편집 순서</option>
        </select>
        <input id="pageSelectionRangeInput" type="text" inputmode="text"
          placeholder="예: 1-10, 15, 20-25" aria-label="선택할 페이지 번호 및 구간">
        <div class="page-selection-actions">
          <button type="button" class="page-selection-btn" data-selection-action="range-replace">범위 선택</button>
          <button type="button" class="page-selection-btn" data-selection-action="range-add">선택 추가</button>
          <button type="button" class="page-selection-btn" data-selection-action="range-remove">선택 빼기</button>
        </div>
        <div class="page-selection-quick">
          <button type="button" class="page-selection-btn" data-selection-action="odd">홀수 선택</button>
          <button type="button" class="page-selection-btn" data-selection-action="even">짝수 선택</button>
          <button type="button" class="page-selection-btn" data-selection-action="invert">선택 반전</button>
          <button type="button" class="page-selection-btn" data-selection-action="drag" aria-pressed="false" title="켜면 썸네일을 마우스로 쓸어 연속 선택합니다. 끄면 페이지 드래그 정렬이 가능합니다.">드래그 선택</button>
        </div>
        <div class="page-selection-status" id="pageSelectionRangeStatus" role="status" aria-live="polite">범위는 쉼표로 구분 · Shift+클릭으로 연속 선택</div>
      </div>`;
    area.parentElement.insertBefore(toolbar, area);
    syncRangeScopeOptions();
    toolbar.addEventListener('click', (event) => {
      const button = event.target.closest('[data-selection-action]');
      if (!button) return;
      const action = button.dataset.selectionAction;
      if (action === 'all') selectAll();
      else if (action === 'clear') clearSelection();
      else if (action.startsWith('range-')) {
        const mode = action.slice(6);
        const result = selectRange(byId('pageSelectionRangeInput')?.value, byId('pageSelectionRangeScope')?.value, mode);
        setRangeStatus(result.ok ? `${result.affected}페이지 ${mode === 'replace' ? '선택' : mode === 'add' ? '추가' : '제외'} 완료` : result.error, !result.ok);
      } else if (action === 'odd' || action === 'even') {
        const result = selectParity(byId('pageSelectionRangeScope')?.value, action);
        setRangeStatus(result.ok ? `${result.affected}페이지 ${action === 'odd' ? '홀수' : '짝수'} 선택` : result.error, !result.ok);
      } else if (action === 'invert') {
        const result = invertScopeSelection(byId('pageSelectionRangeScope')?.value);
        setRangeStatus(`${result.affected}페이지 선택 반전 완료`);
      } else if (action === 'drag') {
        setDragSelectMode(!dragSelectMode);
        setRangeStatus(dragSelectMode ? '마우스를 누르고 썸네일을 쓸어 선택 · 정렬은 잠시 꺼집니다.' : '페이지 드래그 정렬을 다시 사용할 수 있습니다.');
      }
    });
    byId('pageSelectionRangeInput')?.addEventListener('keydown', (event) => {
      if (event.key !== 'Enter') return;
      event.preventDefault();
      const result = selectRange(event.currentTarget.value, byId('pageSelectionRangeScope')?.value, 'replace');
      setRangeStatus(result.ok ? `${result.affected}페이지 범위 선택 완료` : result.error, !result.ok);
    });
    byId('pageSelectionRangeScope')?.addEventListener('change', () => {
      const isFile = String(byId('pageSelectionRangeScope').value).startsWith('file:');
      setRangeStatus(isFile ? '파일의 원본 페이지 번호 기준으로 입력하세요.' : '전체 작업의 현재 편집 순서 기준으로 입력하세요.');
    });
    const hint = area.parentElement.querySelector('.thumb-hint');
    if (hint) hint.textContent = '왼쪽은 기본 페이지 목록 · Ctrl/Shift=다중선택 · 우클릭 작업은 오른쪽 미리보기에 반영';
  }

  function setRangeStatus(message, error = false) {
    const status = byId('pageSelectionRangeStatus');
    if (!status) return;
    status.textContent = String(message);
    status.dataset.error = error ? 'true' : 'false';
  }

  function syncRangeScopeOptions() {
    const control = byId('pageSelectionRangeScope');
    if (!control || !editorReady()) return;
    const value = control.value;
    const groups = new Map();
    parsedPages.forEach(page => {
      const fileIndex = Number(page.file_index);
      if (page.pageType !== 'pdf' || !Number.isInteger(fileIndex) || fileIndex < 0) return;
      if (!groups.has(fileIndex)) {
        const name = String(uploadedFiles?.[fileIndex]?.name || page.sourceFile || `파일 ${fileIndex + 1}`);
        groups.set(fileIndex, name);
      }
    });
    control.replaceChildren();
    const all = document.createElement('option');
    all.value = 'all';
    all.textContent = '전체 작업 · 현재 편집 순서';
    control.appendChild(all);
    for (const [index, name] of groups) {
      const option = document.createElement('option');
      option.value = `file:${index}`;
      option.textContent = `파일 ${index + 1} · ${name} (원본쪽)`;
      control.appendChild(option);
    }
    control.value = [...control.options].some(option => option.value === value) ? value : 'all';
  }

  function scopePages(scope = 'all') {
    if (!editorReady()) return [];
    if (scope === 'all') return parsedPages.map((page, index) => ({ page, number: index + 1 }));
    const match = /^file:(\d+)$/.exec(String(scope));
    if (!match) return [];
    const fileIndex = Number(match[1]);
    return parsedPages.filter(page =>
      page.pageType === 'pdf' && Number(page.file_index) === fileIndex && Number.isInteger(Number(page.page_index))
        && Number(page.page_index) >= 0
    ).map(page => ({ page, number: Number(page.page_index) + 1 }));
  }

  function parseRangeExpression(value, maxPage) {
    const text = String(value ?? '').trim();
    if (!text) return { ok: false, error: '페이지 범위를 입력해 주세요. 예: 1-10, 15, 20-25' };
    const ranges = [];
    const max = Number(maxPage);
    for (const part of text.split(',')) {
      const match = /^(\d+)\s*(?:-\s*(\d+))?$/.exec(part.trim());
      if (!match) return { ok: false, error: `잘못된 구간입니다: "${part.trim()}"` };
      const first = Number(match[1]);
      const last = match[2] ? Number(match[2]) : first;
      if (!Number.isSafeInteger(first) || !Number.isSafeInteger(last) || first < 1
        || last < first || last > max) {
        return { ok: false, error: `범위는 1~${max} 안에서 오름차순으로 입력해 주세요.` };
      }
      ranges.push([first, last]);
    }
    return { ok: true, ranges };
  }

  function applyScopedSelection(matches, mode = 'replace') {
    const pages = (matches || []).map(entry => entry.page);
    if (mode === 'replace') selectedIds.clear();
    for (const page of pages) {
      const id = pageId(page);
      if (id === null) continue;
      if (mode === 'remove') selectedIds.delete(id);
      else selectedIds.add(id);
    }
    anchorId = pages.length ? pageId(pages[0]) : null;
    primaryId = pages.length && mode !== 'remove'
      ? pageId(pages[pages.length - 1])
      : (selectedIds.size ? [...selectedIds][selectedIds.size - 1] : null);
    contextSelectionIds = [];
    syncSelectionUi();
    return { ok: true, affected: pages.length, selected: selectedIds.size };
  }

  function selectRange(expression, scope = 'all', mode = 'replace') {
    if (!['replace', 'add', 'remove'].includes(mode)) return { ok: false, error: '선택 방식이 올바르지 않습니다.' };
    const entries = scopePages(scope);
    if (!entries.length) return { ok: false, error: '선택할 페이지가 없습니다.' };
    const max = Math.max(...entries.map(entry => entry.number));
    const result = parseRangeExpression(expression, max);
    if (!result.ok) return result;
    const matches = entries.filter(entry => result.ranges.some(([first, last]) =>
      entry.number >= first && entry.number <= last));
    if (!matches.length) return { ok: false, error: '해당 범위에 남아 있는 페이지가 없습니다. 번호를 확인해 주세요.' };
    return applyScopedSelection(matches, mode);
  }

  function selectParity(scope = 'all', parity = 'odd') {
    if (!['odd', 'even'].includes(parity)) return { ok: false, error: '홀수/짝수 선택 방식이 올바르지 않습니다.' };
    const matches = scopePages(scope).filter(entry => entry.number % 2 === (parity === 'odd' ? 1 : 0));
    if (!matches.length) return { ok: false, error: '선택할 페이지가 없습니다.' };
    return applyScopedSelection(matches, 'replace');
  }

  function invertScopeSelection(scope = 'all') {
    const entries = scopePages(scope);
    const previous = new Set(selectedIds);
    for (const entry of entries) {
      const id = pageId(entry.page);
      if (id === null) continue;
      if (previous.has(id)) selectedIds.delete(id);
      else selectedIds.add(id);
    }
    const last = [...selectedIds][selectedIds.size - 1];
    anchorId = last ?? null;
    primaryId = last ?? null;
    contextSelectionIds = [];
    syncSelectionUi();
    return { ok: true, affected: entries.length, selected: selectedIds.size };
  }

  function setDragSelectMode(enabled) {
    dragSelectMode = !!enabled;
    dragSelectPointer = null;
    dragSelectLastId = null;
    const area = byId('thumbArea');
    if (area) {
      area.dataset.dragSelect = dragSelectMode ? 'true' : 'false';
      area.querySelectorAll('.thumb-item').forEach(item => { item.draggable = !dragSelectMode; });
    }
    const button = byId('pageSelectionToolbar')?.querySelector('[data-selection-action="drag"]');
    button?.setAttribute('aria-pressed', dragSelectMode ? 'true' : 'false');
  }

  function rememberSourceThumb(page) {
    if (!page || page.pageType !== 'pdf' || !page.pdfPage || page.sourceThumbCanvas) return;
    if (Number(page.rotation || 0) === 0 && page.thumbCanvas) page.sourceThumbCanvas = page.thumbCanvas;
  }

  async function ensureSourceThumb(page) {
    if (!page || page.pageType !== 'pdf' || !page.pdfPage) return null;
    if (page.sourceThumbCanvas) return page.sourceThumbCanvas;
    if (Number(page.rotation || 0) === 0 && page.thumbCanvas) {
      page.sourceThumbCanvas = page.thumbCanvas;
      return page.sourceThumbCanvas;
    }
    try {
      page.sourceThumbCanvas = await renderPdfPage(page.pdfPage, 0.9, 0);
      return page.sourceThumbCanvas;
    } catch (error) {
      console.warn('[pdf-selection] source thumbnail render failed', error);
      return null;
    }
  }

  function drawSourceThumbIntoItem(item, page) {
    if (!item || !page || page.pageType !== 'pdf') return;
    rememberSourceThumb(page);
    const source = page.sourceThumbCanvas;
    const canvas = item.querySelector('.thumb-wrap canvas');
    if (!source || !canvas || typeof canvas.getContext !== 'function') return;
    try {
      canvas.width = source.width;
      canvas.height = source.height;
      canvas.getContext('2d').clearRect(0, 0, canvas.width, canvas.height);
      canvas.getContext('2d').drawImage(source, 0, 0);
      canvas.dataset.sidebarSourcePreview = 'true';
    } catch (_) {}
  }

  function syncSidebarSourceThumbs() {
    if (!editorReady()) return;
    document.querySelectorAll('#thumbArea .thumb-item').forEach((item) => {
      const page = pageById(Number(item.dataset.id));
      drawSourceThumbIntoItem(item, page);
    });
    document.documentElement.dataset.pdfSidebarPageView = 'source-portrait';
  }

  function syncSelectionUi({ painting = false } = {}) {
    cleanupSelection();
    document.querySelectorAll('#thumbArea .thumb-item').forEach((item) => {
      const id = Number(item.dataset.id);
      if (dragSelectMode) item.draggable = false;
      const selected = selectedIds.has(id);
      item.classList.toggle('page-selected', selected);
      item.classList.toggle('page-selection-anchor', selected && id === anchorId);
      const wrap = item.querySelector('.thumb-wrap');
      if (!wrap) return;
      if (!wrap.style.position) wrap.style.position = 'relative';
      let checkbox = wrap.querySelector('.pdf-page-select-checkbox');
      if (!checkbox) {
        checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.className = 'pdf-page-select-checkbox';
        checkbox.setAttribute('aria-label', '이 페이지 선택');
        checkbox.addEventListener('change', () => {
          const target = pageById(Number(item.dataset.id));
          if (target) selectPage(target, { ctrlKey: true, metaKey: false, shiftKey: false });
        });
        wrap.appendChild(checkbox);
      }
      checkbox.checked = selected;
      let mark = wrap.querySelector('.page-selection-mark');
      if (selected && !mark) {
        mark = document.createElement('span');
        mark.className = 'page-selection-mark';
        mark.textContent = '✓';
        wrap.appendChild(mark);
      } else if (!selected && mark) mark.remove();
    });
    if (!painting) syncSidebarSourceThumbs();
    const count = byId('pageSelectionCount');
    if (count) count.textContent = `선택 ${selectedIds.size}개`;
    document.dispatchEvent(new CustomEvent('pdf-page-selection-change', { detail: { count: selectedIds.size } }));
    if (!painting) highlightPreviewTarget();
  }

  function selectFile(fileIndex, { additive = false } = {}) {
    if (!editorReady()) return 0;
    const target = Number(fileIndex);
    if (!Number.isInteger(target) || target < 0) return 0;
    const pages = parsedPages.filter(page => Number(page.file_index) === target && page.pageType === 'pdf');
    if (!pages.length) return 0;
    if (!additive) selectedIds.clear();
    for (const page of pages) {
      const id = pageId(page);
      if (id !== null) selectedIds.add(id);
    }
    anchorId = pages.length ? pageId(pages[0]) : null;
    primaryId = pages.length ? pageId(pages[pages.length - 1]) : null;
    contextSelectionIds = [];
    syncSelectionUi();
    return pages.length;
  }

  function clearFile(fileIndex) {
    if (!editorReady()) return 0;
    const target = Number(fileIndex);
    const pages = parsedPages.filter(page => Number(page.file_index) === target && page.pageType === 'pdf');
    for (const page of pages) selectedIds.delete(pageId(page));
    anchorId = null;
    primaryId = selectedIds.size ? [...selectedIds][0] : null;
    contextSelectionIds = [];
    syncSelectionUi();
    return pages.length;
  }

  function selectedCountForFile(fileIndex) {
    if (!editorReady()) return 0;
    return parsedPages.filter(page => Number(page.file_index) === Number(fileIndex) && page.pageType === 'pdf' && selectedIds.has(pageId(page))).length;
  }

  function selectAll() {
    if (!editorReady()) return;
    selectedIds.clear();
    parsedPages.forEach((page) => {
      const id = pageId(page);
      if (id !== null) selectedIds.add(id);
    });
    anchorId = parsedPages.length ? pageId(parsedPages[0]) : null;
    primaryId = parsedPages.length ? pageId(parsedPages[parsedPages.length - 1]) : null;
    contextSelectionIds = [];
    syncSelectionUi();
  }

  function clearSelection() {
    selectedIds.clear();
    anchorId = null;
    primaryId = null;
    contextSelectionIds = [];
    syncSelectionUi();
  }

  function selectPage(page, event) {
    const id = pageId(page);
    if (id === null) return;
    const additive = !!(event.ctrlKey || event.metaKey);
    const range = !!event.shiftKey;

    if (range && anchorId !== null && editorReady()) {
      const start = parsedPages.findIndex((entry) => pageId(entry) === anchorId);
      const end = parsedPages.findIndex((entry) => pageId(entry) === id);
      if (start >= 0 && end >= 0) {
        if (!additive) selectedIds.clear();
        const [from, to] = start <= end ? [start, end] : [end, start];
        for (let index = from; index <= to; index += 1) {
          const rangeId = pageId(parsedPages[index]);
          if (rangeId !== null) selectedIds.add(rangeId);
        }
      }
    } else if (additive) {
      if (selectedIds.has(id)) selectedIds.delete(id);
      else selectedIds.add(id);
      anchorId = id;
    } else {
      selectedIds.clear();
      selectedIds.add(id);
      anchorId = id;
    }

    primaryId = selectedIds.has(id) ? id : (selectedIds.size ? [...selectedIds][selectedIds.size - 1] : null);
    contextSelectionIds = [];
    syncSelectionUi();
    if (primaryId !== null) focusPreviewForPage(pageById(primaryId), true);
  }

  function installPointerPaintSelection() {
    const area = byId('thumbArea');
    if (!area || area.dataset.pagePaintSelectionBound) return;
    area.dataset.pagePaintSelectionBound = '1';

    const paintAt = (element) => {
      if (!dragSelectMode || dragSelectPointer === null) return;
      const item = element?.closest?.('.thumb-item');
      if (!item || !area.contains(item)) return;
      const id = Number(item.dataset.id);
      if (!Number.isFinite(id) || id === dragSelectLastId) return;
      const page = pageById(id);
      if (!page) return;
      dragSelectLastId = id;
      selectedIds.add(id);
      primaryId = id;
      contextSelectionIds = [];
      syncSelectionUi({ painting: true });
    };
    area.addEventListener('pointerdown', (event) => {
      if (!dragSelectMode || event.button !== 0 || event.pointerType === 'touch'
        || event.target.closest('input,button,select,.thumb-file-sep')) return;
      const item = event.target.closest('.thumb-item');
      if (!item || !area.contains(item)) return;
      event.preventDefault();
      event.stopImmediatePropagation();
      dragSelectPointer = event.pointerId;
      dragSelectLastId = null;
      if (!event.ctrlKey && !event.metaKey) selectedIds.clear();
      anchorId = Number(item.dataset.id);
      paintAt(item);
    }, true);
    document.addEventListener('pointermove', (event) => {
      if (!dragSelectMode || dragSelectPointer !== event.pointerId) return;
      const element = document.elementFromPoint?.(event.clientX, event.clientY);
      if (element && area.contains(element)) paintAt(element);
    }, true);
    const finish = (event) => {
      if (dragSelectPointer === event.pointerId) {
        dragSelectPointer = null;
        dragSelectLastId = null;
        syncSelectionUi();
      }
    };
    document.addEventListener('pointerup', finish, true);
    document.addEventListener('pointercancel', finish, true);
  }

  function installClickSelection() {
    const area = byId('thumbArea');
    if (!area || area.dataset.pageSelectionBoundV2) return;
    area.dataset.pageSelectionBoundV2 = '1';

    area.addEventListener('click', (event) => {
      if (event.target.closest('select,input,button,.thumb-file-sep')) return;
      if (dragSelectMode) {
        event.preventDefault();
        event.stopImmediatePropagation();
        return;
      }
      const wrap = event.target.closest('.thumb-wrap');
      const item = wrap && wrap.closest('.thumb-item');
      if (!wrap || !item || !area.contains(item)) return;
      const page = pageById(Number(item.dataset.id));
      if (!page) return;
      event.preventDefault();
      event.stopImmediatePropagation();
      selectPage(page, event);
    }, true);

    area.addEventListener('contextmenu', (event) => {
      const item = event.target.closest('.thumb-item');
      if (!item || !area.contains(item)) return;
      const page = pageById(Number(item.dataset.id));
      if (!page) return;
      const id = pageId(page);
      if (!selectedIds.has(id)) {
        selectedIds.clear();
        selectedIds.add(id);
        anchorId = id;
      }
      primaryId = id;
      syncSelectionUi();
      // Freeze the complete selection before any context-menu click handlers run.
      contextSelectionIds = snapshotSelectedIds();
      document.documentElement.dataset.pdfContextSelectionCount = String(contextSelectionIds.length);
    }, true);
  }

  function previewPagesInOrder() {
    if (!editorReady()) return [];
    const active = parsedPages.filter((page) => !page.excluded);
    try {
      const booklet = !!(byId('bookletCheck') && byId('bookletCheck').checked);
      if (booklet && typeof bookletReorderPreview === 'function' && typeof nup !== 'undefined' && typeof BOOKLET_STRIPS !== 'undefined' && nup in BOOKLET_STRIPS) {
        return bookletReorderPreview(active, nup);
      }
    } catch (_) {}
    return active;
  }

  function outputIndexForPage(page) {
    if (!page || page.excluded) return -1;
    try {
      const pages = previewPagesInOrder();
      const groups = groupByNup(pages);
      let outputIndex = 0;
      for (const group of groups) {
        const layout = getLayout(group.n);
        const perPage = layout.cols * layout.rows;
        const pageIndex = group.pages.findIndex((entry) => entry === page || pageId(entry) === pageId(page));
        if (pageIndex >= 0) return outputIndex + Math.floor(pageIndex / perPage);
        outputIndex += Math.ceil(group.pages.length / perPage);
      }
    } catch (error) {
      console.warn('[pdf-selection] output mapping failed', error);
    }
    return -1;
  }

  function annotatePreviewPages() {
    document.querySelectorAll('#previewScroll .page-preview').forEach((element, index) => {
      if (!element.dataset.outputIndex) element.dataset.outputIndex = String(index);
    });
  }

  function previewElement(index) {
    return document.querySelector(`#previewScroll .page-preview[data-output-index="${index}"]`) ||
      document.querySelectorAll('#previewScroll .page-preview')[index] || null;
  }

  function scrollPreviewTo(index, smooth) {
    const scroll = byId('previewScroll');
    const target = previewElement(index);
    if (!scroll || !target) return false;
    const scrollRect = scroll.getBoundingClientRect();
    const targetRect = target.getBoundingClientRect();
    const top = scroll.scrollTop + targetRect.top - scrollRect.top - 12;
    scroll.scrollTo({ top: Math.max(0, top), behavior: smooth ? 'smooth' : 'auto' });
    document.querySelectorAll('#previewScroll .page-preview.preview-selection-target').forEach((element) => element.classList.remove('preview-selection-target'));
    target.classList.add('preview-selection-target');
    return true;
  }

  function focusPreviewForPage(page, smooth) {
    if (!page) return false;
    if (page.excluded) {
      try { if (typeof showStatus === 'function') showStatus('숨긴 페이지는 오른쪽 미리보기에서 제외됩니다. 우클릭 메뉴에서 다시 포함할 수 있습니다.', 'info'); } catch (_) {}
      return false;
    }
    annotatePreviewPages();
    const index = outputIndexForPage(page);
    return index >= 0 ? scrollPreviewTo(index, smooth) : false;
  }

  function highlightPreviewTarget() {
    document.querySelectorAll('#previewScroll .page-preview.preview-selection-target').forEach((element) => element.classList.remove('preview-selection-target'));
    const page = pageById(primaryId);
    if (!page || page.excluded) return;
    const index = outputIndexForPage(page);
    const target = index >= 0 ? previewElement(index) : null;
    if (target) target.classList.add('preview-selection-target');
  }

  function currentVisiblePreviewIndex() {
    const scroll = byId('previewScroll');
    if (!scroll) return 0;
    const scrollRect = scroll.getBoundingClientRect();
    let bestIndex = 0;
    let bestDistance = Infinity;
    document.querySelectorAll('#previewScroll .page-preview').forEach((element, index) => {
      const distance = Math.abs(element.getBoundingClientRect().top - scrollRect.top - 10);
      if (distance < bestDistance) {
        bestDistance = distance;
        bestIndex = index;
      }
    });
    return bestIndex;
  }

  function patchDisplayPreview() {
    try {
      if (typeof displayPreview !== 'function') return false;
      if (displayPreview.__pageSelectionFocusPatchedV2) return true;
      const original = displayPreview;
      const wrapped = function displayPreviewKeepingFocus() {
        const previousIndex = currentVisiblePreviewIndex();
        const selectedPage = pageById(primaryId);
        const selectedOutput = selectedPage ? outputIndexForPage(selectedPage) : -1;
        const result = original.apply(this, arguments);
        annotatePreviewPages();
        requestAnimationFrame(() => {
          const targetIndex = selectedOutput >= 0 ? selectedOutput : previousIndex;
          scrollPreviewTo(targetIndex, false);
          syncSelectionUi();
        });
        return result;
      };
      wrapped.__pageSelectionFocusPatchedV2 = true;
      displayPreview = wrapped;
      window.displayPreview = wrapped;
      previewPatched = true;
      return true;
    } catch (error) {
      console.warn('[pdf-selection] preview patch failed', error);
      return false;
    }
  }

  function patchRenderThumbs() {
    try {
      if (typeof renderThumbs !== 'function') return false;
      if (renderThumbs.__pageSelectionPatchedV2) return true;
      const original = renderThumbs;
      const wrapped = function renderThumbsKeepingSelection() {
        const result = original.apply(this, arguments);
        setTimeout(() => {
          ensureToolbar();
          syncSelectionUi();
        }, 0);
        return result;
      };
      wrapped.__pageSelectionPatchedV2 = true;
      renderThumbs = wrapped;
      window.renderThumbs = wrapped;
      renderPatched = true;
      return true;
    } catch (error) {
      console.warn('[pdf-selection] thumbnail patch failed', error);
      return false;
    }
  }

  function menuItem(menu, icon, label, className, handler) {
    const element = document.createElement('div');
    element.className = `ctx-item${className ? ` ${className}` : ''}`;
    const iconElement = document.createElement('span');
    iconElement.className = 'ctx-icon';
    iconElement.textContent = icon;
    element.appendChild(iconElement);
    element.appendChild(document.createTextNode(label));
    element.addEventListener('click', (event) => {
      event.preventDefault();
      event.stopImmediatePropagation();
      menu.classList.remove('open');
      handler();
    }, true);
    return element;
  }

  function separator() {
    const element = document.createElement('div');
    element.className = 'ctx-sep';
    return element;
  }

  function refreshRightPreview(reason) {
    try {
      if (window.PdfViewportLazyPreviewGuard?.refreshRightPreview) {
        window.PdfViewportLazyPreviewGuard.refreshRightPreview(reason || 'batch-action');
        return true;
      }
    } catch (_) {}
    try {
      const lazy = window.PdfViewportLazyPreview;
      const scroll = byId('previewScroll');
      if ((window.__pdfEditorLazyPreviewActive || scroll?.dataset?.lazyPreview === 'true') && lazy?.requestRender) {
        const index = typeof lazy.getCurrentOutputIndex === 'function' ? lazy.getCurrentOutputIndex() : 0;
        lazy.requestRender(index);
        document.documentElement.dataset.pdfBatchPreviewSync = reason || 'batch-action';
        return true;
      }
    } catch (_) {}
    try {
      if (typeof triggerPreview === 'function') {
        Promise.resolve(triggerPreview()).finally(() => {
          document.documentElement.dataset.pdfBatchPreviewSync = reason || 'batch-action';
        });
        return true;
      }
    } catch (_) {}
    try {
      if (typeof schedulePreview === 'function') {
        schedulePreview(0);
        document.documentElement.dataset.pdfBatchPreviewSync = reason || 'batch-action';
        return true;
      }
    } catch (_) {}
    return false;
  }

  function announceBatch(type, ids) {
    document.documentElement.dataset.pdfBatchActionCount = String((ids || []).length);
    document.documentElement.dataset.pdfBatchActionType = type;
    try {
      document.dispatchEvent(new CustomEvent('pdf-batch-pages-changed', { detail: { type, ids: [...(ids || [])] } }));
    } catch (_) {}
  }

  function refreshAfterBatch(options = {}) {
    if (options.renderList !== false) {
      try { renderThumbs(); } catch (_) {}
    } else syncSelectionUi();
    refreshRightPreview(options.reason || 'batch-action');
  }

  async function rotatePages(ids, degrees) {
    const actionIds = [...(ids || [])];
    const targets = pagesForIds(actionIds).filter((page) => page.pageType === 'pdf' && page.pdfPage);
    if (!targets.length) return false;
    try { if (typeof showStatus === 'function') showStatus(`선택 ${targets.length}페이지를 오른쪽 미리보기에 회전 반영 중...`); } catch (_) {}
    for (const page of targets) {
      await ensureSourceThumb(page);
      page.rotation = ((page.rotation || 0) + degrees + 360) % 360;
      // Keep thumbCanvas as the canonical rotated/output source used by the preview/export,
      // while sourceThumbCanvas remains untouched for the left sidebar.
      page.thumbCanvas = await renderPdfPage(page.pdfPage, 0.9, page.rotation);
      page.hiCanvas = null;
    }
    try { if (typeof hideStatus === 'function') hideStatus(); } catch (_) {}
    announceBatch('rotation', actionIds);
    refreshAfterBatch({ renderList: true, reason: 'batch-rotation' });
    return true;
  }

  function setPagesExcluded(ids, excluded) {
    const actionIds = [...(ids || [])];
    const targets = pagesForIds(actionIds);
    if (!targets.length) return false;
    targets.forEach((page) => { page.excluded = excluded; });
    announceBatch(excluded ? 'hide' : 'include', actionIds);
    refreshAfterBatch({ renderList: true, reason: excluded ? 'batch-hide' : 'batch-include' });
    return true;
  }

  function deletePages(ids) {
    const actionIds = [...(ids || [])];
    const idSet = new Set(actionIds.map(Number));
    if (!idSet.size || !editorReady()) return false;
    const before = parsedPages.length;
    parsedPages = parsedPages.filter((page) => !idSet.has(pageId(page)));
    if (parsedPages.length === before) return false;
    actionIds.forEach((id) => selectedIds.delete(Number(id)));
    anchorId = selectedIds.size ? [...selectedIds][0] : null;
    primaryId = anchorId;
    contextSelectionIds = [];
    announceBatch('delete', actionIds);
    refreshAfterBatch({ renderList: true, reason: 'batch-delete' });
    return true;
  }

  function insertBlankForIds(ids, relative) {
    const actionIds = [...(ids || [])];
    const selected = pagesForIds(actionIds);
    if (!selected.length || !editorReady()) return false;
    const indices = selected.map((page) => parsedPages.indexOf(page)).filter((index) => index >= 0);
    if (!indices.length) return false;
    const index = relative === 'before' ? Math.min(...indices) : Math.max(...indices) + 1;
    parsedPages.splice(index, 0, makeBlankPage());
    announceBatch(relative === 'before' ? 'insert-blank-before' : 'insert-blank-after', actionIds);
    refreshAfterBatch({ renderList: true, reason: 'batch-insert-blank' });
    return true;
  }

  function contextIdsForPage(page) {
    const id = pageId(page);
    if (id === null) return [];
    if (!selectedIds.has(id)) {
      selectedIds.clear();
      selectedIds.add(id);
      anchorId = id;
    }
    primaryId = id;
    syncSelectionUi();
    const snapshot = snapshotSelectedIds();
    contextSelectionIds = snapshot.slice();
    document.documentElement.dataset.pdfContextSelectionCount = String(snapshot.length);
    return snapshot;
  }

  function installContextMenu() {
    if (!byId('thumbCtxMenu') || window.__pdfSelectionContextMenuInstalledV2) return false;
    window.__pdfSelectionContextMenuInstalledV2 = true;
    window.__pdfSelectionContextMenuInstalledV1 = true;
    window._openThumbCtxMenu = function openSelectedPageContextMenu(event, page) {
      event.preventDefault();
      event.stopImmediatePropagation();
      const actionIds = contextIdsForPage(page);
      if (!actionIds.length) return;

      const menu = byId('thumbCtxMenu');
      const targets = pagesForIds(actionIds);
      const hiddenCount = targets.filter((entry) => entry.excluded).length;
      const visibleCount = targets.length - hiddenCount;
      menu.innerHTML = '';
      menu.dataset.selectionIds = actionIds.join(',');
      menu.dataset.selectionCount = String(actionIds.length);

      const heading = document.createElement('div');
      heading.className = 'ctx-heading';
      heading.textContent = `선택한 페이지 ${actionIds.length}개 · 오른쪽 미리보기에 적용`;
      menu.appendChild(heading);
      if (visibleCount) menu.appendChild(menuItem(menu, '◌', `선택 페이지 숨기기 (${visibleCount})`, '', () => setPagesExcluded(actionIds, true)));
      if (hiddenCount) menu.appendChild(menuItem(menu, '◉', `선택 페이지 다시 포함 (${hiddenCount})`, '', () => setPagesExcluded(actionIds, false)));
      menu.appendChild(separator());
      menu.appendChild(menuItem(menu, '↻', `선택 ${actionIds.length}개 시계방향 90° 회전`, '', () => rotatePages(actionIds, 90)));
      menu.appendChild(menuItem(menu, '↺', `선택 ${actionIds.length}개 시계반대방향 90° 회전`, '', () => rotatePages(actionIds, -90)));
      menu.appendChild(menuItem(menu, '⇅', `선택 ${actionIds.length}개 180° 회전`, '', () => rotatePages(actionIds, 180)));
      menu.appendChild(separator());
      menu.appendChild(menuItem(menu, '⬆', '선택 영역 위에 빈 페이지 삽입', '', () => insertBlankForIds(actionIds, 'before')));
      menu.appendChild(menuItem(menu, '⬇', '선택 영역 아래에 빈 페이지 삽입', '', () => insertBlankForIds(actionIds, 'after')));
      menu.appendChild(separator());
      menu.appendChild(menuItem(menu, '☑', '전체 페이지 선택', 'all-rotate', selectAll));
      menu.appendChild(menuItem(menu, '□', '선택 해제', 'all-rotate', clearSelection));
      menu.appendChild(separator());
      menu.appendChild(menuItem(menu, '🗑', `선택 페이지 삭제 (${actionIds.length})`, 'danger', () => deletePages(actionIds)));

      menu.classList.add('open');
      const viewportWidth = window.innerWidth;
      const viewportHeight = window.innerHeight;
      const width = menu.offsetWidth;
      const height = menu.offsetHeight;
      let x = event.clientX;
      let y = event.clientY;
      if (x + width > viewportWidth) x = viewportWidth - width - 6;
      if (y + height > viewportHeight) y = viewportHeight - height - 6;
      menu.style.left = `${Math.max(4, x)}px`;
      menu.style.top = `${Math.max(4, y)}px`;
    };
    return true;
  }

  function boot() {
    installStyles();
    if (!editorReady()) {
      if (attempts < 14) {
        attempts += 1;
        setTimeout(boot, 180 + attempts * 70);
      }
      return;
    }
    parsedPages.forEach(rememberSourceThumb);
    ensureToolbar();
    installClickSelection();
    installPointerPaintSelection();
    setDragSelectMode(dragSelectMode);
    patchRenderThumbs();
    patchDisplayPreview();
    installContextMenu();
    if (!window.__pdfPageSelectionImportResetV1) {
      window.__pdfPageSelectionImportResetV1 = true;
      document.addEventListener('pdf-import-committed', event => {
        if (event?.detail?.mode === 'new') clearSelection();
      });
      byId('resetBtn')?.addEventListener('click', clearSelection);
    }
    annotatePreviewPages();
    syncSelectionUi();
    if ((!renderPatched || !previewPatched || !window._openThumbCtxMenu) && attempts < 14) {
      attempts += 1;
      setTimeout(boot, 180 + attempts * 70);
    }
  }

  window.PdfEditorPageSelection = {
    selectedIds,
    selectAll,
    selectFile,
    clearFile,
    selectedCountForFile,
    clearSelection,
    selectRange,
    selectParity,
    invertScopeSelection,
    parseRangeExpression,
    scopePages,
    setDragSelectMode,
    snapshotSelectedIds,
    pagesForIds,
    rotatePages,
    setPagesExcluded,
    deletePages,
    insertBlankForIds,
    refreshRightPreview,
    syncSidebarSourceThumbs,
    focusPage: (id) => focusPreviewForPage(pageById(id), true),
    get contextSelectionIds() { return contextSelectionIds.slice(); },
    stage: 'page-selection-batch-snapshot-canvas-v2',
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once: true });
  else boot();
})();
