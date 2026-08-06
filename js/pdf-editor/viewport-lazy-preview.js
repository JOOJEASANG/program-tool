// Windowed work preview for large PDF jobs. Final PDF generation remains unchanged.
(function () {
  'use strict';
  if (window.__pdfViewportLazyPreviewV1) return;
  window.__pdfViewportLazyPreviewV1 = true;
  if (!location.pathname.includes('pdf-editor')) return;

  const ACTIVE_OUTPUT_THRESHOLD = 80;
  const WINDOW_RADIUS = 3;
  const EXTREME_WINDOW_RADIUS = 2;
  const EDGE_SCROLL_STEP = 3;
  const PREVIEW_PPM = 96 / 25.4;
  const INSTALL_DELAYS = [0, 180, 420, 800, 1300, 2100, 3300, 5000];

  let coordinatorInstalled = false;
  let selectedPageId = '';
  let currentOutputIndex = 0;
  let currentWindow = { start: 0, end: 0, total: 0 };
  let renderPromise = null;
  let queuedOutputIndex = null;
  let lastDescriptors = [];
  let scrollLockedUntil = 0;

  const byId = (id) => document.getElementById(id);
  const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
  const nextPaint = () => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));

  function activePages() {
    try { return parsedPages.filter((page) => !page.excluded); }
    catch (_) { return []; }
  }

  function arrangedPages() {
    const active = activePages();
    try {
      const booklet = Boolean(byId('bookletCheck')?.checked)
        && typeof BOOKLET_STRIPS !== 'undefined'
        && typeof nup !== 'undefined'
        && nup in BOOKLET_STRIPS;
      if (booklet && typeof bookletReorderPreview === 'function') {
        return bookletReorderPreview(active, nup) || active;
      }
    } catch (error) {
      console.warn('[lazy-preview] booklet order unavailable', error);
    }
    return active;
  }

  function buildOutputDescriptors(sourcePages = arrangedPages()) {
    if (typeof groupByNup !== 'function' || typeof getLayout !== 'function') return [];
    const descriptors = [];
    const groups = groupByNup(sourcePages);
    for (let groupIndex = 0; groupIndex < groups.length; groupIndex += 1) {
      const group = groups[groupIndex];
      const layout = getLayout(group.n);
      const cols = Math.max(1, Number(layout?.cols || 1));
      const rows = Math.max(1, Number(layout?.rows || 1));
      const perPage = cols * rows;
      const outputCount = Math.ceil(group.pages.length / perPage);
      for (let pageIndex = 0; pageIndex < outputCount; pageIndex += 1) {
        const start = pageIndex * perPage;
        descriptors.push({
          outputIndex: descriptors.length,
          groupIndex,
          pageIndex,
          cols,
          rows,
          perPage,
          n: group.n,
          groupPages: group.pages,
          sourcePages: group.pages.slice(start, start + perPage),
        });
      }
    }
    return descriptors;
  }

  function chooseWindow(total, center, radius = WINDOW_RADIUS) {
    const safeTotal = Math.max(0, Number(total || 0));
    if (!safeTotal) return { start: 0, end: 0, center: 0, total: 0 };
    const safeRadius = Math.max(0, Math.floor(Number(radius || 0)));
    const size = Math.min(safeTotal, safeRadius * 2 + 1);
    const safeCenter = clamp(Math.floor(Number(center || 0)), 0, safeTotal - 1);
    let start = clamp(safeCenter - safeRadius, 0, Math.max(0, safeTotal - size));
    let end = Math.min(safeTotal, start + size);
    if (end - start < size) start = Math.max(0, end - size);
    return { start, end, center: safeCenter, total: safeTotal };
  }

  function descriptorIndexForPage(page, descriptors = lastDescriptors) {
    if (!page) return -1;
    return descriptors.findIndex((descriptor) => descriptor.sourcePages.includes(page));
  }

  function selectedPageFromDom() {
    try {
      if (selectedPageId) {
        const remembered = parsedPages.find((page) => String(page.id) === String(selectedPageId));
        if (remembered && !remembered.excluded) return remembered;
      }
      const wrap = document.querySelector('#thumbArea .thumb-wrap[data-sidebar-current="true"]');
      const id = wrap?.closest('.thumb-item')?.dataset?.id;
      if (id) {
        const page = parsedPages.find((item) => String(item.id) === String(id));
        if (page && !page.excluded) return page;
      }
    } catch (_) {}
    return activePages()[0] || null;
  }

  function isLightweightPage(page) {
    return Boolean(
      page?.lightweight
      || page?.pdfPage?.__lightweightPdfPage
      || page?.thumbCanvas?.dataset?.lightweightPage === '1',
    );
  }

  function isActive(descriptors = null) {
    let count = 0;
    try { count = Array.isArray(descriptors) ? descriptors.length : buildOutputDescriptors().length; }
    catch (_) { return false; }
    return Boolean(window.__pdfEditorFastMode || window.__pdfEditorExtremeMode || count > ACTIVE_OUTPUT_THRESHOLD);
  }

  function installStyles() {
    if (byId('pdfViewportLazyPreviewStyles')) return;
    const style = document.createElement('style');
    style.id = 'pdfViewportLazyPreviewStyles';
    style.textContent = `
      #pdfLazyPreviewNav{display:none;align-items:center;gap:6px;padding:7px 9px;border:1px solid #dbe5ee;border-radius:9px;background:#f8fafc;flex-wrap:wrap}
      #pdfLazyPreviewNav[data-active="true"]{display:flex}
      #pdfLazyPreviewNav button{border:1px solid #cbd5e1;border-radius:7px;background:#fff;color:#334155;padding:5px 9px;font:inherit;font-size:10px;font-weight:850;cursor:pointer}
      #pdfLazyPreviewNav button:disabled{opacity:.42;cursor:not-allowed}
      #pdfLazyPreviewNav input{width:68px;border:1px solid #cbd5e1;border-radius:7px;padding:5px 7px;font:inherit;font-size:10px;font-weight:800;text-align:center;background:#fff}
      #pdfLazyPreviewNav .lazy-preview-count{font-size:10px;font-weight:850;color:#475569;white-space:nowrap}
      #pdfLazyPreviewNav .lazy-preview-range{margin-left:auto;font-size:9px;font-weight:750;color:#64748b;white-space:nowrap}
      #previewScroll[data-lazy-preview="true"] .page-preview{position:relative}
      #previewScroll[data-lazy-preview="true"] .page-preview[data-lazy-selected="true"]{outline:3px solid #2563eb;outline-offset:3px}
      .lazy-preview-face-label{position:absolute;top:5px;right:5px;z-index:3;border-radius:999px;padding:3px 7px;background:rgba(15,23,42,.82);color:#fff;font-size:9px;font-weight:850;pointer-events:none}
      .lazy-preview-source-note{position:absolute;left:5px;bottom:5px;z-index:3;max-width:calc(100% - 10px);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;border-radius:5px;padding:3px 6px;background:rgba(255,255,255,.9);color:#475569;font-size:8px;font-weight:750;pointer-events:none}
      @media(max-width:700px){#pdfLazyPreviewNav .lazy-preview-range{width:100%;margin-left:0}}
    `;
    document.head.appendChild(style);
  }

  function ensureNavigation() {
    let nav = byId('pdfLazyPreviewNav');
    if (nav) return nav;
    const scroll = byId('previewScroll');
    if (!scroll?.parentElement) return null;
    nav = document.createElement('div');
    nav.id = 'pdfLazyPreviewNav';
    nav.setAttribute('role', 'navigation');
    nav.setAttribute('aria-label', '대용량 PDF 작업 미리보기 이동');

    const previous = document.createElement('button');
    previous.id = 'pdfLazyPreviewPrevious';
    previous.type = 'button';
    previous.textContent = '‹ 이전';
    previous.addEventListener('click', () => requestRender(Math.max(0, currentOutputIndex - 1)));

    const input = document.createElement('input');
    input.id = 'pdfLazyPreviewOutputNumber';
    input.type = 'number';
    input.min = '1';
    input.step = '1';
    input.setAttribute('aria-label', '이동할 출력면 번호');
    input.addEventListener('change', () => {
      const target = clamp(Math.floor(Number(input.value || 1)) - 1, 0, Math.max(0, currentWindow.total - 1));
      requestRender(target);
    });
    input.addEventListener('keydown', (event) => {
      if (event.key !== 'Enter') return;
      event.preventDefault();
      input.dispatchEvent(new Event('change', { bubbles: true }));
    });

    const count = document.createElement('span');
    count.id = 'pdfLazyPreviewCount';
    count.className = 'lazy-preview-count';
    count.textContent = '/ 0';

    const next = document.createElement('button');
    next.id = 'pdfLazyPreviewNext';
    next.type = 'button';
    next.textContent = '다음 ›';
    next.addEventListener('click', () => requestRender(Math.min(currentWindow.total - 1, currentOutputIndex + 1)));

    const range = document.createElement('span');
    range.id = 'pdfLazyPreviewRange';
    range.className = 'lazy-preview-range';
    range.textContent = '주변 출력면만 표시';

    nav.append(previous, input, count, next, range);
    scroll.parentElement.insertBefore(nav, scroll);
    return nav;
  }

  function updateNavigation(windowRange, selectedIndex) {
    const nav = ensureNavigation();
    if (!nav) return;
    nav.dataset.active = 'true';
    const input = byId('pdfLazyPreviewOutputNumber');
    const previous = byId('pdfLazyPreviewPrevious');
    const next = byId('pdfLazyPreviewNext');
    if (input) {
      input.max = String(Math.max(1, windowRange.total));
      input.value = String(selectedIndex + 1);
    }
    if (byId('pdfLazyPreviewCount')) byId('pdfLazyPreviewCount').textContent = `/ ${windowRange.total}`;
    if (byId('pdfLazyPreviewRange')) {
      byId('pdfLazyPreviewRange').textContent = `${windowRange.start + 1}–${windowRange.end} 출력면 표시 · 전체 저장에는 모두 반영`;
    }
    if (previous) previous.disabled = selectedIndex <= 0;
    if (next) next.disabled = selectedIndex >= windowRange.total - 1;
  }

  function hideNavigation() {
    const nav = byId('pdfLazyPreviewNav');
    if (nav) nav.dataset.active = 'false';
    const scroll = byId('previewScroll');
    if (scroll) delete scroll.dataset.lazyPreview;
    window.__pdfEditorLazyPreviewActive = false;
  }

  function markSelectedThumbnail(page) {
    selectedPageId = page ? String(page.id) : '';
    document.querySelectorAll('#thumbArea .thumb-wrap').forEach((wrap) => {
      const id = wrap.closest('.thumb-item')?.dataset?.id;
      if (page && String(id) === String(page.id)) wrap.dataset.sidebarCurrent = 'true';
      else delete wrap.dataset.sidebarCurrent;
    });
  }

  function errorSourceCanvas(page, message) {
    const canvas = document.createElement('canvas');
    canvas.width = 420;
    canvas.height = 594;
    const context = canvas.getContext('2d', { alpha: false });
    context.fillStyle = '#fff7ed';
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.strokeStyle = '#fb923c';
    context.lineWidth = 4;
    context.strokeRect(8, 8, canvas.width - 16, canvas.height - 16);
    context.fillStyle = '#9a3412';
    context.textAlign = 'center';
    context.font = 'bold 28px sans-serif';
    context.fillText(`원본 ${Number(page?.page_index || 0) + 1}페이지`, canvas.width / 2, 235);
    context.font = '20px sans-serif';
    context.fillText('미리보기를 만들지 못했습니다.', canvas.width / 2, 285);
    context.font = '16px sans-serif';
    const detail = String(message || '').slice(0, 42);
    if (detail) context.fillText(detail, canvas.width / 2, 325);
    canvas.dataset.lazyPreviewError = '1';
    return canvas;
  }

  async function openSourceDocument(fileIndex, cache) {
    if (cache.has(fileIndex)) return cache.get(fileIndex);
    const promise = (async () => {
      const file = uploadedFiles[fileIndex];
      if (!file || typeof file.arrayBuffer !== 'function') throw new Error('원본 PDF 파일을 찾지 못했습니다.');
      const buffer = await file.arrayBuffer();
      const safety = window.PdfImportTransactionSafety;
      if (typeof safety?.safePdfGetDocument === 'function') return safety.safePdfGetDocument(buffer, true);
      return pdfjsLib.getDocument({ data: buffer, disableAutoFetch: true, disableFontFace: true }).promise;
    })();
    cache.set(fileIndex, promise);
    return promise;
  }

  async function hydrateSourcePage(page, documentCache, temporary) {
    if (!isLightweightPage(page) || page?.pageType !== 'pdf') return page;
    try {
      const fileIndex = Number(page.file_index);
      const documentHandle = await openSourceDocument(fileIndex, documentCache);
      const pdfPage = await documentHandle.getPage(Number(page.page_index || 0) + 1);
      const safety = window.PdfImportTransactionSafety;
      const rotation = Number(page.rotation || 0);
      const thumbCanvas = typeof safety?.safeRenderPdfPage === 'function'
        ? await safety.safeRenderPdfPage(pdfPage, 0.62, rotation, true)
        : await renderPdfPage(pdfPage, 0.62, rotation);
      temporary.push({ pdfPage, thumbCanvas });
      return { ...page, pdfPage, thumbCanvas, lightweight: false };
    } catch (error) {
      console.warn('[lazy-preview] original source page hydration failed', error);
      const thumbCanvas = errorSourceCanvas(page, error?.message);
      temporary.push({ pdfPage: null, thumbCanvas });
      return { ...page, thumbCanvas, lightweight: false, lazyPreviewError: true };
    }
  }

  async function buildDescriptorCanvas(descriptor, total, documentCache, temporary) {
    const renderGroup = descriptor.groupPages.slice();
    const start = descriptor.pageIndex * descriptor.perPage;
    for (let offset = 0; offset < descriptor.sourcePages.length; offset += 1) {
      renderGroup[start + offset] = await hydrateSourcePage(
        descriptor.sourcePages[offset],
        documentCache,
        temporary,
      );
    }
    const canvas = buildOutputPage(
      renderGroup,
      descriptor.pageIndex,
      descriptor.cols,
      descriptor.rows,
      PREVIEW_PPM,
      false,
      descriptor.outputIndex,
    );
    try { applyDocEdits(canvas, descriptor.outputIndex, total, PREVIEW_PPM); }
    catch (error) { console.warn('[lazy-preview] document edit overlay failed', error); }
    if (window.PdfPrintMarks?.enabled?.()) {
      return window.PdfPrintMarks.addMarksToCanvas(canvas, PREVIEW_PPM);
    }
    return canvas;
  }

  async function closeSourceDocuments(cache) {
    const handles = await Promise.allSettled([...cache.values()]);
    await Promise.allSettled(handles
      .filter((result) => result.status === 'fulfilled')
      .map((result) => result.value?.destroy?.()));
  }

  function releaseTemporarySources(temporary) {
    for (const item of temporary) {
      try { item.pdfPage?.cleanup?.(); } catch (_) {}
      if (item.thumbCanvas) {
        item.thumbCanvas.width = 1;
        item.thumbCanvas.height = 1;
      }
    }
  }

  function releaseOldPreviewCanvases(previous, current) {
    for (const canvas of previous || []) {
      if (!canvas || current.includes(canvas)) continue;
      canvas.width = 1;
      canvas.height = 1;
    }
  }

  function annotateDisplayedFaces(descriptors, selectedIndex) {
    const nodes = [...document.querySelectorAll('#previewScroll .page-preview')];
    nodes.forEach((node, index) => {
      const descriptor = descriptors[index];
      if (!descriptor) return;
      node.dataset.outputIndex = String(descriptor.outputIndex);
      node.dataset.lazySelected = String(descriptor.outputIndex === selectedIndex);
      const label = document.createElement('span');
      label.className = 'lazy-preview-face-label';
      label.textContent = `출력면 ${descriptor.outputIndex + 1}`;
      node.appendChild(label);
      const names = [...new Set(descriptor.sourcePages
        .map((page) => String(page?.sourceFile || '').trim())
        .filter(Boolean))];
      if (names.length) {
        const note = document.createElement('span');
        note.className = 'lazy-preview-source-note';
        note.textContent = names.join(' · ');
        node.appendChild(note);
      }
    });
    const selected = nodes.find((node) => Number(node.dataset.outputIndex) === selectedIndex);
    selected?.scrollIntoView({ behavior: 'auto', block: 'center', inline: 'center' });
  }

  async function renderLazyWindow(outputIndex = currentOutputIndex) {
    const descriptors = buildOutputDescriptors();
    lastDescriptors = descriptors;
    if (!descriptors.length) {
      hideNavigation();
      return false;
    }
    if (!isActive(descriptors)) {
      hideNavigation();
      return false;
    }

    const selected = selectedPageFromDom();
    const selectedDescriptor = descriptorIndexForPage(selected, descriptors);
    const requested = Number.isFinite(Number(outputIndex))
      ? Number(outputIndex)
      : selectedDescriptor >= 0 ? selectedDescriptor : currentOutputIndex;
    currentOutputIndex = clamp(requested, 0, descriptors.length - 1);
    if (selectedDescriptor >= 0 && outputIndex == null) currentOutputIndex = selectedDescriptor;
    const radius = window.__pdfEditorExtremeMode ? EXTREME_WINDOW_RADIUS : WINDOW_RADIUS;
    const windowRange = chooseWindow(descriptors.length, currentOutputIndex, radius);
    currentWindow = windowRange;
    window.__pdfEditorLazyPreviewActive = true;

    installStyles();
    ensureNavigation();
    updateNavigation(windowRange, currentOutputIndex);
    const visibleDescriptors = descriptors.slice(windowRange.start, windowRange.end);
    const documentCache = new Map();
    const temporary = [];
    const canvases = [];
    const previous = Array.isArray(previewCanvases) ? previewCanvases.slice() : [];

    try {
      if (typeof showStatus === 'function') {
        showStatus(`작업 미리보기 생성 중 · 출력면 ${windowRange.start + 1}–${windowRange.end} / ${windowRange.total}`);
      }
      for (let index = 0; index < visibleDescriptors.length; index += 1) {
        const descriptor = visibleDescriptors[index];
        canvases.push(await buildDescriptorCanvas(
          descriptor,
          descriptors.length,
          documentCache,
          temporary,
        ));
        if (index < visibleDescriptors.length - 1) await nextPaint();
      }
      previewCanvases = canvases;
      displayPreview(canvases, true);
      const scroll = byId('previewScroll');
      if (scroll) scroll.dataset.lazyPreview = 'true';
      annotateDisplayedFaces(visibleDescriptors, currentOutputIndex);
      releaseOldPreviewCanvases(previous, canvases);

      if (byId('previewInfo')) {
        byId('previewInfo').textContent = '대용량 작업 미리보기 · 선택한 페이지 주변만 실제 표시';
      }
      if (byId('previewPages')) {
        byId('previewPages').textContent = `전체 ${descriptors.length}개 중 ${windowRange.start + 1}–${windowRange.end} 출력면`;
      }
      if (byId('previewBtn')) byId('previewBtn').disabled = false;
      if (byId('downloadBtn')) byId('downloadBtn').disabled = parsedPages.length === 0;
      updateNavigation(windowRange, currentOutputIndex);
      scrollLockedUntil = Date.now() + 450;
      if (typeof showStatus === 'function') {
        showStatus(`작업 미리보기 완료 · 출력면 ${currentOutputIndex + 1} / ${descriptors.length}`, 'success');
        if (typeof hideStatus === 'function') setTimeout(hideStatus, 1400);
      }
      return true;
    } finally {
      releaseTemporarySources(temporary);
      await closeSourceDocuments(documentCache);
    }
  }

  function requestRender(outputIndex) {
    queuedOutputIndex = outputIndex;
    if (renderPromise) return renderPromise;
    renderPromise = (async () => {
      let result = false;
      while (queuedOutputIndex !== null) {
        const nextIndex = queuedOutputIndex;
        queuedOutputIndex = null;
        result = await renderLazyWindow(nextIndex);
      }
      return result;
    })().catch((error) => {
      console.error('[lazy-preview] render failed', error);
      if (typeof showStatus === 'function') showStatus(`작업 미리보기 오류: ${error?.message || error}`, 'error');
      return false;
    }).finally(() => { renderPromise = null; });
    return renderPromise;
  }

  function handleThumbnailNavigation(event) {
    if (event.type === 'keydown' && event.key !== 'Enter' && event.key !== ' ') return;
    const wrap = event.target?.closest?.('#thumbArea .thumb-wrap');
    if (!wrap) return;
    const item = wrap.closest('.thumb-item');
    const id = item?.dataset?.id;
    if (!id) return;
    const descriptors = buildOutputDescriptors();
    if (!isActive(descriptors)) return;
    const page = parsedPages.find((entry) => String(entry.id) === String(id));
    if (!page) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    event.stopPropagation();
    if (page.excluded) {
      if (typeof showStatus === 'function') showStatus('숨김 페이지는 미리보기에서 제외됩니다.', 'error');
      return;
    }
    markSelectedThumbnail(page);
    const index = descriptorIndexForPage(page, descriptors);
    if (index >= 0) requestRender(index);
  }

  function handlePreviewWheel(event) {
    if (!window.__pdfEditorLazyPreviewActive || Date.now() < scrollLockedUntil) return;
    const scroll = byId('previewScroll');
    if (!scroll || !scroll.contains(event.target)) return;
    const nearTop = scroll.scrollTop <= 18;
    const nearBottom = scroll.scrollTop + scroll.clientHeight >= scroll.scrollHeight - 18;
    if (event.deltaY > 0 && nearBottom && currentWindow.end < currentWindow.total) {
      event.preventDefault();
      const target = Math.min(currentWindow.total - 1, currentWindow.end + EDGE_SCROLL_STEP - 1);
      requestRender(target);
    } else if (event.deltaY < 0 && nearTop && currentWindow.start > 0) {
      event.preventDefault();
      const target = Math.max(0, currentWindow.start - EDGE_SCROLL_STEP);
      requestRender(target);
    }
  }

  function installCoordinatorDelegate() {
    const ensure = window.__pdfEditorEnsurePreviewCoordinatorV8;
    const coordinator = window.__pdfEditorPreviewCoordinatorV8
      || (typeof ensure === 'function' ? ensure(0) : null);
    if (!coordinator?.setDelegate || !coordinator?.getOriginal) return false;
    const original = coordinator.getOriginal();
    coordinator.setDelegate(async (context, args) => {
      const descriptors = buildOutputDescriptors();
      if (!isActive(descriptors)) {
        hideNavigation();
        return original.apply(context, args);
      }
      const page = selectedPageFromDom();
      const index = descriptorIndexForPage(page, descriptors);
      return requestRender(index >= 0 ? index : currentOutputIndex);
    });
    triggerPreview = coordinator.request;
    window.triggerPreview = coordinator.request;
    coordinatorInstalled = true;
    return true;
  }

  function installEvents() {
    if (document.documentElement.dataset.pdfLazyPreviewEvents === '1') return;
    document.documentElement.dataset.pdfLazyPreviewEvents = '1';
    document.addEventListener('click', handleThumbnailNavigation, true);
    document.addEventListener('keydown', handleThumbnailNavigation, true);
    document.addEventListener('wheel', handlePreviewWheel, { capture: true, passive: false });
    document.addEventListener('pdf-import-committed', () => {
      selectedPageId = '';
      currentOutputIndex = 0;
      queuedOutputIndex = null;
    });
  }

  function install() {
    installStyles();
    ensureNavigation();
    installEvents();
    installCoordinatorDelegate();
  }

  window.PdfViewportLazyPreview = {
    buildOutputDescriptors,
    chooseWindow,
    descriptorIndexForPage,
    isLightweightPage,
    isActive,
    renderLazyWindow,
    requestRender,
    getCurrentWindow: () => ({ ...currentWindow }),
    getCurrentOutputIndex: () => currentOutputIndex,
    get coordinatorInstalled() { return coordinatorInstalled; },
    stage: 'selected-output-window-real-source-hydration',
  };

  for (const delay of INSTALL_DELAYS) setTimeout(install, delay);
})();
