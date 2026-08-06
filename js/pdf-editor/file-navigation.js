// Compact file grouping and page jump tools for the PDF editor thumbnail list.
(function () {
  'use strict';
  if (window.__pdfFileNavigationV1) return;
  window.__pdfFileNavigationV1 = true;
  if (!location.pathname.includes('pdf-editor')) return;

  const INSTALL_DELAYS = [0, 180, 420, 800, 1400, 2300, 3600];
  const collapsed = new Set();
  let observer = null;
  let enhancing = false;
  let frame = 0;
  let selectedId = '';
  let installed = false;

  const byId = (id) => document.getElementById(id);
  const keyOf = (value) => String(Number(value));
  const idOf = (page) => String(page?.id ?? '');

  function uniqueNumbers(values) {
    return [...new Set((values || []).map(Number).filter(Number.isFinite))].sort((a, b) => a - b);
  }

  function compactRanges(values, maxRanges = 2) {
    const numbers = uniqueNumbers(values);
    if (!numbers.length) return '없음';
    const ranges = [];
    let start = numbers[0];
    let end = start;
    for (let index = 1; index < numbers.length; index += 1) {
      if (numbers[index] === end + 1) end = numbers[index];
      else { ranges.push([start, end]); start = numbers[index]; end = start; }
    }
    ranges.push([start, end]);
    const visible = ranges.slice(0, Math.max(1, maxRanges));
    const label = visible.map(([from, to]) => from === to ? String(from) : `${from}–${to}`).join(', ');
    return ranges.length > visible.length ? `${label} 외 ${ranges.length - visible.length}구간` : label;
  }

  function buildFileGroups(pages = parsedPages, files = uploadedFiles) {
    const groups = new Map();
    (pages || []).forEach((page, editedIndex) => {
      const fileIndex = Number(page?.file_index);
      if (!Number.isInteger(fileIndex) || fileIndex < 0) return;
      const key = keyOf(fileIndex);
      if (!groups.has(key)) {
        groups.set(key, {
          key,
          fileIndex,
          name: String(page.sourceFile || files?.[fileIndex]?.name || `파일 ${fileIndex + 1}`),
          pages: [], edited: [], originals: [], excluded: 0, segments: 0,
        });
      }
      const group = groups.get(key);
      group.pages.push(page);
      group.edited.push(editedIndex + 1);
      if (Number.isFinite(Number(page.page_index))) group.originals.push(Number(page.page_index) + 1);
      if (page.excluded) group.excluded += 1;
    });
    for (const group of groups.values()) {
      const edited = uniqueNumbers(group.edited);
      group.segments = edited.length ? 1 : 0;
      for (let index = 1; index < edited.length; index += 1) {
        if (edited[index] !== edited[index - 1] + 1) group.segments += 1;
      }
      group.editedRange = compactRanges(group.edited);
      group.originalRange = compactRanges(group.originals);
      group.summary = `편집 ${group.editedRange} · 원본 ${group.originalRange} · ${group.pages.length}쪽${group.excluded ? ` · 숨김 ${group.excluded}` : ''}`;
    }
    return groups;
  }

  function editedPageAt(value, pages = parsedPages) {
    const index = Math.floor(Number(value)) - 1;
    return index >= 0 && index < (pages || []).length ? pages[index] : null;
  }

  function originalPageAt(fileIndex, value, pages = parsedPages) {
    const file = Number(fileIndex);
    const pageIndex = Math.floor(Number(value)) - 1;
    if (!Number.isInteger(file) || pageIndex < 0) return null;
    return (pages || []).find((page) => Number(page?.file_index) === file && Number(page?.page_index) === pageIndex) || null;
  }

  function installStyles() {
    if (byId('pdfFileNavigationStyles')) return;
    const style = document.createElement('style');
    style.id = 'pdfFileNavigationStyles';
    style.textContent = `
      .pdf-file-nav{position:sticky;top:-1px;z-index:12;display:grid;gap:5px;margin:0 0 7px;padding:7px;border:1px solid #dbe5ee;border-radius:9px;background:rgba(248,250,252,.97);box-shadow:0 3px 8px rgba(15,23,42,.06)}
      .pdf-file-nav-row{display:grid;grid-template-columns:minmax(0,1fr) 60px 42px;gap:4px;align-items:center}
      .pdf-file-nav label{margin:0;font-size:9px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
      .pdf-file-nav input,.pdf-file-nav select{min-width:0;width:100%;height:27px;padding:4px 6px;border:1px solid #cbd5e1;border-radius:6px;background:#fff;font:inherit;font-size:9px;font-weight:750}
      .pdf-file-nav button{height:27px;border:1px solid #93c5fd;border-radius:6px;background:#eff6ff;color:#1d4ed8;font:inherit;font-size:9px;font-weight:850;cursor:pointer}
      .pdf-file-nav-actions{display:flex;gap:4px}.pdf-file-nav-actions button{flex:1;border-color:#cbd5e1;background:#fff;color:#475569}
      .pdf-file-nav-status{min-height:12px;font-size:8px;font-weight:750;color:#64748b;line-height:1.35}
      .thumb-file-sep[data-file-nav-header="true"]{gap:5px;padding:6px 5px;margin-top:2px;border:1px solid #ddd6fe;border-radius:7px;background:#faf8ff}
      .thumb-file-sep[data-file-nav-header="true"] .thumb-file-sep-line{display:none}
      .thumb-file-sep[data-file-nav-header="true"] .thumb-file-sep-label{max-width:105px;overflow:hidden;text-overflow:ellipsis;font-size:9px}
      .pdf-file-nav-toggle{flex:0 0 24px;width:24px;height:24px;border:1px solid #c4b5fd;border-radius:6px;background:#fff;color:#6d28d9;font:inherit;font-size:11px;font-weight:900;cursor:pointer}
      .thumb-file-sep[data-collapsed="true"] .pdf-file-nav-toggle{transform:rotate(-90deg)}
      .pdf-file-nav-meta{min-width:0;flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:#64748b;font-size:8px;font-weight:750}
      .thumb-item[data-file-nav-current="true"] .thumb-wrap{border-color:#2563eb!important;box-shadow:0 0 0 2px rgba(37,99,235,.18)}
      @media(max-width:430px){.pdf-file-nav-row{grid-template-columns:minmax(0,1fr) 52px 40px}.pdf-file-nav-meta{display:none}}
    `;
    document.head.appendChild(style);
  }

  function setStatus(message, level = 'normal') {
    const status = byId('pdfFileNavigationStatus');
    if (!status) return;
    status.textContent = message;
    status.dataset.level = level;
    status.style.color = level === 'error' ? '#b91c1c' : level === 'success' ? '#166534' : '#64748b';
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

      const edited = document.createElement('div'); edited.className = 'pdf-file-nav-row';
      const editedLabel = document.createElement('label'); editedLabel.htmlFor = 'pdfEditedPageJump'; editedLabel.textContent = '편집 페이지';
      const editedInput = document.createElement('input'); editedInput.id = 'pdfEditedPageJump'; editedInput.type = 'number'; editedInput.min = '1'; editedInput.placeholder = '번호';
      const editedButton = document.createElement('button'); editedButton.id = 'pdfEditedPageJumpButton'; editedButton.type = 'button'; editedButton.textContent = '이동';
      edited.append(editedLabel, editedInput, editedButton);

      const original = document.createElement('div'); original.className = 'pdf-file-nav-row';
      const select = document.createElement('select'); select.id = 'pdfOriginalFileJump'; select.setAttribute('aria-label', '원본 PDF 파일');
      const originalInput = document.createElement('input'); originalInput.id = 'pdfOriginalPageJump'; originalInput.type = 'number'; originalInput.min = '1'; originalInput.placeholder = '원본쪽';
      const originalButton = document.createElement('button'); originalButton.id = 'pdfOriginalPageJumpButton'; originalButton.type = 'button'; originalButton.textContent = '이동';
      original.append(select, originalInput, originalButton);

      const actions = document.createElement('div'); actions.className = 'pdf-file-nav-actions';
      const collapseButton = document.createElement('button'); collapseButton.id = 'pdfCollapseAllFiles'; collapseButton.type = 'button'; collapseButton.textContent = '모두 접기';
      const expandButton = document.createElement('button'); expandButton.id = 'pdfExpandAllFiles'; expandButton.type = 'button'; expandButton.textContent = '모두 펼치기';
      actions.append(collapseButton, expandButton);

      const status = document.createElement('div'); status.id = 'pdfFileNavigationStatus'; status.className = 'pdf-file-nav-status'; status.setAttribute('role', 'status'); status.setAttribute('aria-live', 'polite'); status.textContent = '편집 페이지 또는 원본 페이지로 이동합니다.';
      toolbar.append(edited, original, actions, status);
      area.parentElement.insertBefore(toolbar, area);

      editedButton.addEventListener('click', jumpEdited);
      originalButton.addEventListener('click', jumpOriginal);
      editedInput.addEventListener('keydown', (event) => { if (event.key === 'Enter') { event.preventDefault(); jumpEdited(); } });
      originalInput.addEventListener('keydown', (event) => { if (event.key === 'Enter') { event.preventDefault(); jumpOriginal(); } });
      collapseButton.addEventListener('click', collapseAll);
      expandButton.addEventListener('click', expandAll);
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
      const options = [...select.querySelectorAll('option')];
      if (options.some((option) => option.value === previous)) select.value = previous;
    }
    const editedInput = byId('pdfEditedPageJump');
    if (editedInput) editedInput.max = String(Math.max(1, parsedPages.length));
    return toolbar;
  }

  function pageForItem(item) {
    const id = String(item?.dataset?.id || '');
    return parsedPages.find((page) => idOf(page) === id) || null;
  }

  function findItem(page) {
    const id = idOf(page);
    return [...(byId('thumbArea')?.querySelectorAll('.thumb-item') || [])].find((item) => String(item.dataset.id) === id) || null;
  }

  function syntheticHeader(group) {
    const header = document.createElement('div'); header.className = 'thumb-file-sep pdf-file-nav-single-header';
    const label = document.createElement('div'); label.className = 'thumb-file-sep-label'; label.textContent = group.name;
    header.appendChild(label);
    return header;
  }

  function decorateHeader(header, group) {
    header.dataset.fileNavHeader = 'true';
    header.dataset.fileIndex = group.key;
    header.querySelectorAll('.pdf-file-nav-toggle,.pdf-file-nav-meta').forEach((node) => node.remove());
    const toggle = document.createElement('button'); toggle.type = 'button'; toggle.className = 'pdf-file-nav-toggle'; toggle.textContent = '▾'; toggle.title = `${group.name} 접기 또는 펼치기`; toggle.setAttribute('aria-label', toggle.title);
    toggle.addEventListener('click', (event) => { event.preventDefault(); event.stopPropagation(); toggleFile(group.key); });
    const meta = document.createElement('span'); meta.className = 'pdf-file-nav-meta'; meta.textContent = group.summary; meta.title = `${group.name} · ${group.summary}`;
    const label = header.querySelector('.thumb-file-sep-label');
    header.insertBefore(toggle, header.firstChild);
    if (label?.nextSibling) header.insertBefore(meta, label.nextSibling); else header.appendChild(meta);
  }

  function applyCollapsed(groups = buildFileGroups()) {
    const area = byId('thumbArea');
    if (!area) return;
    area.querySelectorAll('.thumb-item').forEach((item) => {
      const page = pageForItem(item);
      if (!page || !Number.isInteger(Number(page.file_index))) return;
      const hidden = collapsed.has(keyOf(page.file_index));
      item.hidden = hidden;
      item.dataset.fileCollapsed = hidden ? 'true' : 'false';
    });
    area.querySelectorAll('[data-file-nav-header="true"]').forEach((header) => {
      const hidden = collapsed.has(String(header.dataset.fileIndex));
      header.dataset.collapsed = hidden ? 'true' : 'false';
      header.querySelector('.pdf-file-nav-toggle')?.setAttribute('aria-expanded', hidden ? 'false' : 'true');
    });
    const collapsedCount = [...groups.keys()].filter((key) => collapsed.has(key)).length;
    if (byId('pdfCollapseAllFiles')) byId('pdfCollapseAllFiles').disabled = groups.size === 0 || collapsedCount === groups.size;
    if (byId('pdfExpandAllFiles')) byId('pdfExpandAllFiles').disabled = collapsedCount === 0;
  }

  function reconnectObserver(area) {
    if (!observer || !area) return;
    observer.observe(area, { childList: true, subtree: false });
  }

  function enhance() {
    frame = 0;
    if (enhancing) return false;
    const area = byId('thumbArea');
    if (!area) return false;
    enhancing = true;
    observer?.disconnect?.();
    try {
      installStyles();
      const groups = buildFileGroups();
      ensureToolbar(groups);
      area.querySelectorAll('.pdf-file-nav-single-header').forEach((header) => header.remove());
      const items = [...area.querySelectorAll('.thumb-item')];
      items.forEach((item) => {
        const page = pageForItem(item);
        if (page && Number.isInteger(Number(page.file_index))) item.dataset.fileIndex = keyOf(page.file_index);
        item.dataset.fileNavCurrent = idOf(page) === selectedId ? 'true' : 'false';
      });

      const decorated = new Set();
      for (const header of area.querySelectorAll('.thumb-file-sep')) {
        let cursor = header.nextElementSibling;
        while (cursor && !cursor.classList.contains('thumb-item')) cursor = cursor.nextElementSibling;
        const page = pageForItem(cursor);
        const group = page ? groups.get(keyOf(page.file_index)) : null;
        if (!group) continue;
        decorateHeader(header, group);
        decorated.add(group.key);
      }
      for (const group of groups.values()) {
        if (decorated.has(group.key)) continue;
        const first = items.find((item) => item.dataset.fileIndex === group.key);
        if (!first) continue;
        const header = syntheticHeader(group);
        first.parentElement.insertBefore(header, first);
        decorateHeader(header, group);
      }
      applyCollapsed(groups);
      return true;
    } finally {
      enhancing = false;
      reconnectObserver(area);
    }
  }

  function queueEnhance() {
    if (frame || enhancing) return;
    frame = requestAnimationFrame(enhance);
  }

  function toggleFile(key) {
    const normalized = String(key);
    if (collapsed.has(normalized)) collapsed.delete(normalized); else collapsed.add(normalized);
    applyCollapsed();
  }

  function collapseAll() {
    for (const key of buildFileGroups().keys()) collapsed.add(key);
    applyCollapsed();
    setStatus('모든 원본 파일 페이지를 접었습니다.', 'success');
  }

  function expandAll() {
    collapsed.clear();
    applyCollapsed();
    setStatus('모든 원본 파일 페이지를 펼쳤습니다.', 'success');
  }

  async function showOutput(page) {
    const lazy = window.PdfViewportLazyPreview;
    try {
      const descriptors = lazy?.buildOutputDescriptors?.() || [];
      const outputIndex = lazy?.descriptorIndexForPage?.(page, descriptors);
      if (outputIndex >= 0 && lazy?.isActive?.(descriptors)) {
        await lazy.requestRender(outputIndex);
        return;
      }
      if (typeof triggerPreview === 'function') await triggerPreview();
      requestAnimationFrame(() => {
        const previews = document.querySelectorAll('#previewScroll .page-preview');
        previews[outputIndex >= 0 ? outputIndex : 0]?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      });
    } catch (error) {
      console.warn('[pdf-file-navigation] preview navigation failed', error);
    }
  }

  async function navigateToPage(page, label = '페이지 이동') {
    if (!page) return false;
    if (Number.isInteger(Number(page.file_index))) collapsed.delete(keyOf(page.file_index));
    selectedId = idOf(page);
    enhance();
    const item = findItem(page);
    if (item) {
      item.hidden = false;
      item.dataset.fileNavCurrent = 'true';
      item.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
    await showOutput(page);
    const edited = parsedPages.indexOf(page) + 1;
    const original = Number.isFinite(Number(page.page_index)) ? Number(page.page_index) + 1 : null;
    setStatus(`${label} · 편집 ${edited}쪽${original ? ` · 원본 ${original}쪽` : ''}${page.excluded ? ' · 숨김 페이지' : ''}`, page.excluded ? 'error' : 'success');
    return true;
  }

  function jumpEdited() {
    const page = editedPageAt(byId('pdfEditedPageJump')?.value);
    if (!page) {
      setStatus(`편집 페이지는 1–${parsedPages.length} 범위로 입력해 주세요.`, 'error');
      return false;
    }
    return navigateToPage(page, '편집 페이지 이동');
  }

  function jumpOriginal() {
    const fileIndex = Number(byId('pdfOriginalFileJump')?.value);
    const ordinal = Number(byId('pdfOriginalPageJump')?.value);
    const page = originalPageAt(fileIndex, ordinal);
    if (!page) {
      const group = buildFileGroups().get(keyOf(fileIndex));
      setStatus(`${group?.name || '선택한 파일'}의 원본 ${ordinal || '?'}페이지가 현재 작업에 없습니다.`, 'error');
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
    reconnectObserver(area);
    return true;
  }

  function install() {
    installStyles();
    wrapRenderThumbs();
    installObserver();
    enhance();
    if (!installed) {
      installed = true;
      document.addEventListener('pdf-import-committed', () => { selectedId = ''; queueEnhance(); });
      document.addEventListener('pdf-import-failed', queueEnhance);
    }
  }

  window.PdfFileNavigation = {
    uniqueNumbers,
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
    getCollapsedFiles: () => new Set(collapsed),
    stage: 'file-collapse-edited-original-page-jump',
  };

  for (const delay of INSTALL_DELAYS) setTimeout(install, delay);
})();
