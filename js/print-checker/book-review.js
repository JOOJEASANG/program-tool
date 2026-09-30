/* book-review.js — 문서파일 PDF 인쇄용지/재단 규격 검토 */
(function () {
  'use strict';

  if (window.__printCheckerBookReviewV1) return;
  window.__printCheckerBookReviewV1 = true;

  const PDFJS_VERSION = '3.11.174';
  const PDFJS_WORKER = `https://cdn.jsdelivr.net/npm/pdfjs-dist@${PDFJS_VERSION}/build/pdf.worker.min.js`;
  const MM_TOLERANCE = 0.8;
  const SHEETS = {
    a3: { label: 'A3', w: 297, h: 420 },
    b4: { label: 'B4', w: 257, h: 364 },
    a4: { label: 'A4', w: 210, h: 297 },
    b5: { label: 'B5', w: 182, h: 257 },
    isoB5: { label: 'ISO B5', w: 176, h: 250 },
    a5: { label: 'A5', w: 148, h: 210 },
    custom: { label: '직접 입력', w: 0, h: 0 },
  };

  const byId = (id) => document.getElementById(id);
  let active = false;
  let lastFile = null;
  let pdfDoc = null;
  let pdfMeta = { pageCount: 0, pages: {} };
  let renderCache = new Map();
  let currentPage = 1;
  let imagePreview = null;
  let loadSerial = 0;
  let pdfJsPromise = null;
  let thumbnailObserver = null;
  let previewResizeFrame = 0;
  let specs = {
    sheetPreset: 'b5',
    sheetW: 182,
    sheetH: 257,
    trimW: 0,
    trimH: 0,
    bleed: 3,
    safeZone: 5,
    bindingSafe: 10,
  };

  function checker() {
    try {
      if (typeof PrintChecker !== 'undefined') return PrintChecker;
    } catch (_) {}
    return window.PrintChecker || null;
  }

  function mm(points) {
    return Number(points || 0) * 25.4 / 72;
  }

  function round1(value) {
    return Math.round((Number(value) || 0) * 10) / 10;
  }

  function fmt(value) {
    return Number.isFinite(Number(value)) ? round1(value).toFixed(1) : '-';
  }

  function escapeHtml(value) {
    return String(value ?? '').replace(/[&<>"']/g, (char) => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    }[char]));
  }

  function setUrlProduct(value) {
    if (!history?.replaceState) return;
    const url = new URL(location.href);
    if (value) url.searchParams.set('product', value);
    else url.searchParams.delete('product');
    history.replaceState(null, '', `${url.pathname}${url.search}${url.hash}`);
  }

  function ensureProductCard() {
    const grid = byId('productGrid');
    if (!grid) return null;
    let button = grid.querySelector('[data-product="book-review"]');
    if (button) {
      const label = button.querySelector('.pc-label');
      const desc = button.querySelector('.pc-desc');
      const icon = button.querySelector('.pc-icon');
      if (label) label.textContent = '문서파일';
      if (desc) desc.textContent = 'PDF 문서·재단선·안전영역';
      if (icon) icon.textContent = '📑';
      return button;
    }
    button = document.createElement('button');
    button.type = 'button';
    button.className = 'product-card book-review-card';
    button.dataset.product = 'book-review';
    button.innerHTML = '<span class="pc-icon">📑</span><strong class="pc-label">문서파일</strong><small class="pc-desc">PDF 문서·재단선·안전영역</small>';
    button.addEventListener('click', (event) => {
      event.preventDefault();
      event.stopPropagation();
      activate();
    });
    grid.appendChild(button);
    return button;
  }

  function ensureCanvas() {
    const wrap = document.querySelector('.canvas-wrap');
    if (!wrap) return null;
    let canvas = byId('bookReviewCanvas');
    if (!canvas) {
      canvas = document.createElement('canvas');
      canvas.id = 'bookReviewCanvas';
      canvas.setAttribute('aria-label', '문서파일 인쇄용지 미리보기');
      wrap.insertBefore(canvas, wrap.firstChild);
    } else {
      canvas.setAttribute('aria-label', '문서파일 인쇄용지 미리보기');
    }
    return canvas;
  }

  function ensurePageNav() {
    const main = byId('printCheckerMain');
    if (!main) return null;
    let nav = byId('bookReviewPageNav');
    if (!nav) {
      nav = document.createElement('aside');
      nav.id = 'bookReviewPageNav';
      nav.className = 'book-review-page-nav';
      nav.setAttribute('aria-label', '문서 전체 페이지 확인');
      nav.innerHTML = `
        <div class="book-review-nav-head">
          <div><div class="book-review-nav-title">전체 페이지</div><div class="book-review-nav-sub">페이지를 눌러 가운데에서 크게 확인합니다.</div></div>
          <span class="book-review-nav-count" id="bookReviewPageCount">0p</span>
        </div>
        <div class="book-review-nav-row"><button type="button" id="bookReviewPrev">← 이전</button><strong id="bookReviewPageLabel">PDF 없음</strong><button type="button" id="bookReviewNext">다음 →</button></div>
        <div class="book-review-thumbs" id="bookReviewThumbs"><div class="book-review-empty">PDF를 올리면 전체 페이지가 여기에 표시됩니다.</div></div>`;
      main.appendChild(nav);
      byId('bookReviewPrev')?.addEventListener('click', () => showPage(currentPage - 1));
      byId('bookReviewNext')?.addEventListener('click', () => showPage(currentPage + 1));
    } else if (nav.parentElement !== main) {
      main.appendChild(nav);
    }
    return nav;
  }

  function renderForm() {
    const form = byId('specForm');
    if (!form) return;
    form.innerHTML = `
      <div class="spec-field">
        <label class="spec-label" for="bookSheetPreset">인쇄 용지<small class="spec-hint">PDF를 실제 크기로 이 용지 중앙에 배치합니다.</small></label>
        <select class="spec-input spec-select" id="bookSheetPreset">
          ${Object.entries(SHEETS).map(([key, item]) => `<option value="${key}" ${specs.sheetPreset === key ? 'selected' : ''}>${item.label}${key === 'custom' ? '' : ` · ${item.w}×${item.h}mm`}</option>`).join('')}
        </select>
      </div>
      <div class="book-review-custom-sheet" id="bookReviewCustomSheet" ${specs.sheetPreset === 'custom' ? '' : 'hidden'}>
        <div class="spec-field"><label class="spec-label" for="bookSheetW">용지 폭</label><div class="spec-input-row"><input class="spec-input" id="bookSheetW" type="number" min="1" step="0.1" value="${specs.sheetW || ''}" placeholder="182"><span class="spec-unit">mm</span></div></div>
        <div class="spec-field"><label class="spec-label" for="bookSheetH">용지 높이</label><div class="spec-input-row"><input class="spec-input" id="bookSheetH" type="number" min="1" step="0.1" value="${specs.sheetH || ''}" placeholder="257"><span class="spec-unit">mm</span></div></div>
      </div>
      <div class="spec-field"><label class="spec-label" for="trimW">실제 재단 폭<small class="spec-hint">완성 후 잘라낼 최종 가로 크기</small></label><div class="spec-input-row"><input class="spec-input" id="trimW" type="number" min="1" step="0.1" value="${specs.trimW || ''}" placeholder="128"><span class="spec-unit">mm</span></div></div>
      <div class="spec-field"><label class="spec-label" for="trimH">실제 재단 높이<small class="spec-hint">완성 후 잘라낼 최종 세로 크기</small></label><div class="spec-input-row"><input class="spec-input" id="trimH" type="number" min="1" step="0.1" value="${specs.trimH || ''}" placeholder="188"><span class="spec-unit">mm</span></div></div>
      <div class="spec-field"><label class="spec-label" for="bleed">권장 재단 여유<small class="spec-hint">PDF가 재단선 밖으로 확보해야 할 최소 여유</small></label><div class="spec-input-row"><input class="spec-input" id="bleed" type="number" min="0" step="0.1" value="${specs.bleed}"><span class="spec-unit">mm</span></div></div>
      <div class="spec-field"><label class="spec-label" for="safeZone">일반 안전 영역<small class="spec-hint">재단선 안쪽 글자·로고 권장 여백</small></label><div class="spec-input-row"><input class="spec-input" id="safeZone" type="number" min="0" step="0.1" value="${specs.safeZone}"><span class="spec-unit">mm</span></div></div>
      <div class="spec-field"><label class="spec-label" for="bookBindingSafe">제본쪽 안전 여백<small class="spec-hint">홀수 페이지 왼쪽 / 짝수 페이지 오른쪽</small></label><div class="spec-input-row"><input class="spec-input" id="bookBindingSafe" type="number" min="0" step="0.1" value="${specs.bindingSafe}"><span class="spec-unit">mm</span></div></div>`;

    const update = () => {
      readSpecs();
      renderPreview();
    };
    form.querySelectorAll('input,select').forEach((element) => {
      element.addEventListener('input', update);
      element.addEventListener('change', update);
    });
    byId('bookSheetPreset')?.addEventListener('change', () => {
      const preset = byId('bookSheetPreset')?.value || 'b5';
      const custom = byId('bookReviewCustomSheet');
      if (custom) custom.hidden = preset !== 'custom';
      const item = SHEETS[preset];
      if (preset !== 'custom' && item) {
        specs.sheetW = item.w;
        specs.sheetH = item.h;
      }
      readSpecs();
      renderPreview();
    });
    readSpecs();
  }

  function readSpecs() {
    const preset = byId('bookSheetPreset')?.value || specs.sheetPreset || 'b5';
    const item = SHEETS[preset] || SHEETS.b5;
    specs.sheetPreset = preset;
    specs.sheetW = preset === 'custom' ? (parseFloat(byId('bookSheetW')?.value) || 0) : item.w;
    specs.sheetH = preset === 'custom' ? (parseFloat(byId('bookSheetH')?.value) || 0) : item.h;
    specs.trimW = parseFloat(byId('trimW')?.value) || 0;
    specs.trimH = parseFloat(byId('trimH')?.value) || 0;
    specs.bleed = parseFloat(byId('bleed')?.value) || 0;
    specs.safeZone = parseFloat(byId('safeZone')?.value) || 0;
    specs.bindingSafe = parseFloat(byId('bookBindingSafe')?.value) || 0;
    return { ...specs };
  }

  function activate() {
    active = true;
    document.body.classList.add('book-review-active');
    const core = checker();
    core?.selectProduct?.('flyer', { syncUrl: false });
    ensureProductCard();
    renderForm();
    ensureCanvas();
    ensurePageNav();
    const section = byId('specSection');
    if (section) section.hidden = false;
    document.querySelectorAll('.product-card').forEach((card) => card.classList.toggle('selected', card.dataset.product === 'book-review'));
    setUrlProduct('book-review');
    clearReport();
    renderPreview();
    requestAnimationFrame(renderPreview);
    if (lastFile) loadBookFile(lastFile);
  }

  function deactivate(options = {}) {
    if (!active) return;
    active = false;
    document.body.classList.remove('book-review-active');
    if (options.keepUrl !== true && new URLSearchParams(location.search).get('product') === 'book-review') setUrlProduct('cover');
    const canvas = byId('bookReviewCanvas');
    if (canvas) canvas.hidden = true;
  }

  async function requirePdfJs() {
    if (window.pdfjsLib?.getDocument) {
      if (window.pdfjsLib.GlobalWorkerOptions && !window.pdfjsLib.GlobalWorkerOptions.workerSrc) window.pdfjsLib.GlobalWorkerOptions.workerSrc = PDFJS_WORKER;
      return window.pdfjsLib;
    }
    if (!pdfJsPromise) {
      pdfJsPromise = new Promise((resolve, reject) => {
        const finish = () => {
          if (!window.pdfjsLib?.getDocument) return reject(new Error('PDF.js unavailable'));
          if (window.pdfjsLib.GlobalWorkerOptions && !window.pdfjsLib.GlobalWorkerOptions.workerSrc) window.pdfjsLib.GlobalWorkerOptions.workerSrc = PDFJS_WORKER;
          resolve(window.pdfjsLib);
        };
        const existing = byId('printCheckerPdfJs');
        if (existing) {
          if (window.pdfjsLib?.getDocument) return finish();
          existing.addEventListener('load', finish, { once: true });
          existing.addEventListener('error', () => reject(new Error('PDF.js load failed')), { once: true });
          return;
        }
        const script = document.createElement('script');
        script.id = 'printCheckerPdfJs';
        script.src = `https://cdn.jsdelivr.net/npm/pdfjs-dist@${PDFJS_VERSION}/build/pdf.min.js`;
        script.defer = true;
        script.addEventListener('load', finish, { once: true });
        script.addEventListener('error', () => reject(new Error('PDF.js load failed')), { once: true });
        document.head.appendChild(script);
      }).catch((error) => {
        pdfJsPromise = null;
        throw error;
      });
    }
    return pdfJsPromise;
  }

  async function loadBookFile(file) {
    if (!active || !file) return;
    lastFile = file;
    const serial = ++loadSerial;
    renderCache = new Map();
    currentPage = 1;
    imagePreview = null;
    pdfMeta = { pageCount: 0, pages: {} };
    const isPdf = file.type === 'application/pdf' || /\.pdf$/i.test(file.name || '');
    try {
      if (isPdf) {
        const lib = await requirePdfJs();
        const data = new Uint8Array(await file.arrayBuffer());
        if (serial !== loadSerial || !active) return;
        const documentProxy = await lib.getDocument({ data }).promise;
        if (serial !== loadSerial || !active) {
          try { await documentProxy.destroy?.(); } catch (_) {}
          return;
        }
        try { await pdfDoc?.destroy?.(); } catch (_) {}
        pdfDoc = documentProxy;
        pdfMeta = { pageCount: documentProxy.numPages, pages: {} };
        renderPageThumbs();
        await showPage(1, { force: true, serial });
      } else if (/^image\/(png|jpeg|webp)$/i.test(file.type || '')) {
        try { await pdfDoc?.destroy?.(); } catch (_) {}
        pdfDoc = null;
        const url = URL.createObjectURL(file);
        const image = new Image();
        await new Promise((resolve, reject) => {
          image.onload = resolve;
          image.onerror = reject;
          image.src = url;
        });
        URL.revokeObjectURL(url);
        if (serial !== loadSerial || !active) return;
        imagePreview = image;
        renderPageThumbs();
        renderPreview();
        syncPageNav();
      }
    } catch (error) {
      console.error('[document-file-review] file load failed', error);
      showBookNotice('문서파일에서 파일을 읽지 못했습니다. PDF를 다시 확인해 주세요.', true);
    }
  }

  async function ensurePageMeta(pageNumber) {
    if (!pdfDoc || pageNumber < 1 || pageNumber > pdfDoc.numPages) return null;
    if (pdfMeta.pages[pageNumber]) return pdfMeta.pages[pageNumber];
    const page = await pdfDoc.getPage(pageNumber);
    const viewport = page.getViewport({ scale: 1 });
    const meta = {
      pageNumber,
      widthMm: mm(viewport.width),
      heightMm: mm(viewport.height),
      rotation: Number(viewport.rotation || page.rotate || 0),
    };
    pdfMeta.pages[pageNumber] = meta;
    return meta;
  }

  async function renderPdfPage(pageNumber, serial) {
    if (renderCache.has(pageNumber)) return renderCache.get(pageNumber);
    const page = await pdfDoc.getPage(pageNumber);
    const base = page.getViewport({ scale: 1 });
    const scale = Math.max(1, Math.min(2.2, 1800 / Math.max(base.width, base.height)));
    const viewport = page.getViewport({ scale });
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(viewport.width));
    canvas.height = Math.max(1, Math.round(viewport.height));
    const context = canvas.getContext('2d', { alpha: false });
    context.fillStyle = '#fff';
    context.fillRect(0, 0, canvas.width, canvas.height);
    await page.render({ canvasContext: context, viewport, background: '#ffffff' }).promise;
    if (serial !== loadSerial) return null;
    renderCache.set(pageNumber, canvas);
    return canvas;
  }

  async function renderThumbnail(pageNumber, button, serial) {
    if (!pdfDoc || !button || serial !== loadSerial || button.dataset.rendered === '1' || button.dataset.rendering === '1') return;
    button.dataset.rendering = '1';
    try {
      const page = await pdfDoc.getPage(pageNumber);
      if (serial !== loadSerial || !active) return;
      const base = page.getViewport({ scale: 1 });
      if (!pdfMeta.pages[pageNumber]) {
        pdfMeta.pages[pageNumber] = {
          pageNumber,
          widthMm: mm(base.width),
          heightMm: mm(base.height),
          rotation: Number(base.rotation || page.rotate || 0),
        };
      }
      const scale = Math.max(0.12, Math.min(0.42, 150 / Math.max(base.width, base.height)));
      const viewport = page.getViewport({ scale });
      const canvas = button.querySelector('canvas');
      if (!canvas) return;
      canvas.width = Math.max(1, Math.round(viewport.width));
      canvas.height = Math.max(1, Math.round(viewport.height));
      const context = canvas.getContext('2d', { alpha: false });
      context.fillStyle = '#fff';
      context.fillRect(0, 0, canvas.width, canvas.height);
      await page.render({ canvasContext: context, viewport, background: '#ffffff' }).promise;
      if (serial !== loadSerial || !active) return;
      const meta = pdfMeta.pages[pageNumber];
      const size = button.querySelector('.book-review-thumb-size');
      if (size && meta) size.textContent = `${fmt(meta.widthMm)}×${fmt(meta.heightMm)}`;
      button.dataset.rendered = '1';
    } catch (error) {
      console.warn('[document-file-review] thumbnail failed', pageNumber, error);
    } finally {
      button.dataset.rendering = '';
    }
  }

  function renderPageThumbs() {
    ensurePageNav();
    const holder = byId('bookReviewThumbs');
    if (!holder) return;
    thumbnailObserver?.disconnect();
    thumbnailObserver = null;
    holder.replaceChildren();
    const total = pdfDoc?.numPages || 0;
    const count = byId('bookReviewPageCount');
    if (count) count.textContent = total ? `${total}p` : '0p';
    if (!total) {
      const empty = document.createElement('div');
      empty.className = 'book-review-empty';
      empty.textContent = imagePreview ? '이미지 파일은 1개 미리보기로 확인합니다.' : 'PDF를 올리면 전체 페이지가 여기에 표시됩니다.';
      holder.appendChild(empty);
      return;
    }

    const serial = loadSerial;
    if ('IntersectionObserver' in window) {
      thumbnailObserver = new IntersectionObserver((entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          thumbnailObserver?.unobserve(entry.target);
          const pageNumber = Number(entry.target.dataset.page || 0);
          renderThumbnail(pageNumber, entry.target, serial);
        });
      }, { root: holder, rootMargin: '220px 0px' });
    }

    for (let pageNumber = 1; pageNumber <= total; pageNumber += 1) {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'book-review-thumb';
      button.dataset.page = String(pageNumber);
      button.setAttribute('aria-label', `${pageNumber}페이지 미리보기`);
      button.innerHTML = `<canvas aria-hidden="true"></canvas><span class="book-review-thumb-meta"><strong class="book-review-thumb-page">${pageNumber}p</strong><span class="book-review-thumb-size">불러오는 중</span></span>`;
      button.addEventListener('click', () => showPage(pageNumber));
      holder.appendChild(button);
      if (thumbnailObserver) thumbnailObserver.observe(button);
      else if (pageNumber <= 12) renderThumbnail(pageNumber, button, serial);
    }
    syncPageNav();
  }

  async function showPage(pageNumber, options = {}) {
    if (!pdfDoc) return false;
    const next = Math.max(1, Math.min(pdfDoc.numPages, Number(pageNumber) || 1));
    const serial = options.serial ?? loadSerial;
    currentPage = next;
    await ensurePageMeta(next);
    if (!renderCache.has(next) || options.force) await renderPdfPage(next, serial);
    if (serial !== loadSerial || !active) return false;
    syncPageNav();
    renderPreview();
    return true;
  }

  function syncPageNav() {
    const total = pdfDoc?.numPages || 0;
    const label = byId('bookReviewPageLabel');
    if (label) label.textContent = total ? `${currentPage} / ${total}p` : 'PDF 없음';
    const count = byId('bookReviewPageCount');
    if (count) count.textContent = total ? `${total}p` : '0p';
    const prev = byId('bookReviewPrev');
    const next = byId('bookReviewNext');
    if (prev) prev.disabled = !total || currentPage <= 1;
    if (next) next.disabled = !total || currentPage >= total;
    document.querySelectorAll('.book-review-thumb').forEach((button) => {
      const selected = Number(button.dataset.page) === currentPage;
      button.classList.toggle('active', selected);
      button.setAttribute('aria-current', selected ? 'page' : 'false');
      if (selected) button.scrollIntoView({ block: 'nearest', inline: 'nearest' });
    });
  }

  function sheetLabel() {
    const item = SHEETS[specs.sheetPreset];
    const prefix = specs.sheetPreset === 'custom' ? '사용자 지정' : (item?.label || '인쇄용지');
    return `${prefix} ${fmt(specs.sheetW)}×${fmt(specs.sheetH)}mm`;
  }

  function drawBadge(context, text, x, y, background, foreground = '#fff') {
    context.save();
    context.font = '800 11px Pretendard, sans-serif';
    const width = Math.ceil(context.measureText(text).width) + 16;
    context.fillStyle = background;
    context.beginPath();
    context.roundRect?.(x, y, width, 24, 6);
    if (!context.roundRect) context.rect(x, y, width, 24);
    context.fill();
    context.fillStyle = foreground;
    context.textAlign = 'left';
    context.textBaseline = 'middle';
    context.fillText(text, x + 8, y + 12);
    context.restore();
  }

  function shadeOutsideTrim(context, fileRect, trimRect) {
    const left = Math.max(fileRect.x, trimRect.x);
    const top = Math.max(fileRect.y, trimRect.y);
    const right = Math.min(fileRect.x + fileRect.w, trimRect.x + trimRect.w);
    const bottom = Math.min(fileRect.y + fileRect.h, trimRect.y + trimRect.h);
    context.save();
    context.fillStyle = 'rgba(15,23,42,.42)';
    if (top > fileRect.y) context.fillRect(fileRect.x, fileRect.y, fileRect.w, top - fileRect.y);
    if (bottom < fileRect.y + fileRect.h) context.fillRect(fileRect.x, bottom, fileRect.w, fileRect.y + fileRect.h - bottom);
    if (left > fileRect.x && bottom > top) context.fillRect(fileRect.x, top, left - fileRect.x, bottom - top);
    if (right < fileRect.x + fileRect.w && bottom > top) context.fillRect(right, top, fileRect.x + fileRect.w - right, bottom - top);
    context.restore();
  }

  function renderPreview() {
    if (!active) return;
    readSpecs();
    const canvas = ensureCanvas();
    if (!canvas) return;
    canvas.hidden = false;
    const context = canvas.getContext('2d');
    const wrap = canvas.parentElement;
    const wrapWidth = wrap?.clientWidth || 900;
    const wrapHeight = wrap?.clientHeight || Math.max(560, window.innerHeight - 28);
    const displayW = Math.max(320, Math.floor(wrapWidth - 20));
    const displayH = Math.max(340, Math.floor(wrapHeight - 50));
    const sheetW = Math.max(1, specs.sheetW || 182);
    const sheetH = Math.max(1, specs.sheetH || 257);
    const maxSheetW = Math.max(220, displayW - 48);
    const maxSheetH = Math.max(280, displayH - 56);
    const pxPerMm = Math.min(maxSheetW / sheetW, maxSheetH / sheetH);
    const sheetPxW = sheetW * pxPerMm;
    const sheetPxH = sheetH * pxPerMm;
    canvas.width = displayW;
    canvas.height = displayH;

    context.fillStyle = '#aeb9c7';
    context.fillRect(0, 0, canvas.width, canvas.height);
    const sheetX = (canvas.width - sheetPxW) / 2;
    const sheetY = (canvas.height - sheetPxH) / 2;

    context.save();
    context.shadowColor = 'rgba(15,23,42,.28)';
    context.shadowBlur = 18;
    context.shadowOffsetY = 5;
    context.fillStyle = '#ffffff';
    context.fillRect(sheetX, sheetY, sheetPxW, sheetPxH);
    context.restore();
    context.strokeStyle = '#64748b';
    context.lineWidth = 2;
    context.strokeRect(sheetX, sheetY, sheetPxW, sheetPxH);
    drawBadge(context, `인쇄용지 · ${sheetLabel()}`, sheetX + 10, sheetY + 10, '#0f3b6d');

    const meta = pdfMeta.pages[currentPage];
    let fileWmm = meta?.widthMm || 0;
    let fileHmm = meta?.heightMm || 0;
    const source = renderCache.get(currentPage) || imagePreview;
    if (!fileWmm || !fileHmm) {
      fileWmm = specs.trimW || Math.min(sheetW * 0.72, 133);
      fileHmm = specs.trimH || Math.min(sheetH * 0.78, 203);
    }
    const fileW = fileWmm * pxPerMm;
    const fileH = fileHmm * pxPerMm;
    const fileX = sheetX + (sheetPxW - fileW) / 2;
    const fileY = sheetY + (sheetPxH - fileH) / 2;
    const fileRect = { x: fileX, y: fileY, w: fileW, h: fileH };

    context.save();
    context.fillStyle = '#ffffff';
    context.fillRect(fileX, fileY, fileW, fileH);
    if (source) context.drawImage(source, fileX, fileY, fileW, fileH);
    context.strokeStyle = '#6d28d9';
    context.lineWidth = 2.5;
    context.strokeRect(fileX, fileY, fileW, fileH);
    context.restore();
    drawBadge(context, `파일 · ${fmt(fileWmm)}×${fmt(fileHmm)}mm${pdfDoc ? ` · P${currentPage}` : ''}`, fileX + 8, fileY + 8, '#6d28d9');

    if (specs.trimW > 0 && specs.trimH > 0) {
      const trimW = specs.trimW * pxPerMm;
      const trimH = specs.trimH * pxPerMm;
      const trimX = sheetX + (sheetPxW - trimW) / 2;
      const trimY = sheetY + (sheetPxH - trimH) / 2;
      const trimRect = { x: trimX, y: trimY, w: trimW, h: trimH };
      shadeOutsideTrim(context, fileRect, trimRect);

      context.save();
      context.strokeStyle = '#2563eb';
      context.lineWidth = 3;
      context.setLineDash([]);
      context.strokeRect(trimX, trimY, trimW, trimH);
      context.restore();
      drawBadge(context, `실제 재단 · ${fmt(specs.trimW)}×${fmt(specs.trimH)}mm`, trimX + 8, trimY + 38, '#1d4ed8');

      const safe = specs.safeZone * pxPerMm;
      if (safe > 0 && trimW > safe * 2 && trimH > safe * 2) {
        context.save();
        context.fillStyle = 'rgba(220,252,231,.45)';
        context.fillRect(trimX + safe, trimY + safe, trimW - safe * 2, trimH - safe * 2);
        context.strokeStyle = '#16a34a';
        context.lineWidth = 2;
        context.setLineDash([7, 4]);
        context.strokeRect(trimX + safe, trimY + safe, trimW - safe * 2, trimH - safe * 2);
        context.restore();
      }

      const binding = specs.bindingSafe * pxPerMm;
      if (binding > 0 && binding < trimW) {
        const odd = currentPage % 2 === 1;
        const bindingX = odd ? trimX + binding : trimX + trimW - binding;
        context.save();
        context.strokeStyle = '#f97316';
        context.lineWidth = 2.5;
        context.setLineDash([9, 5]);
        context.beginPath();
        context.moveTo(bindingX, trimY);
        context.lineTo(bindingX, trimY + trimH);
        context.stroke();
        context.fillStyle = '#c2410c';
        context.font = '900 10px Pretendard, sans-serif';
        context.textAlign = odd ? 'left' : 'right';
        context.fillText(`제본쪽 ${fmt(specs.bindingSafe)}mm`, bindingX + (odd ? 5 : -5), trimY + trimH - 8);
        context.restore();
      }
    }

    context.save();
    context.fillStyle = '#172033';
    context.fillRect(16, canvas.height - 42, canvas.width - 32, 27);
    context.fillStyle = '#f8fafc';
    context.font = '700 10px Pretendard, sans-serif';
    context.textAlign = 'center';
    context.fillText('회색=인쇄용지 밖 · 보라=업로드 파일 · 어두운 영역=재단 제외 · 파랑=재단선 · 초록=안전영역 · 주황=제본쪽', canvas.width / 2, canvas.height - 25);
    context.restore();

    const info = byId('canvasFileInfo');
    if (info) {
      const trimText = specs.trimW && specs.trimH ? ` · 재단 ${fmt(specs.trimW)}×${fmt(specs.trimH)}mm` : ' · 재단사이즈 입력 필요';
      info.textContent = `문서파일 · ${sheetLabel()}${meta ? ` · PDF ${pdfMeta.pageCount}p · 현재 ${currentPage}p · 파일 ${fmt(meta.widthMm)}×${fmt(meta.heightMm)}mm` : ''}${trimText}`;
      info.hidden = false;
    }
  }

  function showBookNotice(message, error) {
    const element = byId('uploadError');
    if (!element) return;
    element.textContent = message;
    element.hidden = false;
    element.classList.toggle('book-review-error', Boolean(error));
  }

  async function ensureAllPageMeta() {
    if (!pdfDoc) return [];
    const result = [];
    for (let pageNumber = 1; pageNumber <= pdfDoc.numPages; pageNumber += 1) {
      result.push(await ensurePageMeta(pageNumber));
    }
    return result.filter(Boolean);
  }

  function reportItem(label, status, detail, guide) {
    return { label, status, detail, guide };
  }

  async function runBookCheck() {
    if (!active) return;
    readSpecs();
    if (!specs.sheetW || !specs.sheetH) {
      alert('인쇄 용지 크기를 확인해 주세요.');
      return;
    }
    if (!specs.trimW || !specs.trimH) {
      alert('실제 재단 폭과 높이를 입력해 주세요.');
      return;
    }
    if (!lastFile) {
      alert('검토할 문서 PDF를 먼저 올려 주세요.');
      return;
    }

    const button = byId('runBtn');
    const previousText = button?.textContent || '검토 실행';
    if (button) {
      button.disabled = true;
      button.textContent = '전체 페이지 확인 중…';
    }
    try {
      const items = [];
      if (!pdfDoc) {
        items.push(reportItem('파일 형식', 'warn', '이미지 파일', '정확한 mm 규격과 전체 페이지 검사는 PDF에서 지원합니다.'));
        items.push(reportItem('인쇄 용지', specs.trimW <= specs.sheetW && specs.trimH <= specs.sheetH ? 'pass' : 'fail', sheetLabel(), '실제 재단사이즈가 인쇄 용지 안에 들어오는지 확인했습니다.'));
        renderReport(items);
        return;
      }

      const pages = await ensureAllPageMeta();
      const first = pages[0];
      const inconsistent = pages.filter((meta) => Math.abs(meta.widthMm - first.widthMm) > MM_TOLERANCE || Math.abs(meta.heightMm - first.heightMm) > MM_TOLERANCE);
      const oversized = pages.filter((meta) => meta.widthMm > specs.sheetW + MM_TOLERANCE || meta.heightMm > specs.sheetH + MM_TOLERANCE);
      const trimOutside = specs.trimW > specs.sheetW + MM_TOLERANCE || specs.trimH > specs.sheetH + MM_TOLERANCE;
      const tooSmall = pages.filter((meta) => meta.widthMm + MM_TOLERANCE < specs.trimW || meta.heightMm + MM_TOLERANCE < specs.trimH);
      const bleedShort = pages.filter((meta) => ((meta.widthMm - specs.trimW) / 2) + MM_TOLERANCE < specs.bleed || ((meta.heightMm - specs.trimH) / 2) + MM_TOLERANCE < specs.bleed);
      const marginX = (first.widthMm - specs.trimW) / 2;
      const marginY = (first.heightMm - specs.trimH) / 2;

      items.push(reportItem('PDF 페이지 수', pdfMeta.pageCount % 2 === 0 ? 'pass' : 'warn', `${pdfMeta.pageCount}p`, pdfMeta.pageCount % 2 === 0 ? '짝수 페이지 구성입니다.' : '양면 인쇄나 제본 시 마지막 빈 페이지가 필요한지 확인하세요.'));
      items.push(reportItem('전체 페이지 규격', inconsistent.length ? 'fail' : 'pass', `${fmt(first.widthMm)} × ${fmt(first.heightMm)}mm`, inconsistent.length ? `규격이 다른 페이지: ${inconsistent.slice(0, 12).map((meta) => `${meta.pageNumber}p`).join(', ')}${inconsistent.length > 12 ? ' 외' : ''}` : `전체 ${pages.length}페이지의 크기가 동일합니다.`));
      items.push(reportItem('인쇄 용지 배치', oversized.length ? 'fail' : 'pass', sheetLabel(), oversized.length ? `인쇄 용지를 벗어나는 페이지: ${oversized.slice(0, 12).map((meta) => `${meta.pageNumber}p`).join(', ')}${oversized.length > 12 ? ' 외' : ''}` : '모든 PDF 페이지가 선택한 인쇄 용지 안에 실제 크기로 들어옵니다.'));
      items.push(reportItem('실제 재단사이즈', trimOutside || tooSmall.length ? 'fail' : 'pass', `${fmt(specs.trimW)} × ${fmt(specs.trimH)}mm`, trimOutside ? '재단사이즈가 선택한 인쇄 용지보다 큽니다.' : tooSmall.length ? `재단사이즈보다 작은 PDF 페이지가 ${tooSmall.length}개 있습니다.` : 'PDF 안쪽에 재단영역이 포함됩니다.'));
      items.push(reportItem('파일 대비 재단 여유', tooSmall.length ? 'fail' : bleedShort.length ? 'warn' : 'pass', `좌우 ${fmt(marginX)}mm · 상하 ${fmt(marginY)}mm`, tooSmall.length ? '파일이 재단사이즈보다 작아 잘림 없이 제작할 수 없습니다.' : bleedShort.length ? `권장 ${fmt(specs.bleed)}mm보다 여유가 부족한 페이지가 ${bleedShort.length}개 있습니다.` : `사방 권장 재단 여유 ${fmt(specs.bleed)}mm 이상입니다.`));
      items.push(reportItem('안전영역 안내', 'info', `일반 ${fmt(specs.safeZone)}mm · 제본쪽 ${fmt(specs.bindingSafe)}mm`, '초록색 안전영역 안에 글자·로고가 들어오는지 확인하세요. 홀수 페이지는 왼쪽, 짝수 페이지는 오른쪽이 제본쪽입니다.'));
      renderReport(items);
    } finally {
      if (button) {
        button.disabled = false;
        button.textContent = previousText;
      }
    }
  }

  function renderReport(items) {
    const section = byId('reportSection');
    const grid = byId('reportGrid');
    const summary = byId('reportSummary');
    if (!section || !grid || !summary) return;
    grid.replaceChildren();
    const counts = { pass: 0, warn: 0, fail: 0, info: 0 };
    items.forEach((item) => {
      counts[item.status] = (counts[item.status] || 0) + 1;
      const card = document.createElement('div');
      card.className = `report-card status-${item.status}`;
      const icon = { pass: '✅', warn: '⚠️', fail: '❌', info: 'ℹ️' }[item.status] || 'ℹ️';
      card.innerHTML = `<div class="rc-head"><span class="rc-icon">${icon}</span><strong class="rc-label">${escapeHtml(item.label)}</strong></div><div class="rc-detail">${escapeHtml(item.detail)}</div><div class="rc-guide">${escapeHtml(item.guide)}</div>`;
      grid.appendChild(card);
    });
    const overall = counts.fail ? 'fail' : counts.warn ? 'warn' : 'pass';
    summary.className = `report-summary status-${overall}`;
    summary.innerHTML = `<strong>${overall === 'fail' ? '조치 필요' : overall === 'warn' ? '주의 필요' : '이상 없음'}</strong> — 통과 ${counts.pass}, 주의 ${counts.warn}, 오류 ${counts.fail}`;
    section.hidden = false;
    section.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  function clearReport() {
    if (byId('reportSection')) byId('reportSection').hidden = true;
    byId('reportGrid')?.replaceChildren();
  }

  function schedulePreviewFit() {
    if (!active) return;
    cancelAnimationFrame(previewResizeFrame);
    previewResizeFrame = requestAnimationFrame(renderPreview);
  }

  function install() {
    ensureProductCard();
    ensureCanvas();
    ensurePageNav();
    renderPageThumbs();

    document.addEventListener('click', (event) => {
      const card = event.target.closest?.('.product-card');
      if (!card || card.dataset.product === 'book-review' || !active) return;
      deactivate({ keepUrl: true });
    }, true);

    byId('runBtn')?.addEventListener('click', (event) => {
      if (!active) return;
      event.preventDefault();
      event.stopImmediatePropagation();
      runBookCheck().catch((error) => {
        console.error(error);
        alert('문서파일 검토 중 오류가 발생했습니다.');
      });
    }, true);

    byId('resetBtn')?.addEventListener('click', () => {
      if (!active) return;
      setTimeout(() => {
        active = false;
        document.body.classList.remove('book-review-active');
        lastFile = null;
        currentPage = 1;
        imagePreview = null;
        renderCache = new Map();
        pdfMeta = { pageCount: 0, pages: {} };
        thumbnailObserver?.disconnect();
        thumbnailObserver = null;
        try { pdfDoc?.destroy?.(); } catch (_) {}
        pdfDoc = null;
        renderPageThumbs();
        syncPageNav();
      }, 0);
    });

    byId('fileInput')?.addEventListener('change', (event) => {
      const file = event.target.files?.[0];
      if (file) lastFile = file;
      if (active && file) loadBookFile(file);
    });

    byId('uploadZone')?.addEventListener('drop', (event) => {
      const file = event.dataTransfer?.files?.[0];
      if (file) lastFile = file;
      if (active && file) loadBookFile(file);
    });

    window.addEventListener('resize', schedulePreviewFit);

    if (new URLSearchParams(location.search).get('product') === 'book-review') activate();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', install, { once: true });
  else install();

  window.PrintCheckerBookReview = {
    activate,
    showPage,
    renderPreview,
    renderPageThumbs,
    runBookCheck,
    getState: () => ({ active, currentPage, pageCount: pdfMeta.pageCount, specs: { ...specs } }),
  };
})();
