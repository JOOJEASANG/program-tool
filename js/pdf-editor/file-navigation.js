// File-aware navigation for large PDF thumbnail lists.
(function () {
  'use strict';
  if (window.__pdfFileNavigationV1) return;
  window.__pdfFileNavigationV1 = true;
  if (!location.pathname.includes('pdf-editor')) return;

  const INSTALL_DELAYS = [0, 180, 420, 800, 1400, 2300, 3600];
  const collapsedFiles = new Set();
  let installed = false;
  let enhancing = false;
  let enhanceFrame = 0;
  let observer = null;
  let selectedPageId = '';

  const byId = (id) => document.getElementById(id);
  const pageId = (page) => String(page?.id ?? '');
  const fileKey = (value) => String(Number.isFinite(Number(value)) ? Number(value) : value ?? '');

  function uniqueSorted(values) {
    return [...new Set((values || []).map(Number).filter(Number.isFinite))].sort((a, b) => a - b);
  }

  function compactRanges(values, maxRanges = 2) {
    const numbers = uniqueSorted(values);
    if (!numbers.length) return '없음';
    const ranges = [];
    let start = numbers[0];
    let end = numbers[0];
    for (let index = 1; index < numbers.length; index += 1) {
      const value = numbers[index];
      if (value === end + 1) {
        end = value;
        continue;
      }
      ranges.push([start, end]);
      start = value;
      end = value;
    }
    ranges.push([start, end]);
    const visible = ranges.slice(0, Math.max(1, maxRanges));
    const label = visible.map(([from, to]) => from === to ? String(from) : `${from}–${to}`).join(', ');
    const remaining = ranges.length - visible.length;
    return remaining > 0 ? `${label} 외 ${remaining}구간` : label;
  }

  function buildFileGroups(pages = parsedPages, files = uploadedFiles) {
    const groups = new Map();
    (pages || []).forEach((page, index) => {
      if (page?.file_index === undefined || page?.file_index === null) return;
      const key = fileKey(page.file_index);
      if (!groups.has(key)) {
        const fileIndex = Number(page.file_index);
        groups.set(key, {
          key,
          fileIndex,
          name: String(page.sourceFile || files?.[fileIndex]?.name || `파일 ${fileIndex + 1}`),
          pages: [],
          editedOrdinals: [],
          originalOrdinals: [],
          excluded: 0,
          segments: 0,
        });
      }
      const group = groups.get(key);
      group.pages.push(page);
      group.editedOrdinals.push(index + 1);
      if (Number.isFinite(Number(page.page_index))) group.originalOrdinals.push(Number(page.page_index) + 1);
      if (page.excluded) group.excluded += 1;
    });

    for (const group of groups.values()) {
      const edited = uniqueSorted(group.editedOrdinals);
      let segments = edited.length ? 1 : 0;
      for (let index = 1; index < edited.length; index += 1) {
        if (edited[index] !== edited[index - 1] + 1) segments += 1;
      }
      group.segments = segments;
      group.editedRange = compactRanges(group.editedOrdinals);
      group.originalRange = compactRanges(group.originalOrdinals);
      group.summary = `편집 ${group.editedRange} · 원본 ${group.originalRange} · ${group.pages.length}쪽${group.excluded ? ` · 숨김 ${group.excluded}` : ''}`;
    }
    return groups;
  }

  function editedPageAt(ordinal, pages = parsedPages) {
    const index = Math.floor(Number(ordinal)) - 1;
    return index >= 0 && index < (pages || []).length ? pages[index] : null;
  }

  function originalPageAt(fileIndex, originalOrdinal, pages = parsedPages) {
    const targetFile = Number(fileIndex);
    const targetPage = Math.floor(Number(originalOrdinal)) - 1;
    if (!Number.isInteger(targetFile) || targetPage < 0) return null;
    return (pages || []).find((page) => (
      Number(page?.file_index) === targetFile
      && Number(page?.page_index) === targetPage
    )) || null;
  }

  function installStyles() {
    if (byId('pdfFileNavigationStyles')) return;
    const style = document.createElement('style');
    style.id = 'pdfFileNavigationStyles';
    style.textContent = `
      .pdf-file-nav{position:sticky;top:-1px;z-index:12;display:grid;gap:6px;margin:0 0 7px;padding:7px;border:1px solid #dbe5ee;border-radius:9px;background:rgba(248,250,252,.97);box-shadow:0 3px 8px rgba(15,23,42,.06)}
      .pdf-file-nav-row{display:grid;grid-template-columns:minmax(0,1fr) 58px 44px;gap:4px;align-items:center}
      .pdf-file-nav-row.original{grid-template-columns:minmax(0,1fr) 58px 44px}
      .pdf-file-nav input,.pdf-file-nav select{min-width:0;width:100%;height:27px;padding:4px 6px;border:1px solid #cbd5e1;border-radius:6px;background:#fff;font:inherit;font-size:9px;font-weight:750}
      .pdf-file-nav button{height:27px;border:1px solid #93c5fd;border-radius:6px;background:#eff6ff;color:#1d4ed8;font:inherit;font-size:9px;font-weight:850;cursor:pointer}
      .pdf-file-nav-actions{display:flex;gap:4px}
      .pdf-file-nav-actions button{flex:1;border-color:#cbd5e1;background:#fff;color:#475569}
      .pdf-file-nav-status{min-height:13px;font-size:8px;font-weight:750;color:#64748b;line-height:1.35}
      .thumb-file-sep[data-file-nav-header="true"]{gap:5px;padding:6px 5px;margin-top:2px;border:1px solid #ddd6fe;border-radius:7px;background:#faf8ff}
      .pdf-file-nav-toggle{flex:0 0 24px;width:24px;height:24px;border:1px solid #c4b5fd;border-radius:6px;background:#fff;color:#6d28d9;font:inherit;font-size:11px;font-weight:900;cursor:pointer}
      .thumb-file-sep[data-collapsed="true"] .pdf-file-nav-toggle{transform:rotate(-90deg)}
      .thumb-file-sep[data-file-nav-header="true"] .thumb-file-sep-line{display:none}
      .thumb-file-sep[data-file-nav-header="true"] .thumb-file-sep-label{max-width:110px;overflow:hidden;text-overflow:ellipsis;font-size:9px}
      .pdf-file-nav-meta{min-width:0;flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:#64748b;font-size:8px;font-weight:750}
      .thumb-item[data-file-nav-current="true"] .thumb-wrap{border-color:#2563eb!important;box-shadow:0 0 0 2px rgba(37,99,235,.18)}
      @media(max-width:430px){.pdf-file-nav-row,.pdf-file-nav-row.original{grid-template-columns:minmax(0,1fr) 52px 40px}.pdf-file-nav-meta{display:none}}
    `;
    document.head.appendChild(style);
  }

  function ensureToolbar(groups) {
    const area = byId('thumbArea');
    if (!area?.parentElement) return null;
    let toolbar = byId('pdfFileNavigation');
    if (!toolbar) {
      toolbar = document.createElement('div');
      toolbar.id = 'pdfFileNavigation';
      toolbar.className = 'pdf-file-nav';
      toolbar.setAttribute('role', 'navigation');
      toolbar.setAttribute('aria-label', 'PDF 페이지 빠른 이동');

      const editedRow = document.createElement('div');
      editedRow.className = 'pdf-file-nav-row';
      const editedLabel = document.createElement('label');
      editedLabel.htmlFor = 'pdfEditedPageJump';
      editedLabel.textContent = '편집 페이지 이동';
      const editedInput = document.createElement('input');
      editedInput.id = 'pdfEditedPageJump';
      editedInput.type = 'number';
      editedInput.min = '1';
      editedInput.placeholder = '번호';
      const editedButton = document.createElement('button');
      editedButton.id = 'pdfEditedPageJumpButton';
      editedButton.type = 'button';
      editedButton.textContent = '이동';
      editedRow.append(editedLabel, editedInput, editedButton);

      const originalRow = document.createElement('div');
      originalRow.className = 'pdf-file-nav-row original';
      const fileSelect = document.createElement('select');
      fileSelect.id = 'pdfOriginalFileJump';
      fileSelect.setAttribute('aria-label', '원본 PDF 파일');
      const originalInput = document.createElement('input');
      originalInput.id = 'pdfOriginalPageJump';
      originalInput.type = 'number';
      originalInput.min = '1';
      originalInput.placeholder = '원본쪽';
      const originalButton = document.createElement('button');
      originalButton.id = 'pdfOriginalPageJumpButton';
      originalButton.type = 'button';
      originalButton.textContent = '이동';
      originalRow.append(fileSelect, originalInput, originalButton);

      const actions = document.createElement('div');
      actions.className = 'pdf-file-nav-actions';
      const collapse = document.createElement('button');
      collapse.id = 'pdfCollapseAllFiles';
      collapse.type = 'button';
      collapse.textContent = '모두 접기';
      const expand = document.createElement('button');
      expand.id = 'pdfExpandAllFiles';
      expand.type = 'button';
      expand.textContent = '모두 펼치기';
      actions.append(collapse, expand);

      const status = document.createElement('div');
      status.id = 'pdfFileNavigationStatus';
      status.className = 'pdf-file-nav-status';
      status.setAttribute('role', 'status');
      status.setAttribute('aria-live', 'polite');
      status.textContent = '편집 페이지 또는 원본 파일의 페이지 번호로 이동합니다.';

      toolbar.append(editedRow, originalRow, actions, status);
      area.parentElement.insertBefore(toolbar, area);
      editedButton.addEventListener('click', () => jumpEdited());
      originalButton.addEventListener('click', () => jumpOriginal());
      editedInput.addEventListener('keydown', (event) => {
        if (event.key === 'Enter') { event.preventDefault(); jumpEdited(); }
      });
      originalInput.addEventListener('keydown', (event) => {
        if (event.key === 'Enter') { event.preventDefault(); jumpOriginal(); }
      });
      collapse.addEventListener('click', collapseAll);
      expand.addEventListener('click', expandAll);
    }

    const select = byId('pdfOriginalFileJump');
    if (select) {
      const previous = select.value;
      select.replaceChildren();
      for (const group of groups.values()) {
        const option = document.createElement('option');
        option.value = String(group.fileIndex);
        option.textContent = `${group.fileIndex + 1}. ${group.name}`;
        select.appendChild(option);
      }
      if ([...select.options].some((option) => option.value === previous)) select.value = previous;
    }
    if (byId('pdfEditedPageJump')) byId('pdfEditedPageJump').max = String(Math.max(1, parsedPages.length));
    return toolbar;
  }

  function setStatus(message, level = 'normal') {
    const status = byId('pdfFileNavigationStatus');
    if (!status) return;
    status.textContent = message;
    status.dataset.level = level;
    status.style.color = level === 'error' ? '#b91c1c' : level === 'success' ? '#166534' : '#64748b';
  }

  function pageForItem(item) {
    const id = String(item?.dataset?.id || '');
    return parsedPages.find((page) => pageId(page) === id) || null;
  }

  function findItem(page) {
    const id = pageId(page);
    return [...(byId('thumbArea')?.querySelectorAll('.thumb-item') || [])]
      .find((item) => String(item.dataset.id) === id) || null;
  }

  function syntheticHeader(group) {
    const header = document.createElement('div');
    header.className = 'thumb-file-sep pdf-file-nav-single-header';
    const label = document.createElement('div');
    label.className = 'thumb-file-sep-label';
    label.textContent = group.name;
    header.appendChild(label);
    return header;
  }

  function decorateHeader(header, group) {
    header.dataset.fileNavHeader = 'true';
    header.dataset.fileIndex = group.key;
    header.querySelectorAll('.pdf-file-nav-toggle,.pdf-file-nav-meta').forEach((node) => node.remove());
    const toggle = document.createElement('button');
    toggle.type = 'button';
    toggle.className = 'pdf-file-nav-toggle';
    toggle.textContent = '▾';
    toggle.title = `${group.name} 접기 또는 펼치기`;
    toggle.setAttribute('aria-label', `${group.name} 접기 또는 펼치기`);
    toggle.addEventListener('click', (event) => {
      event.preventDefault();
      event.stopPropagation();
      toggleFile(group.key);
    });
    const meta = document.createElement('span');
    meta.className = 'pdf-file-nav-meta';
    meta.textContent = group.summary;
    meta.title = `${group.name} · ${group.summary}`;
    const label = header.querySelector('.thumb-file-sep-label');
    header.insertBefore(toggle, header.firstChild);
    if (label?.nextSibling) header.insertBefore(meta, label.nextSibling);
    else header.appendChild(meta);
  }

  function applyCollapsedState(groups) {
    const area = byId('thumbArea');
    if (!area) return;
    area.querySelectorAll('.thumb-item').forEach((item) => {
      const page = pageForItem(item);
      if (!page || page.file_index === undefined || page.file_index === null) return;
      const collapsed = collapsedFiles.has(fileKey(page.file_index));
      item.hidden = collapsed;
      item.dataset.fileCollapsed = collapsed ? 'true' : 'false';
    });
    area.querySelectorAll('[data-file-nav-header="true"]').forEach((header) => {
      const collapsed = collapsedFiles.has(String(header.dataset.fileIndex));
      header.dataset.collapsed = collapsed ? 'true' : 'false';
      const button = header.querySelector('.pdf-file-nav-toggle');
      if (button) button.setAttribute('aria-expanded', collapsed ? 'false' : 'true');
    });
    const total = groups.size;
    const collapsed = [...groups.keys()].filter((key) => collapsedFiles.has(key)).length;
    if (byId('pdfCollapseAllFiles')) byId('pdfCollapseAllFiles').disabled = total === 0 || collapsed === total;
    if (byId('pdfExpandAllFiles')) byId('pdfExpandAllFiles').disabled = collapsed === 0;
  }

  function enhance() {
    enhanceFrame = 0;
    if (enhancing) return false;
    const area = byId('thumbArea');
    if (!area) return false;
    enhancing = true;
    try {
      installStyles();
      const groups = buildFileGroups();
      ensureToolbar(groups);
      area.querySelectorAll('.pdf-file-nav-single-header').forEach((header) => header.remove());

      const items = [...area.querySelectorAll('.thumb-item')];
      items.forEach((item) => {
        const page = pageForItem(item);
        if (page?.file_index !== undefined && page?.file_index !== null) {
          item.dataset.fileIndex = fileKey(page.file_index);
        }
        item.dataset.fileNavCurrent = pageId(page) === selectedPageId ? 'true' : 'false';
      });

      const existingHeaders = [...area.querySelectorAll('.thumb-file-sep')];
      const decoratedKeys = new Set();
      for (const header of existingHeaders) {
        let cursor = header.nextElementSibling;
        while (cursor && !cursor.classList.contains('thumb-item')) cursor = cursor.nextElementSibling;
        const page = pageForItem(cursor);
        const key = page?.file_index === undefined || page?.file_index === null ? '' : fileKey(page.file_index);
        const group = groups.get(key);
        if (!group) continue;
        decorateHeader(header, group);
        decoratedKeys.add(key);
      }

      for (const group of groups.values()) {
        if (decoratedKeys.has(group.key)) continue;
        const firstItem = items.find((item) => String(item.dataset.fileIndex) === group.key);
        if (!firstItem) continue;
        const header = syntheticHeader(group);
        firstItem.parentElement.insertBefore(header, firstItem);
        decorateHeader(header, group);
      }
      applyCollapsedState(groups);
      return true;
    } finally {
      enhancing = false;
    }
  }

  function queueEnhance() {
    if (enhanceFrame || enhancing) return;
    enhanceFrame = requestAnimationFrame(enhance);
  }

  function toggleFile(key) {
    const normalized = String(key);
    if (collapsedFiles.has(normalized)) collapsedFiles.delete(normalized);
    else collapsedFiles.add(normalized);
    applyCollapsedState(buildFileGroups());
  }

  function collapseAll() {
    for (const key of buildFileGroups().keys()) collapsedFiles.add(key);
    applyCollapsedState(buildFileGroups());
    setStatus('모든 원본 파일 페이지를 접었습니다.', 'success');
  }

  function expandAll() {
    collapsedFiles.clear();
    applyCollapsedState(buildFileGroups());
    setStatus('모든 원본 파일 페이지를 펼쳤습니다.', 'success');
  }

  async function showOutputForPage(page) {
    const lazy = window.PdfViewportLazyPreview;
    try {
      const descriptors = lazy?.buildOutputDescriptors?.();
      const index = lazy?.descriptorIndexForPage?.(page, descriptors);
      if (Array.isArray(descriptors) && index >= 0 && lazy?.isActive?.(descriptors)) {
        await lazy.requestRender(index);
        return;
      }
      if (typeof triggerPreview === 'function') await triggerPreview();
      requestAnimationFrame(() => {
        const allDescriptors = lazy?.buildOutputDescriptors?.() || [];
        const outputIndex = lazy?.descriptorIndexForPage?.(page, allDescriptors);
        const previews = document.querySelectorAll('#previewScroll .page-preview');
        previews[outputIndex >= 0 ? outputIndex : 0]?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      });
    } catch (error) {
      console.warn('[pdf-file-navigation] preview navigation failed', error);
    }
  }

  async function navigateToPage(page, label) {
    if (!page) return false;
    if (page.file_index !== undefined && page.file_index !== null) collapsedFiles.delete(fileKey(page.file_index));
    selectedPageId = pageId(page);
    enhance();
    const item = findItem(page);
    if (item) {
      item.hidden = false;
      item.dataset.fileNavCurrent = 'true';
      item.scrollIntoView({ behavior: 'smooth', block: 'center' });
      item.querySelector('.thumb-wrap')?.focus?.({ preventScroll: true });
    }
    await showOutputForPage(page);
    const editedOrdinal = parsedPages.indexOf(page) + 1;
    const originalOrdinal = Number.isFinite(Number(page.page_index)) ? Number(page.page_index) + 1 : null;
    setStatus(`${label} · 편집 ${editedOrdinal}쪽${originalOrdinal ? ` · 원본 ${originalOrdinal}쪽` : ''}`, page.excluded ? 'error' : 'success');
    return true;
  }

  function jumpEdited() {
    const input = byId('pdfEditedPageJump');
    const page = editedPageAt(input?.value);
    if (!page) {
      setStatus(`편집 페이지는 1–${parsedPages.length} 범위로 입력해 주세요.`, 'error');
      return false;
    }
    return navigateToPage(page, '편집 페이지 이동');
  }

  function jumpOriginal() {
    const fileIndex = Number(byId('pdfOriginalFileJump')?.value);
    const original = Number(byId('pdfOriginalPageJump')?.value);
    const page = originalPageAt(fileIndex, original);
    if (!page) {
      const group = buildFileGroups().get(fileKey(fileIndex));
      setStatus(`${group?.name || '선택한 파일'}의 원본 ${original || '?'}페이지가 현재 작업에 없습니다.`, 'error');
      return false;
    }
    return navigateToPage(page, '원본 페이지 이동');
  }

  function wrapRenderThumbs() {
    if (typeof renderThumbs !== 'function') return false;
    if (renderThumbs.__pdfFileNavigationV1) return true;
    const previous = renderThumbs;
    const wrapped = function renderThumbsWithFileNavigation(...args) {
      const result = previous.apply(this, args);
      queueEnhance();
      return result;
    };
    wrapped.__pdfFileNavigationV1 = true;
    wrapped.__pdfFileNavigationDelegate = previous;
    renderThumbs = wrapped;
    window.renderThumbs = wrapped;
    return true;
  }

  function installObserver() {
    const area = byId('thumbArea');
    if (!area || typeof MutationObserver !== 'function') return false;
    observer?.disconnect?.();
    observer = new MutationObserver(queueEnhance);
    observer.observe(area, { childList: true, subtree: false });
    return true;
  }

  function install() {
    wrapRenderThumbs();
    installObserver();
    enhance();
    if (!installed) {
      installed = true;
      document.addEventListener('pdf-import-committed', () => {
        selectedPageId = '';
        queueEnhance();
      });
      document.addEventListener('pdf-import-failed', queueEnhance);
    }
  }

  window.PdfFileNavigation = {
    uniqueSorted,
    compactRanges,
    buildFileGroups,
    editedPageAt,
    originalPageAt,
    enhance,
    toggleFile,
    collapseAll,
    expandAll,
    navigateToPage,
    jumpEdited,
    jumpOriginal,
    getCollapsedFiles: () => new Set(collapsedFiles),
    stage: 'file-collapse-edited-original-page-jump',
  };

  for (const delay of INSTALL_DELAYS) setTimeout(install, delay);
})();
