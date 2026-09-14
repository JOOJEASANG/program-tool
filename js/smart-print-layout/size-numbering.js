(() => {
  'use strict';
  if (window.__smartPrintSizeNumberingV1) return;
  window.__smartPrintSizeNumberingV1 = true;

  const originalImages = new Map();
  const dirtyItems = new Set();
  const rebuildTimers = new Map();
  const rebuildRevisions = new Map();
  const pendingRebuilds = new Map();
  let bypassDownloadCapture = false;
  let overlayFrame = 0;

  const $ = id => document.getElementById(id);
  const round1 = value => Math.round(Number(value || 0) * 10) / 10;
  const clamp = (value, min, max) => Math.min(max, Math.max(min, Number(value) || min));
  const isImage = file => Boolean(file && (/^image\/(?:jpeg|png|webp)$/i.test(file.type || '') || /\.(?:jpe?g|png|webp)$/i.test(file.name || '')));
  const imageKey = (name, lastModified) => `${String(name || '').trim()}::${Number(lastModified || 0)}`;

  function setStatus(message, type = '') {
    const line = $('statusLine');
    if (!line) return;
    line.textContent = message;
    line.className = `status${type ? ` ${type}` : ''}`;
  }

  function rememberImages(files) {
    Array.from(files || []).forEach(file => {
      if (isImage(file)) originalImages.set(imageKey(file.name, file.lastModified), file);
    });
  }

  function sourceName(item) {
    return item?.sourceOriginalName || item?.file?.__displayName || item?.name || 'image';
  }

  function sourceFile(item) {
    return originalImages.get(imageKey(sourceName(item), item?.file?.lastModified));
  }

  function isImageItem(item) {
    return item?.sourceType === 'image' || item?.file?.__sourceType === 'image';
  }

  function injectStyles() {
    if ($('smartSizeNumberingStyles')) return;
    const style = document.createElement('style');
    style.id = 'smartSizeNumberingStyles';
    style.textContent = `
      .image-size-editor{margin-top:10px;padding:10px;border:1px solid #cbd5e1;border-radius:10px;background:#f8fafc}
      .image-size-head{display:flex;align-items:center;justify-content:space-between;gap:8px;margin-bottom:8px;font-size:12px;font-weight:800;color:#334155}
      .image-size-lock{font-size:10px;font-weight:800;color:#0f766e;background:#ccfbf1;border-radius:999px;padding:3px 7px}
      .image-size-grid{display:grid;grid-template-columns:1fr auto 1fr;gap:7px;align-items:end}
      .image-size-grid label{display:grid;gap:4px;font-size:10px;font-weight:700;color:#64748b}
      .image-size-grid input{width:100%;box-sizing:border-box;border:1px solid #cbd5e1;border-radius:7px;padding:7px 8px;font:700 12px Pretendard,sans-serif;background:#fff;color:#0f172a}
      .image-size-grid input:focus{outline:2px solid rgba(15,118,110,.18);border-color:#0f766e}
      .image-size-times{padding-bottom:7px;color:#94a3b8;font-weight:900}
      .image-size-help{margin-top:7px;font-size:10px;line-height:1.45;color:#64748b}
      .smart-numbering-panel .numbering-options{display:grid;gap:10px;margin-top:10px}
      .smart-numbering-panel .numbering-options.is-disabled{opacity:.42}
      .smart-numbering-panel .numbering-options .grid2{align-items:end}
      .numbering-preview-overlay{position:absolute;z-index:6;pointer-events:none;overflow:hidden}
      .numbering-preview-label{position:absolute;white-space:nowrap;color:#111827;background:rgba(255,255,255,.84);border-radius:2px;padding:1px 3px;font-family:Arial,sans-serif;font-weight:700;line-height:1.12;box-shadow:0 0 0 1px rgba(15,23,42,.08)}
      @media(max-width:700px){.image-size-grid{grid-template-columns:1fr auto 1fr}.image-size-editor{padding:9px}}
    `;
    document.head.appendChild(style);
  }

  function injectNumberingPanel() {
    if ($('numberingEnabled')) return;
    const crop = $('cropMarks');
    const anchor = crop?.closest('.panel');
    if (!anchor) return;
    const panel = document.createElement('section');
    panel.className = 'panel smart-numbering-panel';
    panel.innerHTML = `
      <div class="step">STEP 4</div>
      <h2>자동 넘버링</h2>
      <label class="check-row"><input id="numberingEnabled" type="checkbox"><span>배치된 인쇄물마다 번호 인쇄</span></label>
      <div id="numberingOptions" class="numbering-options is-disabled">
        <div class="grid2">
          <label class="field"><span>시작 번호</span><input id="numberingStart" type="number" min="0" max="9999999" step="1" value="1"></label>
          <label class="field"><span>표시 형식</span><select id="numberingFormat"><option value="plain">1, 2, 3</option><option value="pad3" selected>001, 002, 003</option><option value="no-pad3">NO.001, NO.002</option></select></label>
        </div>
        <div class="grid2">
          <label class="field"><span>위치</span><select id="numberingPosition"><option value="top-left">왼쪽 위</option><option value="top-right">오른쪽 위</option><option value="bottom-left">왼쪽 아래</option><option value="bottom-right" selected>오른쪽 아래</option><option value="bottom-center">아래 가운데</option></select></label>
          <label class="field"><span>글자 크기 pt</span><input id="numberingFontSize" type="number" min="5" max="36" step="1" value="9"></label>
        </div>
        <p class="hint">양면 작업은 앞면과 대응하는 뒷면에 같은 번호가 인쇄됩니다.</p>
      </div>`;
    anchor.insertAdjacentElement('afterend', panel);
  }

  function numberingConfig() {
    return {
      enabled: Boolean($('numberingEnabled')?.checked),
      start: Math.round(clamp($('numberingStart')?.value || 1, 0, 9_999_999)),
      format: $('numberingFormat')?.value || 'pad3',
      position: $('numberingPosition')?.value || 'bottom-right',
      font_size_pt: clamp($('numberingFontSize')?.value || 9, 5, 36),
    };
  }

  function formatNumber(value, format) {
    if (format === 'plain') return String(value);
    if (format === 'no-pad3') return `NO.${String(value).padStart(3, '0')}`;
    return String(value).padStart(3, '0');
  }

  function updateNumberingControls() {
    const enabled = Boolean($('numberingEnabled')?.checked);
    const options = $('numberingOptions');
    options?.classList.toggle('is-disabled', !enabled);
    options?.querySelectorAll('input,select').forEach(control => { control.disabled = !enabled; });
    scheduleOverlay();
  }

  async function loadImageElement(file) {
    if (typeof createImageBitmap === 'function') {
      try { return await createImageBitmap(file, { imageOrientation: 'from-image' }); } catch (_) {}
      try { return await createImageBitmap(file); } catch (_) {}
    }
    const url = URL.createObjectURL(file);
    try {
      const image = new Image();
      image.decoding = 'async';
      image.src = url;
      if (typeof image.decode === 'function') await image.decode();
      else await new Promise((resolve, reject) => { image.onload = resolve; image.onerror = reject; });
      return image;
    } finally {
      URL.revokeObjectURL(url);
    }
  }

  async function ensureJsPdf(original) {
    if (typeof window.jspdf?.jsPDF === 'function') return window.jspdf.jsPDF;
    if (!window.ProgramImagePdfAdapter?.imageToPdf) throw new Error('이미지 PDF 변환 모듈을 찾을 수 없습니다.');
    await window.ProgramImagePdfAdapter.imageToPdf(original, { dpi: 300 });
    if (typeof window.jspdf?.jsPDF !== 'function') throw new Error('이미지 크기 변환 모듈을 준비하지 못했습니다.');
    return window.jspdf.jsPDF;
  }

  async function buildSizedPdf(original, item, widthMm, heightMm) {
    const JsPdf = await ensureJsPdf(original);
    const bitmap = await loadImageElement(original);
    const widthPx = Number(bitmap.width || bitmap.naturalWidth || 0);
    const heightPx = Number(bitmap.height || bitmap.naturalHeight || 0);
    if (!widthPx || !heightPx) throw new Error(`${original.name}: 이미지 크기를 확인할 수 없습니다.`);
    const canvas = document.createElement('canvas');
    canvas.width = widthPx;
    canvas.height = heightPx;
    const ctx = canvas.getContext('2d', { alpha: false });
    if (!ctx) throw new Error('이미지 크기 변환 캔버스를 만들지 못했습니다.');
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, widthPx, heightPx);
    ctx.drawImage(bitmap, 0, 0, widthPx, heightPx);
    try { bitmap.close?.(); } catch (_) {}
    const jpeg = canvas.toDataURL('image/jpeg', .92);
    const pdf = new JsPdf({
      orientation: widthMm > heightMm ? 'landscape' : 'portrait',
      unit: 'mm',
      format: [widthMm, heightMm],
      compress: true,
      putOnlyUsedFonts: true,
    });
    pdf.addImage(jpeg, 'JPEG', 0, 0, widthMm, heightMm, undefined, 'FAST');
    const blob = pdf.output('blob');
    canvas.width = 1;
    canvas.height = 1;
    const name = String(item.name || 'image.pdf').replace(/\.[^.]+$/, '') + '.pdf';
    const file = new File([blob], name, { type: 'application/pdf', lastModified: original.lastModified || Date.now() });
    Object.defineProperties(file, {
      __sourceType: { value: 'image', enumerable: false },
      __displayName: { value: sourceName(item), enumerable: false },
      __imageMeta: { value: { widthPx, heightPx, widthMm, heightMm, dpi: null, targetSize: true, originalType: original.type || '' }, enumerable: false },
    });
    return file;
  }

  function updateDownloadAvailability() {
    const button = $('downloadBtn');
    const layout = window.SmartPrintLayout;
    if (!button || !layout) return;
    if (dirtyItems.size || pendingRebuilds.size) button.disabled = true;
    else button.disabled = Boolean(layout.state.busy || !layout.state.plan || !layout.state.items.length);
  }

  async function rebuildItem(item, revision) {
    const original = sourceFile(item);
    if (!original) throw new Error(`${sourceName(item)}: 원본 이미지를 찾을 수 없어 크기를 다시 적용할 수 없습니다.`);
    const target = item.__smartTargetSize;
    if (!target) return;
    const file = await buildSizedPdf(original, item, target.widthMm, target.heightMm);
    if ((rebuildRevisions.get(item.id) || 0) !== revision) return;
    item.file = file;
    item.widthMm = target.widthMm;
    item.heightMm = target.heightMm;
    item.imageMeta = file.__imageMeta;
    dirtyItems.delete(item.id);
  }

  function startRebuild(item) {
    if (!item?.id || pendingRebuilds.has(item.id) || !dirtyItems.has(item.id)) return pendingRebuilds.get(item.id) || Promise.resolve();
    const revision = rebuildRevisions.get(item.id) || 0;
    const promise = rebuildItem(item, revision)
      .then(() => {
        window.SmartPrintLayout?.recalculate?.();
        syncEditors();
      })
      .finally(() => {
        pendingRebuilds.delete(item.id);
        if (dirtyItems.has(item.id)) scheduleRebuild(item, 60);
        updateDownloadAvailability();
      });
    pendingRebuilds.set(item.id, promise);
    updateDownloadAvailability();
    return promise;
  }

  function scheduleRebuild(item, delay = 380) {
    if (!item?.id) return;
    clearTimeout(rebuildTimers.get(item.id));
    const timer = setTimeout(() => {
      rebuildTimers.delete(item.id);
      startRebuild(item).catch(error => setStatus(error?.message || '이미지 크기를 적용하지 못했습니다.', 'error'));
    }, delay);
    rebuildTimers.set(item.id, timer);
    updateDownloadAvailability();
  }

  async function flushSizes() {
    for (const timer of rebuildTimers.values()) clearTimeout(timer);
    rebuildTimers.clear();
    while (dirtyItems.size || pendingRebuilds.size) {
      const layout = window.SmartPrintLayout;
      const toStart = (layout?.state?.items || []).filter(item => dirtyItems.has(item.id) && !pendingRebuilds.has(item.id));
      toStart.forEach(item => startRebuild(item));
      if (!pendingRebuilds.size) break;
      await Promise.all([...pendingRebuilds.values()]);
    }
  }

  function applyTargetSize(item, editor, changed) {
    const meta = item.imageMeta || item.file?.__imageMeta || {};
    const ratio = item.__imageAspect || (Number(meta.widthPx) > 0 && Number(meta.heightPx) > 0 ? Number(meta.widthPx) / Number(meta.heightPx) : Number(item.widthMm) / Number(item.heightMm));
    if (!Number.isFinite(ratio) || ratio <= 0) return;
    item.__imageAspect = ratio;
    const widthInput = editor.querySelector('[data-image-size="width"]');
    const heightInput = editor.querySelector('[data-image-size="height"]');
    let widthMm = clamp(widthInput.value, 2, 2000);
    let heightMm = clamp(heightInput.value, 2, 2000);
    if (changed === 'width') heightMm = clamp(widthMm / ratio, 2, 2000);
    else widthMm = clamp(heightMm * ratio, 2, 2000);
    widthMm = round1(widthMm);
    heightMm = round1(heightMm);
    widthInput.value = widthMm;
    heightInput.value = heightMm;
    item.widthMm = widthMm;
    item.heightMm = heightMm;
    item.__smartTargetSize = { widthMm, heightMm };
    item.__smartCustomSize = true;
    rebuildRevisions.set(item.id, (rebuildRevisions.get(item.id) || 0) + 1);
    dirtyItems.add(item.id);
    window.SmartPrintLayout?.recalculate?.();
    updateDownloadAvailability();
    scheduleRebuild(item);
    scheduleOverlay();
  }

  function syncEditors() {
    const layout = window.SmartPrintLayout;
    const list = $('fileList');
    if (!layout?.state?.items || !list) return;
    const rows = Array.from(list.children);
    layout.state.items.forEach((item, index) => {
      if (!isImageItem(item)) return;
      item.sourceType = 'image';
      item.sourceOriginalName = sourceName(item);
      item.imageMeta = item.imageMeta || item.file?.__imageMeta || {};
      const row = rows[index];
      if (!row) return;
      let editor = row.querySelector('.image-size-editor');
      if (!editor) {
        editor = document.createElement('div');
        editor.className = 'image-size-editor';
        editor.innerHTML = `<div class="image-size-head"><span>이미지 인쇄 크기</span><span class="image-size-lock">비율 고정</span></div><div class="image-size-grid"><label>가로 mm<input data-image-size="width" type="number" min="2" max="2000" step="0.1"></label><span class="image-size-times">×</span><label>세로 mm<input data-image-size="height" type="number" min="2" max="2000" step="0.1"></label></div><div class="image-size-help">입력한 실제 크기를 기준으로 자동 배치하며 최종 PDF에도 같은 크기로 적용됩니다.</div>`;
        row.appendChild(editor);
        const width = editor.querySelector('[data-image-size="width"]');
        const height = editor.querySelector('[data-image-size="height"]');
        width.addEventListener('input', () => applyTargetSize(item, editor, 'width'));
        height.addEventListener('input', () => applyTargetSize(item, editor, 'height'));
      }
      const width = editor.querySelector('[data-image-size="width"]');
      const height = editor.querySelector('[data-image-size="height"]');
      if (document.activeElement !== width) width.value = round1(item.widthMm);
      if (document.activeElement !== height) height.value = round1(item.heightMm);
    });
  }

  function mirrorBack(placement, cfg) {
    const portrait = cfg.paperH >= cfg.paperW;
    const mirrorX = (cfg.flipEdge === 'long' && portrait) || (cfg.flipEdge === 'short' && !portrait);
    return mirrorX
      ? { ...placement, x: cfg.paperW - placement.x - placement.width }
      : { ...placement, y: cfg.paperH - placement.y - placement.height };
  }

  function scheduleOverlay() {
    cancelAnimationFrame(overlayFrame);
    overlayFrame = requestAnimationFrame(syncNumberingOverlay);
  }

  function syncNumberingOverlay() {
    const shell = $('canvasShell');
    const canvas = $('layoutCanvas');
    const layout = window.SmartPrintLayout;
    if (!shell || !canvas || !layout) return;
    let overlay = $('numberingPreviewOverlay');
    if (!overlay) {
      overlay = document.createElement('div');
      overlay.id = 'numberingPreviewOverlay';
      overlay.className = 'numbering-preview-overlay';
      shell.appendChild(overlay);
    }
    overlay.replaceChildren();
    const config = numberingConfig();
    const plan = layout.state.plan;
    if (!config.enabled || !plan?.sheets?.length || canvas.style.display === 'none') {
      overlay.style.display = 'none';
      return;
    }
    overlay.style.display = 'block';
    overlay.style.left = `${canvas.offsetLeft}px`;
    overlay.style.top = `${canvas.offsetTop}px`;
    overlay.style.width = `${canvas.clientWidth}px`;
    overlay.style.height = `${canvas.clientHeight}px`;
    const cfg = plan.cfg;
    const scale = canvas.clientWidth / cfg.paperW;
    const sheetIndex = layout.state.sheetIndex || 0;
    const sheet = plan.sheets[sheetIndex] || [];
    const sequenceOffset = plan.sheets.slice(0, sheetIndex).reduce((sum, entries) => sum + entries.length, 0);
    const inset = 1.6 * scale;
    sheet.forEach((frontPlacement, index) => {
      const placement = layout.state.side === 'back' ? mirrorBack(frontPlacement, cfg) : frontPlacement;
      const element = document.createElement('span');
      element.className = 'numbering-preview-label';
      element.textContent = formatNumber(config.start + sequenceOffset + index, config.format);
      const fontPx = Math.max(7, config.font_size_pt * 25.4 / 72 * scale);
      element.style.fontSize = `${fontPx}px`;
      const left = placement.x * scale;
      const top = placement.y * scale;
      const width = placement.width * scale;
      const height = placement.height * scale;
      if (config.position === 'top-left') {
        element.style.left = `${left + inset}px`; element.style.top = `${top + inset}px`;
      } else if (config.position === 'top-right') {
        element.style.left = `${left + width - inset}px`; element.style.top = `${top + inset}px`; element.style.transform = 'translateX(-100%)';
      } else if (config.position === 'bottom-left') {
        element.style.left = `${left + inset}px`; element.style.top = `${top + height - inset}px`; element.style.transform = 'translateY(-100%)';
      } else if (config.position === 'bottom-center') {
        element.style.left = `${left + width / 2}px`; element.style.top = `${top + height - inset}px`; element.style.transform = 'translate(-50%,-100%)';
      } else {
        element.style.left = `${left + width - inset}px`; element.style.top = `${top + height - inset}px`; element.style.transform = 'translate(-100%,-100%)';
      }
      overlay.appendChild(element);
    });
  }

  function currentRequestSettings() {
    const plan = window.SmartPrintLayout?.state?.plan;
    const cfg = plan?.cfg || {};
    return {
      jobs: (window.SmartPrintLayout?.state?.items || []).map((item, index) => ({ file_index: index, quantity: 1 })),
      paper: { width_mm: Number($('paperWidth')?.value) || cfg.paperW, height_mm: Number($('paperHeight')?.value) || cfg.paperH },
      margin_mm: Number($('marginMm')?.value) || 0,
      gap_mm: Number($('gapMm')?.value) || 0,
      allow_rotate: Boolean($('allowRotate')?.checked),
      auto_fill: true,
      side_mode: $('sideMode')?.value || 'auto',
      flip_edge: $('flipEdge')?.value || 'long',
      crop_marks: Boolean($('cropMarks')?.checked),
      numbering: numberingConfig(),
    };
  }

  async function generateNumberedPdf() {
    const layout = window.SmartPrintLayout;
    if (!layout?.state?.plan || layout.state.busy) return;
    await flushSizes();
    layout.state.busy = true;
    const button = $('downloadBtn');
    const input = $('fileInput');
    if (button) button.disabled = true;
    if (input) input.disabled = true;
    setStatus('넘버링을 포함한 출력용 PDF를 만드는 중...');
    try {
      const user = window.auth?.currentUser;
      if (!user) throw new Error('로그인이 필요합니다.');
      const token = await user.getIdToken();
      const form = new FormData();
      form.append('settings', JSON.stringify(currentRequestSettings()));
      layout.state.items.forEach(item => form.append('files', item.file, item.name));
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
        const anchor = document.createElement('a');
        anchor.href = result.download_url;
        anchor.download = result.filename || 'smart-print-layout.pdf';
        anchor.rel = 'noopener';
        document.body.appendChild(anchor);
        anchor.click();
        anchor.remove();
      } else {
        const blob = await response.blob();
        const url = URL.createObjectURL(blob);
        const anchor = document.createElement('a');
        anchor.href = url;
        anchor.download = 'smart-print-layout.pdf';
        document.body.appendChild(anchor);
        anchor.click();
        anchor.remove();
        setTimeout(() => URL.revokeObjectURL(url), 30000);
      }
      setStatus('넘버링을 포함한 출력용 PDF를 만들었습니다.', 'success');
    } catch (error) {
      setStatus(error?.message || '출력용 PDF를 만들지 못했습니다.', 'error');
    } finally {
      layout.state.busy = false;
      if (input) input.disabled = false;
      updateDownloadAvailability();
    }
  }

  async function onDownloadCapture(event) {
    if (bypassDownloadCapture) {
      bypassDownloadCapture = false;
      return;
    }
    const needsFlush = dirtyItems.size || pendingRebuilds.size || rebuildTimers.size;
    const numbered = numberingConfig().enabled;
    if (!needsFlush && !numbered) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    try {
      if (needsFlush) {
        setStatus('입력한 이미지 크기를 최종 PDF에 적용하는 중...');
        await flushSizes();
      }
      if (numberingConfig().enabled) {
        await generateNumberedPdf();
      } else {
        bypassDownloadCapture = true;
        $('downloadBtn')?.click();
      }
    } catch (error) {
      setStatus(error?.message || '이미지 크기를 적용하지 못했습니다.', 'error');
      updateDownloadAvailability();
    }
  }

  function resetEnhancements() {
    if ($('numberingEnabled')) $('numberingEnabled').checked = false;
    if ($('numberingStart')) $('numberingStart').value = '1';
    if ($('numberingFormat')) $('numberingFormat').value = 'pad3';
    if ($('numberingPosition')) $('numberingPosition').value = 'bottom-right';
    if ($('numberingFontSize')) $('numberingFontSize').value = '9';
    dirtyItems.clear();
    rebuildTimers.forEach(clearTimeout);
    rebuildTimers.clear();
    updateNumberingControls();
  }

  function bind() {
    const input = $('fileInput');
    const zone = $('uploadZone');
    input?.addEventListener('change', event => rememberImages(event.target.files), true);
    zone?.addEventListener('drop', event => rememberImages(event.dataTransfer?.files), true);

    const list = $('fileList');
    if (list) {
      new MutationObserver(() => requestAnimationFrame(() => { syncEditors(); scheduleOverlay(); }))
        .observe(list, { childList: true });
    }
    const canvas = $('layoutCanvas');
    if (canvas) {
      new MutationObserver(scheduleOverlay).observe(canvas, { attributes: true, attributeFilter: ['width', 'height', 'style'] });
    }

    $('numberingEnabled')?.addEventListener('change', updateNumberingControls);
    ['numberingStart', 'numberingFormat', 'numberingPosition', 'numberingFontSize'].forEach(id => {
      $(id)?.addEventListener('input', scheduleOverlay);
      $(id)?.addEventListener('change', scheduleOverlay);
    });
    ['prevSheet', 'nextSheet', 'frontBtn', 'backBtn'].forEach(id => $(id)?.addEventListener('click', () => requestAnimationFrame(scheduleOverlay)));
    ['paperWidth', 'paperHeight', 'marginMm', 'gapMm', 'allowRotate', 'sideMode', 'flipEdge'].forEach(id => $(id)?.addEventListener('change', scheduleOverlay));
    $('downloadBtn')?.addEventListener('click', onDownloadCapture, true);
    $('resetBtn')?.addEventListener('click', () => requestAnimationFrame(resetEnhancements));
    window.addEventListener('resize', scheduleOverlay);
  }

  function boot() {
    injectStyles();
    injectNumberingPanel();
    bind();
    updateNumberingControls();
    syncEditors();
    scheduleOverlay();
    document.documentElement.dataset.smartLayoutSizeNumbering = 'v1';
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once: true });
  else boot();

  window.SmartPrintSizeNumbering = {
    numberingConfig,
    flushSizes,
    syncEditors,
    stage: 'smart-layout-image-direct-size-numbering-v1',
  };
})();
