// Page selection, batch context actions, and preview focus preservation.
(function () {
  'use strict';
  if (window.__pdfEditorPageSelectionV1) return;
  window.__pdfEditorPageSelectionV1 = true;

  const selectedIds = new Set();
  let anchorId = null;
  let primaryId = null;
  let renderPatched = false;
  let previewPatched = false;
  let attempts = 0;
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

  function orderedSelectedPages() {
    if (!editorReady()) return [];
    return parsedPages.filter((page) => selectedIds.has(pageId(page)));
  }

  function cleanupSelection() {
    if (!editorReady()) return;
    const valid = new Set(parsedPages.map(pageId).filter((id) => id !== null));
    [...selectedIds].forEach((id) => { if (!valid.has(id)) selectedIds.delete(id); });
    if (!valid.has(anchorId)) anchorId = null;
    if (!valid.has(primaryId)) primaryId = selectedIds.size ? [...selectedIds][0] : null;
  }

  function installStyles() {
    if (byId('pdfPageSelectionStyles')) return;
    const style = document.createElement('style');
    style.id = 'pdfPageSelectionStyles';
    style.textContent = `
      .page-selection-toolbar{display:flex;align-items:center;gap:5px;margin-bottom:7px;padding:6px 7px;border:1px solid #dbe5ef;border-radius:9px;background:#f8fafc}
      .page-selection-count{font-size:9px;font-weight:900;color:#334155;margin-right:auto;white-space:nowrap}
      .page-selection-btn{border:1px solid #cbd5e1;border-radius:7px;background:#fff;color:#475569;padding:4px 7px;font:800 9px Pretendard,"Noto Sans KR",sans-serif;cursor:pointer}
      .page-selection-btn:hover{border-color:#93c5fd;background:#eff6ff;color:#1d4ed8}
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
    if (!area || byId('pageSelectionToolbar')) return;
    const toolbar = document.createElement('div');
    toolbar.id = 'pageSelectionToolbar';
    toolbar.className = 'page-selection-toolbar';
    toolbar.innerHTML = `
      <span class="page-selection-count" id="pageSelectionCount">선택 0개</span>
      <button type="button" class="page-selection-btn" data-selection-action="all">전체선택</button>
      <button type="button" class="page-selection-btn" data-selection-action="clear">선택해제</button>`;
    area.parentElement.insertBefore(toolbar, area);
    toolbar.addEventListener('click', (event) => {
      const button = event.target.closest('[data-selection-action]');
      if (!button) return;
      if (button.dataset.selectionAction === 'all') selectAll();
      else clearSelection();
    });
    const hint = area.parentElement.querySelector('.thumb-hint');
    if (hint) hint.textContent = '클릭=선택 · Ctrl/Shift=다중선택 · 우클릭=숨김/회전/삭제 · 드래그=순서변경';
  }

  function syncSelectionUi() {
    cleanupSelection();
    document.querySelectorAll('#thumbArea .thumb-item').forEach((item) => {
      const id = Number(item.dataset.id);
      const selected = selectedIds.has(id);
      item.classList.toggle('page-selected', selected);
      item.classList.toggle('page-selection-anchor', selected && id === anchorId);
      const wrap = item.querySelector('.thumb-wrap');
      if (!wrap) return;
      let mark = wrap.querySelector('.page-selection-mark');
      if (selected && !mark) {
        mark = document.createElement('span');
        mark.className = 'page-selection-mark';
        mark.textContent = '✓';
        wrap.appendChild(mark);
      } else if (!selected && mark) mark.remove();
    });
    const count = byId('pageSelectionCount');
    if (count) count.textContent = `선택 ${selectedIds.size}개`;
    highlightPreviewTarget();
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
    syncSelectionUi();
  }

  function clearSelection() {
    selectedIds.clear();
    anchorId = null;
    primaryId = null;
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
    syncSelectionUi();
    if (primaryId !== null) focusPreviewForPage(pageById(primaryId), true);
  }

  function installClickSelection() {
    const area = byId('thumbArea');
    if (!area || area.dataset.pageSelectionBoundV1) return;
    area.dataset.pageSelectionBoundV1 = '1';

    area.addEventListener('click', (event) => {
      if (event.target.closest('select,input,button,.thumb-file-sep')) return;
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
        primaryId = id;
        syncSelectionUi();
      } else primaryId = id;
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
      element.dataset.outputIndex = String(index);
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
      try { if (typeof showStatus === 'function') showStatus('숨긴 페이지는 미리보기에 표시되지 않습니다. 우클릭 메뉴에서 다시 포함할 수 있습니다.', 'info'); } catch (_) {}
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
      if (displayPreview.__pageSelectionFocusPatchedV1) return true;
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
      wrapped.__pageSelectionFocusPatchedV1 = true;
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
      if (renderThumbs.__pageSelectionPatchedV1) return true;
      const original = renderThumbs;
      const wrapped = function renderThumbsKeepingSelection() {
        const result = original.apply(this, arguments);
        setTimeout(() => {
          ensureToolbar();
          syncSelectionUi();
        }, 0);
        return result;
      };
      wrapped.__pageSelectionPatchedV1 = true;
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
      event.stopPropagation();
      menu.classList.remove('open');
      handler();
    });
    return element;
  }

  function separator() {
    const element = document.createElement('div');
    element.className = 'ctx-sep';
    return element;
  }

  function refreshAfterBatch() {
    try { renderThumbs(); } catch (_) {}
    try { if (typeof schedulePreview === 'function') schedulePreview(250); } catch (_) {}
  }

  async function rotateSelected(degrees) {
    const targets = orderedSelectedPages().filter((page) => page.pageType === 'pdf' && page.pdfPage);
    if (!targets.length) return;
    try { if (typeof showStatus === 'function') showStatus(`선택 ${targets.length}페이지 회전 중...`); } catch (_) {}
    for (const page of targets) {
      page.rotation = ((page.rotation || 0) + degrees + 360) % 360;
      page.thumbCanvas = await renderPdfPage(page.pdfPage, 0.9, page.rotation);
      page.hiCanvas = null;
    }
    try { if (typeof hideStatus === 'function') hideStatus(); } catch (_) {}
    refreshAfterBatch();
  }

  function setSelectedExcluded(excluded) {
    const targets = orderedSelectedPages();
    targets.forEach((page) => { page.excluded = excluded; });
    refreshAfterBatch();
  }

  function deleteSelected() {
    const ids = new Set(selectedIds);
    if (!ids.size || !editorReady()) return;
    parsedPages = parsedPages.filter((page) => !ids.has(pageId(page)));
    selectedIds.clear();
    anchorId = null;
    primaryId = null;
    refreshAfterBatch();
  }

  function insertBlank(relative) {
    const selected = orderedSelectedPages();
    if (!selected.length || !editorReady()) return;
    const indices = selected.map((page) => parsedPages.indexOf(page)).filter((index) => index >= 0);
    const index = relative === 'before' ? Math.min(...indices) : Math.max(...indices) + 1;
    parsedPages.splice(index, 0, makeBlankPage());
    refreshAfterBatch();
  }

  function installContextMenu() {
    if (!byId('thumbCtxMenu') || window.__pdfSelectionContextMenuInstalledV1) return false;
    window.__pdfSelectionContextMenuInstalledV1 = true;
    window._openThumbCtxMenu = function openSelectedPageContextMenu(event, page) {
      event.preventDefault();
      event.stopPropagation();
      const id = pageId(page);
      if (!selectedIds.has(id)) {
        selectedIds.clear();
        selectedIds.add(id);
        anchorId = id;
      }
      primaryId = id;
      syncSelectionUi();

      const menu = byId('thumbCtxMenu');
      const targets = orderedSelectedPages();
      const hiddenCount = targets.filter((entry) => entry.excluded).length;
      const visibleCount = targets.length - hiddenCount;
      menu.innerHTML = '';

      const heading = document.createElement('div');
      heading.className = 'ctx-heading';
      heading.textContent = `선택한 페이지 ${targets.length}개`;
      menu.appendChild(heading);
      if (visibleCount) menu.appendChild(menuItem(menu, '◌', `선택 페이지 숨기기 (${visibleCount})`, '', () => setSelectedExcluded(true)));
      if (hiddenCount) menu.appendChild(menuItem(menu, '◉', `선택 페이지 다시 포함 (${hiddenCount})`, '', () => setSelectedExcluded(false)));
      menu.appendChild(separator());
      menu.appendChild(menuItem(menu, '↻', '선택 시계방향 90° 회전', '', () => rotateSelected(90)));
      menu.appendChild(menuItem(menu, '↺', '선택 시계반대방향 90° 회전', '', () => rotateSelected(-90)));
      menu.appendChild(menuItem(menu, '⇅', '선택 180° 회전', '', () => rotateSelected(180)));
      menu.appendChild(separator());
      menu.appendChild(menuItem(menu, '⬆', '선택 영역 위에 빈 페이지 삽입', '', () => insertBlank('before')));
      menu.appendChild(menuItem(menu, '⬇', '선택 영역 아래에 빈 페이지 삽입', '', () => insertBlank('after')));
      menu.appendChild(separator());
      menu.appendChild(menuItem(menu, '☑', '전체 페이지 선택', 'all-rotate', selectAll));
      menu.appendChild(menuItem(menu, '□', '선택 해제', 'all-rotate', clearSelection));
      menu.appendChild(separator());
      menu.appendChild(menuItem(menu, '🗑', `선택 페이지 삭제 (${targets.length})`, 'danger', deleteSelected));

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
    ensureToolbar();
    installClickSelection();
    patchRenderThumbs();
    patchDisplayPreview();
    installContextMenu();
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
    clearSelection,
    focusPage: (id) => focusPreviewForPage(pageById(id), true),
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once: true });
  else boot();
})();
