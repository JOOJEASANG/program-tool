/* print-checker.js — 인쇄물 사전 검토 v20260904-1 */
'use strict';

const PrintChecker = (() => {
  /* ---------- 상수 ---------- */
  const PRODUCTS = {
    cover:      { label: '표지',         icon: '📚', desc: '앞표지 + 책등 + 뒤표지', hasFold: false, hasSpine: true,  isBooklet: false },
    leaflet:    { label: '리플렛',       icon: '📄', desc: '2단·3단·4단 접지',       hasFold: true,  hasSpine: false, isBooklet: false },
    flyer:      { label: '전단지/포스터', icon: '🖼️', desc: '단면 전단지·포스터',    hasFold: false, hasSpine: false, isBooklet: false },
    invitation: { label: '초대장/안내장', icon: '💌', desc: '단면 평판 초대장',       hasFold: false, hasSpine: false, isBooklet: false },
    booklet:    { label: '소책자',       icon: '📖', desc: '중철 4·8·12·16p',       hasFold: false, hasSpine: false, isBooklet: true  },
  };

  const FOLD_TYPES = {
    '2fold':  { label: '반접기 (2단)',         panels: 2 },
    '3roll':  { label: '말아접기 (3단)',        panels: 3 },
    '3zfold': { label: 'Z접기 (3단 지그재그)', panels: 3 },
    '4fold':  { label: '4단 접기',             panels: 4 },
  };

  /*
   * 접지 방식별 페이지 배치 (평면 전개도 기준, 왼쪽→오른쪽)
   * outside: 인쇄 앞면(외부) 패널의 페이지 번호 배열
   * inside:  인쇄 뒷면(내부) 패널의 페이지 번호 배열
   * cover: 표지 페이지 번호, back: 뒷면 페이지 번호
   */
  const FOLD_PAGES = {
    '2fold':  {
      outside: [4, 1], inside: [2, 3], total: 4, cover: 1, back: 4,
      desc: '반접기 — 총 4페이지. 오른쪽 패널이 표지(P1), 왼쪽이 뒷면(P4).',
    },
    '3roll':  {
      outside: [6, 5, 1], inside: [2, 3, 4], total: 6, cover: 1, back: 6,
      desc: '말아접기 — 총 6페이지. 가장 오른쪽(P1)이 표지, 왼쪽(P6)이 뒷면. P5는 표지 뒤에 숨겨집니다.',
    },
    '3zfold': {
      outside: [1, 2, 3], inside: [6, 5, 4], total: 6, cover: 1, back: 6,
      desc: 'Z접기 — 총 6페이지. 가장 왼쪽(P1)이 표지. 지그재그로 접힙니다.',
    },
    '4fold':  {
      outside: [8, 7, 6, 1], inside: [2, 3, 4, 5], total: 8, cover: 1, back: 8,
      desc: '4단 접기 — 총 8페이지. 가장 오른쪽(P1)이 표지, 왼쪽 끝(P8)이 뒷면.',
    },
  };

  const PAPER_TYPES = {
    mojo80:  { label: '모조지 80g',    mmPerSheet: 0.100 },
    mojo100: { label: '모조지 100g',   mmPerSheet: 0.130 },
    snow80:  { label: '스노우지 80g',  mmPerSheet: 0.090 },
    snow100: { label: '스노우지 100g', mmPerSheet: 0.110 },
    snow120: { label: '스노우지 120g', mmPerSheet: 0.135 },
    art80:   { label: '아트지 80g',    mmPerSheet: 0.090 },
    art100:  { label: '아트지 100g',   mmPerSheet: 0.105 },
    art130:  { label: '아트지 130g',   mmPerSheet: 0.140 },
    custom:  { label: '직접 입력',     mmPerSheet: null  },
  };

  /* ---------- 상태 ---------- */
  let _file = null, _imgEl = null, _naturalW = 0, _naturalH = 0;
  let _product = null, _specs = {}, _reportItems = [];
  let _offsetX = 0, _offsetY = 0, _scaleAdj = 1.0, _fileHasBleed = false;
  let _fileSide = 'front';

  const byId = id => document.getElementById(id);

  /* ---------- 초기화 ---------- */
  function init() {
    renderProductCards();
    bindUpload();
    bindForm();
    bindAdj();
    drawCanvas();
  }

  /* ---------- 제품 카드 ---------- */
  function renderProductCards() {
    const grid = byId('productGrid');
    Object.entries(PRODUCTS).forEach(([key, p]) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'product-card';
      btn.dataset.product = key;
      btn.innerHTML = `<span class="pc-icon">${p.icon}</span><strong class="pc-label">${p.label}</strong><small class="pc-desc">${p.desc}</small>`;
      btn.addEventListener('click', () => selectProduct(key));
      grid.appendChild(btn);
    });
  }

  function selectProduct(key) {
    _product = key;
    document.querySelectorAll('.product-card').forEach(c => c.classList.toggle('selected', c.dataset.product === key));
    renderSpecForm(key);
    byId('specSection').hidden = false;
    clearReport();
    drawCanvas();
    updateInfoPanels();
  }

  /* ---------- 사양 폼 ---------- */
  function renderSpecForm(key) {
    const p = PRODUCTS[key];
    const form = byId('specForm');
    form.innerHTML = '';

    const mmField = (id, label, hint, def) => {
      const w = document.createElement('div');
      w.className = 'spec-field';
      w.innerHTML = `<label class="spec-label" for="${id}">${label}<small class="spec-hint">${hint}</small></label>
        <div class="spec-input-row">
          <input class="spec-input" id="${id}" type="number" min="0" step="0.1" placeholder="${def}" value="${_specs[id] ?? ''}">
          <span class="spec-unit">mm</span>
        </div>`;
      form.appendChild(w);
    };

    if (!p.isBooklet) {
      mmField('trimW', '재단 폭 (Trim Width)', '재단 후 최종 가로', '210');
      mmField('trimH', '재단 높이 (Trim Height)', '재단 후 최종 세로', '297');
    } else {
      /* 소책자는 완성판 크기 */
      mmField('trimW', '완성판 폭', '접은 후 가로 크기', '148');
      mmField('trimH', '완성판 높이', '접은 후 세로 크기', '210');
    }

    if (p.hasSpine) {
      /* 종이 종류 + 페이지 수 → 책등 자동 계산 */
      const ptWrap = document.createElement('div');
      ptWrap.className = 'spec-field';
      ptWrap.innerHTML = `<label class="spec-label" for="paperType">종이 종류<small class="spec-hint">책등 두께 자동 계산</small></label>
        <select class="spec-input spec-select" id="paperType">
          ${Object.entries(PAPER_TYPES).map(([v,t]) => `<option value="${v}" ${(_specs.paperType||'mojo80')===v?'selected':''}>${t.label}</option>`).join('')}
        </select>`;
      form.appendChild(ptWrap);

      const pgWrap = document.createElement('div');
      pgWrap.className = 'spec-field';
      pgWrap.innerHTML = `<label class="spec-label" for="pageCount">페이지 수<small class="spec-hint">총 페이지 (표지 제외)</small></label>
        <div class="spec-input-row">
          <input class="spec-input" id="pageCount" type="number" min="2" step="2" placeholder="100" value="${_specs.pageCount ?? ''}">
          <span class="spec-unit">p</span>
        </div>`;
      form.appendChild(pgWrap);

      const spWrap = document.createElement('div');
      spWrap.className = 'spec-field';
      spWrap.innerHTML = `<label class="spec-label" for="spine">책등 두께<small class="spec-hint" id="spineHint">종이·페이지 선택 시 자동 계산</small></label>
        <div class="spec-input-row">
          <input class="spec-input" id="spine" type="number" min="0" step="0.1" placeholder="0.0" value="${_specs.spine ?? ''}">
          <span class="spec-unit">mm</span>
        </div>`;
      form.appendChild(spWrap);

      const wingWrap = document.createElement('div');
      wingWrap.className = 'spec-field wing-group';
      wingWrap.innerHTML = `<label class="spec-check-row">
          <input type="checkbox" id="hasWing" ${_specs.hasWing?'checked':''}>
          <span>날개(플랩) 포함</span>
        </label>
        <div id="wingWGroup" style="margin-top:8px" ${_specs.hasWing?'':' hidden'}>
          <div class="spec-input-row">
            <input class="spec-input" id="wingW" type="number" min="0" step="1" placeholder="90" value="${_specs.wingW??''}">
            <span class="spec-unit">mm</span>
          </div>
          <small class="spec-hint">날개 폭 (앞·뒷날개 동일)</small>
        </div>`;
      form.appendChild(wingWrap);

      const autoSpine = () => {
        const ptKey = byId('paperType')?.value;
        const pages = parseInt(byId('pageCount')?.value) || 0;
        const spineEl = byId('spine');
        if (ptKey && ptKey !== 'custom' && pages >= 2 && spineEl && !spineEl.dataset.manual) {
          const val = calcSpine(ptKey, pages);
          if (val !== null) { spineEl.value = val; byId('spineHint').textContent = `자동 계산: ${val}mm`; }
        }
        readSpecs(); drawCanvas(); updateInfoPanels();
      };
      byId('paperType')?.addEventListener('change', autoSpine);
      byId('pageCount')?.addEventListener('input', autoSpine);
      byId('spine')?.addEventListener('input', e => {
        e.target.dataset.manual = e.target.value ? '1' : '';
        byId('spineHint').textContent = '직접 입력 중';
        readSpecs(); drawCanvas();
      });
      byId('hasWing')?.addEventListener('change', e => { byId('wingWGroup').hidden = !e.target.checked; readSpecs(); drawCanvas(); });
      byId('wingW')?.addEventListener('input', () => { readSpecs(); drawCanvas(); });
    }

    if (p.hasFold) {
      const ftWrap = document.createElement('div');
      ftWrap.className = 'spec-field';
      ftWrap.innerHTML = `<label class="spec-label" for="foldType">접지 방식<small class="spec-hint">접지 유형 선택</small></label>
        <select class="spec-input spec-select" id="foldType">
          ${Object.entries(FOLD_TYPES).map(([v,f]) => `<option value="${v}" ${_specs.foldType===v?'selected':''}>${f.label}</option>`).join('')}
        </select>`;
      form.appendChild(ftWrap);
      byId('foldType')?.addEventListener('change', () => { readSpecs(); drawCanvas(); updateInfoPanels(); });

      const gmWrap = document.createElement('div');
      gmWrap.className = 'spec-field';
      gmWrap.innerHTML = `<label class="spec-label" for="gutterMargin">거터 (Gutter)<small class="spec-hint">패널 사이 여백 기준</small></label>
        <div class="spec-input-row">
          <input class="spec-input" id="gutterMargin" type="number" min="0" step="0.1" placeholder="3" value="${_specs.gutterMargin??''}">
          <span class="spec-unit">mm</span>
        </div>`;
      form.appendChild(gmWrap);
    }

    if (p.isBooklet) {
      /* 소책자: 페이지 수 입력 → 인쇄 시트 계산 */
      const bpWrap = document.createElement('div');
      bpWrap.className = 'spec-field';
      bpWrap.innerHTML = `<label class="spec-label" for="bookletPages">총 페이지 수<small class="spec-hint">4의 배수 권장 (중철 기준)</small></label>
        <div class="spec-input-row">
          <input class="spec-input" id="bookletPages" type="number" min="4" step="1" placeholder="8" value="${_specs.bookletPages??''}">
          <span class="spec-unit">p</span>
        </div>`;
      form.appendChild(bpWrap);
      byId('bookletPages')?.addEventListener('input', () => { readSpecs(); updateInfoPanels(); });

      const ptWrap2 = document.createElement('div');
      ptWrap2.className = 'spec-field';
      ptWrap2.innerHTML = `<label class="spec-label" for="paperType">종이 종류<small class="spec-hint">두께 참고용</small></label>
        <select class="spec-input spec-select" id="paperType">
          ${Object.entries(PAPER_TYPES).map(([v,t]) => `<option value="${v}" ${(_specs.paperType||'mojo80')===v?'selected':''}>${t.label}</option>`).join('')}
        </select>`;
      form.appendChild(ptWrap2);
    }

    mmField('bleed',    '재단선 여유 (Bleed)',   '재단선 바깥 여분 (보통 3mm)', '3');
    mmField('safeZone', '안전 영역 (Safe Zone)', '텍스트·로고 여백 (보통 3mm)', '3');
  }

  function calcSpine(paperKey, pageCount) {
    const pt = PAPER_TYPES[paperKey];
    if (!pt?.mmPerSheet || pageCount < 2) return null;
    return Math.round((pageCount / 2) * pt.mmPerSheet * 10) / 10;
  }

  function readSpecs() {
    const s = {};
    ['trimW','trimH','spine','bleed','safeZone','gutterMargin','wingW','bookletPages'].forEach(id => {
      const el = byId(id); if (el) s[id] = parseFloat(el.value) || 0;
    });
    const pcEl = byId('pageCount');    if (pcEl) s.pageCount    = parseInt(pcEl.value) || 0;
    const ftEl = byId('foldType');    if (ftEl) s.foldType     = ftEl.value;
    const ptEl = byId('paperType');   if (ptEl) s.paperType    = ptEl.value;
    const hwEl = byId('hasWing');     if (hwEl) s.hasWing      = hwEl.checked;
    _specs = s;
    return s;
  }

  /* ---------- 업로드 ---------- */
  function bindUpload() {
    const zone = byId('uploadZone'), input = byId('fileInput');
    zone.addEventListener('click', () => input.click());
    zone.addEventListener('keydown', e => { if (e.key==='Enter'||e.key===' ') input.click(); });
    zone.addEventListener('dragover', e => { e.preventDefault(); zone.classList.add('dragover'); });
    zone.addEventListener('dragleave', () => zone.classList.remove('dragover'));
    zone.addEventListener('drop', e => { e.preventDefault(); zone.classList.remove('dragover'); handleFile(e.dataTransfer.files[0]); });
    input.addEventListener('change', () => handleFile(input.files[0]));
  }

  function handleFile(file) {
    if (!file) return;
    if (!file.type.match(/^(application\/pdf|image\/(png|jpeg|tiff?|webp))$/i)) {
      showUploadError('PDF 또는 이미지(PNG·JPEG·TIFF·WEBP)만 지원합니다.'); return;
    }
    _file = file;
    byId('uploadFilename').textContent = file.name;
    byId('uploadFilename').style.display = 'block';
    byId('uploadZone').classList.add('has-file');
    clearUploadError();
    byId('adjPanel').hidden = false;
    const sideRow = byId('sideSelectRow');
    if (sideRow) sideRow.hidden = false;
    const reader = new FileReader();
    reader.onload = e => {
      if (file.type === 'application/pdf') loadPdfPreview(e.target.result);
      else loadImagePreview(e.target.result);
    };
    reader.readAsDataURL(file);
  }

  function loadImagePreview(dataUrl) {
    const img = new Image();
    img.onload = () => {
      _imgEl = img; _naturalW = img.naturalWidth; _naturalH = img.naturalHeight;
      drawCanvas();
      byId('fileInfo').textContent = `${_naturalW} × ${_naturalH} px (이미지)`;
      byId('fileInfo').hidden = false;
    };
    img.src = dataUrl;
  }

  function loadPdfPreview(dataUrl) {
    const img = new Image();
    img.onload = () => {
      _imgEl = img; _naturalW = img.naturalWidth; _naturalH = img.naturalHeight;
      drawCanvas();
      byId('fileInfo').textContent = 'PDF (첫 페이지 미리보기)';
      byId('fileInfo').hidden = false;
    };
    img.onerror = () => { byId('fileInfo').textContent = 'PDF (미리보기 불가)'; byId('fileInfo').hidden = false; };
    img.src = dataUrl;
  }

  function showUploadError(msg) { const el = byId('uploadError'); el.textContent = msg; el.hidden = false; }
  function clearUploadError() { byId('uploadError').hidden = true; }

  /* ---------- 레이아웃 계산 ---------- */
  function getLayout() {
    const s = _specs;
    const bleed = s.bleed || 0;
    const spine = (PRODUCTS[_product]?.hasSpine && s.spine) ? s.spine : 0;
    const wing  = (s.hasWing && s.wingW) ? s.wingW : 0;
    let fileW;
    if (PRODUCTS[_product]?.hasSpine)
      fileW = 2*(s.trimW||0) + spine + 2*wing + (_fileHasBleed ? 2*bleed : 0);
    else
      fileW = (s.trimW||0) + (_fileHasBleed ? 2*bleed : 0);
    return { fileW, fileH: (s.trimH||0) + (_fileHasBleed ? 2*bleed : 0), bleedMm: bleed, spineMm: spine, wingMm: wing };
  }

  /* ---------- 캔버스 ---------- */
  function getDisplayW(canvas) {
    const p = canvas.parentElement;
    return p ? Math.max(Math.floor(p.clientWidth) - 36, 300) : 640;
  }

  function drawCanvas() {
    const canvas = byId('previewCanvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const hasSpecs = !!((_specs.trimW || _specs.bookletPages) && _product);

    if (_imgEl)           drawOverlayCanvas(canvas, ctx);
    else if (hasSpecs)    drawTemplateCanvas(canvas, ctx);
    else                  drawEmptyCanvas(canvas, ctx);

    /* 파일 업로드 시 tips 박스 숨김 */
    const tips = document.querySelector('.canvas-tips');
    if (tips) tips.hidden = !!_imgEl;
  }

  function drawEmptyCanvas(canvas, ctx) {
    const dw = getDisplayW(canvas);
    canvas.width = dw; canvas.height = 380;
    ctx.fillStyle = '#f8fafc'; ctx.fillRect(0, 0, dw, 380);
    ctx.fillStyle = '#cbd5e1'; ctx.textAlign = 'center';
    ctx.font = '600 14px Pretendard, sans-serif';
    ctx.fillText('왼쪽에서 제품 유형을 선택하고', dw/2, 175);
    ctx.fillText('사양을 입력하면 안내선이 표시됩니다', dw/2, 197);
    ctx.font = '12px Pretendard, sans-serif';
    ctx.fillText('파일 없이도 작업 전 규격 확인 가능합니다', dw/2, 225);
  }

  function drawTemplateCanvas(canvas, ctx) {
    /* 소책자는 스프레드 시트 레이아웃 */
    if (PRODUCTS[_product]?.isBooklet) { drawBookletSpreadCanvas(canvas, ctx); return; }

    const s = _specs;
    const layout = getLayout();
    if (!layout.fileW || !layout.fileH) { drawEmptyCanvas(canvas, ctx); return; }

    const dw = getDisplayW(canvas);
    const scale = dw / layout.fileW;
    canvas.width = dw;
    canvas.height = Math.max(Math.round(layout.fileH * scale), 180);

    const mX = mm => mm * scale;

    /* 흰 배경 (색 채우기 없음) */
    ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, canvas.width, canvas.height);

    const trimL = _fileHasBleed ? mX(layout.bleedMm) : 0;
    const trimT = _fileHasBleed ? mX(layout.bleedMm) : 0;
    const trimR = canvas.width  - (_fileHasBleed ? mX(layout.bleedMm) : 0);
    const trimB = canvas.height - (_fileHasBleed ? mX(layout.bleedMm) : 0);

    if (PRODUCTS[_product].hasSpine) {
      /* 표지: 존 레이블만 표시 (색 채우기 없음) */
      const wingPx = mX(layout.wingMm);
      const backL  = trimL + wingPx;
      const spineL = backL + mX(s.trimW);
      const spineR = spineL + mX(layout.spineMm);
      const frontR = spineR + mX(s.trimW);

      drawZoneLabel(ctx, trimL,  trimT, backL,  trimB, layout.wingMm?'뒷날개':'', '#92400e', scale<1.6);
      drawZoneLabel(ctx, backL,  trimT, spineL, trimB, `뒤표지\n${s.trimW}mm`,   '#1e40af', scale<1.6);
      if (layout.spineMm>0) drawZoneLabel(ctx, spineL, trimT, spineR, trimB, `책등\n${layout.spineMm}mm`, '#991b1b', scale<1.6);
      drawZoneLabel(ctx, spineR, trimT, frontR, trimB, `앞표지\n${s.trimW}mm`,   '#1e40af', scale<1.6);
      drawZoneLabel(ctx, frontR, trimT, trimR,  trimB, layout.wingMm?'앞날개':'', '#92400e', scale<1.6);

      if (s.trimH) {
        ctx.save(); ctx.translate(8,(trimT+trimB)/2); ctx.rotate(-Math.PI/2);
        ctx.fillStyle='#475569'; ctx.font='bold 10px Pretendard,sans-serif'; ctx.textAlign='center';
        ctx.fillText(`${s.trimH}mm`,0,0); ctx.restore();
      }
    } else if (PRODUCTS[_product].hasFold) {
      /* 리플렛: 패널 구분 + 페이지 번호 */
      drawLeafletPanelLines(ctx, trimL, trimT, trimR, trimB, scale);
    } else {
      drawZoneLabel(ctx, trimL, trimT, trimR, trimB,
        `${PRODUCTS[_product].label}\n${s.trimW||'?'} × ${s.trimH||'?'}mm`, '#334155', false);
    }

    drawGuideLines(ctx, canvas, scale);
    drawLegend(ctx, canvas);
  }

  /* 리플렛 패널 선 + 페이지 번호 (색 채우기 없음) */
  function drawLeafletPanelLines(ctx, trimL, trimT, trimR, trimB, scale) {
    const foldKey = _specs.foldType || '3roll';
    const fp = FOLD_PAGES[foldKey];
    if (!fp) return;

    const panels = fp.outside.length;
    const trimW = trimR - trimL;
    const trimH = trimB - trimT;
    const panelW = trimW / panels;
    const smallText = panelW < 80;

    fp.outside.forEach((pageNum, i) => {
      const x  = trimL + panelW * i;
      const cx = x + panelW / 2;

      /* 페이지 번호 */
      const isC = pageNum === fp.cover, isB = pageNum === fp.back;
      const textColor = isC ? '#1d4ed8' : isB ? '#dc2626' : '#475569';
      const fontSize  = smallText ? 11 : 15;
      ctx.save();
      ctx.fillStyle = textColor;
      ctx.textAlign = 'center';
      ctx.font = `900 ${fontSize}px Pretendard, sans-serif`;
      ctx.fillText(`P${pageNum}`, cx, trimT + trimH * 0.45);

      const roleLabel = isC ? '표지' : isB ? '뒷면' : '';
      if (roleLabel) {
        ctx.font = `700 ${smallText?8:10}px Pretendard, sans-serif`;
        ctx.fillText(roleLabel, cx, trimT + trimH * 0.45 + (smallText?12:15));
      }
      ctx.restore();
    });
  }

  /* 소책자: 중철 스프레드 레이아웃 시각화 */
  function drawBookletSpreadCanvas(canvas, ctx) {
    const s = _specs;
    const dw = getDisplayW(canvas);
    const userPages = parseInt(s.bookletPages) || 0;

    if (userPages < 4) {
      canvas.width = dw; canvas.height = 200;
      ctx.fillStyle = '#f8fafc'; ctx.fillRect(0, 0, dw, 200);
      ctx.fillStyle = '#cbd5e1'; ctx.textAlign = 'center';
      ctx.font = '600 13px Pretendard, sans-serif';
      ctx.fillText('소책자 페이지 수를 입력하면', dw/2, 85);
      ctx.fillText('시트 배치 레이아웃이 표시됩니다', dw/2, 105);
      ctx.font = '11px Pretendard, sans-serif';
      ctx.fillText('예: 8p, 12p, 16p (4의 배수 권장)', dw/2, 130);
      return;
    }

    const imp = computeImposition(userPages);
    const rowH = 72, labelW = 68, padH = 14, gap = 6;
    const rows = imp.sheets * 2;

    canvas.width = dw;
    canvas.height = 44 + rows * (rowH + gap) + padH;

    ctx.fillStyle = '#f8fafc'; ctx.fillRect(0, 0, canvas.width, canvas.height);

    /* 제목 */
    ctx.fillStyle = '#1e40af'; ctx.textAlign = 'left';
    ctx.font = 'bold 12px Pretendard, sans-serif';
    ctx.fillText(`중철 임포지션 — ${imp.pages}p / ${imp.sheets}장`, padH, 26);
    if (imp.blank > 0) {
      ctx.fillStyle = '#dc2626'; ctx.font = '10px Pretendard, sans-serif';
      ctx.fillText(`⚠ 빈 페이지 ${imp.blank}장 추가 필요`, padH + 200, 26);
    }

    const spreadW = dw - labelW - padH * 2;
    const pageW   = (spreadW - gap) / 2;
    const pageH   = rowH - 10;

    imp.result.forEach((sheet, si) => {
      const frontY = 44 + si * 2 * (rowH + gap);
      const backY  = 44 + (si * 2 + 1) * (rowH + gap);
      /* front[0]=높은 페이지(왼쪽), front[1]=낮은 페이지(오른쪽) */
      drawSpreadRow(ctx, '앞면', si + 1, sheet.front[0], sheet.front[1],
                    labelW, padH, frontY, pageW, pageH, gap, imp.pages);
      drawSpreadRow(ctx, '뒷면', si + 1, sheet.back[0], sheet.back[1],
                    labelW, padH, backY,  pageW, pageH, gap, imp.pages);
    });
  }

  function drawSpreadRow(ctx, side, sheetNum, leftPage, rightPage,
                          labelW, padH, y, pageW, pageH, gap, totalPages) {
    const lx = padH + labelW;
    const ry = y + 5;

    /* 레이블 */
    ctx.fillStyle = '#64748b'; ctx.textAlign = 'right';
    ctx.font = 'bold 9px Pretendard, sans-serif';
    ctx.fillText(`시트 ${sheetNum}`, padH + labelW - 4, ry + pageH / 2 - 4);
    ctx.font = '9px Pretendard, sans-serif';
    ctx.fillText(side, padH + labelW - 4, ry + pageH / 2 + 8);

    /* 바인딩 중앙선 */
    const cx = lx + pageW + gap / 2;
    ctx.strokeStyle = '#cbd5e1'; ctx.lineWidth = 1.5; ctx.setLineDash([3, 2]);
    ctx.beginPath(); ctx.moveTo(cx, ry - 2); ctx.lineTo(cx, ry + pageH + 2); ctx.stroke();
    ctx.setLineDash([]);

    drawSpreadPage(ctx, lx,            ry, pageW, pageH, leftPage,  totalPages);
    drawSpreadPage(ctx, lx + pageW + gap, ry, pageW, pageH, rightPage, totalPages);
  }

  function drawSpreadPage(ctx, x, y, w, h, pageNum, totalPages) {
    const isFirst = pageNum === 1;
    const isLast  = pageNum === totalPages;
    const isBlank = pageNum > totalPages;

    ctx.fillStyle = isBlank ? '#f1f5f9' : isFirst ? '#eff6ff' : isLast ? '#fff1f2' : '#ffffff';
    ctx.strokeStyle = isFirst ? '#3b82f6' : isLast ? '#ef4444' : '#e2e8f0';
    ctx.lineWidth = (isFirst || isLast) ? 1.5 : 1;
    ctx.setLineDash([]);
    roundRect(ctx, x, y, w, h, 6); ctx.fill(); ctx.stroke();

    if (isBlank) {
      ctx.fillStyle = '#94a3b8'; ctx.textAlign = 'center';
      ctx.font = '9px Pretendard, sans-serif';
      ctx.fillText('빈 페이지', x + w / 2, y + h / 2 + 4);
      return;
    }

    const tc = isFirst ? '#1d4ed8' : isLast ? '#dc2626' : '#334155';
    ctx.fillStyle = tc; ctx.textAlign = 'center';
    ctx.font = `bold ${w < 60 ? 12 : 14}px Pretendard, sans-serif`;
    ctx.fillText(`P${pageNum}`, x + w / 2, y + h / 2 - 1);

    const role = isFirst ? '앞표지' : isLast ? '뒷표지' : '';
    if (role) {
      ctx.font = '9px Pretendard, sans-serif';
      ctx.fillText(role, x + w / 2, y + h / 2 + 13);
    }
  }

  function drawZoneLabel(ctx, x1, y1, x2, y2, text, color, small) {
    if (!text || x2-x1<16) return;
    const cx=(x1+x2)/2, cy=(y1+y2)/2;
    ctx.save(); ctx.fillStyle=color; ctx.textAlign='center';
    ctx.font=`${small?'9':'11'}px Pretendard,sans-serif`;
    text.split('\n').forEach((l,i,a) => ctx.fillText(l, cx, cy+(i-(a.length-1)/2)*(small?12:15)));
    ctx.restore();
  }

  function drawOverlayCanvas(canvas, ctx) {
    const dw = getDisplayW(canvas);
    const scale = dw / _naturalW;
    canvas.width = dw;
    canvas.height = Math.round(_naturalH * scale);
    ctx.drawImage(_imgEl, 0, 0, canvas.width, canvas.height);

    if (!_product || !_specs.trimW || !_specs.trimH) return;

    const layout = getLayout();
    const guideScale = canvas.width / layout.fileW;
    const cx = canvas.width/2, cy = canvas.height/2;
    ctx.save();
    ctx.translate(cx+_offsetX, cy+_offsetY);
    ctx.scale(_scaleAdj, _scaleAdj);
    ctx.translate(-cx, -cy);
    drawGuideLines(ctx, canvas, guideScale);
    ctx.restore();
    /* 파일 업로드 시 범례 숨김 — drawLegend는 _imgEl 체크 후 자동 반환 */
    drawLegend(ctx, canvas);
  }

  function drawGuideLines(ctx, canvas, scale) {
    const s = _specs;
    const layout = getLayout();
    const mX = mm => mm * scale;

    const trimL = _fileHasBleed ? mX(layout.bleedMm) : 0;
    const trimT = _fileHasBleed ? mX(layout.bleedMm) : 0;
    const trimR = canvas.width  - (_fileHasBleed ? mX(layout.bleedMm) : 0);
    const trimB = canvas.height - (_fileHasBleed ? mX(layout.bleedMm) : 0);

    /* 작업선(도련선) — 마젠타, 얇은 점선 */
    if (_fileHasBleed && layout.bleedMm) {
      drawRect(ctx, 1, 1, canvas.width - 2, canvas.height - 2, '#ec4899', 1, [4, 3]);
    }

    /* 재단선 — 파란색, 얇은 점선 */
    drawRect(ctx, trimL, trimT, trimR - trimL, trimB - trimT, '#3b82f6', 1.5, [6, 4]);

    /* 안전 영역 — 초록색, 얇은 실선 */
    const sz = mX(s.safeZone || 0);
    if (sz) drawRect(ctx, trimL + sz, trimT + sz, (trimR - trimL) - 2 * sz, (trimB - trimT) - 2 * sz, '#22c55e', 1, []);

    if (PRODUCTS[_product]?.hasSpine && layout.spineMm) {
      const backL  = trimL + mX(layout.wingMm);
      const spineL = backL + mX(s.trimW);
      const spineR = spineL + mX(layout.spineMm);
      /* 책등선 — 빨간색, 얇은 점선 */
      drawLine(ctx, spineL, trimT, spineL, trimB, '#ef4444', 1.5, [6, 4]);
      drawLine(ctx, spineR, trimT, spineR, trimB, '#ef4444', 1.5, [6, 4]);
      if (layout.wingMm) {
        const wPx = mX(layout.wingMm);
        /* 날개선 — 주황색, 얇은 점선 */
        drawLine(ctx, trimL + wPx, trimT, trimL + wPx, trimB, '#f59e0b', 1.5, [8, 4]);
        drawLine(ctx, trimR - wPx, trimT, trimR - wPx, trimB, '#f59e0b', 1.5, [8, 4]);
      }
    }

    if (PRODUCTS[_product]?.hasFold && s.foldType) {
      const { panels } = FOLD_TYPES[s.foldType] || { panels: 3 };
      const trimAreaW = trimR - trimL;
      for (let i = 1; i < panels; i++) {
        const lx = trimL + (trimAreaW / panels) * i;
        /* 접지선 — 주황색, 얇은 점선 */
        drawLine(ctx, lx, trimT, lx, trimB, '#f59e0b', 1.5, [8, 4]);
      }
    }
  }

  /* ---------- 범례 (파일 업로드 시 숨김) ---------- */
  function drawLegend(ctx, canvas) {
    if (!_product || _imgEl) return;
    const items = [];
    if (_fileHasBleed) items.push({color:'#ec4899', dash:true,  label:'작업선(도련)'});
    items.push({color:'#3b82f6', dash:true,  label:'재단선'});
    items.push({color:'#22c55e', dash:false, label:'안전 영역'});
    if (PRODUCTS[_product]?.hasSpine) {
      items.push({color:'#ef4444', dash:true, label:'책등'});
      if (_specs.hasWing && _specs.wingW) items.push({color:'#f59e0b', dash:true, label:'날개선'});
    }
    if (PRODUCTS[_product]?.hasFold) items.push({color:'#f59e0b', dash:true, label:'접지선'});

    const px=12, py=12, lineH=18, padV=6, padH=10;
    const boxW=128, boxH=items.length*lineH+padV*2;
    ctx.save();
    ctx.fillStyle='rgba(255,255,255,.92)';
    ctx.strokeStyle='rgba(100,116,139,.25)'; ctx.lineWidth=1;
    roundRect(ctx, px, py, boxW, boxH, 7); ctx.fill(); ctx.stroke();
    items.forEach((it,i)=>{
      const ly=py+padV+i*lineH+lineH/2;
      ctx.strokeStyle=it.color; ctx.lineWidth=1.5; ctx.setLineDash(it.dash?[4,3]:[]);
      ctx.beginPath(); ctx.moveTo(px+padH,ly); ctx.lineTo(px+padH+20,ly); ctx.stroke();
      ctx.setLineDash([]); ctx.fillStyle='#334155'; ctx.font='10px Pretendard,sans-serif';
      ctx.fillText(it.label, px+padH+26, ly+4);
    });
    ctx.restore();
  }

  /* ---------- 그리기 헬퍼 ---------- */
  function drawRect(ctx,x,y,w,h,color,lw,dash){ctx.save();ctx.strokeStyle=color;ctx.lineWidth=lw;ctx.setLineDash(dash);ctx.strokeRect(x,y,w,h);ctx.restore();}
  function drawLine(ctx,x1,y1,x2,y2,color,lw,dash){ctx.save();ctx.strokeStyle=color;ctx.lineWidth=lw;ctx.setLineDash(dash);ctx.beginPath();ctx.moveTo(x1,y1);ctx.lineTo(x2,y2);ctx.stroke();ctx.restore();}
  function roundRect(ctx,x,y,w,h,r){ctx.beginPath();ctx.moveTo(x+r,y);ctx.lineTo(x+w-r,y);ctx.quadraticCurveTo(x+w,y,x+w,y+r);ctx.lineTo(x+w,y+h-r);ctx.quadraticCurveTo(x+w,y+h,x+w-r,y+h);ctx.lineTo(x+r,y+h);ctx.quadraticCurveTo(x,y+h,x,y+h-r);ctx.lineTo(x,y+r);ctx.quadraticCurveTo(x,y,x+r,y);ctx.closePath();}

  /* ---------- 정보 패널 업데이트 ---------- */
  function updateInfoPanels() {
    renderLeafletFoldGuide();
    renderImpositionGuide();
  }

  /* 리플렛 페이지 배치 안내 */
  function renderLeafletFoldGuide() {
    const el = byId('leafletGuide');
    if (!el) return;
    if (_product !== 'leaflet') { el.hidden = true; return; }

    readSpecs();
    const foldKey = _specs.foldType || '3roll';
    const fp = FOLD_PAGES[foldKey];
    if (!fp) { el.hidden = true; return; }

    const cell = (p) => {
      const isC = p===fp.cover, isB = p===fp.back;
      const bg = isC?'#dbeafe':isB?'#fee2e2':'#f1f5f9';
      const bc = isC?'#3b82f6':isB?'#ef4444':'#e2e8f0';
      const tc = isC?'#1e40af':isB?'#991b1b':'#475569';
      const role = isC?'표지':isB?'뒷면':'';
      return `<div class="fp-cell" style="background:${bg};border-color:${bc}">
        <div class="fp-num" style="color:${tc}">P${p}</div>
        ${role?`<div class="fp-role" style="color:${tc}">${role}</div>`:''}
      </div>`;
    };
    const sep = '<div class="fp-sep">|</div>';

    el.innerHTML = `
      <div class="info-kicker">리플렛 페이지 배치 — ${FOLD_TYPES[foldKey]?.label}</div>
      <p class="info-desc">${fp.desc}</p>
      <div class="fp-row">
        <span class="fp-side-label">앞면 인쇄</span>
        <div class="fp-panels">${fp.outside.map(cell).join(sep)}</div>
      </div>
      <div class="fp-row" style="margin-top:8px">
        <span class="fp-side-label">뒷면 인쇄</span>
        <div class="fp-panels">${fp.inside.map(cell).join(sep)}</div>
      </div>
      <p class="info-note">↑ 패널은 왼쪽→오른쪽 순서입니다 (평면 전개도 기준)</p>`;
    el.hidden = false;
  }

  /* 소책자 중철 페이지 배치 가이드 */
  function renderImpositionGuide() {
    const el = byId('impositionGuide');
    if (!el) return;

    if (_product !== 'booklet') { el.hidden = true; return; }

    const userPages = parseInt(_specs.bookletPages) || 0;

    function impRows(n, highlight) {
      const imp = computeImposition(n);
      const warnHtml = imp.blank > 0
        ? `<div class="imp-warn">⚠️ ${n}p는 4의 배수가 아닙니다. <strong>${imp.pages}p</strong>로 맞추세요 (빈 페이지 ${imp.blank}장 추가). <small>빈 페이지는 마지막에 배치합니다.</small></div>`
        : (highlight ? `<div class="imp-ok">✅ ${n}p = ${imp.sheets}장 인쇄</div>` : '');
      const rows = imp.result.map(s => {
        const f0blank = imp.blank > 0 && s.front[0] > n;
        const b1blank = imp.blank > 0 && s.back[1] > n;
        return `<div class="imp-row">
          <span class="imp-sheet-label">시트 ${s.sheet}</span>
          <span class="imp-front">앞 <strong>P${s.front[0]}</strong>${f0blank?' <em>(빈)</em>':''} · <strong>P${s.front[1]}</strong></span>
          <span class="imp-back">뒤 <strong>P${s.back[0]}</strong> · <strong>P${s.back[1]}</strong>${b1blank?' <em>(빈)</em>':''}</span>
        </div>`;
      }).join('');
      return warnHtml + rows;
    }

    let body = '';

    if (userPages >= 4) {
      body += `<div class="info-kicker" style="margin-bottom:6px">입력한 페이지: ${userPages}p 배치</div>
        <div class="imp-preset" style="margin-bottom:14px">${impRows(userPages, true)}</div>`;
    }

    body += `<div class="info-kicker" style="margin-bottom:6px">주요 페이지 수 참조표</div>
      <div class="imp-presets">${[4,8,12,16].map(n => {
        const imp = computeImposition(n);
        return `<div class="imp-preset">
          <div class="imp-preset-title">${n}p (${imp.sheets}장)</div>
          ${imp.result.map(s =>
            `<div class="imp-row">
              <span class="imp-sheet-label">시트 ${s.sheet}</span>
              <span class="imp-front">앞 <strong>P${s.front[0]}</strong>·<strong>P${s.front[1]}</strong></span>
              <span class="imp-back">뒤 <strong>P${s.back[0]}</strong>·<strong>P${s.back[1]}</strong></span>
            </div>`).join('')}
        </div>`;
      }).join('')}</div>`;

    el.innerHTML = `
      <div class="info-kicker">소책자 페이지 배치 (중철 기준)</div>
      <p class="info-desc">중철(스테이플) 소책자는 <strong>4의 배수</strong> 페이지가 필요합니다.
        왼쪽 사양 입력의 페이지 수를 입력하면 해당 배치가 자동으로 표시됩니다.</p>
      ${body}`;
    el.hidden = false;
  }

  /* 중철 임포지션 계산 */
  function computeImposition(n) {
    const pages = Math.ceil(n / 4) * 4;
    const sheets = pages / 4;
    const result = [];
    for (let s=0; s<sheets; s++) {
      result.push({
        sheet: s+1,
        front: [pages - s*2, s*2 + 1],
        back:  [s*2 + 2, pages - s*2 - 1],
      });
    }
    return { pages, sheets, blank: pages-n, result };
  }

  /* ---------- 폼 & 버튼 ---------- */
  function bindForm() {
    byId('runBtn').addEventListener('click', runCheck);
    byId('resetBtn').addEventListener('click', resetAll);
    byId('specForm').addEventListener('input', () => { readSpecs(); drawCanvas(); });
  }

  /* ---------- 수동 조절 ---------- */
  function bindAdj() {
    byId('fileHasBleed').addEventListener('change', e => { _fileHasBleed = e.target.checked; drawCanvas(); });
    document.querySelectorAll('.side-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        _fileSide = btn.dataset.side;
        document.querySelectorAll('.side-btn').forEach(b => b.classList.toggle('active', b.dataset.side === _fileSide));
      });
    });
    byId('adjX').addEventListener('input', e => { _offsetX=+e.target.value; byId('adjXVal').textContent=(_offsetX>0?'+':'')+_offsetX+' px'; drawCanvas(); });
    byId('adjY').addEventListener('input', e => { _offsetY=+e.target.value; byId('adjYVal').textContent=(_offsetY>0?'+':'')+_offsetY+' px'; drawCanvas(); });
    byId('adjScale').addEventListener('input', e => { _scaleAdj=+e.target.value/100; byId('adjScaleVal').textContent=e.target.value+'%'; drawCanvas(); });
    byId('resetAdjBtn').addEventListener('click', resetAdj);
  }

  function resetAdj() {
    _offsetX=0; _offsetY=0; _scaleAdj=1.0; _fileHasBleed=false;
    byId('adjX').value=0; byId('adjXVal').textContent='0 px';
    byId('adjY').value=0; byId('adjYVal').textContent='0 px';
    byId('adjScale').value=100; byId('adjScaleVal').textContent='100%';
    byId('fileHasBleed').checked=false;
    drawCanvas();
  }

  /* ---------- 검토 실행 ---------- */
  function runCheck() {
    if (!_product) { alert('제품 유형을 먼저 선택해 주세요.'); return; }
    const specs = readSpecs();
    if (!specs.trimW || !specs.trimH) { alert('재단 폭과 높이를 입력해 주세요.'); return; }
    drawCanvas(); _reportItems=[];
    checkBleed(specs); checkSafeZone(specs);
    if (PRODUCTS[_product].hasSpine) checkSpine(specs);
    if (PRODUCTS[_product].hasFold)  checkFold(specs);
    checkDimensions(specs);
    renderReport();
  }

  function checkBleed(s){const ok=s.bleed>=3;addItem('재단선 여유',ok?'pass':'warn',`${s.bleed}mm`,ok?'권장(3mm) 이상':'3mm 미만 — 흰 테두리가 생길 수 있습니다.');}
  function checkSafeZone(s){const ok=s.safeZone>=3;addItem('안전 영역',ok?'pass':'warn',`${s.safeZone}mm`,ok?'권장(3mm) 이상':'3mm 미만 — 텍스트가 재단될 수 있습니다.');}
  function checkSpine(s){
    if(!s.spine){addItem('책등 두께','warn','미입력','책등 두께를 입력해 주세요.');return;}
    const total=s.trimW*2+s.spine+(s.bleed||0)*2+(s.hasWing?(s.wingW||0)*2:0);
    addItem('책등 구성','pass',`뒤 ${s.trimW}mm + 책등 ${s.spine}mm + 앞 ${s.trimW}mm → 전체 ${total.toFixed(1)}mm`,'표지 PDF 전체 폭과 비교해 주세요.');
  }
  function checkFold(s){
    const ft=FOLD_TYPES[s.foldType]||FOLD_TYPES['3roll'];
    addItem(`접지(${ft.label})`,'pass',`패널 ${ft.panels}개, 각 폭 ${(s.trimW/ft.panels).toFixed(2)}mm`,`내지 면이 외지 면보다 ${s.gutterMargin||0}mm 작게 설계되었는지 확인하세요.`);
  }
  function checkDimensions(s){
    const STD=[{w:210,h:297,n:'A4'},{w:148,h:210,n:'A5'},{w:182,h:257,n:'B5'},{w:100,h:210,n:'DL'}];
    const m=STD.find(z=>Math.abs(z.w-s.trimW)<1&&Math.abs(z.h-s.trimH)<1);
    addItem('재단 규격',m?'pass':'info',`${s.trimW} × ${s.trimH}mm`,m?`표준 규격(${m.n})으로 확인됐습니다.`:'비표준 규격 — 인쇄소에 사전 문의를 권장합니다.');
  }
  function addItem(label,status,detail,guide){_reportItems.push({label,status,detail,guide});}

  /* ---------- 리포트 ---------- */
  function renderReport(){
    const section=byId('reportSection'), grid=byId('reportGrid');
    grid.innerHTML='';
    const counts={pass:0,warn:0,fail:0,info:0};
    _reportItems.forEach(it=>{
      counts[it.status]=(counts[it.status]||0)+1;
      const card=document.createElement('div');
      card.className=`report-card status-${it.status}`;
      const icon={pass:'✅',warn:'⚠️',fail:'❌',info:'ℹ️'}[it.status]||'ℹ️';
      card.innerHTML=`<div class="rc-head"><span class="rc-icon">${icon}</span><strong class="rc-label">${it.label}</strong></div><div class="rc-detail">${it.detail}</div><div class="rc-guide">${it.guide}</div>`;
      grid.appendChild(card);
    });
    const overall=counts.fail>0?'fail':counts.warn>0?'warn':'pass';
    const summaryEl=byId('reportSummary');
    summaryEl.className=`report-summary status-${overall}`;
    summaryEl.innerHTML=`<strong>${{pass:'이상 없음',warn:'주의 필요',fail:'조치 필요'}[overall]}</strong> — 통과 ${counts.pass}, 주의 ${counts.warn}, 오류 ${counts.fail}`;
    section.hidden=false; section.scrollIntoView({behavior:'smooth',block:'start'});
  }
  function clearReport(){byId('reportSection').hidden=true;byId('reportGrid').innerHTML='';}

  /* ---------- 전체 초기화 ---------- */
  function resetAll(){
    _file=null;_imgEl=null;_naturalW=0;_naturalH=0;
    _product=null;_specs={};_reportItems=[];
    byId('fileInput').value='';
    byId('uploadFilename').style.display='none';
    byId('uploadZone').classList.remove('has-file');
    byId('uploadError').hidden=true;byId('fileInfo').hidden=true;
    byId('adjPanel').hidden=true;
    const sideRow = byId('sideSelectRow'); if (sideRow) sideRow.hidden=true;
    _fileSide='front';
    document.querySelectorAll('.side-btn').forEach(b=>b.classList.toggle('active',b.dataset.side==='front'));
    document.querySelectorAll('.product-card').forEach(c=>c.classList.remove('selected'));
    byId('specSection').hidden=true;byId('specForm').innerHTML='';
    clearReport();resetAdj();
    const lf=byId('leafletGuide'); if(lf) lf.hidden=true;
    const im=byId('impositionGuide'); if(im) im.hidden=true;
    drawCanvas();
  }

  return { init };
})();

document.addEventListener('DOMContentLoaded', () => PrintChecker.init());
