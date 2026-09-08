// Interactive per-page N-up placement adjustment for scanned/misaligned PDFs.
(function () {
  'use strict';
  if (window.__pdfNupPageAdjustV1) return;
  window.__pdfNupPageAdjustV1 = true;
  if (!location.pathname.includes('pdf-editor')) return;

  const MIN_SCALE = 0.5;
  const MAX_SCALE = 3.0;
  const MAX_OFFSET_MM = 200;
  const INSTALL_DELAYS = [0, 180, 420, 800, 1300, 2100, 3300, 5000, 8000];
  const byId = (id) => document.getElementById(id);
  const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

  let selectedPageId = '';
  let previewObserver = null;
  let decorateFrame = 0;
  let pointerState = null;
  let previewTimer = null;
  let sessionBridgeTarget = null;
  let wrappedBuildTarget = null;
  let wrappedApiTarget = null;
  let wrappedFetchTarget = null;

  function pages() {
    try { return Array.isArray(parsedPages) ? parsedPages : []; }
    catch (_) { return []; }
  }

  function pageById(id) {
    return pages().find((page) => String(page.id) === String(id)) || null;
  }

  function normalNumber(value, fallback) {
    const number = Number(value);
    return Number.isFinite(number) ? number : fallback;
  }

  function valuesForPage(page) {
    return {
      scale: clamp(normalNumber(page?.nupScale, 1), MIN_SCALE, MAX_SCALE),
      offsetX: clamp(normalNumber(page?.nupOffsetX, 0), -MAX_OFFSET_MM, MAX_OFFSET_MM),
      offsetY: clamp(normalNumber(page?.nupOffsetY, 0), -MAX_OFFSET_MM, MAX_OFFSET_MM),
    };
  }

  function setValues(page, values) {
    if (!page) return;
    const current = valuesForPage(page);
    page.nupScale = clamp(normalNumber(values?.scale, current.scale), MIN_SCALE, MAX_SCALE);
    page.nupOffsetX = clamp(normalNumber(values?.offsetX, current.offsetX), -MAX_OFFSET_MM, MAX_OFFSET_MM);
    page.nupOffsetY = clamp(normalNumber(values?.offsetY, current.offsetY), -MAX_OFFSET_MM, MAX_OFFSET_MM);
  }

  function resetPage(page) {
    if (!page) return;
    page.nupScale = 1;
    page.nupOffsetX = 0;
    page.nupOffsetY = 0;
  }

  function hasAdjustment(page) {
    const value = valuesForPage(page);
    return Math.abs(value.scale - 1) > 0.0001
      || Math.abs(value.offsetX) > 0.0001
      || Math.abs(value.offsetY) > 0.0001;
  }

  function selectedPage() {
    return pageById(selectedPageId);
  }

  function pageLabel(page) {
    if (!page) return '페이지를 선택하세요';
    const index = pages().indexOf(page);
    const fileName = String(page.sourceFile || '').trim();
    const pageNumber = index >= 0 ? index + 1 : Number(page.page_index || 0) + 1;
    return `${pageNumber}페이지${fileName ? ` · ${fileName}` : ''}`;
  }

  function installStyles() {
    if (byId('pdfNupPageAdjustStylesV1')) return;
    const style = document.createElement('style');
    style.id = 'pdfNupPageAdjustStylesV1';
    style.textContent = `
      .pdf-nup-adjust-panel{margin-top:8px;padding:9px;border:1px solid #cbd5e1;border-radius:10px;background:#fff}
      .pdf-nup-adjust-head{display:flex;align-items:flex-start;justify-content:space-between;gap:7px;margin-bottom:7px}
      .pdf-nup-adjust-head strong{font-size:10px;color:#0f172a;line-height:1.35}
      .pdf-nup-adjust-head span{display:block;margin-top:2px;font-size:8.5px;color:#64748b;font-weight:700;line-height:1.4;word-break:keep-all}
      .pdf-nup-adjust-badge{flex:0 0 auto;padding:2px 6px;border-radius:999px;background:#eff6ff;color:#1d4ed8;font-size:8px;font-weight:900}
      .pdf-nup-adjust-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:5px}
      .pdf-nup-adjust-field label{display:block;margin:0 0 3px;color:#64748b;font-size:8.5px;text-align:center}
      .pdf-nup-adjust-field input{width:100%;padding:6px 4px!important;text-align:center;font-size:10px!important;font-weight:850}
      .pdf-nup-adjust-scale{display:grid;grid-template-columns:minmax(0,1fr) 54px;gap:6px;align-items:center;margin:7px 0}
      .pdf-nup-adjust-scale input[type="range"]{width:100%}
      .pdf-nup-adjust-actions{display:grid;grid-template-columns:1fr 1fr;gap:5px;margin-top:7px}
      .pdf-nup-adjust-actions button{border:1px solid #cbd5e1;border-radius:7px;background:#f8fafc;color:#334155;padding:6px 5px;font:inherit;font-size:9px;font-weight:850;cursor:pointer}
      .pdf-nup-adjust-actions button:hover{background:#f1f5f9}
      .pdf-nup-adjust-help{margin-top:6px;padding-top:6px;border-top:1px solid #e2e8f0;color:#64748b;font-size:8px;font-weight:700;line-height:1.45}
      #previewScroll .page-preview{position:relative}
      .pdf-nup-adjust-overlay{position:absolute;z-index:8;pointer-events:none;overflow:visible}
      .pdf-nup-adjust-hit{position:absolute;border:1.5px dashed rgba(37,99,235,.28);background:rgba(37,99,235,.015);pointer-events:auto;cursor:move;touch-action:none}
      .pdf-nup-adjust-hit:hover{border-color:rgba(37,99,235,.72);background:rgba(37,99,235,.045)}
      .pdf-nup-adjust-hit[data-adjusted="true"]{border-color:rgba(217,119,6,.78);background:rgba(245,158,11,.035)}
      .pdf-nup-adjust-hit[data-selected="true"]{border:2px solid #2563eb;background:rgba(37,99,235,.055);box-shadow:0 0 0 2px rgba(255,255,255,.8) inset}
      .pdf-nup-adjust-page-no{position:absolute;left:3px;top:3px;padding:2px 5px;border-radius:999px;background:rgba(15,23,42,.82);color:#fff;font-size:8px;font-weight:900;pointer-events:none}
      .pdf-nup-adjust-handle{position:absolute;right:-5px;bottom:-5px;width:13px;height:13px;border:2px solid #fff;border-radius:50%;background:#2563eb;box-shadow:0 1px 3px rgba(15,23,42,.35);cursor:nwse-resize;pointer-events:auto;touch-action:none}
      .pdf-nup-adjust-hit:not([data-selected="true"]) .pdf-nup-adjust-handle{display:none}
    `;
    document.head.appendChild(style);
  }

  function ensurePanel() {
    let panel = byId('pdfNupPageAdjustPanelV1');
    if (panel) return panel;
    const guide = byId('nupQuickGuide');
    const grid = document.querySelector('.nup-grid');
    const anchor = guide || grid;
    if (!anchor?.parentElement) return null;

    panel = document.createElement('div');
    panel.id = 'pdfNupPageAdjustPanelV1';
    panel.className = 'pdf-nup-adjust-panel';
    panel.innerHTML = `
      <div class="pdf-nup-adjust-head">
        <div><strong>스캔 페이지 위치·크기 보정</strong><span id="pdfNupAdjustSelectedLabel">미리보기에서 페이지 칸을 선택하세요.</span></div>
        <div class="pdf-nup-adjust-badge" id="pdfNupAdjustBadge">개별</div>
      </div>
      <div class="pdf-nup-adjust-scale">
        <input id="pdfNupAdjustScaleRange" type="range" min="50" max="300" step="1" value="100" aria-label="선택 페이지 확대율">
        <input id="pdfNupAdjustScale" type="number" min="50" max="300" step="1" value="100" aria-label="선택 페이지 확대율 퍼센트">
      </div>
      <div class="pdf-nup-adjust-grid">
        <div class="pdf-nup-adjust-field"><label for="pdfNupAdjustX">좌우 이동 mm</label><input id="pdfNupAdjustX" type="number" min="-200" max="200" step="0.5" value="0"></div>
        <div class="pdf-nup-adjust-field"><label for="pdfNupAdjustY">상하 이동 mm</label><input id="pdfNupAdjustY" type="number" min="-200" max="200" step="0.5" value="0"></div>
        <div class="pdf-nup-adjust-field"><label>현재 상태</label><input id="pdfNupAdjustState" type="text" value="기본" readonly tabindex="-1"></div>
      </div>
      <div class="pdf-nup-adjust-actions">
        <button type="button" id="pdfNupAdjustReset">선택 페이지 초기화</button>
        <button type="button" id="pdfNupAdjustResetAll">전체 보정 초기화</button>
      </div>
      <div class="pdf-nup-adjust-help">미리보기 칸 드래그 = 위치 이동 · 오른쪽 아래 파란 핸들 드래그 = 확대/축소 · 수치 입력도 가능. 보정값은 최종 PDF와 작업 저장에 함께 반영됩니다.</div>`;
    anchor.insertAdjacentElement('afterend', panel);
    bindPanelEvents();
    syncPanel();
    return panel;
  }

  function syncPanel() {
    const page = selectedPage();
    const value = valuesForPage(page);
    const disabled = !page;
    const scalePercent = Math.round(value.scale * 100);
    const label = byId('pdfNupAdjustSelectedLabel');
    if (label) label.textContent = page ? pageLabel(page) : '미리보기에서 페이지 칸을 선택하세요.';
    const badge = byId('pdfNupAdjustBadge');
    if (badge) badge.textContent = page && hasAdjustment(page) ? '보정됨' : '개별';
    const range = byId('pdfNupAdjustScaleRange');
    const scale = byId('pdfNupAdjustScale');
    const x = byId('pdfNupAdjustX');
    const y = byId('pdfNupAdjustY');
    const state = byId('pdfNupAdjustState');
    if (range) { range.value = String(scalePercent); range.disabled = disabled; }
    if (scale) { scale.value = String(scalePercent); scale.disabled = disabled; }
    if (x) { x.value = value.offsetX.toFixed(1); x.disabled = disabled; }
    if (y) { y.value = value.offsetY.toFixed(1); y.disabled = disabled; }
    if (state) state.value = !page ? '선택 없음' : (hasAdjustment(page) ? '보정 적용' : '기본');
    if (byId('pdfNupAdjustReset')) byId('pdfNupAdjustReset').disabled = disabled;
    document.querySelectorAll('.pdf-nup-adjust-hit').forEach((node) => {
      node.dataset.selected = String(page && node.dataset.pageId === String(page.id));
    });
  }

  function applyPanelValues(source) {
    const page = selectedPage();
    if (!page) return;
    let scalePercent = normalNumber(byId('pdfNupAdjustScale')?.value, 100);
    if (source === 'range') scalePercent = normalNumber(byId('pdfNupAdjustScaleRange')?.value, scalePercent);
    scalePercent = clamp(scalePercent, 50, 300);
    const x = clamp(normalNumber(byId('pdfNupAdjustX')?.value, 0), -MAX_OFFSET_MM, MAX_OFFSET_MM);
    const y = clamp(normalNumber(byId('pdfNupAdjustY')?.value, 0), -MAX_OFFSET_MM, MAX_OFFSET_MM);
    setValues(page, { scale: scalePercent / 100, offsetX: x, offsetY: y });
    if (byId('pdfNupAdjustScale')) byId('pdfNupAdjustScale').value = String(Math.round(page.nupScale * 100));
    if (byId('pdfNupAdjustScaleRange')) byId('pdfNupAdjustScaleRange').value = String(Math.round(page.nupScale * 100));
    syncPanel();
    schedulePreview(90);
  }

  function bindPanelEvents() {
    const panel = byId('pdfNupPageAdjustPanelV1');
    if (!panel || panel.dataset.bound === 'true') return;
    panel.dataset.bound = 'true';
    byId('pdfNupAdjustScaleRange')?.addEventListener('input', () => {
      const value = byId('pdfNupAdjustScaleRange')?.value || '100';
      if (byId('pdfNupAdjustScale')) byId('pdfNupAdjustScale').value = value;
      applyPanelValues('range');
    });
    ['pdfNupAdjustScale', 'pdfNupAdjustX', 'pdfNupAdjustY'].forEach((id) => {
      const input = byId(id);
      input?.addEventListener('input', () => applyPanelValues('input'));
      input?.addEventListener('change', () => applyPanelValues('change'));
    });
    byId('pdfNupAdjustReset')?.addEventListener('click', () => {
      const page = selectedPage();
      if (!page) return;
      resetPage(page);
      syncPanel();
      schedulePreview(0);
    });
    byId('pdfNupAdjustResetAll')?.addEventListener('click', () => {
      pages().forEach(resetPage);
      syncPanel();
      schedulePreview(0);
    });
  }

  function selectPage(page) {
    if (!page || page.pageType === 'divider' || page.pageType === 'blank' || page._bookletBlank) return;
    selectedPageId = String(page.id);
    syncPanel();
    queueDecoration();
  }

  function enrichSettings(settings) {
    if (!settings || typeof settings !== 'object' || !Array.isArray(settings.pages)) return settings;
    const sourcePages = pages();
    settings.pages = settings.pages.map((entry, index) => {
      const source = sourcePages[index];
      const value = valuesForPage(source);
      return {
        ...entry,
        content_scale: value.scale,
        offset_x_mm: value.offsetX,
        offset_y_mm: value.offsetY,
      };
    });
    return settings;
  }

  function outputDescriptors() {
    try {
      if (window.PdfViewportLazyPreview?.buildOutputDescriptors) {
        return window.PdfViewportLazyPreview.buildOutputDescriptors();
      }
    } catch (_) {}
    const active = pages().filter((page) => !page.excluded);
    let arranged = active;
    try {
      if (byId('bookletCheck')?.checked && typeof bookletReorderPreview === 'function') {
        arranged = bookletReorderPreview(active, Number(typeof nup === 'undefined' ? 1 : nup)) || active;
      }
    } catch (_) {}
    if (typeof groupByNup !== 'function' || typeof getLayout !== 'function') return [];
    const descriptors = [];
    for (const group of groupByNup(arranged)) {
      const layout = getLayout(group.n);
      const cols = Math.max(1, Number(layout?.cols || 1));
      const rows = Math.max(1, Number(layout?.rows || 1));
      const perPage = cols * rows;
      for (let pageIndex = 0; pageIndex < Math.ceil(group.pages.length / perPage); pageIndex += 1) {
        const start = pageIndex * perPage;
        descriptors.push({
          outputIndex: descriptors.length,
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

  function paperGeometry(canvas) {
    let pw = 210;
    let ph = 297;
    try {
      const settings = typeof getSettings === 'function' ? getSettings() : null;
      if (Number(settings?.pw) > 0) pw = Number(settings.pw);
      if (Number(settings?.ph) > 0) ph = Number(settings.ph);
    } catch (_) {}
    const left = normalNumber(canvas?.dataset?.marginLeftMm, 10);
    const right = normalNumber(canvas?.dataset?.marginRightMm, 10);
    const top = normalNumber(canvas?.dataset?.marginTopMm, 10);
    const bottom = normalNumber(canvas?.dataset?.marginBottomMm, 10);
    const gap = normalNumber(canvas?.dataset?.gapMm, 5);
    return { pw, ph, left, right, top, bottom, gap };
  }

  function cellRect(descriptor, slot, canvas) {
    const geometry = paperGeometry(canvas);
    const usableW = geometry.pw - geometry.left - geometry.right - geometry.gap * (descriptor.cols - 1);
    const usableH = geometry.ph - geometry.top - geometry.bottom - geometry.gap * (descriptor.rows - 1);
    const cellW = usableW / descriptor.cols;
    const cellH = usableH / descriptor.rows;
    let column;
    let row;
    let rowMajor = true;
    try { rowMajor = typeof orderLR === 'undefined' ? true : !!orderLR; } catch (_) {}
    if (rowMajor) {
      column = slot % descriptor.cols;
      row = Math.floor(slot / descriptor.cols);
    } else {
      column = Math.floor(slot / descriptor.rows);
      row = slot % descriptor.rows;
    }
    return {
      left: (geometry.left + column * (cellW + geometry.gap)) / geometry.pw,
      top: (geometry.top + row * (cellH + geometry.gap)) / geometry.ph,
      width: cellW / geometry.pw,
      height: cellH / geometry.ph,
      paperW: geometry.pw,
      paperH: geometry.ph,
    };
  }

  function beginPointer(event, page, mode, hit) {
    if (!page) return;
    event.preventDefault();
    event.stopPropagation();
    selectPage(page);
    const start = valuesForPage(page);
    const canvas = hit?.closest('.page-preview')?.querySelector('canvas');
    const rect = canvas?.getBoundingClientRect();
    pointerState = {
      page,
      mode,
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      start,
      canvasWidth: Math.max(1, rect?.width || 1),
      canvasHeight: Math.max(1, rect?.height || 1),
      paper: paperGeometry(canvas),
    };
    try { event.target.setPointerCapture?.(event.pointerId); } catch (_) {}
  }

  function movePointer(event) {
    const state = pointerState;
    if (!state || event.pointerId !== state.pointerId) return;
    event.preventDefault();
    const dx = event.clientX - state.startX;
    const dy = event.clientY - state.startY;
    if (state.mode === 'scale') {
      const factor = Math.exp((dx - dy) / 180);
      setValues(state.page, { scale: state.start.scale * factor });
    } else {
      setValues(state.page, {
        offsetX: state.start.offsetX + dx / state.canvasWidth * state.paper.pw,
        offsetY: state.start.offsetY + dy / state.canvasHeight * state.paper.ph,
      });
    }
    syncPanel();
  }

  function endPointer(event) {
    if (!pointerState || event.pointerId !== pointerState.pointerId) return;
    pointerState = null;
    schedulePreview(0);
  }

  function decoratePreview() {
    decorateFrame = 0;
    const descriptors = outputDescriptors();
    if (!descriptors.length) return;
    const descriptorMap = new Map(descriptors.map((descriptor) => [Number(descriptor.outputIndex), descriptor]));
    const nodes = [...document.querySelectorAll('#previewScroll .page-preview')];
    nodes.forEach((wrap, domIndex) => {
      wrap.querySelectorAll('.pdf-nup-adjust-overlay').forEach((node) => node.remove());
      const canvas = wrap.querySelector('canvas');
      if (!canvas) return;
      const outputIndex = Number.isFinite(Number(wrap.dataset.outputIndex))
        ? Number(wrap.dataset.outputIndex)
        : domIndex;
      const descriptor = descriptorMap.get(outputIndex);
      if (!descriptor) return;
      const overlay = document.createElement('div');
      overlay.className = 'pdf-nup-adjust-overlay';
      overlay.style.left = `${canvas.offsetLeft}px`;
      overlay.style.top = `${canvas.offsetTop}px`;
      overlay.style.width = `${canvas.offsetWidth}px`;
      overlay.style.height = `${canvas.offsetHeight}px`;

      descriptor.sourcePages.forEach((page, slot) => {
        if (!page || page.pageType === 'divider' || page.pageType === 'blank' || page._bookletBlank) return;
        const rect = cellRect(descriptor, slot, canvas);
        const hit = document.createElement('div');
        hit.className = 'pdf-nup-adjust-hit';
        hit.dataset.pageId = String(page.id);
        hit.dataset.adjusted = String(hasAdjustment(page));
        hit.dataset.selected = String(String(page.id) === selectedPageId);
        hit.style.left = `${rect.left * 100}%`;
        hit.style.top = `${rect.top * 100}%`;
        hit.style.width = `${rect.width * 100}%`;
        hit.style.height = `${rect.height * 100}%`;
        hit.title = `${pageLabel(page)} · 드래그: 이동 · 핸들: 크기`;
        const number = document.createElement('span');
        number.className = 'pdf-nup-adjust-page-no';
        number.textContent = pageLabel(page).split('페이지')[0];
        const handle = document.createElement('span');
        handle.className = 'pdf-nup-adjust-handle';
        handle.setAttribute('aria-label', '페이지 크기 조절');
        hit.append(number, handle);
        hit.addEventListener('pointerdown', (event) => {
          if (event.target === handle) beginPointer(event, page, 'scale', hit);
          else beginPointer(event, page, 'move', hit);
        });
        hit.addEventListener('click', (event) => {
          event.preventDefault();
          event.stopPropagation();
          selectPage(page);
        });
        overlay.appendChild(hit);
      });
      wrap.appendChild(overlay);
    });
    syncPanel();
  }

  function queueDecoration() {
    if (decorateFrame) return;
    decorateFrame = requestAnimationFrame(decoratePreview);
  }

  function schedulePreview(delay = 80) {
    clearTimeout(previewTimer);
    previewTimer = setTimeout(() => {
      try {
        const lazy = window.PdfViewportLazyPreview;
        if (lazy?.isActive?.()) {
          const page = selectedPage();
          const descriptors = lazy.buildOutputDescriptors?.() || [];
          const index = page ? lazy.descriptorIndexForPage?.(page, descriptors) : -1;
          lazy.requestRender?.(index >= 0 ? index : lazy.getCurrentOutputIndex?.());
          return;
        }
        if (window.PdfEditorLayoutExport?.refresh) {
          window.PdfEditorLayoutExport.refresh();
          return;
        }
        if (typeof schedulePreview === 'function' && schedulePreview !== arguments.callee) {
          schedulePreview(80);
          return;
        }
        if (typeof triggerPreview === 'function') triggerPreview();
      } catch (error) {
        console.warn('[pdf-nup-adjust] preview refresh failed', error);
      }
    }, Math.max(0, Number(delay) || 0));
  }

  function wrapBuildOutputPage() {
    const current = window.buildOutputPage;
    if (typeof current !== 'function') return false;
    if (current.__pdfNupPageAdjustWrappedV1) {
      wrappedBuildTarget = current;
      return true;
    }
    const original = current;
    const wrapped = function adjustedBuildOutputPage(groupPages, pageIdx, cols, rows) {
      const perPage = Math.max(1, Number(cols || 1) * Number(rows || 1));
      let slot = 0;
      let originalDraw = null;
      try { originalDraw = window.drawPageInCell || drawPageInCell; } catch (_) { originalDraw = window.drawPageInCell; }
      if (typeof originalDraw !== 'function') return original.apply(this, arguments);

      const adjustedDraw = function adjustedDrawPage(ctx, src, cellX, cellY, cellW, cellH) {
        const sourceIndex = Number(pageIdx || 0) * perPage + slot;
        const page = groupPages?.[sourceIndex];
        slot += 1;
        const value = valuesForPage(page);
        if (!page || !hasAdjustment(page)) return originalDraw(ctx, src, cellX, cellY, cellW, cellH);
        const drawW = cellW * value.scale;
        const drawH = cellH * value.scale;
        const mm2pxX = cellW > 0 ? (cellW / Math.max(1, cellW)) : 1;
        let pxPerMm = 1;
        try {
          const settings = typeof getSettings === 'function' ? getSettings() : null;
          const canvasWidth = ctx?.canvas?.width || 0;
          if (Number(settings?.pw) > 0 && canvasWidth > 0) pxPerMm = canvasWidth / Number(settings.pw);
        } catch (_) { pxPerMm = mm2pxX; }
        const drawX = cellX + (cellW - drawW) / 2 + value.offsetX * pxPerMm;
        const drawY = cellY + (cellH - drawH) / 2 + value.offsetY * pxPerMm;
        ctx.save();
        ctx.beginPath();
        ctx.rect(cellX, cellY, cellW, cellH);
        ctx.clip();
        try { return originalDraw(ctx, src, drawX, drawY, drawW, drawH); }
        finally { ctx.restore(); }
      };

      const previousWindow = window.drawPageInCell;
      let previousBinding = null;
      try { previousBinding = drawPageInCell; } catch (_) {}
      window.drawPageInCell = adjustedDraw;
      try { drawPageInCell = adjustedDraw; } catch (_) {}
      try {
        return original.apply(this, arguments);
      } finally {
        window.drawPageInCell = previousWindow || originalDraw;
        try { drawPageInCell = previousBinding || originalDraw; } catch (_) {}
      }
    };
    wrapped.__pdfNupPageAdjustWrappedV1 = true;
    wrapped.__pdfNupPageAdjustOriginal = original;
    window.buildOutputPage = wrapped;
    try { buildOutputPage = wrapped; } catch (_) {}
    wrappedBuildTarget = wrapped;
    return true;
  }

  function wrapApiProcessPdf() {
    const current = window.apiProcessPdf;
    if (typeof current !== 'function') return false;
    if (current.__pdfNupPageAdjustWrappedV1) {
      wrappedApiTarget = current;
      return true;
    }
    const original = current;
    const wrapped = function adjustedApiProcessPdf(files, settings, options) {
      return original.call(this, files, enrichSettings(settings), options);
    };
    wrapped.__pdfNupPageAdjustWrappedV1 = true;
    wrapped.__pdfNupPageAdjustOriginal = original;
    window.apiProcessPdf = wrapped;
    try { apiProcessPdf = wrapped; } catch (_) {}
    wrappedApiTarget = wrapped;
    return true;
  }

  function endpointPath(input) {
    try {
      const raw = typeof input === 'string' ? input : input?.url;
      if (!raw) return '';
      const url = new URL(raw, location.href);
      return url.origin === location.origin ? url.pathname.replace(/\/+$/, '') : '';
    } catch (_) { return ''; }
  }

  function wrapFetch() {
    const current = window.fetch;
    if (typeof current !== 'function') return false;
    if (current.__pdfNupPageAdjustWrappedV1) {
      wrappedFetchTarget = current;
      return true;
    }
    const original = current.bind(window);
    const wrapped = function adjustedPdfFetch(input, init) {
      try {
        const path = endpointPath(input);
        if (path === '/api/pdf/process' && init?.body instanceof FormData) {
          const raw = init.body.get('settings');
          if (raw) init.body.set('settings', JSON.stringify(enrichSettings(JSON.parse(raw))));
        } else if (path === '/api/pdf/process-storage' && init && typeof init.body === 'string') {
          const body = JSON.parse(init.body);
          if (body?.settings) {
            body.settings = enrichSettings(body.settings);
            init.body = JSON.stringify(body);
          }
        }
      } catch (error) {
        console.warn('[pdf-nup-adjust] request enrichment failed', error);
      }
      return original(input, init);
    };
    wrapped.__pdfNupPageAdjustWrappedV1 = true;
    wrapped.__pdfNupPageAdjustOriginal = current;
    window.fetch = wrapped;
    wrappedFetchTarget = wrapped;
    return true;
  }

  function installSessionBridge() {
    const collect = window.collectEditorState;
    const load = window.loadEditorSession;
    if (typeof collect !== 'function' || typeof load !== 'function') return false;
    if (collect.__pdfNupPageAdjustStateV1 && load.__pdfNupPageAdjustStateV1) {
      sessionBridgeTarget = collect;
      return true;
    }
    const originalCollect = collect;
    const originalLoad = load;
    const collectWrapped = function collectWithPageAdjustments() {
      const state = originalCollect.apply(this, arguments) || {};
      state.nupPageAdjustments = pages().map((page) => valuesForPage(page));
      return state;
    };
    collectWrapped.__pdfNupPageAdjustStateV1 = true;
    const loadWrapped = async function loadWithPageAdjustments(data) {
      const result = await originalLoad.apply(this, arguments);
      try {
        const state = typeof data?.state === 'string' ? JSON.parse(data.state) : (data?.state || {});
        const saved = Array.isArray(state.nupPageAdjustments) ? state.nupPageAdjustments : [];
        pages().forEach((page, index) => {
          if (saved[index]) setValues(page, saved[index]);
        });
      } catch (error) {
        console.warn('[pdf-nup-adjust] saved adjustments could not be restored', error);
      }
      selectedPageId = '';
      syncPanel();
      schedulePreview(0);
      return result;
    };
    loadWrapped.__pdfNupPageAdjustStateV1 = true;
    window.collectEditorState = collectWrapped;
    window.loadEditorSession = loadWrapped;
    try { collectEditorState = collectWrapped; loadEditorSession = loadWrapped; } catch (_) {}
    sessionBridgeTarget = collectWrapped;
    return true;
  }

  function installObserver() {
    const area = byId('previewScroll');
    if (!area || previewObserver) return Boolean(area);
    previewObserver = new MutationObserver((mutations) => {
      if (mutations.some((mutation) => mutation.addedNodes.length || mutation.removedNodes.length)) queueDecoration();
    });
    previewObserver.observe(area, { childList: true, subtree: true });
    return true;
  }

  function installPointerEvents() {
    if (document.documentElement.dataset.pdfNupAdjustPointerEvents === '1') return;
    document.documentElement.dataset.pdfNupAdjustPointerEvents = '1';
    document.addEventListener('pointermove', movePointer, true);
    document.addEventListener('pointerup', endPointer, true);
    document.addEventListener('pointercancel', endPointer, true);
    window.addEventListener('resize', queueDecoration);
  }

  function maintainWrappers() {
    if (window.buildOutputPage !== wrappedBuildTarget) wrapBuildOutputPage();
    if (window.apiProcessPdf !== wrappedApiTarget) wrapApiProcessPdf();
    if (window.fetch !== wrappedFetchTarget) wrapFetch();
    if (window.collectEditorState !== sessionBridgeTarget) installSessionBridge();
  }

  function install() {
    installStyles();
    ensurePanel();
    installObserver();
    installPointerEvents();
    maintainWrappers();
    queueDecoration();
  }

  window.PdfNupPageAdjust = {
    valuesForPage,
    setValues,
    resetPage,
    hasAdjustment,
    selectPage,
    enrichSettings,
    outputDescriptors,
    decoratePreview,
    refresh: () => schedulePreview(0),
    limits: { minScale: MIN_SCALE, maxScale: MAX_SCALE, maxOffsetMm: MAX_OFFSET_MM },
    stage: 'interactive-page-scale-pan-v1',
  };

  for (const delay of INSTALL_DELAYS) setTimeout(install, delay);
  setInterval(maintainWrappers, 2500);
})();
