(() => {
  'use strict';

  const PDFJS_VERSION = '3.11.174';
  const PDFJS_WORKER = `https://cdn.jsdelivr.net/npm/pdfjs-dist@${PDFJS_VERSION}/build/pdf.worker.min.js`;
  const MAX_FILES = 30;
  const MAX_FILE_BYTES = 20 * 1024 * 1024;
  const MAX_TOTAL_COPIES = 2000;
  const EPS = 1e-7;
  const PAPER = {
    a4: [210, 297], b4: [257, 364], a3: [297, 420], sra3: [320, 450], a3plus: [329, 483]
  };

  const $ = id => document.getElementById(id);
  const state = { items: [], plan: null, sheetIndex: 0, side: 'front', pdfJsPromise: null, busy: false };

  const mmFromPt = pt => Number(pt || 0) * 25.4 / 72;
  const round1 = value => Math.round(Number(value || 0) * 10) / 10;

  function status(message = '', type = '') {
    const line = $('statusLine');
    if (!line) return;
    line.textContent = message;
    line.className = `status${type ? ` ${type}` : ''}`;
  }

  function setBusy(value) {
    state.busy = Boolean(value);
    $('downloadBtn').disabled = state.busy || !state.plan || !state.items.length;
    $('fileInput').disabled = state.busy;
  }

  async function requirePdfJs() {
    if (window.pdfjsLib?.getDocument) {
      if (window.pdfjsLib.GlobalWorkerOptions && !window.pdfjsLib.GlobalWorkerOptions.workerSrc) window.pdfjsLib.GlobalWorkerOptions.workerSrc = PDFJS_WORKER;
      return window.pdfjsLib;
    }
    if (!state.pdfJsPromise) {
      state.pdfJsPromise = new Promise((resolve, reject) => {
        const script = document.createElement('script');
        script.src = `https://cdn.jsdelivr.net/npm/pdfjs-dist@${PDFJS_VERSION}/build/pdf.min.js`;
        script.onload = () => {
          if (!window.pdfjsLib?.getDocument) return reject(new Error('PDF 읽기 모듈을 불러오지 못했습니다.'));
          window.pdfjsLib.GlobalWorkerOptions.workerSrc = PDFJS_WORKER;
          resolve(window.pdfjsLib);
        };
        script.onerror = () => reject(new Error('PDF 읽기 모듈을 불러오지 못했습니다.'));
        document.head.appendChild(script);
      }).catch(error => { state.pdfJsPromise = null; throw error; });
    }
    return state.pdfJsPromise;
  }

  async function renderThumb(doc, pageNumber) {
    const page = await doc.getPage(pageNumber);
    const base = page.getViewport({ scale: 1 });
    const scale = Math.min(1.5, Math.max(0.35, 700 / Math.max(base.width, base.height)));
    const viewport = page.getViewport({ scale });
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(viewport.width));
    canvas.height = Math.max(1, Math.round(viewport.height));
    const ctx = canvas.getContext('2d', { alpha: false });
    ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, canvas.width, canvas.height);
    await page.render({ canvasContext: ctx, viewport, background: '#fff' }).promise;
    const image = new Image();
    image.src = canvas.toDataURL('image/jpeg', .82);
    if (typeof image.decode === 'function') await image.decode().catch(() => {});
    else await new Promise(resolve => { image.onload = resolve; image.onerror = resolve; });
    return image;
  }

  async function inspectFile(file) {
    if (!/\.pdf$/i.test(file.name) && file.type !== 'application/pdf') throw new Error(`${file.name}: PDF 파일만 사용할 수 있습니다.`);
    if (file.size > MAX_FILE_BYTES) throw new Error(`${file.name}: 20MB 이하 PDF를 사용해 주세요.`);
    const lib = await requirePdfJs();
    const bytes = new Uint8Array(await file.arrayBuffer());
    const doc = await lib.getDocument({ data: bytes }).promise;
    try {
      if (!doc.numPages || doc.numPages > 2) throw new Error(`${file.name}: 스마트 인쇄배치는 파일별 1~2페이지 PDF를 지원합니다.`);
      const p1 = await doc.getPage(1);
      const v1 = p1.getViewport({ scale: 1 });
      const widthMm = mmFromPt(v1.width);
      const heightMm = mmFromPt(v1.height);
      if (doc.numPages === 2) {
        const p2 = await doc.getPage(2);
        const v2 = p2.getViewport({ scale: 1 });
        if (Math.abs(mmFromPt(v2.width) - widthMm) > .8 || Math.abs(mmFromPt(v2.height) - heightMm) > .8) {
          throw new Error(`${file.name}: 앞면과 뒷면의 페이지 크기가 다릅니다.`);
        }
      }
      const frontThumb = await renderThumb(doc, 1);
      const backThumb = doc.numPages === 2 ? await renderThumb(doc, 2) : null;
      return {
        id: `f-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`,
        file, name: file.name, pageCount: doc.numPages, widthMm, heightMm,
        frontThumb, backThumb
      };
    } finally {
      try { await doc.destroy?.(); } catch (_) {}
    }
  }

  async function addFiles(fileList) {
    const incoming = [...fileList];
    if (!incoming.length) return;
    if (state.items.length + incoming.length > MAX_FILES) return status(`파일은 최대 ${MAX_FILES}개까지 추가할 수 있습니다.`, 'error');
    setBusy(true); status('PDF 크기와 앞·뒷면을 확인하는 중...');
    try {
      for (const file of incoming) {
        if (state.items.some(item => item.name === file.name && item.file.size === file.size && item.file.lastModified === file.lastModified)) continue;
        const item = await inspectFile(file);
        state.items.push(item);
      }
      renderFiles(); recalculate(); status('용지 한 장에 들어가는 최대 개수로 자동 배치했습니다.', 'success');
    } catch (error) {
      status(error?.message || 'PDF를 읽지 못했습니다.', 'error');
    } finally {
      $('fileInput').value = '';
      setBusy(false);
    }
  }

  function renderFiles() {
    const list = $('fileList');
    list.replaceChildren();
    state.items.forEach(item => {
      const row = document.createElement('div');
      row.className = 'file-item';
      row.innerHTML = `<div class="file-top"><div class="file-main"><div class="file-name"></div><div class="file-meta"></div></div><span class="side-pill">${item.pageCount === 2 ? '앞·뒤' : '앞면'}</span><button class="remove-file" type="button" aria-label="파일 삭제">×</button></div>`;
      row.querySelector('.file-name').textContent = item.name;
      row.querySelector('.file-meta').textContent = `${round1(item.widthMm)} × ${round1(item.heightMm)}mm · ${item.pageCount}p · 수량 자동`;
      row.querySelector('.remove-file').onclick = () => {
        state.items = state.items.filter(value => value.id !== item.id);
        renderFiles(); recalculate();
      };
      list.appendChild(row);
    });
  }

  class MaxRectsBin {
    constructor(width, height) { this.width = width; this.height = height; this.free = [{ x: 0, y: 0, width, height }]; }
    candidate(width, height, allowRotate) {
      const options = [{ width, height, rotated: false }];
      if (allowRotate && Math.abs(width - height) > EPS) options.push({ width: height, height: width, rotated: true });
      let best = null;
      for (const fr of this.free) {
        for (const option of options) {
          if (option.width > fr.width + EPS || option.height > fr.height + EPS) continue;
          const lw = fr.width - option.width, lh = fr.height - option.height;
          const score = [Math.min(lw, lh), Math.max(lw, lh), fr.width * fr.height - option.width * option.height, fr.y, fr.x, option.rotated ? 1 : 0];
          const candidate = { score, used: { x: fr.x, y: fr.y, width: option.width, height: option.height }, rotated: option.rotated };
          if (!best || compareScore(score, best.score) < 0) best = candidate;
        }
      }
      return best;
    }
    place(used) {
      const next = [];
      for (const fr of this.free) {
        if (!intersects(fr, used)) { next.push(fr); continue; }
        if (used.x < right(fr) && right(used) > fr.x) {
          if (used.y > fr.y + EPS) next.push({ x: fr.x, y: fr.y, width: fr.width, height: used.y - fr.y });
          if (bottom(used) < bottom(fr) - EPS) next.push({ x: fr.x, y: bottom(used), width: fr.width, height: bottom(fr) - bottom(used) });
        }
        if (used.y < bottom(fr) && bottom(used) > fr.y) {
          if (used.x > fr.x + EPS) next.push({ x: fr.x, y: fr.y, width: used.x - fr.x, height: fr.height });
          if (right(used) < right(fr) - EPS) next.push({ x: right(used), y: fr.y, width: right(fr) - right(used), height: fr.height });
        }
      }
      this.free = prune(next);
    }
  }

  const right = r => r.x + r.width;
  const bottom = r => r.y + r.height;
  const intersects = (a, b) => !(b.x >= right(a) - EPS || right(b) <= a.x + EPS || b.y >= bottom(a) - EPS || bottom(b) <= a.y + EPS);
  const contains = (outer, inner) => inner.x >= outer.x - EPS && inner.y >= outer.y - EPS && right(inner) <= right(outer) + EPS && bottom(inner) <= bottom(outer) + EPS;
  function prune(rects) {
    return rects.filter((r, i) => r.width > EPS && r.height > EPS && !rects.some((other, j) => i !== j && contains(other, r)));
  }
  function compareScore(a, b) {
    for (let i = 0; i < a.length; i++) { if (a[i] < b[i]) return -1; if (a[i] > b[i]) return 1; }
    return 0;
  }

  function settings() {
    return {
      paperW: Number($('paperWidth').value) || 0,
      paperH: Number($('paperHeight').value) || 0,
      margin: Number($('marginMm').value) || 0,
      gap: Number($('gapMm').value) || 0,
      allowRotate: $('allowRotate').checked,
      sideMode: $('sideMode').value,
      flipEdge: $('flipEdge').value,
      cropMarks: $('cropMarks').checked
    };
  }

  function resolvedDuplex(cfg = settings()) {
    if (cfg.sideMode === 'single') return false;
    if (cfg.sideMode === 'duplex') return true;
    return state.items.some(item => item.pageCount === 2);
  }

  function centerSheet(sheet, cfg) {
    if (!sheet.length) return sheet;
    const minX = Math.min(...sheet.map(p => p.x));
    const minY = Math.min(...sheet.map(p => p.y));
    const maxX = Math.max(...sheet.map(p => p.x + p.width));
    const maxY = Math.max(...sheet.map(p => p.y + p.height));
    const groupW = maxX - minX;
    const groupH = maxY - minY;
    const dx = (cfg.paperW - groupW) / 2 - minX;
    const dy = (cfg.paperH - groupH) / 2 - minY;
    return sheet.map(p => ({ ...p, x: p.x + dx, y: p.y + dy }));
  }

  function packOneFile(item, fileIndex, cfg, usableW, usableH, remainingCapacity) {
    const canFit = (item.widthMm + cfg.gap <= usableW + EPS && item.heightMm + cfg.gap <= usableH + EPS) || (cfg.allowRotate && item.heightMm + cfg.gap <= usableW + EPS && item.widthMm + cfg.gap <= usableH + EPS);
    if (!canFit) throw new Error(`${item.name} (${round1(item.widthMm)}×${round1(item.heightMm)}mm)이 선택한 용지에 들어가지 않습니다.`);
    if (remainingCapacity <= 0) throw new Error(`자동 배치 결과가 ${MAX_TOTAL_COPIES.toLocaleString()}개를 초과합니다.`);

    const bin = new MaxRectsBin(usableW, usableH);
    const sheet = [];
    const reqW = item.widthMm + cfg.gap;
    const reqH = item.heightMm + cfg.gap;

    for (let copyIndex = 0; copyIndex < remainingCapacity; copyIndex++) {
      const candidate = bin.candidate(reqW, reqH, cfg.allowRotate);
      if (!candidate) break;
      bin.place(candidate.used);
      sheet.push({
        fileIndex, copyIndex,
        x: cfg.margin + candidate.used.x,
        y: cfg.margin + candidate.used.y,
        width: candidate.used.width - cfg.gap,
        height: candidate.used.height - cfg.gap,
        rotated: candidate.rotated
      });
    }

    if (!sheet.length) throw new Error(`${item.name}을 배치할 수 없습니다.`);
    if (sheet.length === remainingCapacity && bin.candidate(reqW, reqH, cfg.allowRotate)) {
      throw new Error(`자동 배치 결과가 ${MAX_TOTAL_COPIES.toLocaleString()}개를 초과합니다. 파일 수나 용지 설정을 조정해 주세요.`);
    }
    return centerSheet(sheet, cfg);
  }

  function computePlan() {
    const cfg = settings();
    if (!state.items.length) return null;
    if (cfg.paperW < 50 || cfg.paperH < 50) throw new Error('용지 크기를 확인해 주세요.');
    if (cfg.margin < 0 || cfg.margin > 80 || cfg.gap < 0 || cfg.gap > 50) throw new Error('여백 또는 간격 값을 확인해 주세요.');
    if (cfg.sideMode === 'single' && state.items.some(item => item.pageCount === 2)) throw new Error('2페이지 PDF가 있습니다. 양면 방식에서 자동 또는 양면을 선택해 주세요.');

    const usableW = cfg.paperW - 2 * cfg.margin + cfg.gap;
    const usableH = cfg.paperH - 2 * cfg.margin + cfg.gap;
    if (usableW <= 1 || usableH <= 1) throw new Error('용지 여백이 너무 큽니다.');

    const sheets = [];
    let totalCopies = 0;
    for (let fileIndex = 0; fileIndex < state.items.length; fileIndex++) {
      const sheet = packOneFile(state.items[fileIndex], fileIndex, cfg, usableW, usableH, MAX_TOTAL_COPIES - totalCopies);
      sheets.push(sheet);
      totalCopies += sheet.length;
    }

    const usedArea = sheets.flat().reduce((sum, placement) => sum + placement.width * placement.height, 0);
    const utilization = sheets.length ? usedArea / (sheets.length * cfg.paperW * cfg.paperH) * 100 : 0;
    return { sheets, totalCopies, utilization, duplex: resolvedDuplex(cfg), cfg };
  }

  function mirrorBack(p, cfg) {
    const portrait = cfg.paperH >= cfg.paperW;
    const mirrorX = (cfg.flipEdge === 'long' && portrait) || (cfg.flipEdge === 'short' && !portrait);
    return mirrorX
      ? { ...p, x: cfg.paperW - p.x - p.width }
      : { ...p, y: cfg.paperH - p.y - p.height };
  }

  function recalculate() {
    state.sheetIndex = 0;
    try {
      state.plan = computePlan();
      status(state.plan ? '자동 최대 배치와 가운데 정렬이 갱신되었습니다.' : '');
    } catch (error) {
      state.plan = null;
      status(error?.message || '배치 설정을 확인해 주세요.', 'error');
    }
    updateSummary(); updateControls(); drawPreview();
    $('downloadBtn').disabled = state.busy || !state.plan;
  }

  function updateSummary() {
    const card = $('summaryCard');
    if (!state.plan) {
      card.innerHTML = `<div class="summary-empty">${state.items.length ? '현재 설정으로 배치할 수 없습니다. 위 안내를 확인해 주세요.' : 'PDF를 올리면 용지 한 장에 들어가는 최대 개수를 자동 계산합니다.'}</div>`;
      return;
    }
    const p = state.plan;
    const printSides = p.sheets.length * (p.duplex ? 2 : 1);
    const counts = p.sheets.map((sheet, index) => `${index + 1}번 ${sheet.length}개`);
    const countText = counts.length <= 3 ? counts.join(' · ') : `${counts.slice(0, 3).join(' · ')} · 외 ${counts.length - 3}개 파일`;
    card.innerHTML = `<div class="summary-grid"><div class="summary-cell"><span>파일별 용지</span><strong>${p.sheets.length}장</strong></div><div class="summary-cell"><span>총 인쇄면</span><strong>${printSides}면</strong></div><div class="summary-cell"><span>자동 배치</span><strong>${p.totalCopies}개</strong></div><div class="summary-cell"><span>평균 사용률</span><strong>${round1(p.utilization)}%</strong></div></div><div class="summary-note">${countText} · 가운데 정렬 · ${p.duplex ? `양면 / ${p.cfg.flipEdge === 'long' ? '긴쪽' : '짧은쪽'} 넘김` : '단면'}${p.cfg.allowRotate ? ' · 90° 회전 허용' : ''}</div>`;
  }

  function updateControls() {
    const p = state.plan;
    const total = p?.sheets.length || 0;
    if (state.sheetIndex >= total) state.sheetIndex = Math.max(0, total - 1);
    $('sheetLabel').textContent = `용지 ${total ? state.sheetIndex + 1 : 0} / ${total}`;
    $('prevSheet').disabled = !total || state.sheetIndex <= 0;
    $('nextSheet').disabled = !total || state.sheetIndex >= total - 1;
    $('backBtn').disabled = !p?.duplex;
    if (!p?.duplex && state.side === 'back') state.side = 'front';
    $('frontBtn').classList.toggle('active', state.side === 'front');
    $('backBtn').classList.toggle('active', state.side === 'back');
    $('flipOptions').style.opacity = p?.duplex || $('sideMode').value !== 'single' ? '1' : '.45';
  }

  function drawPreview() {
    const canvas = $('layoutCanvas'), empty = $('emptyPreview');
    const p = state.plan;
    if (!p?.sheets.length) { canvas.style.display = 'none'; empty.style.display = 'flex'; return; }
    empty.style.display = 'none'; canvas.style.display = 'block';
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const maxCssW = Math.max(360, Math.min(900, $('canvasShell')?.clientWidth || 820));
    const maxCssH = Math.max(360, Math.min(760, window.innerHeight - 245));
    const scale = Math.min(maxCssW / p.cfg.paperW, maxCssH / p.cfg.paperH);
    const cssW = Math.max(180, Math.round(p.cfg.paperW * scale));
    const cssH = Math.max(220, Math.round(p.cfg.paperH * scale));
    canvas.width = Math.round(cssW * dpr); canvas.height = Math.round(cssH * dpr); canvas.style.width = `${cssW}px`; canvas.style.height = `${cssH}px`;
    const ctx = canvas.getContext('2d'); ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.clearRect(0, 0, cssW, cssH); ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, cssW, cssH);
    const mmScale = cssW / p.cfg.paperW;
    const sheet = p.sheets[state.sheetIndex] || [];
    sheet.forEach(frontPlacement => {
      const placement = state.side === 'back' ? mirrorBack(frontPlacement, p.cfg) : frontPlacement;
      const item = state.items[placement.fileIndex];
      const thumb = state.side === 'back' ? item.backThumb : item.frontThumb;
      const x = placement.x * mmScale, y = placement.y * mmScale, w = placement.width * mmScale, h = placement.height * mmScale;
      ctx.save(); ctx.beginPath(); ctx.rect(x, y, w, h); ctx.clip();
      if (thumb) {
        if (placement.rotated) {
          ctx.translate(x + w / 2, y + h / 2); ctx.rotate(Math.PI / 2); ctx.drawImage(thumb, -h / 2, -w / 2, h, w);
        } else ctx.drawImage(thumb, x, y, w, h);
      } else {
        ctx.fillStyle = '#f8fafc'; ctx.fillRect(x, y, w, h); ctx.fillStyle = '#94a3b8'; ctx.font = '700 10px Pretendard'; ctx.textAlign = 'center'; ctx.fillText('뒷면 없음', x + w / 2, y + h / 2);
      }
      ctx.restore();
      ctx.strokeStyle = '#0f766e'; ctx.lineWidth = Math.max(1, dpr * .5); ctx.strokeRect(x, y, w, h);
      const label = `${placement.fileIndex + 1}-${placement.copyIndex + 1}`;
      ctx.fillStyle = 'rgba(15,118,110,.88)'; ctx.fillRect(x + 2, y + 2, Math.min(44, Math.max(0, w - 4)), 14); ctx.fillStyle = '#fff'; ctx.font = '800 8px Pretendard'; ctx.textAlign = 'left'; ctx.fillText(label, x + 5, y + 12);
    });
    ctx.strokeStyle = '#94a3b8'; ctx.lineWidth = 1; ctx.strokeRect(.5, .5, cssW - 1, cssH - 1);
  }

  async function generatePdf() {
    if (!state.plan || state.busy) return;
    setBusy(true); status('출력용 PDF를 만드는 중...');
    try {
      const user = window.auth?.currentUser;
      if (!user) throw new Error('로그인이 필요합니다.');
      const token = await user.getIdToken();
      const cfg = settings();
      const form = new FormData();
      form.append('settings', JSON.stringify({
        jobs: state.items.map((item, index) => ({ file_index: index, quantity: 1 })),
        paper: { width_mm: cfg.paperW, height_mm: cfg.paperH },
        margin_mm: cfg.margin, gap_mm: cfg.gap, allow_rotate: cfg.allowRotate,
        auto_fill: true,
        side_mode: cfg.sideMode, flip_edge: cfg.flipEdge, crop_marks: cfg.cropMarks
      }));
      state.items.forEach(item => form.append('files', item.file, item.name));
      const response = await fetch('/api/pdf/smart-layout', { method: 'POST', headers: { Authorization: `Bearer ${token}` }, body: form });
      if (!response.ok) {
        let detail = `PDF 생성 실패 (${response.status})`;
        try { detail = (await response.json())?.detail || detail; } catch (_) {}
        throw new Error(detail);
      }
      const type = response.headers.get('content-type') || '';
      if (type.includes('application/json')) {
        const result = await response.json();
        if (!result.download_url) throw new Error('완성 PDF 다운로드 주소를 받지 못했습니다.');
        const a = document.createElement('a'); a.href = result.download_url; a.download = result.filename || 'smart-print-layout.pdf'; a.rel = 'noopener'; document.body.appendChild(a); a.click(); a.remove();
      } else {
        const blob = await response.blob();
        const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = 'smart-print-layout.pdf'; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 30000);
      }
      status('출력용 PDF를 만들었습니다.', 'success');
    } catch (error) {
      status(error?.message || '출력용 PDF를 만들지 못했습니다.', 'error');
    } finally { setBusy(false); }
  }

  function bind() {
    const zone = $('uploadZone'), input = $('fileInput');
    zone.addEventListener('keydown', event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); input.click(); } });
    input.addEventListener('change', event => addFiles(event.target.files));
    ['dragenter', 'dragover'].forEach(type => zone.addEventListener(type, event => { event.preventDefault(); zone.classList.add('drag'); }));
    ['dragleave', 'drop'].forEach(type => zone.addEventListener(type, event => { event.preventDefault(); zone.classList.remove('drag'); }));
    zone.addEventListener('drop', event => addFiles([...event.dataTransfer.files].filter(file => /\.pdf$/i.test(file.name) || file.type === 'application/pdf')));

    $('paperPreset').addEventListener('change', event => {
      const size = PAPER[event.target.value];
      if (size) { $('paperWidth').value = size[0]; $('paperHeight').value = size[1]; }
      const custom = event.target.value === 'custom'; $('paperWidth').readOnly = !custom; $('paperHeight').readOnly = !custom; recalculate();
    });
    ['paperWidth', 'paperHeight', 'marginMm', 'gapMm'].forEach(id => $(id).addEventListener('input', recalculate));
    ['allowRotate', 'sideMode', 'flipEdge', 'cropMarks'].forEach(id => $(id).addEventListener('change', recalculate));
    $('prevSheet').onclick = () => { if (state.sheetIndex > 0) { state.sheetIndex--; updateControls(); drawPreview(); } };
    $('nextSheet').onclick = () => { if (state.plan && state.sheetIndex < state.plan.sheets.length - 1) { state.sheetIndex++; updateControls(); drawPreview(); } };
    $('frontBtn').onclick = () => { state.side = 'front'; updateControls(); drawPreview(); };
    $('backBtn').onclick = () => { if (state.plan?.duplex) { state.side = 'back'; updateControls(); drawPreview(); } };
    $('downloadBtn').onclick = generatePdf;
    $('resetBtn').onclick = () => { state.items = []; state.plan = null; state.sheetIndex = 0; state.side = 'front'; renderFiles(); updateSummary(); updateControls(); drawPreview(); status('초기화했습니다.'); };
    $('logoutBtn').onclick = () => window.auth?.signOut().then(() => location.replace('/'));
    window.addEventListener('resize', () => { clearTimeout(window.__smartLayoutResize); window.__smartLayoutResize = setTimeout(drawPreview, 100); });
  }

  async function boot() {
    bind();
    $('paperWidth').readOnly = true; $('paperHeight').readOnly = true;
    try {
      await window.authPersistenceReady;
      const access = await window.ProgramAccess?.guardTool({ programId: 'pdf-editor', loginUrl: '/login.html', waitingUrl: '/approval-waiting.html', timeoutMs: 8000 });
      if (!access) return;
      const user = window.auth?.currentUser;
      $('userName').textContent = user?.displayName || user?.email || '사용자';
      document.documentElement.style.visibility = 'visible';
      updateSummary(); updateControls(); drawPreview();
    } catch (error) {
      console.error(error); document.documentElement.style.visibility = 'visible'; status('로그인 상태를 확인할 수 없습니다.', 'error');
    }
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once: true }); else boot();
  window.SmartPrintLayout = { state, recalculate, stage: 'auto-fill-centered-v2' };
})();
