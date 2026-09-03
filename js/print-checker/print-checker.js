/* print-checker.js — 인쇄물 사전 검토 v20260903-3 */
'use strict';

const PrintChecker = (() => {
  /* ---------- 상수 ---------- */
  const PRODUCTS = {
    cover:      { label: '표지',         icon: '📚', desc: '앞표지 + 책등 + 뒤표지', hasFold: false, hasSpine: true  },
    leaflet:    { label: '리플렛',       icon: '📄', desc: '2단·3단·4단 접지',       hasFold: true,  hasSpine: false },
    flyer:      { label: '전단지/포스터', icon: '🖼️', desc: '단면 전단지·포스터',    hasFold: false, hasSpine: false },
    invitation: { label: '초대장/안내장', icon: '💌', desc: '단면 평판 초대장',       hasFold: false, hasSpine: false },
  };

  const FOLD_TYPES = {
    '2fold':  { label: '반접기 (2단)',         panels: 2 },
    '3roll':  { label: '말아접기 (3단)',        panels: 3 },
    '3zfold': { label: 'Z접기 (3단 지그재그)', panels: 3 },
    '4fold':  { label: '4단 접기',             panels: 4 },
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

    mmField('trimW', '재단 폭 (Trim Width)', '재단 후 최종 가로', '210');
    mmField('trimH', '재단 높이 (Trim Height)', '재단 후 최종 세로', '297');

    if (p.hasSpine) {
      /* 종이 종류 */
      const ptWrap = document.createElement('div');
      ptWrap.className = 'spec-field';
      ptWrap.innerHTML = `<label class="spec-label" for="paperType">종이 종류<small class="spec-hint">책등 두께 자동 계산</small></label>
        <select class="spec-input spec-select" id="paperType">
          ${Object.entries(PAPER_TYPES).map(([v, t]) => `<option value="${v}" ${(_specs.paperType || 'mojo80') === v ? 'selected' : ''}>${t.label}</option>`).join('')}
        </select>`;
      form.appendChild(ptWrap);

      /* 페이지 수 */
      const pgWrap = document.createElement('div');
      pgWrap.className = 'spec-field';
      pgWrap.innerHTML = `<label class="spec-label" for="pageCount">페이지 수<small class="spec-hint">총 페이지 (표지 제외)</small></label>
        <div class="spec-input-row">
          <input class="spec-input" id="pageCount" type="number" min="2" step="2" placeholder="100" value="${_specs.pageCount ?? ''}">
          <span class="spec-unit">p</span>
        </div>`;
      form.appendChild(pgWrap);

      /* 책등 두께 (자동/수동) */
      const spWrap = document.createElement('div');
      spWrap.className = 'spec-field';
      spWrap.innerHTML = `<label class="spec-label" for="spine">책등 두께<small class="spec-hint" id="spineHint">종이·페이지 선택 시 자동 계산</small></label>
        <div class="spec-input-row">
          <input class="spec-input" id="spine" type="number" min="0" step="0.1" placeholder="0.0" value="${_specs.spine ?? ''}">
          <span class="spec-unit">mm</span>
        </div>`;
      form.appendChild(spWrap);

      /* 날개 옵션 */
      const wingWrap = document.createElement('div');
      wingWrap.className = 'spec-field';
      wingWrap.innerHTML = `<label class="spec-check-row" for="hasWing">
          <input type="checkbox" id="hasWing" ${_specs.hasWing ? 'checked' : ''}>
          <span>날개(플랩) 포함</span>
        </label>
        <div id="wingWGroup" style="margin-top:8px" ${_specs.hasWing ? '' : 'hidden'}>
          <div class="spec-input-row">
            <input class="spec-input" id="wingW" type="number" min="0" step="1" placeholder="90" value="${_specs.wingW ?? ''}">
            <span class="spec-unit">mm</span>
          </div>
          <small class="spec-hint">날개 폭 (앞·뒷날개 동일)</small>
        </div>`;
      form.appendChild(wingWrap);

      /* 책등 자동 계산 이벤트 */
      const autoSpine = () => {
        const ptKey = byId('paperType')?.value;
        const pages = parseInt(byId('pageCount')?.value) || 0;
        const spineEl = byId('spine');
        if (ptKey && ptKey !== 'custom' && pages >= 2 && spineEl && !spineEl.dataset.manual) {
          const val = calcSpine(ptKey, pages);
          if (val !== null) {
            spineEl.value = val;
            byId('spineHint').textContent = `자동 계산: ${val}mm`;
          }
        }
        readSpecs(); drawCanvas();
      };

      byId('paperType')?.addEventListener('change', autoSpine);
      byId('pageCount')?.addEventListener('input', autoSpine);
      byId('spine')?.addEventListener('input', e => {
        e.target.dataset.manual = e.target.value ? '1' : '';
        byId('spineHint').textContent = '직접 입력 중';
        readSpecs(); drawCanvas();
      });
      byId('hasWing')?.addEventListener('change', e => {
        byId('wingWGroup').hidden = !e.target.checked;
        readSpecs(); drawCanvas();
      });
      byId('wingW')?.addEventListener('input', () => { readSpecs(); drawCanvas(); });
    }

    if (p.hasFold) {
      const ftWrap = document.createElement('div');
      ftWrap.className = 'spec-field';
      ftWrap.innerHTML = `<label class="spec-label" for="foldType">접지 방식<small class="spec-hint">접지 유형 선택</small></label>
        <select class="spec-input spec-select" id="foldType">
          ${Object.entries(FOLD_TYPES).map(([v, f]) => `<option value="${v}" ${_specs.foldType === v ? 'selected' : ''}>${f.label}</option>`).join('')}
        </select>`;
      form.appendChild(ftWrap);

      const gmWrap = document.createElement('div');
      gmWrap.className = 'spec-field';
      gmWrap.innerHTML = `<label class="spec-label" for="gutterMargin">거터 (Gutter)<small class="spec-hint">패널 사이 여백 기준</small></label>
        <div class="spec-input-row">
          <input class="spec-input" id="gutterMargin" type="number" min="0" step="0.1" placeholder="3" value="${_specs.gutterMargin ?? ''}">
          <span class="spec-unit">mm</span>
        </div>`;
      form.appendChild(gmWrap);
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
    ['trimW','trimH','spine','bleed','safeZone','gutterMargin','wingW'].forEach(id => {
      const el = byId(id); if (el) s[id] = parseFloat(el.value) || 0;
    });
    const pcEl = byId('pageCount'); if (pcEl) s.pageCount = parseInt(pcEl.value) || 0;
    const ftEl = byId('foldType');  if (ftEl) s.foldType  = ftEl.value;
    const ptEl = byId('paperType'); if (ptEl) s.paperType = ptEl.value;
    const hwEl = byId('hasWing');   if (hwEl) s.hasWing   = hwEl.checked;
    _specs = s;
    return s;
  }

  /* ---------- 업로드 ---------- */
  function bindUpload() {
    const zone  = byId('uploadZone');
    const input = byId('fileInput');

    zone.addEventListener('click', () => input.click());
    zone.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') input.click(); });
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
    loadPreview(file);
  }

  function loadPreview(file) {
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
    img.onerror = () => {
      byId('fileInfo').textContent = 'PDF (미리보기 불가 — 검토는 정상 진행됩니다)';
      byId('fileInfo').hidden = false;
    };
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
    if (PRODUCTS[_product]?.hasSpine) {
      fileW = 2 * (s.trimW || 0) + spine + 2 * wing + (_fileHasBleed ? 2 * bleed : 0);
    } else {
      fileW = (s.trimW || 0) + (_fileHasBleed ? 2 * bleed : 0);
    }
    const fileH = (s.trimH || 0) + (_fileHasBleed ? 2 * bleed : 0);
    return { fileW, fileH, bleedMm: bleed, spineMm: spine, wingMm: wing };
  }

  /* ---------- 캔버스 ---------- */
  const DISPLAY_W = 680;

  function drawCanvas() {
    const canvas = byId('previewCanvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const specs = _specs;
    const hasSpecs = !!(specs.trimW && specs.trimH && _product);

    if (_imgEl) {
      drawOverlayCanvas(canvas, ctx);
    } else if (hasSpecs) {
      drawTemplateCanvas(canvas, ctx);
    } else {
      drawEmptyCanvas(canvas, ctx);
    }
  }

  function drawEmptyCanvas(canvas, ctx) {
    canvas.width = DISPLAY_W; canvas.height = 420;
    ctx.fillStyle = '#f1f5f9';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = '#94a3b8';
    ctx.font = '600 14px Pretendard, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('왼쪽에서 제품 유형을 선택하고', DISPLAY_W / 2, 196);
    ctx.fillText('사양을 입력하면 안내선이 표시됩니다', DISPLAY_W / 2, 220);
    ctx.font = '12px Pretendard, sans-serif';
    ctx.fillText('파일 없이도 작업 전 규격 확인이 가능합니다', DISPLAY_W / 2, 248);
  }

  function drawTemplateCanvas(canvas, ctx) {
    const s = _specs;
    const layout = getLayout();
    if (!layout.fileW || !layout.fileH) { drawEmptyCanvas(canvas, ctx); return; }

    const scale = DISPLAY_W / layout.fileW;
    canvas.width = DISPLAY_W;
    canvas.height = Math.max(Math.round(layout.fileH * scale), 180);

    const mX = mm => mm * scale;
    const mY = mm => mm * scale;

    /* 재단선 여유 영역 (bleed 포함 시 = 연한 파랑) */
    ctx.fillStyle = '#dbeafe';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    const trimL = _fileHasBleed ? mX(layout.bleedMm) : 0;
    const trimT = _fileHasBleed ? mY(layout.bleedMm) : 0;
    const trimR = canvas.width  - (_fileHasBleed ? mX(layout.bleedMm) : 0);
    const trimB = canvas.height - (_fileHasBleed ? mY(layout.bleedMm) : 0);

    /* 표지 레이아웃 */
    if (PRODUCTS[_product].hasSpine) {
      const wingPx = mX(layout.wingMm);
      const backL  = trimL + wingPx;
      const spineL = backL + mX(s.trimW);
      const spineR = spineL + mX(layout.spineMm);
      const frontR = spineR + mX(s.trimW);

      /* 뒤표지 */
      ctx.fillStyle = '#f0f9ff'; ctx.fillRect(backL, trimT, mX(s.trimW), trimB - trimT);
      /* 책등 */
      if (layout.spineMm > 0) {
        ctx.fillStyle = '#fee2e2'; ctx.fillRect(spineL, trimT, mX(layout.spineMm), trimB - trimT);
      }
      /* 앞표지 */
      ctx.fillStyle = '#f0f9ff'; ctx.fillRect(spineR, trimT, mX(s.trimW), trimB - trimT);
      /* 날개 */
      if (layout.wingMm > 0) {
        ctx.fillStyle = '#fef9c3';
        ctx.fillRect(trimL,   trimT, wingPx, trimB - trimT);
        ctx.fillRect(frontR,  trimT, wingPx, trimB - trimT);
      }

      /* 존 레이블 */
      drawZoneLabel(ctx, trimL, trimT, backL,  trimB, layout.wingMm > 0 ? '뒷날개' : '', '#92400e', scale < 1.4);
      drawZoneLabel(ctx, backL,  trimT, spineL, trimB, `뒤표지\n${s.trimW}mm`, '#1e40af', scale < 1.4);
      if (layout.spineMm > 0)
        drawZoneLabel(ctx, spineL, trimT, spineR, trimB, `책등\n${layout.spineMm}mm`, '#991b1b', scale < 1.4);
      drawZoneLabel(ctx, spineR, trimT, frontR, trimB, `앞표지\n${s.trimW}mm`, '#1e40af', scale < 1.4);
      drawZoneLabel(ctx, frontR, trimT, trimR,  trimB, layout.wingMm > 0 ? '앞날개' : '', '#92400e', scale < 1.4);
    } else {
      /* 표지 외 제품 */
      ctx.fillStyle = '#f8fafc';
      ctx.fillRect(trimL, trimT, trimR - trimL, trimB - trimT);
      drawZoneLabel(ctx, trimL, trimT, trimR, trimB,
        PRODUCTS[_product].label + `\n${s.trimW} × ${s.trimH}mm`, '#334155', false);
    }

    /* 세로 치수 레이블 */
    if (s.trimH) {
      ctx.save();
      ctx.translate(8, (trimT + trimB) / 2);
      ctx.rotate(-Math.PI / 2);
      ctx.fillStyle = '#475569'; ctx.font = 'bold 10px Pretendard, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(`${s.trimH}mm`, 0, 0);
      ctx.restore();
    }

    /* 안내선 */
    drawGuideLines(ctx, canvas, scale);
    drawLegend(ctx, canvas);
  }

  function drawZoneLabel(ctx, x1, y1, x2, y2, text, color, smallFont) {
    if (!text || x2 - x1 < 18) return;
    const cx = (x1 + x2) / 2, cy = (y1 + y2) / 2;
    ctx.save();
    ctx.fillStyle = color;
    ctx.textAlign = 'center';
    ctx.font = `${smallFont ? '9' : '11'}px Pretendard, sans-serif`;
    text.split('\n').forEach((line, i, arr) => {
      ctx.fillText(line, cx, cy + (i - (arr.length - 1) / 2) * (smallFont ? 12 : 15));
    });
    ctx.restore();
  }

  function drawOverlayCanvas(canvas, ctx) {
    const scale = DISPLAY_W / _naturalW;
    canvas.width = DISPLAY_W;
    canvas.height = Math.round(_naturalH * scale);
    ctx.drawImage(_imgEl, 0, 0, canvas.width, canvas.height);

    if (!_product || !_specs.trimW || !_specs.trimH) return;

    const layout = getLayout();
    const guideScale = canvas.width / layout.fileW;

    const cx = canvas.width / 2, cy = canvas.height / 2;
    ctx.save();
    ctx.translate(cx + _offsetX, cy + _offsetY);
    ctx.scale(_scaleAdj, _scaleAdj);
    ctx.translate(-cx, -cy);

    drawGuideLines(ctx, canvas, guideScale);

    ctx.restore();
    drawLegend(ctx, canvas);
  }

  function drawGuideLines(ctx, canvas, scale) {
    const s = _specs;
    const layout = getLayout();
    const mX = mm => mm * scale;
    const mY = mm => mm * scale;

    const trimL = _fileHasBleed ? mX(layout.bleedMm) : 0;
    const trimT = _fileHasBleed ? mY(layout.bleedMm) : 0;
    const trimR = canvas.width  - (_fileHasBleed ? mX(layout.bleedMm) : 0);
    const trimB = canvas.height - (_fileHasBleed ? mY(layout.bleedMm) : 0);

    /* 재단선 (파란 점선) */
    drawRect(ctx, trimL, trimT, trimR - trimL, trimB - trimT, '#3b82f6', 2, [6, 4]);

    /* 안전 영역 (녹색 실선) */
    const szX = mX(s.safeZone || 0), szY = mY(s.safeZone || 0);
    if (szX || szY) {
      drawRect(ctx, trimL + szX, trimT + szY, (trimR - trimL) - 2 * szX, (trimB - trimT) - 2 * szY, '#22c55e', 1.5, []);
    }

    if (PRODUCTS[_product]?.hasSpine && layout.spineMm) {
      const backL  = trimL + mX(layout.wingMm);
      const spineL = backL + mX(s.trimW);
      const spineR = spineL + mX(layout.spineMm);

      /* 책등 (빨간 점선) */
      drawLine(ctx, spineL, trimT, spineL, trimB, '#ef4444', 2, [8, 4]);
      drawLine(ctx, spineR, trimT, spineR, trimB, '#ef4444', 2, [8, 4]);

      /* 날개 구분선 (노란 점선) */
      if (layout.wingMm) {
        const wingPx = mX(layout.wingMm);
        drawLine(ctx, trimL + wingPx, trimT, trimL + wingPx, trimB, '#f59e0b', 2, [10, 5]);
        drawLine(ctx, trimR - wingPx, trimT, trimR - wingPx, trimB, '#f59e0b', 2, [10, 5]);
      }
    }

    if (PRODUCTS[_product]?.hasFold && s.foldType) {
      const { panels } = FOLD_TYPES[s.foldType] || { panels: 3 };
      const trimAreaW = trimR - trimL;
      for (let i = 1; i < panels; i++) {
        const lx = trimL + (trimAreaW / panels) * i;
        drawLine(ctx, lx, trimT, lx, trimB, '#f59e0b', 2, [10, 5]);
      }
    }
  }

  /* ---------- 범례 ---------- */
  function drawLegend(ctx, canvas) {
    if (!_product) return;
    const items = [{ color: '#3b82f6', dash: true, label: '재단선' }, { color: '#22c55e', dash: false, label: '안전 영역' }];
    if (PRODUCTS[_product]?.hasSpine) {
      items.push({ color: '#ef4444', dash: true, label: '책등' });
      if (_specs.hasWing && _specs.wingW) items.push({ color: '#f59e0b', dash: true, label: '날개선' });
    }
    if (PRODUCTS[_product]?.hasFold) items.push({ color: '#f59e0b', dash: true, label: '접지선' });

    const px = 12, py = 12, lineH = 20, padV = 7, padH = 10;
    const boxH = items.length * lineH + padV * 2;
    ctx.save();
    ctx.fillStyle = 'rgba(0,0,0,.62)';
    roundRect(ctx, px, py, 122, boxH, 7); ctx.fill();

    items.forEach((it, i) => {
      const ly = py + padV + i * lineH + lineH / 2;
      ctx.strokeStyle = it.color; ctx.lineWidth = 2;
      ctx.setLineDash(it.dash ? [5, 3] : []);
      ctx.beginPath(); ctx.moveTo(px + padH, ly); ctx.lineTo(px + padH + 22, ly); ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = '#fff'; ctx.font = '10px Pretendard, sans-serif';
      ctx.fillText(it.label, px + padH + 28, ly + 4);
    });
    ctx.restore();
  }

  /* ---------- 그리기 헬퍼 ---------- */
  function drawRect(ctx, x, y, w, h, color, lw, dash) {
    ctx.save(); ctx.strokeStyle = color; ctx.lineWidth = lw; ctx.setLineDash(dash);
    ctx.strokeRect(x, y, w, h); ctx.restore();
  }
  function drawLine(ctx, x1, y1, x2, y2, color, lw, dash) {
    ctx.save(); ctx.strokeStyle = color; ctx.lineWidth = lw; ctx.setLineDash(dash);
    ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke(); ctx.restore();
  }
  function roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x+r,y); ctx.lineTo(x+w-r,y); ctx.quadraticCurveTo(x+w,y,x+w,y+r);
    ctx.lineTo(x+w,y+h-r); ctx.quadraticCurveTo(x+w,y+h,x+w-r,y+h);
    ctx.lineTo(x+r,y+h); ctx.quadraticCurveTo(x,y+h,x,y+h-r);
    ctx.lineTo(x,y+r); ctx.quadraticCurveTo(x,y,x+r,y); ctx.closePath();
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

    byId('adjX').addEventListener('input', e => {
      _offsetX = +e.target.value;
      byId('adjXVal').textContent = (_offsetX > 0 ? '+' : '') + _offsetX + ' px';
      drawCanvas();
    });
    byId('adjY').addEventListener('input', e => {
      _offsetY = +e.target.value;
      byId('adjYVal').textContent = (_offsetY > 0 ? '+' : '') + _offsetY + ' px';
      drawCanvas();
    });
    byId('adjScale').addEventListener('input', e => {
      _scaleAdj = +e.target.value / 100;
      byId('adjScaleVal').textContent = e.target.value + '%';
      drawCanvas();
    });
    byId('resetAdjBtn').addEventListener('click', resetAdj);
  }

  function resetAdj() {
    _offsetX = 0; _offsetY = 0; _scaleAdj = 1.0; _fileHasBleed = false;
    byId('adjX').value = 0; byId('adjXVal').textContent = '0 px';
    byId('adjY').value = 0; byId('adjYVal').textContent = '0 px';
    byId('adjScale').value = 100; byId('adjScaleVal').textContent = '100%';
    byId('fileHasBleed').checked = false;
    drawCanvas();
  }

  /* ---------- 검토 실행 ---------- */
  function runCheck() {
    if (!_product) { alert('제품 유형을 먼저 선택해 주세요.'); return; }
    const specs = readSpecs();
    if (!specs.trimW || !specs.trimH) { alert('재단 폭과 높이를 입력해 주세요.'); return; }
    drawCanvas();
    _reportItems = [];
    checkBleed(specs); checkSafeZone(specs);
    if (PRODUCTS[_product].hasSpine) checkSpine(specs);
    if (PRODUCTS[_product].hasFold)  checkFold(specs);
    checkDimensions(specs);
    renderReport();
  }

  function checkBleed(s) {
    const ok = s.bleed >= 3;
    addItem('재단선 여유 (Bleed)', ok ? 'pass' : 'warn', `${s.bleed}mm`,
      ok ? '권장 기준(3mm) 이상입니다.' : '3mm 미만 — 흰 테두리가 생길 수 있습니다.');
  }
  function checkSafeZone(s) {
    const ok = s.safeZone >= 3;
    addItem('안전 영역 (Safe Zone)', ok ? 'pass' : 'warn', `${s.safeZone}mm`,
      ok ? '권장 기준(3mm) 이상입니다.' : '3mm 미만 — 텍스트·로고가 재단될 수 있습니다.');
  }
  function checkSpine(s) {
    if (!s.spine) { addItem('책등 두께', 'warn', '미입력', '책등 두께를 입력해 주세요.'); return; }
    const totalW = s.trimW * 2 + s.spine + (s.bleed || 0) * 2 + (s.hasWing ? (s.wingW||0)*2 : 0);
    addItem('책등 구성', 'pass',
      `뒤표지 ${s.trimW}mm + 책등 ${s.spine}mm + 앞표지 ${s.trimW}mm → 전체 ${totalW.toFixed(1)}mm`,
      '책등 구성이 확인되었습니다. 표지 PDF 전체 폭과 비교해 주세요.');
  }
  function checkFold(s) {
    const ft = FOLD_TYPES[s.foldType] || FOLD_TYPES['3roll'];
    addItem(`접지 (${ft.label})`, 'pass',
      `패널 ${ft.panels}개, 각 패널 폭 ${(s.trimW / ft.panels).toFixed(2)}mm`,
      `내지 면이 외지 면보다 ${s.gutterMargin||0}mm 작게 설계되었는지 확인하세요.`);
  }
  function checkDimensions(s) {
    const STD = [
      {w:210,h:297,n:'A4 세로'},{w:297,h:210,n:'A4 가로'},
      {w:148,h:210,n:'A5 세로'},{w:210,h:148,n:'A5 가로'},
      {w:182,h:257,n:'B5 세로'},{w:100,h:210,n:'DL 세로'},
    ];
    const m = STD.find(z => Math.abs(z.w-s.trimW)<1 && Math.abs(z.h-s.trimH)<1);
    addItem('재단 규격', m ? 'pass' : 'info', `${s.trimW} × ${s.trimH}mm`,
      m ? `표준 규격(${m.n})` : '비표준 규격 — 인쇄소에 사전 문의를 권장합니다.');
  }
  function addItem(label, status, detail, guide) { _reportItems.push({ label, status, detail, guide }); }

  /* ---------- 리포트 ---------- */
  function renderReport() {
    const section = byId('reportSection');
    const grid = byId('reportGrid');
    grid.innerHTML = '';
    const counts = { pass:0, warn:0, fail:0, info:0 };
    _reportItems.forEach(it => {
      counts[it.status] = (counts[it.status]||0) + 1;
      const card = document.createElement('div');
      card.className = `report-card status-${it.status}`;
      const icon = { pass:'✅', warn:'⚠️', fail:'❌', info:'ℹ️' }[it.status]||'ℹ️';
      card.innerHTML = `<div class="rc-head"><span class="rc-icon">${icon}</span><strong class="rc-label">${it.label}</strong></div><div class="rc-detail">${it.detail}</div><div class="rc-guide">${it.guide}</div>`;
      grid.appendChild(card);
    });
    const overall = counts.fail>0?'fail':counts.warn>0?'warn':'pass';
    const summaryEl = byId('reportSummary');
    summaryEl.className = `report-summary status-${overall}`;
    summaryEl.innerHTML = `<strong>${{pass:'이상 없음',warn:'주의 필요',fail:'조치 필요'}[overall]}</strong> — 통과 ${counts.pass}, 주의 ${counts.warn}, 오류 ${counts.fail}`;
    section.hidden = false;
    section.scrollIntoView({ behavior:'smooth', block:'start' });
  }
  function clearReport() { byId('reportSection').hidden = true; byId('reportGrid').innerHTML = ''; }

  /* ---------- 전체 초기화 ---------- */
  function resetAll() {
    _file=null; _imgEl=null; _naturalW=0; _naturalH=0;
    _product=null; _specs={}; _reportItems=[];
    byId('fileInput').value='';
    byId('uploadFilename').style.display='none';
    byId('uploadZone').classList.remove('has-file');
    byId('uploadError').hidden=true; byId('fileInfo').hidden=true;
    byId('adjPanel').hidden=true;
    document.querySelectorAll('.product-card').forEach(c=>c.classList.remove('selected'));
    byId('specSection').hidden=true; byId('specForm').innerHTML='';
    clearReport(); resetAdj(); drawCanvas();
  }

  return { init };
})();

document.addEventListener('DOMContentLoaded', () => PrintChecker.init());
