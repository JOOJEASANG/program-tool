(() => {
  'use strict';
  if (window.__smartPrintSizeNumberingV2) return;
  window.__smartPrintSizeNumberingV2 = true;

  const MAX_NUMBERED_COPIES = 2000;
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
  const FONT_PREVIEW = {
    korean: 'Arial, "Malgun Gothic", sans-serif',
    helvetica: 'Arial, Helvetica, sans-serif',
    'helvetica-bold': 'Arial, Helvetica, sans-serif',
    'helvetica-oblique': 'Arial, Helvetica, sans-serif',
    'helvetica-bold-oblique': 'Arial, Helvetica, sans-serif',
    times: '"Times New Roman", Times, serif',
    'times-bold': '"Times New Roman", Times, serif',
    'times-italic': '"Times New Roman", Times, serif',
    'times-bold-italic': '"Times New Roman", Times, serif',
    courier: '"Courier New", Courier, monospace',
    'courier-bold': '"Courier New", Courier, monospace',
    'courier-oblique': '"Courier New", Courier, monospace',
    'courier-bold-oblique': '"Courier New", Courier, monospace',
  };

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
      .image-size-grid label,.image-margin-row label{display:grid;gap:4px;font-size:10px;font-weight:700;color:#64748b}
      .image-size-grid input,.image-margin-row input{width:100%;box-sizing:border-box;border:1px solid #cbd5e1;border-radius:7px;padding:7px 8px;font:700 12px Pretendard,sans-serif;background:#fff;color:#0f172a}
      .image-size-grid input:focus,.image-margin-row input:focus{outline:2px solid rgba(15,118,110,.18);border-color:#0f766e}
      .image-size-times{padding-bottom:7px;color:#94a3b8;font-weight:900}
      .image-margin-row{display:grid;grid-template-columns:1fr 1fr;gap:7px;margin-top:8px;align-items:end}
      .image-size-help{margin-top:7px;font-size:10px;line-height:1.45;color:#64748b}
      .smart-numbering-panel .numbering-options,.smart-trim-panel .trim-options{display:grid;gap:10px;margin-top:10px}
      .smart-numbering-panel .numbering-options.is-disabled,.smart-trim-panel .trim-options.is-disabled{opacity:.42}
      .smart-numbering-panel .numbering-options .grid2,.smart-trim-panel .trim-options .grid2{align-items:end}
      .numbering-estimate{margin:0;padding:8px 10px;border-radius:8px;background:#f1f5f9;color:#334155;font-size:11px;font-weight:700;line-height:1.45}
      .numbering-estimate.error{background:#fef2f2;color:#b91c1c}
      .numbering-preview-overlay{position:absolute;z-index:6;pointer-events:none;overflow:hidden}
      .numbering-preview-label{position:absolute;white-space:nowrap;color:#111827;background:rgba(255,255,255,.84);border-radius:2px;padding:1px 3px;font-family:Arial,sans-serif;font-weight:700;line-height:1.12;box-shadow:0 0 0 1px rgba(15,23,42,.08)}
      .numbering-preview-label.is-transparent{background:transparent;box-shadow:none;padding:0}
      .trim-guide-preview{position:absolute;box-sizing:border-box;border:2px dashed #e11d48;border-radius:2px}
      .trim-guide-preview.is-over{border-color:#dc2626;background:rgba(254,226,226,.18)}
      .trim-guide-label{position:absolute;left:2px;top:2px;padding:1px 4px;border-radius:3px;background:rgba(225,29,72,.9);color:#fff;font:800 8px/1.35 Pretendard,sans-serif;white-space:nowrap}
      .image-margin-preview{position:absolute;background:rgba(255,255,255,.82)}
      @media(max-width:700px){.image-size-grid{grid-template-columns:1fr auto 1fr}.image-size-editor{padding:9px}.image-margin-row{grid-template-columns:1fr}}
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
      <div class="step">STEP 5</div>
      <h2>자동 넘버링</h2>
      <label class="check-row"><input id="numberingEnabled" type="checkbox"><span>배치된 인쇄물마다 번호 인쇄</span></label>
      <div id="numberingOptions" class="numbering-options is-disabled">
        <div class="grid2">
          <label class="field"><span>시작 번호</span><input id="numberingStart" type="number" min="0" max="9999999" step="1" value="1"></label>
          <label class="field"><span>끝 번호</span><input id="numberingEnd" type="number" min="0" max="9999999" step="1" placeholder="예: 1000"></label>
        </div>
        <div class="grid2">
          <label class="field"><span>번호 앞 추가 문구</span><input id="numberingPrefix" type="text" maxlength="40" placeholder="예: 입장권- "></label>
          <label class="field"><span>표시 형식</span><select id="numberingFormat"><option value="plain">1, 2, 3</option><option value="pad3" selected>001, 002, 003</option><option value="no-pad3">NO.001, NO.002</option></select></label>
        </div>
        <div class="grid2">
          <label class="field"><span>글꼴</span><select id="numberingFont">
            <option value="korean">한국어 기본</option>
            <option value="helvetica-bold" selected>Helvetica Bold</option>
            <option value="helvetica">Helvetica</option>
            <option value="helvetica-oblique">Helvetica Oblique</option>
            <option value="helvetica-bold-oblique">Helvetica Bold Oblique</option>
            <option value="times">Times Roman</option>
            <option value="times-bold">Times Bold</option>
            <option value="times-italic">Times Italic</option>
            <option value="times-bold-italic">Times Bold Italic</option>
            <option value="courier">Courier</option>
            <option value="courier-bold">Courier Bold</option>
            <option value="courier-oblique">Courier Oblique</option>
            <option value="courier-bold-oblique">Courier Bold Oblique</option>
          </select></label>
          <label class="field"><span>글자 크기 pt</span><input id="numberingFontSize" type="number" min="5" max="36" step="1" value="9"></label>
        </div>
        <div class="grid2">
          <label class="field"><span>위치</span><select id="numberingPosition"><option value="top-left">왼쪽 위</option><option value="top-center">위 가운데</option><option value="top-right">오른쪽 위</option><option value="bottom-left">왼쪽 아래</option><option value="bottom-center">아래 가운데</option><option value="bottom-right" selected>오른쪽 아래</option></select></label>
          <label class="check-row"><input id="numberingTransparent" type="checkbox"><span>넘버링 배경 투명</span></label>
        </div>
        <p id="numberingEstimate" class="numbering-estimate">끝번호를 입력하면 필요한 출력 용지를 자동 생성합니다.</p>
        <p class="hint">한 번에 최대 2,000개 번호를 생성합니다. 한글 문구를 사용할 때는 ‘한국어 기본’ 글꼴을 선택해 주세요. 양면은 앞·뒤에 같은 번호가 들어갑니다.</p>
      </div>`;
    anchor.insertAdjacentElement('afterend', panel);
  }

  function injectTrimPanel() {
    if ($('trimGuideEnabled')) return;
    const crop = $('cropMarks');
    const anchor = crop?.closest('.panel');
    if (!anchor) return;
    const panel = document.createElement('section');
    panel.className = 'panel smart-trim-panel';
    panel.innerHTML = `
      <div class="step">STEP 4</div>
      <h2>재단 크기 비교</h2>
      <label class="check-row"><input id="trimGuideEnabled" type="checkbox"><span>미리보기에 실제 재단선을 점선으로 표시</span></label>
      <div id="trimGuideOptions" class="trim-options is-disabled">
        <div class="grid2">
          <label class="field"><span>재단 가로 mm</span><input id="trimGuideWidth" type="number" min="2" max="2000" step="0.1" placeholder="예: 90"></label>
          <label class="field"><span>재단 세로 mm</span><input id="trimGuideHeight" type="number" min="2" max="2000" step="0.1" placeholder="예: 50"></label>
        </div>
        <p class="hint">PDF는 업로드된 페이지 크기 위에 실제 재단 크기를 중앙 점선으로 겹쳐 비교합니다. 이미지 파일은 아래 파일 카드에서 재단 크기와 사방 여백을 따로 지정할 수 있습니다.</p>
      </div>`;
    anchor.insertAdjacentElement('afterend', panel);
  }

  function numberingConfig() {
    const start = Math.round(clamp($('numberingStart')?.value || 1, 0, 9_999_999));
    const rawEnd = String($('numberingEnd')?.value || '').trim();
    const end = rawEnd === '' ? null : Math.round(clamp(rawEnd, 0, 9_999_999));
    return {
      enabled: Boolean($('numberingEnabled')?.checked),
      start,
      end,
      prefix: String($('numberingPrefix')?.value || '').slice(0, 40),
      format: $('numberingFormat')?.value || 'pad3',
      position: $('numberingPosition')?.value || 'bottom-right',
      font: $('numberingFont')?.value || 'helvetica-bold',
      font_size_pt: clamp($('numberingFontSize')?.value || 9, 5, 36),
      transparent_background: Boolean($('numberingTransparent')?.checked),
    };
  }

  function trimGuideConfig() {
    const width = Number($('trimGuideWidth')?.value || 0);
    const height = Number($('trimGuideHeight')?.value || 0);
    return {
      enabled: Boolean($('trimGuideEnabled')?.checked) && width >= 2 && height >= 2,
      widthMm: width,
      heightMm: height,
    };
  }

  function validateNumberingConfig(config = numberingConfig()) {
    if (!config.enabled || config.end == null) return config;
    if (config.end < config.start) throw new Error('넘버링 끝번호는 시작번호보다 크거나 같아야 합니다.');
    if (config.end - config.start + 1 > MAX_NUMBERED_COPIES) throw new Error(`한 번에 생성할 넘버링은 최대 ${MAX_NUMBERED_COPIES.toLocaleString()}개까지 가능합니다.`);
    return config;
  }

  function formatNumber(value, config) {
    let number;
    if (config.format === 'plain') number = String(value);
    else if (config.format === 'no-pad3') number = `NO.${String(value).padStart(3, '0')}`;
    else number = String(value).padStart(3, '0');
    return `${config.prefix || ''}${number}`;
  }

  function updateNumberingEstimate() {
    const element = $('numberingEstimate');
    if (!element) return;
    const config = numberingConfig();
    element.classList.remove('error');
    if (!config.enabled) {
      element.textContent = '넘버링을 켜면 번호 범위와 예상 용지 수를 계산합니다.';
      return;
    }
    if (config.end == null) {
      element.textContent = '끝번호를 비워두면 현재처럼 한 번의 자동배치 용지만 생성합니다.';
      return;
    }
    try {
      validateNumberingConfig(config);
    } catch (error) {
      element.textContent = error.message;
      element.classList.add('error');
      return;
    }
    const count = config.end - config.start + 1;
    const templates = window.SmartPrintLayout?.state?.plan?.sheets || [];
    if (!templates.length) {
      element.textContent = `${config.start.toLocaleString()}~${config.end.toLocaleString()} · 총 ${count.toLocaleString()}개 번호`;
      return;
    }
    let remaining = count;
    let sheetCount = 0;
    let index = 0;
    while (remaining > 0 && sheetCount <= MAX_NUMBERED_COPIES) {
      const capacity = Math.max(1, templates[index % templates.length]?.length || 1);
      remaining -= Math.min(remaining, capacity);
      sheetCount += 1;
      index += 1;
    }
    element.textContent = `${config.start.toLocaleString()}~${config.end.toLocaleString()} · 총 ${count.toLocaleString()}개 · 예상 출력 용지 ${sheetCount.toLocaleString()}장${window.SmartPrintLayout?.state?.plan?.duplex ? ' (양면)' : ''}`;
  }

  function updateNumberingControls() {
    const enabled = Boolean($('numberingEnabled')?.checked);
    const options = $('numberingOptions');
    options?.classList.toggle('is-disabled', !enabled);
    options?.querySelectorAll('input,select').forEach(control => { control.disabled = !enabled; });
    updateNumberingEstimate();
    scheduleOverlay();
  }

  function updateTrimControls() {
    const enabled = Boolean($('trimGuideEnabled')?.checked);
    const options = $('trimGuideOptions');
    options?.classList.toggle('is-disabled', !enabled);
    options?.querySelectorAll('input,select').forEach(control => { control.disabled = !enabled; });
    if (enabled && !$('trimGuideWidth')?.value && !$('trimGuideHeight')?.value) {
      const first = window.SmartPrintLayout?.state?.items?.[0];
      if (first) {
        $('trimGuideWidth').value = round1(first.widthMm);
        $('trimGuideHeight').value = round1(first.heightMm);
      }
    }
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

  async function buildSizedPdf(original, item, trimWidthMm, trimHeightMm, marginMm) {
    const JsPdf = await ensureJsPdf(original);
    const bitmap = await loadImageElement(original);
    const widthPx = Number(bitmap.width || bitmap.naturalWidth || 0);
    const heightPx = Number(bitmap.height || bitmap.naturalHeight || 0);
    if (!widthPx || !heightPx) throw new Error(`${original.name}: 이미지 크기를 확인할 수 없습니다.`);
    const pageWidthMm = trimWidthMm + marginMm * 2;
    const pageHeightMm = trimHeightMm + marginMm * 2;
    if (pageWidthMm > 2000 || pageHeightMm > 2000) throw new Error('이미지 재단 크기와 여백을 합친 크기는 2,000mm 이하로 설정해 주세요.');
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
      orientation: pageWidthMm > pageHeightMm ? 'landscape' : 'portrait',
      unit: 'mm',
      format: [pageWidthMm, pageHeightMm],
      compress: true,
      putOnlyUsedFonts: true,
    });
    pdf.addImage(jpeg, 'JPEG', marginMm, marginMm, trimWidthMm, trimHeightMm, undefined, 'FAST');
    const blob = pdf.output('blob');
    canvas.width = 1;
    canvas.height = 1;
    const name = String(item.name || 'image.pdf').replace(/\.[^.]+$/, '') + '.pdf';
    const file = new File([blob], name, { type: 'application/pdf', lastModified: original.lastModified || Date.now() });
    Object.defineProperties(file, {
      __sourceType: { value: 'image', enumerable: false },
      __displayName: { value: sourceName(item), enumerable: false },
      __imageMeta: { value: { widthPx, heightPx, widthMm: pageWidthMm, heightMm: pageHeightMm, trimWidthMm, trimHeightMm, marginMm, dpi: null, targetSize: true, originalType: original.type || '' }, enumerable: false },
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
    const file = await buildSizedPdf(original, item, target.trimWidthMm, target.trimHeightMm, target.marginMm);
    if ((rebuildRevisions.get(item.id) || 0) !== revision) return;
    item.file = file;
    item.widthMm = target.trimWidthMm + target.marginMm * 2;
    item.heightMm = target.trimHeightMm + target.marginMm * 2;
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
        updateNumberingEstimate();
        scheduleOverlay();
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

  function applyImageSettings(item, editor, changed) {
    const meta = item.imageMeta || item.file?.__imageMeta || {};
    const current = item.__smartTargetSize || {
      trimWidthMm: Number(meta.trimWidthMm) || Number(item.widthMm) || 10,
      trimHeightMm: Number(meta.trimHeightMm) || Number(item.heightMm) || 10,
      marginMm: Number(meta.marginMm) || 0,
    };
    const ratio = item.__imageAspect || (Number(meta.widthPx) > 0 && Number(meta.heightPx) > 0 ? Number(meta.widthPx) / Number(meta.heightPx) : current.trimWidthMm / current.trimHeightMm);
    if (!Number.isFinite(ratio) || ratio <= 0) return;
    item.__imageAspect = ratio;
    const widthInput = editor.querySelector('[data-image-size="width"]');
    const heightInput = editor.querySelector('[data-image-size="height"]');
    const marginInput = editor.querySelector('[data-image-size="margin"]');
    let trimWidthMm = clamp(widthInput.value, 2, 2000);
    let trimHeightMm = clamp(heightInput.value, 2, 2000);
    const marginMm = clamp(marginInput.value || 0, 0, 100);
    if (changed === 'width') trimHeightMm = clamp(trimWidthMm / ratio, 2, 2000);
    else if (changed === 'height') trimWidthMm = clamp(trimHeightMm * ratio, 2, 2000);
    trimWidthMm = round1(trimWidthMm);
    trimHeightMm = round1(trimHeightMm);
    widthInput.value = trimWidthMm;
    heightInput.value = trimHeightMm;
    marginInput.value = round1(marginMm);
    item.widthMm = trimWidthMm + marginMm * 2;
    item.heightMm = trimHeightMm + marginMm * 2;
    item.__smartTargetSize = { trimWidthMm, trimHeightMm, marginMm };
    item.__smartCustomSize = true;
    rebuildRevisions.set(item.id, (rebuildRevisions.get(item.id) || 0) + 1);
    dirtyItems.add(item.id);
    window.SmartPrintLayout?.recalculate?.();
    updateNumberingEstimate();
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
      if (!item.__smartTargetSize) {
        const meta = item.imageMeta || {};
        item.__smartTargetSize = {
          trimWidthMm: round1(Number(meta.trimWidthMm) || item.widthMm),
          trimHeightMm: round1(Number(meta.trimHeightMm) || item.heightMm),
          marginMm: round1(Number(meta.marginMm) || 0),
        };
      }
      let editor = row.querySelector('.image-size-editor');
      if (!editor) {
        editor = document.createElement('div');
        editor.className = 'image-size-editor';
        editor.innerHTML = `<div class="image-size-head"><span>이미지 재단·여백</span><span class="image-size-lock">재단 비율 고정</span></div><div class="image-size-grid"><label>재단 가로 mm<input data-image-size="width" type="number" min="2" max="2000" step="0.1"></label><span class="image-size-times">×</span><label>재단 세로 mm<input data-image-size="height" type="number" min="2" max="2000" step="0.1"></label></div><div class="image-margin-row"><label>사방 여백 mm<input data-image-size="margin" type="number" min="0" max="100" step="0.1" value="0"></label><div class="image-size-help">최종 배치 크기 = 재단 크기 + 좌우·상하 여백</div></div><div class="image-size-help">이미지는 재단 크기로 인쇄하고 입력한 여백만큼 흰 여백을 실제 PDF 페이지에 추가합니다. 미리보기 점선이 실제 재단선입니다.</div>`;
        row.appendChild(editor);
        const width = editor.querySelector('[data-image-size="width"]');
        const height = editor.querySelector('[data-image-size="height"]');
        const margin = editor.querySelector('[data-image-size="margin"]');
        width.addEventListener('input', () => applyImageSettings(item, editor, 'width'));
        height.addEventListener('input', () => applyImageSettings(item, editor, 'height'));
        margin.addEventListener('input', () => applyImageSettings(item, editor, 'margin'));
      }
      const target = item.__smartTargetSize;
      const width = editor.querySelector('[data-image-size="width"]');
      const height = editor.querySelector('[data-image-size="height"]');
      const margin = editor.querySelector('[data-image-size="margin"]');
      if (document.activeElement !== width) width.value = round1(target.trimWidthMm);
      if (document.activeElement !== height) height.value = round1(target.trimHeightMm);
      if (document.activeElement !== margin) margin.value = round1(target.marginMm);
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

  function addMarginMask(overlay, left, top, width, height) {
    if (width <= 0 || height <= 0) return;
    const mask = document.createElement('span');
    mask.className = 'image-margin-preview';
    mask.style.left = `${left}px`;
    mask.style.top = `${top}px`;
    mask.style.width = `${width}px`;
    mask.style.height = `${height}px`;
    overlay.appendChild(mask);
  }

  function drawTrimGuide(overlay, placement, item, scale, config) {
    const target = isImageItem(item) ? item.__smartTargetSize : null;
    const trimWidthSource = Number(target?.trimWidthMm || (config.enabled ? config.widthMm : 0));
    const trimHeightSource = Number(target?.trimHeightMm || (config.enabled ? config.heightMm : 0));
    if (!(trimWidthSource >= 2 && trimHeightSource >= 2)) return;

    const sourceWidth = Number(item?.widthMm || placement.width);
    const sourceHeight = Number(item?.heightMm || placement.height);
    const sourceDisplayWidth = placement.rotated ? sourceHeight : sourceWidth;
    const sourceDisplayHeight = placement.rotated ? sourceWidth : sourceHeight;
    const trimDisplayWidth = placement.rotated ? trimHeightSource : trimWidthSource;
    const trimDisplayHeight = placement.rotated ? trimWidthSource : trimHeightSource;
    const guideWidthMm = trimDisplayWidth * placement.width / Math.max(.001, sourceDisplayWidth);
    const guideHeightMm = trimDisplayHeight * placement.height / Math.max(.001, sourceDisplayHeight);
    const left = (placement.x + (placement.width - guideWidthMm) / 2) * scale;
    const top = (placement.y + (placement.height - guideHeightMm) / 2) * scale;
    const width = guideWidthMm * scale;
    const height = guideHeightMm * scale;

    if (target?.marginMm > 0) {
      const px = placement.x * scale;
      const py = placement.y * scale;
      const pw = placement.width * scale;
      const ph = placement.height * scale;
      addMarginMask(overlay, px, py, pw, Math.max(0, top - py));
      addMarginMask(overlay, px, top + height, pw, Math.max(0, py + ph - top - height));
      addMarginMask(overlay, px, top, Math.max(0, left - px), height);
      addMarginMask(overlay, left + width, top, Math.max(0, px + pw - left - width), height);
    }

    const guide = document.createElement('span');
    guide.className = 'trim-guide-preview';
    if (trimDisplayWidth > sourceDisplayWidth + .2 || trimDisplayHeight > sourceDisplayHeight + .2) guide.classList.add('is-over');
    guide.style.left = `${left}px`;
    guide.style.top = `${top}px`;
    guide.style.width = `${width}px`;
    guide.style.height = `${height}px`;
    const label = document.createElement('span');
    label.className = 'trim-guide-label';
    label.textContent = `재단 ${round1(trimWidthSource)}×${round1(trimHeightSource)}mm`;
    guide.appendChild(label);
    overlay.appendChild(guide);
  }

  function drawNumberLabel(overlay, placement, scale, value, config) {
    const element = document.createElement('span');
    element.className = 'numbering-preview-label';
    if (config.transparent_background) element.classList.add('is-transparent');
    element.textContent = formatNumber(value, config);
    const fontPx = Math.max(7, config.font_size_pt * 25.4 / 72 * scale);
    element.style.fontSize = `${fontPx}px`;
    element.style.fontFamily = FONT_PREVIEW[config.font] || FONT_PREVIEW['helvetica-bold'];
    element.style.fontWeight = config.font.includes('bold') ? '700' : '400';
    element.style.fontStyle = config.font.includes('italic') || config.font.includes('oblique') ? 'italic' : 'normal';
    const inset = 1.6 * scale;
    const left = placement.x * scale;
    const top = placement.y * scale;
    const width = placement.width * scale;
    const height = placement.height * scale;
    if (config.position === 'top-left') {
      element.style.left = `${left + inset}px`; element.style.top = `${top + inset}px`;
    } else if (config.position === 'top-center') {
      element.style.left = `${left + width / 2}px`; element.style.top = `${top + inset}px`; element.style.transform = 'translateX(-50%)';
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
    const numberConfig = numberingConfig();
    const trimConfig = trimGuideConfig();
    const plan = layout.state.plan;
    const hasImageTrim = (layout.state.items || []).some(item => isImageItem(item) && item.__smartTargetSize);
    if ((!numberConfig.enabled && !trimConfig.enabled && !hasImageTrim) || !plan?.sheets?.length || canvas.style.display === 'none') {
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
    sheet.forEach((frontPlacement, index) => {
      const placement = layout.state.side === 'back' ? mirrorBack(frontPlacement, cfg) : frontPlacement;
      const item = layout.state.items?.[frontPlacement.fileIndex];
      if (item) drawTrimGuide(overlay, placement, item, scale, trimConfig);
      const value = numberConfig.start + sequenceOffset + index;
      if (numberConfig.enabled && (numberConfig.end == null || value <= numberConfig.end)) drawNumberLabel(overlay, placement, scale, value, numberConfig);
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
    validateNumberingConfig();
    await flushSizes();
    layout.state.busy = true;
    const button = $('downloadBtn');
    const input = $('fileInput');
    if (button) button.disabled = true;
    if (input) input.disabled = true;
    setStatus('넘버링 범위에 맞춰 출력용 PDF 페이지를 만드는 중...');
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
      setStatus('끝번호까지 넘버링한 출력용 PDF를 만들었습니다.', 'success');
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
        setStatus('입력한 이미지 재단 크기와 여백을 최종 PDF에 적용하는 중...');
        await flushSizes();
      }
      if (numberingConfig().enabled) {
        await generateNumberedPdf();
      } else {
        bypassDownloadCapture = true;
        $('downloadBtn')?.click();
      }
    } catch (error) {
      setStatus(error?.message || '이미지 크기 또는 넘버링을 적용하지 못했습니다.', 'error');
      updateDownloadAvailability();
    }
  }

  function resetEnhancements() {
    if ($('numberingEnabled')) $('numberingEnabled').checked = false;
    if ($('numberingStart')) $('numberingStart').value = '1';
    if ($('numberingEnd')) $('numberingEnd').value = '';
    if ($('numberingPrefix')) $('numberingPrefix').value = '';
    if ($('numberingFormat')) $('numberingFormat').value = 'pad3';
    if ($('numberingPosition')) $('numberingPosition').value = 'bottom-right';
    if ($('numberingFont')) $('numberingFont').value = 'helvetica-bold';
    if ($('numberingFontSize')) $('numberingFontSize').value = '9';
    if ($('numberingTransparent')) $('numberingTransparent').checked = false;
    if ($('trimGuideEnabled')) $('trimGuideEnabled').checked = false;
    if ($('trimGuideWidth')) $('trimGuideWidth').value = '';
    if ($('trimGuideHeight')) $('trimGuideHeight').value = '';
    dirtyItems.clear();
    rebuildTimers.forEach(clearTimeout);
    rebuildTimers.clear();
    updateNumberingControls();
    updateTrimControls();
  }

  function bind() {
    const input = $('fileInput');
    const zone = $('uploadZone');
    input?.addEventListener('change', event => rememberImages(event.target.files), true);
    zone?.addEventListener('drop', event => rememberImages(event.dataTransfer?.files), true);

    const list = $('fileList');
    if (list) {
      new MutationObserver(() => requestAnimationFrame(() => { syncEditors(); updateNumberingEstimate(); scheduleOverlay(); }))
        .observe(list, { childList: true });
    }
    const canvas = $('layoutCanvas');
    if (canvas) new MutationObserver(scheduleOverlay).observe(canvas, { attributes: true, attributeFilter: ['width', 'height', 'style'] });

    $('numberingEnabled')?.addEventListener('change', updateNumberingControls);
    ['numberingStart', 'numberingEnd', 'numberingPrefix', 'numberingFormat', 'numberingPosition', 'numberingFont', 'numberingFontSize', 'numberingTransparent'].forEach(id => {
      $(id)?.addEventListener('input', () => { updateNumberingEstimate(); scheduleOverlay(); });
      $(id)?.addEventListener('change', () => { updateNumberingEstimate(); scheduleOverlay(); });
    });
    $('trimGuideEnabled')?.addEventListener('change', updateTrimControls);
    ['trimGuideWidth', 'trimGuideHeight'].forEach(id => {
      $(id)?.addEventListener('input', scheduleOverlay);
      $(id)?.addEventListener('change', scheduleOverlay);
    });
    ['prevSheet', 'nextSheet', 'frontBtn', 'backBtn'].forEach(id => $(id)?.addEventListener('click', () => requestAnimationFrame(scheduleOverlay)));
    ['paperWidth', 'paperHeight', 'marginMm', 'gapMm', 'allowRotate', 'sideMode', 'flipEdge'].forEach(id => $(id)?.addEventListener('change', () => { updateNumberingEstimate(); scheduleOverlay(); }));
    $('downloadBtn')?.addEventListener('click', onDownloadCapture, true);
    $('resetBtn')?.addEventListener('click', () => requestAnimationFrame(resetEnhancements));
    window.addEventListener('resize', scheduleOverlay);
  }

  function boot() {
    injectStyles();
    injectNumberingPanel();
    injectTrimPanel();
    bind();
    updateNumberingControls();
    updateTrimControls();
    syncEditors();
    scheduleOverlay();
    window.SmartPrintLayoutEnhancements = { numberingConfig, trimGuideConfig, scheduleOverlay };
    document.documentElement.dataset.smartLayoutSizeNumbering = 'v2-number-range-trim';
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once: true });
  else boot();
})();
