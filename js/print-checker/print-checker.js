/* print-checker.js — 인쇄물 사전 검토 v20260904-2 */
'use strict';

const PrintChecker = (() => {
  const PDFJS_VERSION = '3.11.174';
  const PDFJS_WORKER = `https://cdn.jsdelivr.net/npm/pdfjs-dist@${PDFJS_VERSION}/build/pdf.worker.min.js`;
  const MAX_FILE_BYTES = 200 * 1024 * 1024;
  const PDF_MM_TOLERANCE = 0.8;
  const PRODUCTS = {
    cover:      { label: '표지',         icon: '📚', desc: '앞표지 + 책등 + 뒤표지', hasFold: false, hasSpine: true,  isBooklet: false },
    leaflet:    { label: '리플렛',       icon: '📄', desc: '2단·3단·4단 접지',       hasFold: true,  hasSpine: false, isBooklet: false },
    flyer:      { label: '전단지/포스터', icon: '🖼️', desc: '단면 전단지·포스터',    hasFold: false, hasSpine: false, isBooklet: false },
    invitation: { label: '초대장/안내장', icon: '💌', desc: '단면 평판 초대장',       hasFold: false, hasSpine: false, isBooklet: false },
    booklet:    { label: '소책자',       icon: '📖', desc: '중철 4·8·12·16p',       hasFold: false, hasSpine: false, isBooklet: true  },
  };
  const PRODUCT_ALIASES = { poster: 'flyer', notice: 'invitation' };
  const FOLD_TYPES = {
    '2fold':  { label: '반접기 (2단)', panels: 2 },
    '3roll':  { label: '말아접기 (3단)', panels: 3 },
    '3zfold': { label: 'Z접기 (3단 지그재그)', panels: 3 },
    '4fold':  { label: '4단 접기', panels: 4 },
  };
  const FOLD_PAGES = {
    '2fold':  { outside: [4, 1], inside: [2, 3], total: 4, cover: 1, back: 4, desc: '반접기 — 총 4페이지. 오른쪽 패널이 표지(P1), 왼쪽이 뒷면(P4).' },
    '3roll':  { outside: [6, 5, 1], inside: [2, 3, 4], total: 6, cover: 1, back: 6, desc: '말아접기 — 총 6페이지. 가장 오른쪽(P1)이 표지, 왼쪽(P6)이 뒷면입니다.' },
    '3zfold': { outside: [1, 2, 3], inside: [6, 5, 4], total: 6, cover: 1, back: 6, desc: 'Z접기 — 총 6페이지. 가장 왼쪽(P1)이 표지이며 지그재그로 접힙니다.' },
    '4fold':  { outside: [8, 7, 6, 1], inside: [2, 3, 4, 5], total: 8, cover: 1, back: 8, desc: '4단 접기 — 총 8페이지. 가장 오른쪽(P1)이 표지, 왼쪽 끝(P8)이 뒷면입니다.' },
  };
  const PAPER_TYPES = {
    mojo80:  { label: '모조지 80g', mmPerSheet: 0.100 },
    mojo100: { label: '모조지 100g', mmPerSheet: 0.130 },
    snow80:  { label: '스노우지 80g', mmPerSheet: 0.090 },
    snow100: { label: '스노우지 100g', mmPerSheet: 0.110 },
    snow120: { label: '스노우지 120g', mmPerSheet: 0.135 },
    art80:   { label: '아트지 80g', mmPerSheet: 0.090 },
    art100:  { label: '아트지 100g', mmPerSheet: 0.105 },
    art130:  { label: '아트지 130g', mmPerSheet: 0.140 },
    custom:  { label: '직접 입력', mmPerSheet: null },
  };

  let _file = null;
  let _fileKind = '';
  let _imgEl = null;
  let _naturalW = 0;
  let _naturalH = 0;
  let _product = null;
  let _specs = {};
  let _reportItems = [];
  let _offsetX = 0;
  let _offsetY = 0;
  let _scaleAdj = 1;
  let _fileHasBleed = false;
  let _fileSide = 'front';
  let _pdfDoc = null;
  let _pdfMeta = null;
  let _pdfRenderCache = new Map();
  let _loadSerial = 0;
  let _pdfJsPromise = null;

  const byId = (id) => document.getElementById(id);
  const mm = (points) => Number(points || 0) * 25.4 / 72;

  function init() {
    renderProductCards();
    bindUpload();
    bindForm();
    bindAdj();
    const requested = normalizeProduct(new URLSearchParams(location.search).get('product'));
    if (requested) selectProduct(requested, { syncUrl: false });
    drawCanvas();
    syncFileInfo();
  }

  function normalizeProduct(value) {
    const key = String(value || '').trim().toLowerCase();
    const normalized = PRODUCT_ALIASES[key] || key;
    return Object.prototype.hasOwnProperty.call(PRODUCTS, normalized) ? normalized : '';
  }

  function renderProductCards() {
    const grid = byId('productGrid');
    if (!grid) return;
    grid.replaceChildren();
    Object.entries(PRODUCTS).forEach(([key, product]) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'product-card';
      button.dataset.product = key;
      button.innerHTML = `<span class="pc-icon">${product.icon}</span><strong class="pc-label">${product.label}</strong><small class="pc-desc">${product.desc}</small>`;
      button.addEventListener('click', () => selectProduct(key));
      grid.appendChild(button);
    });
  }

  function selectProduct(value, options = {}) {
    const key = normalizeProduct(value);
    if (!key) return false;
    _product = key;
    document.querySelectorAll('.product-card').forEach((card) => card.classList.toggle('selected', card.dataset.product === key));
    renderSpecForm(key);
    const specSection = byId('specSection');
    if (specSection) specSection.hidden = false;
    clearReport();
    syncSideControls();
    drawCanvas();
    updateInfoPanels();
    if (options.syncUrl !== false && history?.replaceState) {
      const url = new URL(location.href);
      url.searchParams.set('product', key);
      history.replaceState(null, '', `${url.pathname}${url.search}${url.hash}`);
    }
    return true;
  }

  function renderSpecForm(key) {
    const product = PRODUCTS[key];
    const form = byId('specForm');
    if (!product || !form) return;
    form.innerHTML = '';

    const mmField = (id, label, hint, placeholder) => {
      const wrap = document.createElement('div');
      wrap.className = 'spec-field';
      wrap.innerHTML = `<label class="spec-label" for="${id}">${label}<small class="spec-hint">${hint}</small></label><div class="spec-input-row"><input class="spec-input" id="${id}" type="number" min="0" step="0.1" placeholder="${placeholder}" value="${_specs[id] ?? ''}"><span class="spec-unit">mm</span></div>`;
      form.appendChild(wrap);
    };

    mmField('trimW', product.isBooklet ? '완성판 폭' : '재단 폭 (Trim Width)', product.isBooklet ? '접은 후 가로 크기' : '재단 후 최종 가로', product.isBooklet ? '148' : '210');
    mmField('trimH', product.isBooklet ? '완성판 높이' : '재단 높이 (Trim Height)', product.isBooklet ? '접은 후 세로 크기' : '재단 후 최종 세로', product.isBooklet ? '210' : '297');

    if (product.hasSpine) {
      appendSelect(form, 'paperType', '종이 종류', '책등 두께 자동 계산', PAPER_TYPES, _specs.paperType || 'mojo80');
      appendNumber(form, 'pageCount', '페이지 수', '총 페이지 (표지 제외)', '100', 'p', 2, 2);
      mmField('spine', '책등 두께', '종이·페이지 선택 시 자동 계산', '0.0');
      const spineHint = byId('spine')?.closest('.spec-field')?.querySelector('.spec-hint');
      if (spineHint) spineHint.id = 'spineHint';

      const wing = document.createElement('div');
      wing.className = 'spec-field wing-group';
      wing.innerHTML = `<label class="spec-check-row"><input type="checkbox" id="hasWing" ${_specs.hasWing ? 'checked' : ''}><span>날개(플랩) 포함</span></label><div id="wingWGroup" style="margin-top:8px" ${_specs.hasWing ? '' : 'hidden'}><div class="spec-input-row"><input class="spec-input" id="wingW" type="number" min="0" step="1" placeholder="90" value="${_specs.wingW ?? ''}"><span class="spec-unit">mm</span></div><small class="spec-hint">날개 폭 (앞·뒷날개 동일)</small></div>`;
      form.appendChild(wing);

      const autoSpine = () => {
        const paperKey = byId('paperType')?.value;
        const pages = parseInt(byId('pageCount')?.value, 10) || 0;
        const spine = byId('spine');
        if (paperKey && paperKey !== 'custom' && pages >= 2 && spine && !spine.dataset.manual) {
          const value = calcSpine(paperKey, pages);
          if (value !== null) {
            spine.value = value;
            const hint = byId('spineHint');
            if (hint) hint.textContent = `자동 계산: ${value}mm`;
          }
        }
        readSpecs();
        drawCanvas();
      };
      byId('paperType')?.addEventListener('change', autoSpine);
      byId('pageCount')?.addEventListener('input', autoSpine);
      byId('spine')?.addEventListener('input', (event) => {
        event.target.dataset.manual = event.target.value ? '1' : '';
        const hint = byId('spineHint');
        if (hint) hint.textContent = event.target.value ? '직접 입력 중' : '종이·페이지 선택 시 자동 계산';
      });
      byId('hasWing')?.addEventListener('change', (event) => {
        const group = byId('wingWGroup');
        if (group) group.hidden = !event.target.checked;
      });
    }

    if (product.hasFold) {
      appendSelect(form, 'foldType', '접지 방식', '접지 유형 선택', FOLD_TYPES, _specs.foldType || '3roll');
      mmField('gutterMargin', '거터 (Gutter)', '패널 사이 여백 기준', '3');
    }

    if (product.isBooklet) {
      appendNumber(form, 'bookletPages', '총 페이지 수', '4의 배수 권장 (중철 기준)', '8', 'p', 4, 1);
      appendSelect(form, 'paperType', '종이 종류', '두께 참고용', PAPER_TYPES, _specs.paperType || 'mojo80');
    }

    mmField('bleed', '재단선 여유 (Bleed)', '재단선 바깥 여분 (보통 3mm)', '3');
    mmField('safeZone', '안전 영역 (Safe Zone)', '텍스트·로고 여백 (보통 3mm)', '3');
  }

  function appendSelect(form, id, label, hint, options, selected) {
    const wrap = document.createElement('div');
    wrap.className = 'spec-field';
    wrap.innerHTML = `<label class="spec-label" for="${id}">${label}<small class="spec-hint">${hint}</small></label><select class="spec-input spec-select" id="${id}">${Object.entries(options).map(([value, item]) => `<option value="${value}" ${selected === value ? 'selected' : ''}>${item.label}</option>`).join('')}</select>`;
    form.appendChild(wrap);
  }

  function appendNumber(form, id, label, hint, placeholder, unit, min, step) {
    const wrap = document.createElement('div');
    wrap.className = 'spec-field';
    wrap.innerHTML = `<label class="spec-label" for="${id}">${label}<small class="spec-hint">${hint}</small></label><div class="spec-input-row"><input class="spec-input" id="${id}" type="number" min="${min}" step="${step}" placeholder="${placeholder}" value="${_specs[id] ?? ''}"><span class="spec-unit">${unit}</span></div>`;
    form.appendChild(wrap);
  }

  function calcSpine(paperKey, pageCount) {
    const paper = PAPER_TYPES[paperKey];
    if (!paper?.mmPerSheet || pageCount < 2) return null;
    return Math.round((pageCount / 2) * paper.mmPerSheet * 10) / 10;
  }

  function readSpecs() {
    const specs = {};
    ['trimW', 'trimH', 'spine', 'bleed', 'safeZone', 'gutterMargin', 'wingW', 'bookletPages'].forEach((id) => {
      const element = byId(id);
      if (element) specs[id] = parseFloat(element.value) || 0;
    });
    const pageCount = byId('pageCount');
    if (pageCount) specs.pageCount = parseInt(pageCount.value, 10) || 0;
    const foldType = byId('foldType');
    if (foldType) specs.foldType = foldType.value;
    const paperType = byId('paperType');
    if (paperType) specs.paperType = paperType.value;
    const hasWing = byId('hasWing');
    if (hasWing) specs.hasWing = hasWing.checked;
    _specs = specs;
    return specs;
  }

  function bindUpload() {
    const zone = byId('uploadZone');
    const input = byId('fileInput');
    if (!zone || !input) return;
    zone.addEventListener('click', () => input.click());
    zone.addEventListener('keydown', (event) => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        input.click();
      }
    });
    zone.addEventListener('dragover', (event) => { event.preventDefault(); zone.classList.add('dragover'); });
    zone.addEventListener('dragleave', () => zone.classList.remove('dragover'));
    zone.addEventListener('drop', (event) => {
      event.preventDefault();
      zone.classList.remove('dragover');
      inspectFile(event.dataTransfer?.files?.[0]);
    });
    input.addEventListener('change', () => inspectFile(input.files?.[0]));
  }

  async function inspectFile(file) {
    if (!file) return false;
    clearUploadError();
    if (file.size > MAX_FILE_BYTES) {
      showUploadError('파일은 최대 200MB까지 검토할 수 있습니다.');
      return false;
    }
    const isPdf = file.type === 'application/pdf' || /\.pdf$/i.test(file.name || '');
    const isImage = /^image\/(png|jpeg|webp)$/i.test(file.type || '');
    if (!isPdf && !isImage) {
      showUploadError('PDF 또는 이미지(PNG·JPEG·WEBP)만 지원합니다.');
      return false;
    }

    const serial = ++_loadSerial;
    resetFileRuntime({ keepFileInput: true });
    _file = file;
    _fileKind = isPdf ? 'pdf' : 'image';
    const filename = byId('uploadFilename');
    if (filename) {
      filename.textContent = file.name || '파일';
      filename.style.display = 'block';
    }
    byId('uploadZone')?.classList.add('has-file');
    const adjPanel = byId('adjPanel');
    if (adjPanel) adjPanel.hidden = false;
    setFileInfo('파일을 분석하고 있습니다…');

    try {
      if (isPdf) await loadPdfPreview(file, serial);
      else await loadImagePreview(file, serial);
      if (serial !== _loadSerial) return false;
      syncSideControls();
      drawCanvas();
      return true;
    } catch (error) {
      if (serial !== _loadSerial) return false;
      console.error('[print-checker] file inspection failed', error);
      const message = fileErrorMessage(error, isPdf);
      showUploadError(message);
      setFileInfo(message);
      _imgEl = null;
      drawCanvas();
      return false;
    }
  }

  function fileErrorMessage(error, isPdf) {
    const name = String(error?.name || '');
    if (isPdf && /Password/i.test(name)) return '암호가 설정된 PDF는 암호를 해제한 뒤 검토해 주세요.';
    return isPdf ? 'PDF를 분석하거나 미리보기를 만들지 못했습니다.' : '이미지 미리보기를 만들지 못했습니다.';
  }

  async function loadImagePreview(file, serial) {
    const dataUrl = await readFileAsDataUrl(file);
    if (serial !== _loadSerial) return;
    const image = await imageFromUrl(dataUrl);
    if (serial !== _loadSerial) return;
    _imgEl = image;
    _naturalW = image.naturalWidth;
    _naturalH = image.naturalHeight;
    _pdfMeta = null;
    setFileInfo(`${_naturalW} × ${_naturalH}px · 이미지`);
  }

  async function requirePdfJs() {
    if (window.pdfjsLib && typeof window.pdfjsLib.getDocument === 'function') {
      if (window.pdfjsLib.GlobalWorkerOptions && !window.pdfjsLib.GlobalWorkerOptions.workerSrc) window.pdfjsLib.GlobalWorkerOptions.workerSrc = PDFJS_WORKER;
      return window.pdfjsLib;
    }
    if (!_pdfJsPromise) {
      _pdfJsPromise = new Promise((resolve, reject) => {
        const existing = document.getElementById('printCheckerPdfJs');
        const finish = () => {
          const lib = window.pdfjsLib;
          if (!lib || typeof lib.getDocument !== 'function') {
            reject(new Error('PDF.js unavailable'));
            return;
          }
          if (lib.GlobalWorkerOptions && !lib.GlobalWorkerOptions.workerSrc) lib.GlobalWorkerOptions.workerSrc = PDFJS_WORKER;
          resolve(lib);
        };
        if (existing) {
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
        _pdfJsPromise = null;
        throw error;
      });
    }
    return _pdfJsPromise;
  }

  async function loadPdfPreview(file, serial) {
    const lib = await requirePdfJs();
    const bytes = new Uint8Array(await file.arrayBuffer());
    if (serial !== _loadSerial) return;
    const loadingTask = lib.getDocument({ data: bytes });
    const documentProxy = await loadingTask.promise;
    if (serial !== _loadSerial) {
      try { await documentProxy.destroy?.(); } catch (_) {}
      return;
    }
    if (!documentProxy.numPages) throw new Error('empty PDF');
    _pdfDoc = documentProxy;
    _pdfMeta = { pageCount: documentProxy.numPages, pages: {} };
    _pdfRenderCache = new Map();
    await ensurePdfPageMeta(1);
    if (documentProxy.numPages > 1) await ensurePdfPageMeta(2);
    await setFileSide('front', { force: true, serial });
    syncFileInfo();
  }

  async function ensurePdfPageMeta(pageNumber) {
    if (!_pdfDoc || pageNumber < 1 || pageNumber > _pdfDoc.numPages) return null;
    if (_pdfMeta?.pages?.[pageNumber]) return _pdfMeta.pages[pageNumber];
    const page = await _pdfDoc.getPage(pageNumber);
    const viewport = page.getViewport({ scale: 1 });
    const meta = {
      pageNumber,
      widthPt: viewport.width,
      heightPt: viewport.height,
      widthMm: mm(viewport.width),
      heightMm: mm(viewport.height),
      rotation: Number(viewport.rotation || page.rotate || 0),
    };
    _pdfMeta.pages[pageNumber] = meta;
    return meta;
  }

  function sidePageNumber(side) {
    if (!_pdfDoc) return 0;
    if (side === 'back' && canUseBackSide()) return 2;
    return 1;
  }

  function canUseBackSide() {
    return Boolean(_pdfDoc && _pdfDoc.numPages >= 2 && _product !== 'booklet');
  }

  async function setFileSide(side, options = {}) {
    const next = side === 'back' && canUseBackSide() ? 'back' : 'front';
    _fileSide = next;
    document.querySelectorAll('.side-btn').forEach((button) => button.classList.toggle('active', button.dataset.side === next));
    if (_fileKind !== 'pdf' || !_pdfDoc) {
      syncSideControls();
      drawCanvas();
      return;
    }
    const pageNumber = sidePageNumber(next);
    const serial = options.serial ?? _loadSerial;
    let cached = _pdfRenderCache.get(pageNumber);
    if (!cached || options.force) {
      cached = await renderPdfPage(pageNumber, serial);
      if (!cached) return;
      _pdfRenderCache.set(pageNumber, cached);
    }
    if (serial !== _loadSerial) return;
    _imgEl = cached.image;
    _naturalW = cached.image.naturalWidth;
    _naturalH = cached.image.naturalHeight;
    syncSideControls();
    syncFileInfo();
    drawCanvas();
  }

  async function renderPdfPage(pageNumber, serial) {
    const page = await _pdfDoc.getPage(pageNumber);
    const base = page.getViewport({ scale: 1 });
    const maxDimension = 1800;
    const scale = Math.max(1, Math.min(2.2, maxDimension / Math.max(base.width, base.height)));
    const viewport = page.getViewport({ scale });
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(viewport.width));
    canvas.height = Math.max(1, Math.round(viewport.height));
    const context = canvas.getContext('2d', { alpha: false });
    context.save();
    context.fillStyle = '#fff';
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.restore();
    await page.render({ canvasContext: context, viewport, background: '#ffffff' }).promise;
    if (serial !== _loadSerial) return null;
    const image = await imageFromUrl(canvas.toDataURL('image/png'));
    return { image, pageNumber };
  }

  function readFileAsDataUrl(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = () => reject(reader.error || new Error('file read failed'));
      reader.readAsDataURL(file);
    });
  }

  function imageFromUrl(url) {
    return new Promise((resolve, reject) => {
      const image = new Image();
      image.onload = () => resolve(image);
      image.onerror = () => reject(new Error('image decode failed'));
      image.src = url;
    });
  }

  function syncSideControls() {
    const row = byId('sideSelectRow');
    if (!row) return;
    const visible = canUseBackSide();
    row.hidden = !visible;
    const front = row.querySelector('[data-side="front"]');
    const back = row.querySelector('[data-side="back"]');
    if (front) front.textContent = '앞면 · PDF 1p';
    if (back) back.textContent = '뒷면 · PDF 2p';
    if (!visible && _fileSide === 'back') _fileSide = 'front';
  }

  function setFileInfo(message) {
    [byId('uploadFileInfo'), byId('canvasFileInfo')].forEach((element) => {
      if (!element) return;
      element.textContent = message;
      element.hidden = !message;
    });
  }

  function syncFileInfo() {
    if (!_file) {
      setFileInfo('');
      return;
    }
    if (_fileKind === 'pdf' && _pdfMeta) {
      const pageNumber = sidePageNumber(_fileSide) || 1;
      const meta = _pdfMeta.pages[pageNumber];
      const size = meta ? `${meta.widthMm.toFixed(1)} × ${meta.heightMm.toFixed(1)}mm` : '규격 확인 중';
      setFileInfo(`PDF ${_pdfMeta.pageCount}p · 현재 ${pageNumber}p · ${size}`);
      return;
    }
    if (_fileKind === 'image' && _naturalW && _naturalH) {
      setFileInfo(`${_naturalW} × ${_naturalH}px · 이미지`);
      return;
    }
    setFileInfo(_file.name || '파일');
  }

  function showUploadError(message) {
    const element = byId('uploadError');
    if (!element) return;
    element.textContent = message;
    element.hidden = false;
  }

  function clearUploadError() {
    const element = byId('uploadError');
    if (element) element.hidden = true;
  }

  function getLayout() {
    const specs = _specs;
    const bleed = specs.bleed || 0;
    const spine = PRODUCTS[_product]?.hasSpine ? (specs.spine || 0) : 0;
    const wing = specs.hasWing ? (specs.wingW || 0) : 0;
    const bleedTotal = _fileHasBleed ? 2 * bleed : 0;
    const fileW = PRODUCTS[_product]?.hasSpine
      ? 2 * (specs.trimW || 0) + spine + 2 * wing + bleedTotal
      : (specs.trimW || 0) + bleedTotal;
    return {
      fileW,
      fileH: (specs.trimH || 0) + bleedTotal,
      bleedMm: bleed,
      spineMm: spine,
      wingMm: wing,
    };
  }

  function getDisplayW(canvas) {
    const parent = canvas?.parentElement;
    return parent ? Math.max(Math.floor(parent.clientWidth) - 36, 300) : 640;
  }

  function drawCanvas() {
    const canvas = byId('previewCanvas');
    if (!canvas) return;
    const context = canvas.getContext('2d');
    const hasSpecs = Boolean((_specs.trimW || _specs.bookletPages) && _product);
    if (_imgEl) drawOverlayCanvas(canvas, context);
    else if (hasSpecs) drawTemplateCanvas(canvas, context);
    else drawEmptyCanvas(canvas, context);
    const tips = document.querySelector('.canvas-tips');
    if (tips) tips.hidden = Boolean(_imgEl);
  }

  function drawEmptyCanvas(canvas, context) {
    const width = getDisplayW(canvas);
    canvas.width = width;
    canvas.height = 380;
    context.fillStyle = '#f8fafc';
    context.fillRect(0, 0, width, 380);
    context.fillStyle = '#cbd5e1';
    context.textAlign = 'center';
    context.font = '600 14px Pretendard, sans-serif';
    context.fillText('왼쪽에서 제품 유형을 선택하고', width / 2, 175);
    context.fillText('사양을 입력하면 안내선이 표시됩니다', width / 2, 197);
    context.font = '12px Pretendard, sans-serif';
    context.fillText('파일 없이도 작업 전 규격 확인 가능합니다', width / 2, 225);
  }

  function drawTemplateCanvas(canvas, context) {
    if (PRODUCTS[_product]?.isBooklet) {
      drawBookletSpreadCanvas(canvas, context);
      return;
    }
    const layout = getLayout();
    if (!layout.fileW || !layout.fileH) {
      drawEmptyCanvas(canvas, context);
      return;
    }
    const width = getDisplayW(canvas);
    const scale = width / layout.fileW;
    canvas.width = width;
    canvas.height = Math.max(Math.round(layout.fileH * scale), 180);
    context.fillStyle = '#fff';
    context.fillRect(0, 0, canvas.width, canvas.height);
    drawProductZones(context, { x: 0, y: 0, w: canvas.width, h: canvas.height, mmX: scale, mmY: scale });
    drawGuideLines(context, { x: 0, y: 0, w: canvas.width, h: canvas.height, mmX: scale, mmY: scale });
    drawLegend(context, canvas);
  }

  function drawOverlayCanvas(canvas, context) {
    const width = getDisplayW(canvas);
    const aspect = _naturalW > 0 ? _naturalH / _naturalW : 1;
    canvas.width = width;
    canvas.height = Math.max(180, Math.round(width * aspect));
    context.fillStyle = '#e8eef5';
    context.fillRect(0, 0, canvas.width, canvas.height);
    const drawW = canvas.width * _scaleAdj;
    const drawH = canvas.height * _scaleAdj;
    const x = (canvas.width - drawW) / 2 + _offsetX;
    const y = (canvas.height - drawH) / 2 + _offsetY;
    context.drawImage(_imgEl, x, y, drawW, drawH);

    const layout = getLayout();
    if (!_product || !layout.fileW || !layout.fileH) return;
    const actual = currentPdfMeta();
    const mmX = actual?.widthMm ? drawW / actual.widthMm : drawW / layout.fileW;
    const mmY = actual?.heightMm ? drawH / actual.heightMm : drawH / layout.fileH;
    drawGuideLines(context, { x, y, w: drawW, h: drawH, mmX, mmY });
  }

  function currentPdfMeta() {
    if (!_pdfMeta) return null;
    return _pdfMeta.pages[sidePageNumber(_fileSide) || 1] || null;
  }

  function drawProductZones(context, frame) {
    const product = PRODUCTS[_product];
    const specs = _specs;
    const layout = getLayout();
    if (!product) return;
    const trimL = frame.x + (_fileHasBleed ? layout.bleedMm * frame.mmX : 0);
    const trimT = frame.y + (_fileHasBleed ? layout.bleedMm * frame.mmY : 0);
    const trimR = frame.x + frame.w - (_fileHasBleed ? layout.bleedMm * frame.mmX : 0);
    const trimB = frame.y + frame.h - (_fileHasBleed ? layout.bleedMm * frame.mmY : 0);
    if (product.hasSpine) {
      const wingPx = layout.wingMm * frame.mmX;
      const backL = trimL + wingPx;
      const spineL = backL + specs.trimW * frame.mmX;
      const spineR = spineL + layout.spineMm * frame.mmX;
      const frontR = spineR + specs.trimW * frame.mmX;
      drawZoneLabel(context, trimL, trimT, backL, trimB, layout.wingMm ? '뒷날개' : '', '#92400e');
      drawZoneLabel(context, backL, trimT, spineL, trimB, `뒤표지\n${specs.trimW}mm`, '#1e40af');
      if (layout.spineMm) drawZoneLabel(context, spineL, trimT, spineR, trimB, `책등\n${layout.spineMm}mm`, '#991b1b');
      drawZoneLabel(context, spineR, trimT, frontR, trimB, `앞표지\n${specs.trimW}mm`, '#1e40af');
      drawZoneLabel(context, frontR, trimT, trimR, trimB, layout.wingMm ? '앞날개' : '', '#92400e');
    } else if (product.hasFold) {
      drawLeafletPanelLines(context, trimL, trimT, trimR, trimB);
    } else {
      drawZoneLabel(context, trimL, trimT, trimR, trimB, `${product.label}\n${specs.trimW || '?'} × ${specs.trimH || '?'}mm`, '#334155');
    }
  }

  function drawLeafletPanelLines(context, trimL, trimT, trimR, trimB) {
    const fold = FOLD_PAGES[_specs.foldType || '3roll'];
    if (!fold) return;
    const pages = _fileSide === 'back' ? fold.inside : fold.outside;
    const panelW = (trimR - trimL) / pages.length;
    pages.forEach((pageNumber, index) => {
      const center = trimL + panelW * index + panelW / 2;
      const isCover = pageNumber === fold.cover;
      const isBack = pageNumber === fold.back;
      context.save();
      context.fillStyle = isCover ? '#1d4ed8' : isBack ? '#dc2626' : '#475569';
      context.textAlign = 'center';
      context.font = '900 14px Pretendard, sans-serif';
      context.fillText(`P${pageNumber}`, center, trimT + (trimB - trimT) * 0.45);
      context.restore();
    });
  }

  function drawGuideLines(context, frame) {
    const layout = getLayout();
    const specs = _specs;
    const trimL = frame.x + (_fileHasBleed ? layout.bleedMm * frame.mmX : 0);
    const trimT = frame.y + (_fileHasBleed ? layout.bleedMm * frame.mmY : 0);
    const trimR = frame.x + frame.w - (_fileHasBleed ? layout.bleedMm * frame.mmX : 0);
    const trimB = frame.y + frame.h - (_fileHasBleed ? layout.bleedMm * frame.mmY : 0);
    if (_fileHasBleed) drawRect(context, frame.x, frame.y, frame.w, frame.h, '#ec4899', 1.5, [7, 5]);
    drawRect(context, trimL, trimT, trimR - trimL, trimB - trimT, '#3b82f6', 1.5, [6, 4]);
    const safeX = (specs.safeZone || 0) * frame.mmX;
    const safeY = (specs.safeZone || 0) * frame.mmY;
    if (safeX || safeY) drawRect(context, trimL + safeX, trimT + safeY, Math.max(0, trimR - trimL - 2 * safeX), Math.max(0, trimB - trimT - 2 * safeY), '#22c55e', 1, []);

    if (PRODUCTS[_product]?.hasSpine && layout.spineMm) {
      const backL = trimL + layout.wingMm * frame.mmX;
      const spineL = backL + specs.trimW * frame.mmX;
      const spineR = spineL + layout.spineMm * frame.mmX;
      drawLine(context, spineL, trimT, spineL, trimB, '#ef4444', 1.5, [6, 4]);
      drawLine(context, spineR, trimT, spineR, trimB, '#ef4444', 1.5, [6, 4]);
      if (layout.wingMm) {
        drawLine(context, trimL + layout.wingMm * frame.mmX, trimT, trimL + layout.wingMm * frame.mmX, trimB, '#f59e0b', 1.5, [8, 4]);
        drawLine(context, trimR - layout.wingMm * frame.mmX, trimT, trimR - layout.wingMm * frame.mmX, trimB, '#f59e0b', 1.5, [8, 4]);
      }
    }
    if (PRODUCTS[_product]?.hasFold) {
      const panels = FOLD_TYPES[specs.foldType || '3roll']?.panels || 3;
      for (let index = 1; index < panels; index += 1) {
        const x = trimL + ((trimR - trimL) / panels) * index;
        drawLine(context, x, trimT, x, trimB, '#f59e0b', 1.5, [8, 4]);
      }
    }
  }

  function drawLegend(context, canvas) {
    if (!_product || _imgEl) return;
    const items = [];
    if (_fileHasBleed) items.push(['#ec4899', '작업선(도련)']);
    items.push(['#3b82f6', '재단선'], ['#22c55e', '안전 영역']);
    if (PRODUCTS[_product]?.hasSpine) items.push(['#ef4444', '책등']);
    if (PRODUCTS[_product]?.hasFold) items.push(['#f59e0b', '접지선']);
    const boxH = items.length * 18 + 12;
    context.save();
    context.fillStyle = 'rgba(255,255,255,.92)';
    context.strokeStyle = 'rgba(100,116,139,.25)';
    roundRect(context, 12, 12, 128, boxH, 7);
    context.fill();
    context.stroke();
    items.forEach(([color, label], index) => {
      const y = 12 + 6 + index * 18 + 9;
      context.strokeStyle = color;
      context.lineWidth = 1.5;
      context.beginPath();
      context.moveTo(22, y);
      context.lineTo(42, y);
      context.stroke();
      context.fillStyle = '#334155';
      context.font = '10px Pretendard, sans-serif';
      context.fillText(label, 48, y + 4);
    });
    context.restore();
  }

  function drawBookletSpreadCanvas(canvas, context) {
    const pages = parseInt(_specs.bookletPages, 10) || 0;
    const width = getDisplayW(canvas);
    if (pages < 4) {
      canvas.width = width;
      canvas.height = 200;
      context.fillStyle = '#f8fafc';
      context.fillRect(0, 0, width, 200);
      context.fillStyle = '#cbd5e1';
      context.textAlign = 'center';
      context.font = '600 13px Pretendard, sans-serif';
      context.fillText('소책자 페이지 수를 입력하면 시트 배치가 표시됩니다', width / 2, 100);
      return;
    }
    const imposition = computeImposition(pages);
    const rowH = 72;
    const gap = 6;
    canvas.width = width;
    canvas.height = 44 + imposition.sheets * 2 * (rowH + gap) + 14;
    context.fillStyle = '#f8fafc';
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.fillStyle = '#1e40af';
    context.textAlign = 'left';
    context.font = 'bold 12px Pretendard, sans-serif';
    context.fillText(`중철 임포지션 — ${imposition.pages}p / ${imposition.sheets}장`, 14, 26);
    const labelW = 68;
    const spreadW = width - labelW - 28;
    const pageW = (spreadW - gap) / 2;
    const pageH = rowH - 10;
    imposition.result.forEach((sheet, index) => {
      drawSpreadRow(context, '앞면', sheet.sheet, sheet.front, labelW, 14, 44 + index * 2 * (rowH + gap), pageW, pageH, gap, pages);
      drawSpreadRow(context, '뒷면', sheet.sheet, sheet.back, labelW, 14, 44 + (index * 2 + 1) * (rowH + gap), pageW, pageH, gap, pages);
    });
  }

  function drawSpreadRow(context, side, sheetNumber, pages, labelW, pad, y, pageW, pageH, gap, actualPages) {
    const left = pad + labelW;
    context.fillStyle = '#64748b';
    context.textAlign = 'right';
    context.font = 'bold 9px Pretendard, sans-serif';
    context.fillText(`시트 ${sheetNumber}`, pad + labelW - 4, y + pageH / 2);
    context.fillText(side, pad + labelW - 4, y + pageH / 2 + 12);
    drawSpreadPage(context, left, y + 5, pageW, pageH, pages[0], actualPages);
    drawSpreadPage(context, left + pageW + gap, y + 5, pageW, pageH, pages[1], actualPages);
  }

  function drawSpreadPage(context, x, y, w, h, pageNumber, actualPages) {
    const blank = pageNumber > actualPages;
    context.fillStyle = blank ? '#f1f5f9' : '#fff';
    context.strokeStyle = '#cbd5e1';
    roundRect(context, x, y, w, h, 6);
    context.fill();
    context.stroke();
    context.fillStyle = blank ? '#94a3b8' : '#334155';
    context.textAlign = 'center';
    context.font = 'bold 13px Pretendard, sans-serif';
    context.fillText(blank ? '빈 페이지' : `P${pageNumber}`, x + w / 2, y + h / 2 + 4);
  }

  function drawZoneLabel(context, x1, y1, x2, y2, text, color) {
    if (!text || x2 - x1 < 18) return;
    context.save();
    context.fillStyle = color;
    context.textAlign = 'center';
    context.font = '900 11px Pretendard, sans-serif';
    const lines = String(text).split('\n');
    lines.forEach((line, index) => context.fillText(line, (x1 + x2) / 2, (y1 + y2) / 2 + index * 14));
    context.restore();
  }

  function drawRect(context, x, y, w, h, color, lineWidth, dash) {
    if (w < 0 || h < 0) return;
    context.save();
    context.strokeStyle = color;
    context.lineWidth = lineWidth;
    context.setLineDash(dash || []);
    context.strokeRect(x, y, w, h);
    context.restore();
  }

  function drawLine(context, x1, y1, x2, y2, color, lineWidth, dash) {
    context.save();
    context.strokeStyle = color;
    context.lineWidth = lineWidth;
    context.setLineDash(dash || []);
    context.beginPath();
    context.moveTo(x1, y1);
    context.lineTo(x2, y2);
    context.stroke();
    context.restore();
  }

  function roundRect(context, x, y, w, h, radius) {
    const r = Math.min(radius, w / 2, h / 2);
    context.beginPath();
    context.moveTo(x + r, y);
    context.lineTo(x + w - r, y);
    context.quadraticCurveTo(x + w, y, x + w, y + r);
    context.lineTo(x + w, y + h - r);
    context.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    context.lineTo(x + r, y + h);
    context.quadraticCurveTo(x, y + h, x, y + h - r);
    context.lineTo(x, y + r);
    context.quadraticCurveTo(x, y, x + r, y);
    context.closePath();
  }

  function updateInfoPanels() {
    renderLeafletFoldGuide();
    renderImpositionGuide();
  }

  function renderLeafletFoldGuide() {
    const element = byId('leafletGuide');
    if (!element) return;
    if (_product !== 'leaflet') {
      element.hidden = true;
      return;
    }
    const foldKey = _specs.foldType || '3roll';
    const fold = FOLD_PAGES[foldKey];
    if (!fold) {
      element.hidden = true;
      return;
    }
    const cell = (page) => {
      const role = page === fold.cover ? '표지' : page === fold.back ? '뒷면' : '';
      return `<div class="fp-cell"><div class="fp-num">P${page}</div>${role ? `<div class="fp-role">${role}</div>` : ''}</div>`;
    };
    const separator = '<div class="fp-sep">|</div>';
    element.innerHTML = `<div class="info-kicker">리플렛 페이지 배치 — ${FOLD_TYPES[foldKey]?.label}</div><p class="info-desc">${fold.desc}</p><div class="fp-row"><span class="fp-side-label">앞면 인쇄</span><div class="fp-panels">${fold.outside.map(cell).join(separator)}</div></div><div class="fp-row" style="margin-top:8px"><span class="fp-side-label">뒷면 인쇄</span><div class="fp-panels">${fold.inside.map(cell).join(separator)}</div></div><p class="info-note">패널은 왼쪽→오른쪽 순서입니다 (평면 전개도 기준).</p>`;
    element.hidden = false;
  }

  function renderImpositionGuide() {
    const element = byId('impositionGuide');
    if (!element) return;
    if (_product !== 'booklet') {
      element.hidden = true;
      return;
    }
    const pages = parseInt(_specs.bookletPages, 10) || 0;
    const current = pages >= 4 ? computeImposition(pages) : null;
    const currentHtml = current ? `<div class="imp-preset"><div class="imp-preset-title">${pages}p → ${current.pages}p / ${current.sheets}장</div>${current.blank ? `<div class="imp-warn">⚠️ 빈 페이지 ${current.blank}장이 필요합니다.</div>` : '<div class="imp-ok">✅ 4의 배수 페이지입니다.</div>'}${impositionRows(current)}</div>` : '';
    element.innerHTML = `<div class="info-kicker">소책자 페이지 배치 (중철 기준)</div><p class="info-desc">중철 소책자는 4의 배수 페이지가 필요합니다.</p>${currentHtml}<div class="imp-presets">${[4, 8, 12, 16].map((value) => { const imp = computeImposition(value); return `<div class="imp-preset"><div class="imp-preset-title">${value}p (${imp.sheets}장)</div>${impositionRows(imp)}</div>`; }).join('')}</div>`;
    element.hidden = false;
  }

  function impositionRows(imposition) {
    return imposition.result.map((sheet) => `<div class="imp-row"><span class="imp-sheet-label">시트 ${sheet.sheet}</span><span class="imp-front">앞 <strong>P${sheet.front[0]}</strong>·<strong>P${sheet.front[1]}</strong></span><span class="imp-back">뒤 <strong>P${sheet.back[0]}</strong>·<strong>P${sheet.back[1]}</strong></span></div>`).join('');
  }

  function computeImposition(count) {
    const sourcePages = Math.max(0, Number(count) || 0);
    const pages = Math.ceil(sourcePages / 4) * 4;
    const sheets = pages / 4;
    const result = [];
    for (let index = 0; index < sheets; index += 1) {
      result.push({ sheet: index + 1, front: [pages - index * 2, index * 2 + 1], back: [index * 2 + 2, pages - index * 2 - 1] });
    }
    return { pages, sheets, blank: pages - sourcePages, result };
  }

  function bindForm() {
    byId('runBtn')?.addEventListener('click', runCheck);
    byId('resetBtn')?.addEventListener('click', resetAll);
    byId('specForm')?.addEventListener('input', () => {
      readSpecs();
      drawCanvas();
      updateInfoPanels();
    });
    byId('specForm')?.addEventListener('change', () => {
      readSpecs();
      drawCanvas();
      updateInfoPanels();
    });
  }

  function bindAdj() {
    byId('fileHasBleed')?.addEventListener('change', (event) => {
      _fileHasBleed = event.target.checked;
      drawCanvas();
    });
    document.querySelectorAll('.side-btn').forEach((button) => {
      button.addEventListener('click', () => setFileSide(button.dataset.side).catch((error) => {
        console.error(error);
        showUploadError('PDF 면 미리보기를 전환하지 못했습니다.');
      }));
    });
    byId('adjX')?.addEventListener('input', (event) => {
      _offsetX = Number(event.target.value) || 0;
      if (byId('adjXVal')) byId('adjXVal').textContent = `${_offsetX > 0 ? '+' : ''}${_offsetX} px`;
      drawCanvas();
    });
    byId('adjY')?.addEventListener('input', (event) => {
      _offsetY = Number(event.target.value) || 0;
      if (byId('adjYVal')) byId('adjYVal').textContent = `${_offsetY > 0 ? '+' : ''}${_offsetY} px`;
      drawCanvas();
    });
    byId('adjScale')?.addEventListener('input', (event) => {
      _scaleAdj = (Number(event.target.value) || 100) / 100;
      if (byId('adjScaleVal')) byId('adjScaleVal').textContent = `${event.target.value}%`;
      drawCanvas();
    });
    byId('resetAdjBtn')?.addEventListener('click', resetAdj);
  }

  function resetAdj() {
    _offsetX = 0;
    _offsetY = 0;
    _scaleAdj = 1;
    _fileHasBleed = false;
    if (byId('adjX')) byId('adjX').value = 0;
    if (byId('adjY')) byId('adjY').value = 0;
    if (byId('adjScale')) byId('adjScale').value = 100;
    if (byId('adjXVal')) byId('adjXVal').textContent = '0 px';
    if (byId('adjYVal')) byId('adjYVal').textContent = '0 px';
    if (byId('adjScaleVal')) byId('adjScaleVal').textContent = '100%';
    if (byId('fileHasBleed')) byId('fileHasBleed').checked = false;
    drawCanvas();
  }

  function runCheck() {
    if (!_product) {
      alert('제품 유형을 먼저 선택해 주세요.');
      return false;
    }
    const specs = readSpecs();
    if (!specs.trimW || !specs.trimH) {
      alert('재단 폭과 높이를 입력해 주세요.');
      return false;
    }
    drawCanvas();
    _reportItems = [];
    checkBleed(specs);
    checkSafeZone(specs);
    if (PRODUCTS[_product].hasSpine) checkSpine(specs);
    if (PRODUCTS[_product].hasFold) checkFold(specs);
    checkDimensions(specs);
    checkUploadedFile(specs);
    renderReport();
    return true;
  }

  function checkBleed(specs) {
    const ok = specs.bleed >= 3;
    addItem('재단선 여유', ok ? 'pass' : 'warn', `${specs.bleed}mm`, ok ? '권장(3mm) 이상' : '3mm 미만 — 흰 테두리가 생길 수 있습니다.');
  }

  function checkSafeZone(specs) {
    const ok = specs.safeZone >= 3;
    addItem('안전 영역', ok ? 'pass' : 'warn', `${specs.safeZone}mm`, ok ? '권장(3mm) 이상' : '3mm 미만 — 텍스트가 재단될 수 있습니다.');
  }

  function checkSpine(specs) {
    if (!specs.spine) {
      addItem('책등 두께', 'warn', '미입력', '책등 두께를 입력해 주세요.');
      return;
    }
    const total = specs.trimW * 2 + specs.spine + (specs.hasWing ? (specs.wingW || 0) * 2 : 0) + (_fileHasBleed ? (specs.bleed || 0) * 2 : 0);
    addItem('책등 구성', 'pass', `전체 ${total.toFixed(1)}mm`, '뒤표지 + 책등 + 앞표지 + 날개/도련을 합산했습니다.');
  }

  function checkFold(specs) {
    const fold = FOLD_TYPES[specs.foldType] || FOLD_TYPES['3roll'];
    addItem(`접지(${fold.label})`, 'pass', `패널 ${fold.panels}개`, `패널 기준 폭 ${(specs.trimW / fold.panels).toFixed(2)}mm · 거터 ${specs.gutterMargin || 0}mm`);
  }

  function checkDimensions(specs) {
    const standard = [
      { w: 210, h: 297, n: 'A4' }, { w: 297, h: 210, n: 'A4 가로' },
      { w: 148, h: 210, n: 'A5' }, { w: 210, h: 148, n: 'A5 가로' },
      { w: 182, h: 257, n: 'B5' }, { w: 257, h: 182, n: 'B5 가로' },
      { w: 100, h: 210, n: 'DL' },
    ];
    const match = standard.find((item) => Math.abs(item.w - specs.trimW) < 1 && Math.abs(item.h - specs.trimH) < 1);
    addItem('재단 규격', match ? 'pass' : 'info', `${specs.trimW} × ${specs.trimH}mm`, match ? `표준 규격(${match.n})` : '비표준 규격 — 인쇄소 사양과 대조하세요.');
  }

  function checkUploadedFile(specs) {
    if (!_file) {
      addItem('업로드 파일', 'info', '미업로드', '파일을 올리면 실제 PDF 페이지 규격과 페이지 수까지 비교합니다.');
      return;
    }
    if (_fileKind === 'image') {
      addItem('이미지 원본', 'info', `${_naturalW} × ${_naturalH}px`, '이미지 파일은 브라우저에서 신뢰할 수 있는 물리 DPI를 일관되게 읽기 어려워 mm 자동 판정은 PDF에서 수행합니다.');
      return;
    }
    if (!_pdfMeta) {
      addItem('PDF 분석', 'fail', '분석 정보 없음', 'PDF를 다시 업로드해 주세요.');
      return;
    }

    const pageCount = _pdfMeta.pageCount;
    let pageStatus = 'pass';
    let pageGuide = `${pageCount}페이지 PDF입니다.`;
    if (_product === 'leaflet' && pageCount < 2) {
      pageStatus = 'warn';
      pageGuide = '양면 리플렛은 보통 앞면/뒷면 2페이지 PDF를 사용합니다.';
    } else if (_product === 'booklet' && specs.bookletPages && pageCount !== specs.bookletPages) {
      pageStatus = 'warn';
      pageGuide = `입력한 ${specs.bookletPages}p와 PDF ${pageCount}p가 다릅니다.`;
    } else if (_product === 'cover' && pageCount > 1) {
      pageStatus = 'info';
      pageGuide = '전체 표지는 보통 앞·책등·뒤가 연결된 1페이지 펼침 PDF입니다.';
    }
    addItem('PDF 페이지 수', pageStatus, `${pageCount}p`, pageGuide);

    const layout = getLayout();
    const pagesToCheck = canUseBackSide() ? [1, 2] : [1];
    pagesToCheck.forEach((pageNumber) => {
      const meta = _pdfMeta.pages[pageNumber];
      if (!meta) return;
      const widthDiff = Math.abs(meta.widthMm - layout.fileW);
      const heightDiff = Math.abs(meta.heightMm - layout.fileH);
      const swapped = Math.abs(meta.widthMm - layout.fileH) <= PDF_MM_TOLERANCE && Math.abs(meta.heightMm - layout.fileW) <= PDF_MM_TOLERANCE;
      const ok = widthDiff <= PDF_MM_TOLERANCE && heightDiff <= PDF_MM_TOLERANCE;
      const detail = `${meta.widthMm.toFixed(1)} × ${meta.heightMm.toFixed(1)}mm`;
      const expected = `${layout.fileW.toFixed(1)} × ${layout.fileH.toFixed(1)}mm`;
      const status = ok ? 'pass' : 'fail';
      const guide = ok ? `설정 규격 ${expected}와 일치합니다.` : swapped ? `설정 규격 ${expected}와 가로·세로 방향이 뒤바뀌었습니다.` : `설정 규격 ${expected}와 다릅니다.`;
      addItem(`PDF 실제 규격${pagesToCheck.length > 1 ? ` (${pageNumber}p)` : ''}`, status, detail, guide);
    });
  }

  function addItem(label, status, detail, guide) {
    _reportItems.push({ label, status, detail, guide });
  }

  function renderReport() {
    const section = byId('reportSection');
    const grid = byId('reportGrid');
    const summary = byId('reportSummary');
    if (!section || !grid || !summary) return;
    grid.replaceChildren();
    const counts = { pass: 0, warn: 0, fail: 0, info: 0 };
    _reportItems.forEach((item) => {
      counts[item.status] = (counts[item.status] || 0) + 1;
      const card = document.createElement('div');
      card.className = `report-card status-${item.status}`;
      const icon = { pass: '✅', warn: '⚠️', fail: '❌', info: 'ℹ️' }[item.status] || 'ℹ️';
      card.innerHTML = `<div class="rc-head"><span class="rc-icon">${icon}</span><strong class="rc-label">${item.label}</strong></div><div class="rc-detail">${item.detail}</div><div class="rc-guide">${item.guide}</div>`;
      grid.appendChild(card);
    });
    const overall = counts.fail ? 'fail' : counts.warn ? 'warn' : 'pass';
    summary.className = `report-summary status-${overall}`;
    summary.innerHTML = `<strong>${{ pass: '이상 없음', warn: '주의 필요', fail: '조치 필요' }[overall]}</strong> — 통과 ${counts.pass}, 주의 ${counts.warn}, 오류 ${counts.fail}`;
    section.hidden = false;
    section.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  function clearReport() {
    const section = byId('reportSection');
    if (section) section.hidden = true;
    const grid = byId('reportGrid');
    if (grid) grid.replaceChildren();
  }

  function resetFileRuntime(options = {}) {
    _file = null;
    _fileKind = '';
    _imgEl = null;
    _naturalW = 0;
    _naturalH = 0;
    _fileSide = 'front';
    _pdfMeta = null;
    _pdfRenderCache = new Map();
    const previous = _pdfDoc;
    _pdfDoc = null;
    try { previous?.destroy?.(); } catch (_) {}
    if (!options.keepFileInput && byId('fileInput')) byId('fileInput').value = '';
    syncSideControls();
  }

  function resetAll() {
    _loadSerial += 1;
    resetFileRuntime();
    _product = null;
    _specs = {};
    _reportItems = [];
    resetAdj();
    const filename = byId('uploadFilename');
    if (filename) filename.style.display = 'none';
    byId('uploadZone')?.classList.remove('has-file');
    clearUploadError();
    setFileInfo('');
    const adjPanel = byId('adjPanel');
    if (adjPanel) adjPanel.hidden = true;
    document.querySelectorAll('.product-card').forEach((card) => card.classList.remove('selected'));
    const specSection = byId('specSection');
    if (specSection) specSection.hidden = true;
    const form = byId('specForm');
    if (form) form.innerHTML = '';
    clearReport();
    const leaflet = byId('leafletGuide');
    if (leaflet) leaflet.hidden = true;
    const imposition = byId('impositionGuide');
    if (imposition) imposition.hidden = true;
    if (history?.replaceState) {
      const url = new URL(location.href);
      url.searchParams.delete('product');
      history.replaceState(null, '', `${url.pathname}${url.search}${url.hash}`);
    }
    drawCanvas();
  }

  function getState() {
    return {
      product: _product,
      fileKind: _fileKind,
      fileSide: _fileSide,
      pdfPageCount: _pdfMeta?.pageCount || 0,
      pdfPages: _pdfMeta ? JSON.parse(JSON.stringify(_pdfMeta.pages)) : {},
      specs: { ..._specs },
      reportItems: _reportItems.map((item) => ({ ...item })),
    };
  }

  return {
    init,
    selectProduct,
    inspectFile,
    setFileSide,
    runCheck,
    getState,
    computeImposition,
    stage: 'print-checker-v2-real-pdf-preview',
    __test: { normalizeProduct, getLayout, checkUploadedFile },
  };
})();

document.addEventListener('DOMContentLoaded', () => PrintChecker.init());
