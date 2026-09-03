/* print-checker.js — 인쇄물 사전 검토 도구 (단일 통합) v20260903-1 */
'use strict';

const PrintChecker = (() => {
  /* ---------- 제품 사양 정의 ---------- */
  const PRODUCTS = {
    cover: {
      label: '표지',
      icon: '📚',
      description: '책 표지 (앞표지 + 책등 + 뒤표지)',
      specs: ['trimW', 'trimH', 'spine', 'bleed', 'safeZone'],
      hasFold: false, hasSpine: true,
    },
    leaflet: {
      label: '리플렛',
      icon: '📄',
      description: '접지 리플렛 (2단·3단·4단)',
      specs: ['trimW', 'trimH', 'foldType', 'bleed', 'safeZone', 'gutterMargin'],
      hasFold: true, hasSpine: false,
    },
    flyer: {
      label: '전단지 / 포스터',
      icon: '🖼️',
      description: '단면 전단지·포스터',
      specs: ['trimW', 'trimH', 'bleed', 'safeZone'],
      hasFold: false, hasSpine: false,
    },
    invitation: {
      label: '초대장 / 안내장',
      icon: '💌',
      description: '단면 평판 초대장 (접지 없음)',
      specs: ['trimW', 'trimH', 'bleed', 'safeZone'],
      hasFold: false, hasSpine: false,
    },
  };

  const FOLD_TYPES = {
    '2fold': { label: '반접기 (2단)', panels: 2 },
    '3roll': { label: '말아접기 (3단 두루마리)', panels: 3 },
    '3zfold': { label: 'Z 접기 (3단 지그재그)', panels: 3 },
    '4fold': { label: '4단 접기', panels: 4 },
  };

  /* ---------- 상태 ---------- */
  let _file = null;
  let _imgEl = null;
  let _naturalW = 0, _naturalH = 0;
  let _product = null;
  let _specs = {};
  let _reportItems = [];

  /* ---------- DOM 참조 ---------- */
  const byId = id => document.getElementById(id);

  /* ---------- 초기화 ---------- */
  function init() {
    renderProductCards();
    bindUpload();
    bindForm();

    const params = new URLSearchParams(location.search);
    const preset = params.get('product');
    if (preset && PRODUCTS[preset]) selectProduct(preset);
  }

  /* ---------- 제품 카드 ---------- */
  function renderProductCards() {
    const grid = byId('productGrid');
    Object.entries(PRODUCTS).forEach(([key, p]) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'product-card';
      btn.dataset.product = key;
      btn.innerHTML = `<span class="pc-icon">${p.icon}</span><strong class="pc-label">${p.label}</strong><small class="pc-desc">${p.description}</small>`;
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
  }

  /* ---------- 사양 폼 ---------- */
  function renderSpecForm(key) {
    const p = PRODUCTS[key];
    const form = byId('specForm');
    form.innerHTML = '';

    const mm = (id, label, hint, def) => {
      const wrap = document.createElement('div');
      wrap.className = 'spec-field';
      wrap.innerHTML = `<label class="spec-label" for="${id}">${label}<small class="spec-hint">${hint}</small></label><div class="spec-input-row"><input class="spec-input" id="${id}" type="number" min="0" step="0.1" placeholder="${def}" value="${_specs[id] ?? ''}"><span class="spec-unit">mm</span></div>`;
      form.appendChild(wrap);
    };

    mm('trimW', '재단 폭 (Trim Width)', '재단 후 최종 가로 크기', '210');
    mm('trimH', '재단 높이 (Trim Height)', '재단 후 최종 세로 크기', '297');

    if (p.hasSpine) {
      mm('spine', '책등 두께 (Spine)', '종이 두께 × 페이지 수로 계산', '20');
    }

    if (p.hasFold) {
      const wrap = document.createElement('div');
      wrap.className = 'spec-field';
      wrap.innerHTML = `<label class="spec-label" for="foldType">접지 방식<small class="spec-hint">접지 유형을 선택하세요</small></label>
        <select class="spec-input spec-select" id="foldType">
          ${Object.entries(FOLD_TYPES).map(([v, f]) => `<option value="${v}" ${_specs.foldType === v ? 'selected' : ''}>${f.label}</option>`).join('')}
        </select>`;
      form.appendChild(wrap);
      mm('gutterMargin', '거터 (Gutter)', '각 접지 패널 사이 여백 기준', '3');
    }

    mm('bleed', '재단선 여유 (Bleed)', '재단선 바깥으로 나오는 여분 (보통 3mm)', '3');
    mm('safeZone', '안전 영역 (Safe Zone)', '재단선 안쪽 텍스트·로고 여백 (보통 3mm)', '3');
  }

  function readSpecs() {
    const s = {};
    ['trimW','trimH','spine','bleed','safeZone','gutterMargin'].forEach(id => {
      const el = byId(id);
      if (el) s[id] = parseFloat(el.value) || 0;
    });
    const ft = byId('foldType');
    if (ft) s.foldType = ft.value;
    _specs = s;
    return s;
  }

  /* ---------- 업로드 ---------- */
  function bindUpload() {
    const zone = byId('uploadZone');
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
      showUploadError('PDF 또는 이미지 파일(PNG, JPEG, TIFF, WEBP)만 지원합니다.');
      return;
    }
    _file = file;
    byId('uploadFilename').textContent = file.name;
    byId('uploadFilename').style.display = 'block';
    byId('uploadZone').classList.add('has-file');
    clearUploadError();
    loadPreview(file);
  }

  function loadPreview(file) {
    const reader = new FileReader();
    reader.onload = e => {
      if (file.type === 'application/pdf') {
        loadPdfPreview(e.target.result);
      } else {
        loadImagePreview(e.target.result);
      }
    };
    reader.readAsDataURL(file);
  }

  function loadImagePreview(dataUrl) {
    const img = new Image();
    img.onload = () => {
      _imgEl = img;
      _naturalW = img.naturalWidth;
      _naturalH = img.naturalHeight;
      drawCanvas();
      showFileInfo(`${_naturalW} × ${_naturalH} px (이미지)`);
    };
    img.src = dataUrl;
  }

  function loadPdfPreview(dataUrl) {
    /* PDF.js 가 없는 환경에서는 img 태그로 첫 페이지 미리보기 */
    const img = new Image();
    img.onload = () => {
      _imgEl = img;
      _naturalW = img.naturalWidth;
      _naturalH = img.naturalHeight;
      drawCanvas();
      showFileInfo(`PDF (첫 페이지 미리보기)`);
    };
    img.onerror = () => showFileInfo('PDF (미리보기 불가 — 검토는 정상 진행됩니다)');
    img.src = dataUrl;
  }

  function showFileInfo(text) {
    byId('fileInfo').textContent = text;
    byId('fileInfo').hidden = false;
  }

  function showUploadError(msg) {
    const el = byId('uploadError');
    el.textContent = msg;
    el.hidden = false;
  }

  function clearUploadError() {
    byId('uploadError').hidden = true;
  }

  /* ---------- 캔버스 오버레이 ---------- */
  function drawCanvas() {
    const canvas = byId('previewCanvas');
    const ctx = canvas.getContext('2d');
    const specs = _specs;
    const DISPLAY_W = 600;

    if (!_imgEl) { ctx.clearRect(0, 0, canvas.width, canvas.height); return; }

    const scale = DISPLAY_W / _naturalW;
    canvas.width = DISPLAY_W;
    canvas.height = Math.round(_naturalH * scale);
    ctx.drawImage(_imgEl, 0, 0, canvas.width, canvas.height);

    if (!_product || !specs.trimW || !specs.trimH) return;

    /* ppi를 mm → px に変換 (ディスプレイ比率ベース) */
    const mmToCanvas = mm => (mm / specs.trimW) * canvas.width;

    /* 재단선 (bleed outer edge — 파란색 점선) */
    const bleed = specs.bleed || 0;
    const bLeft = mmToCanvas(bleed);
    const bTop = mmToCanvas(bleed);
    const bRight = canvas.width - mmToCanvas(bleed);
    const bBottom = canvas.height - mmToCanvas(bleed);
    drawRect(ctx, bLeft, bTop, bRight - bLeft, bBottom - bTop, '#3b82f6', 2, [6, 4]);

    /* 안전 영역 (green 실선) */
    const safe = bleed + (specs.safeZone || 0);
    const sLeft = mmToCanvas(safe);
    const sTop = mmToCanvas(safe);
    const sRight = canvas.width - mmToCanvas(safe);
    const sBottom = canvas.height - mmToCanvas(safe);
    drawRect(ctx, sLeft, sTop, sRight - sLeft, sBottom - sTop, '#22c55e', 1.5, []);

    /* 책등 (표지) — 빨간 점선 세로 선 */
    if (PRODUCTS[_product].hasSpine && specs.spine) {
      const spL = mmToCanvas(bleed + specs.spine);
      const spR = canvas.width - mmToCanvas(bleed + specs.spine);
      drawLine(ctx, spL, 0, spL, canvas.height, '#ef4444', 2, [8, 4]);
      drawLine(ctx, spR, 0, spR, canvas.height, '#ef4444', 2, [8, 4]);
    }

    /* 접지 패널 구분선 (리플렛) */
    if (PRODUCTS[_product].hasFold && specs.foldType) {
      const { panels } = FOLD_TYPES[specs.foldType] || { panels: 3 };
      const panelW = canvas.width / panels;
      for (let i = 1; i < panels; i++) {
        drawLine(ctx, panelW * i, 0, panelW * i, canvas.height, '#f59e0b', 2, [10, 5]);
      }
    }

    drawLegend(ctx);
  }

  function drawRect(ctx, x, y, w, h, color, lw, dash) {
    ctx.save();
    ctx.strokeStyle = color;
    ctx.lineWidth = lw;
    ctx.setLineDash(dash);
    ctx.strokeRect(x, y, w, h);
    ctx.restore();
  }

  function drawLine(ctx, x1, y1, x2, y2, color, lw, dash) {
    ctx.save();
    ctx.strokeStyle = color;
    ctx.lineWidth = lw;
    ctx.setLineDash(dash);
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();
    ctx.restore();
  }

  function drawLegend(ctx) {
    const items = [
      { color: '#3b82f6', dash: true, label: '재단선' },
      { color: '#22c55e', dash: false, label: '안전 영역' },
    ];
    if (PRODUCTS[_product]?.hasSpine) items.push({ color: '#ef4444', dash: true, label: '책등' });
    if (PRODUCTS[_product]?.hasFold) items.push({ color: '#f59e0b', dash: true, label: '접지선' });

    const px = 12, py = 12, lineH = 22, padV = 8, padH = 12;
    const boxH = items.length * lineH + padV * 2;
    ctx.save();
    ctx.fillStyle = 'rgba(0,0,0,0.6)';
    roundRect(ctx, px, py, 130, boxH, 7);
    ctx.fill();

    items.forEach((it, i) => {
      const ly = py + padV + i * lineH + lineH / 2;
      ctx.strokeStyle = it.color;
      ctx.lineWidth = 2;
      ctx.setLineDash(it.dash ? [5, 3] : []);
      ctx.beginPath();
      ctx.moveTo(px + padH, ly);
      ctx.lineTo(px + padH + 24, ly);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = '#fff';
      ctx.font = '11px Pretendard, sans-serif';
      ctx.fillText(it.label, px + padH + 30, ly + 4);
    });
    ctx.restore();
  }

  function roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    ctx.lineTo(x + w, y + h - r);
    ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    ctx.lineTo(x + r, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - r);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.closePath();
  }

  /* ---------- 폼 바인딩 ---------- */
  function bindForm() {
    byId('runBtn').addEventListener('click', runCheck);
    byId('resetBtn').addEventListener('click', resetAll);
    byId('specForm').addEventListener('input', () => { readSpecs(); drawCanvas(); });
  }

  /* ---------- 검토 실행 ---------- */
  function runCheck() {
    if (!_product) { alert('제품 유형을 먼저 선택해 주세요.'); return; }
    const specs = readSpecs();
    if (!specs.trimW || !specs.trimH) { alert('재단 폭과 높이를 입력해 주세요.'); return; }
    drawCanvas();
    _reportItems = [];

    checkBleed(specs);
    checkSafeZone(specs);
    if (PRODUCTS[_product].hasSpine) checkSpine(specs);
    if (PRODUCTS[_product].hasFold) checkFold(specs);
    checkDimensions(specs);

    renderReport();
  }

  /* ---------- 검토 항목 ---------- */
  function checkBleed(s) {
    const ok = s.bleed >= 3;
    addItem('재단선 여유 (Bleed)', ok ? 'pass' : 'warn',
      `입력값: ${s.bleed}mm`,
      ok ? '권장 기준(3mm) 이상입니다.' : '재단선 여유가 3mm 미만입니다. 여백 부족 시 흰 테두리가 생길 수 있습니다.');
  }

  function checkSafeZone(s) {
    const ok = s.safeZone >= 3;
    addItem('안전 영역 (Safe Zone)', ok ? 'pass' : 'warn',
      `입력값: ${s.safeZone}mm`,
      ok ? '권장 기준(3mm) 이상입니다.' : '안전 영역이 3mm 미만입니다. 텍스트나 로고가 재단에 잘릴 수 있습니다.');
  }

  function checkSpine(s) {
    if (!s.spine) {
      addItem('책등 두께 (Spine)', 'warn', '미입력', '책등 두께를 입력해 주세요.');
      return;
    }
    const totalW = s.trimW * 2 + s.spine + (s.bleed || 0) * 2;
    addItem('책등 구성 (Spine Layout)', 'pass',
      `뒤표지(${s.trimW}mm) + 책등(${s.spine}mm) + 앞표지(${s.trimW}mm) + 재단선(${(s.bleed || 0) * 2}mm) = 전체 ${totalW.toFixed(1)}mm`,
      '책등 구성이 확인되었습니다. 표지 PDF 전체 폭과 비교해 주세요.');
  }

  function checkFold(s) {
    const ft = FOLD_TYPES[s.foldType] || FOLD_TYPES['3roll'];
    const panels = ft.panels;
    const panelW = s.trimW / panels;
    const gutter = s.gutterMargin || 0;
    addItem(`접지 패널 (${ft.label})`, 'pass',
      `패널 수: ${panels}, 각 패널 폭: ${panelW.toFixed(2)}mm, 거터: ${gutter}mm`,
      `패널 폭이 균등한지 확인하고, 내지 면이 외지 면보다 ${gutter}mm 작게 설계되었는지 검토하세요.`);
  }

  function checkDimensions(s) {
    const stdSizes = [
      { w: 210, h: 297, name: 'A4 세로' }, { w: 297, h: 210, name: 'A4 가로' },
      { w: 148, h: 210, name: 'A5 세로' }, { w: 210, h: 148, name: 'A5 가로' },
      { w: 182, h: 257, name: 'B5 세로' }, { w: 100, h: 210, name: 'DL 세로' },
    ];
    const match = stdSizes.find(sz => Math.abs(sz.w - s.trimW) < 1 && Math.abs(sz.h - s.trimH) < 1);
    addItem('재단 규격 확인', match ? 'pass' : 'info',
      `${s.trimW} × ${s.trimH}mm`,
      match ? `표준 규격(${match.name})과 일치합니다.` : '비표준 규격입니다. 인쇄소에 사전 문의를 권장합니다.');
  }

  function addItem(label, status, detail, guide) {
    _reportItems.push({ label, status, detail, guide });
  }

  /* ---------- 리포트 렌더링 ---------- */
  function renderReport() {
    const section = byId('reportSection');
    const grid = byId('reportGrid');
    grid.innerHTML = '';

    const counts = { pass: 0, warn: 0, fail: 0, info: 0 };
    _reportItems.forEach(it => {
      counts[it.status] = (counts[it.status] || 0) + 1;
      const card = document.createElement('div');
      card.className = `report-card status-${it.status}`;
      const icon = { pass: '✅', warn: '⚠️', fail: '❌', info: 'ℹ️' }[it.status] || 'ℹ️';
      card.innerHTML = `<div class="rc-head"><span class="rc-icon">${icon}</span><strong class="rc-label">${it.label}</strong></div><div class="rc-detail">${it.detail}</div><div class="rc-guide">${it.guide}</div>`;
      grid.appendChild(card);
    });

    const overall = counts.fail > 0 ? 'fail' : counts.warn > 0 ? 'warn' : 'pass';
    const overallLabel = { pass: '이상 없음', warn: '주의 필요', fail: '조치 필요' }[overall];
    const summaryEl = byId('reportSummary');
    summaryEl.className = `report-summary status-${overall}`;
    summaryEl.innerHTML = `<strong>${overallLabel}</strong> — 통과 ${counts.pass}, 주의 ${counts.warn}, 오류 ${counts.fail}`;

    section.hidden = false;
    section.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  function clearReport() {
    byId('reportSection').hidden = true;
    byId('reportGrid').innerHTML = '';
  }

  /* ---------- 초기화 ---------- */
  function resetAll() {
    _file = null; _imgEl = null; _naturalW = 0; _naturalH = 0;
    _product = null; _specs = {}; _reportItems = [];

    byId('fileInput').value = '';
    byId('uploadFilename').style.display = 'none';
    byId('uploadZone').classList.remove('has-file');
    byId('uploadError').hidden = true;
    byId('fileInfo').hidden = true;

    const ctx = byId('previewCanvas').getContext('2d');
    ctx.clearRect(0, 0, byId('previewCanvas').width, byId('previewCanvas').height);

    document.querySelectorAll('.product-card').forEach(c => c.classList.remove('selected'));
    byId('specSection').hidden = true;
    byId('specForm').innerHTML = '';
    clearReport();
  }

  return { init };
})();

document.addEventListener('DOMContentLoaded', () => PrintChecker.init());
