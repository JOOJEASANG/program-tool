(() => {
  'use strict';
  if (window.__smartPrintAdvancedControlsV2) return;
  window.__smartPrintAdvancedControlsV2 = true;

  const $ = id => document.getElementById(id);
  const PAPER = {
    a4: [210, 297],
    b4: [257, 364],
    a3: [297, 420],
    sra3: [320, 450],
    a3plus: [329, 483],
  };
  const FONT_CSS = {
    'helvetica': { family: 'Arial, Helvetica, sans-serif', weight: '400' },
    'helvetica-bold': { family: 'Arial, Helvetica, sans-serif', weight: '700' },
    'times': { family: '"Times New Roman", Times, serif', weight: '400' },
    'courier': { family: '"Courier New", Courier, monospace', weight: '400' },
  };
  let overlayFrame = 0;
  let fitFrame = 0;
  let patching = false;
  let originalFetch = null;
  let originalRecalculate = null;

  const clamp = (value, min, max, fallback = min) => {
    const number = Number(value);
    if (!Number.isFinite(number)) return fallback;
    return Math.min(max, Math.max(min, number));
  };
  const round1 = value => Math.round(Number(value || 0) * 10) / 10;

  function layoutApi() {
    return window.SmartPrintLayout || null;
  }

  function setStatus(message = '', type = '') {
    const line = $('statusLine');
    if (!line) return;
    line.textContent = message;
    line.className = `status${type ? ` ${type}` : ''}`;
  }

  function injectStyles() {
    if ($('smartAdvancedControlsStyles')) return;
    const style = document.createElement('style');
    style.id = 'smartAdvancedControlsStyles';
    style.textContent = `
      .smart-orientation-field{margin-top:1px}
      .duplex-pair-row{display:flex;align-items:flex-start;gap:7px;margin-top:8px;padding-top:8px;border-top:1px dashed #cbd5e1;font-size:9.5px;line-height:1.4;color:#475569}
      .duplex-pair-row input{margin-top:1px;accent-color:#0f766e}
      .duplex-pair-row strong{color:#0f766e}
      .file-item[data-duplex-role="back"]{border-color:#99d8d0;background:#f0fdfa}
      .file-item[data-duplex-role="back"] .side-pill{background:#ccfbf1;color:#115e59}
      .file-item[data-duplex-role="front-paired"] .side-pill{background:#dbeafe;color:#1d4ed8}
      .smart-numbering-v2-panel .numbering-v2-options{display:grid;gap:9px;margin-top:10px}
      .smart-numbering-v2-panel .numbering-v2-options.is-disabled{opacity:.43}
      .smart-numbering-v2-panel .grid2{align-items:end}
      .advanced-numbering-overlay{position:absolute;z-index:8;pointer-events:none;overflow:hidden}
      .advanced-numbering-label{position:absolute;white-space:nowrap;color:#111827;background:rgba(255,255,255,.84);border-radius:2px;padding:1px 3px;line-height:1.12;box-shadow:0 0 0 1px rgba(15,23,42,.08)}
      @media(min-width:901px){
        .workspace{overflow:hidden;padding:12px 16px 16px;gap:10px}
        .workspace-head{flex:0 0 auto}
        .canvas-shell{flex:1;min-height:0;padding:12px;overflow:hidden}
        #layoutCanvas{max-width:none;max-height:none}
      }
    `;
    document.head.appendChild(style);
  }

  function injectOrientationControl() {
    if ($('paperOrientation')) return;
    const preset = $('paperPreset');
    const presetField = preset?.closest('.field');
    if (!presetField) return;
    const field = document.createElement('label');
    field.className = 'field smart-orientation-field';
    field.innerHTML = `
      <span>출력 방향</span>
      <select id="paperOrientation" aria-label="출력 용지 방향">
        <option value="portrait" selected>세로 출력</option>
        <option value="landscape">가로 출력</option>
      </select>`;
    presetField.insertAdjacentElement('afterend', field);
  }

  function injectNumberingPanel() {
    document.querySelector('.smart-numbering-panel')?.remove();
    if ($('advNumberingEnabled')) return;
    const anchor = $('cropMarks')?.closest('.panel');
    if (!anchor) return;
    const panel = document.createElement('section');
    panel.className = 'panel smart-numbering-v2-panel';
    panel.innerHTML = `
      <div class="step">STEP 4</div>
      <h2>자동 넘버링</h2>
      <label class="check-row"><input id="advNumberingEnabled" type="checkbox"><span>배치된 인쇄물마다 번호 인쇄</span></label>
      <div id="advNumberingOptions" class="numbering-v2-options is-disabled">
        <div class="grid2">
          <label class="field"><span>시작 번호</span><input id="advNumberingStart" type="number" min="0" max="9999999" step="1" value="1"></label>
          <label class="field"><span>표시 형식</span><select id="advNumberingFormat"><option value="plain">1, 2, 3</option><option value="pad3" selected>001, 002, 003</option><option value="no-pad3">NO.001, NO.002</option></select></label>
        </div>
        <div class="grid2">
          <label class="field"><span>기본 글꼴</span><select id="advNumberingFont"><option value="helvetica-bold" selected>Helvetica Bold</option><option value="helvetica">Helvetica</option><option value="times">Times Roman</option><option value="courier">Courier</option></select></label>
          <label class="field"><span>글자 크기 pt</span><input id="advNumberingFontSize" type="number" min="5" max="36" step="1" value="9"></label>
        </div>
        <label class="field"><span>위치</span><select id="advNumberingPosition"><option value="top-left">왼쪽 위</option><option value="top-center">위 가운데</option><option value="top-right">오른쪽 위</option><option value="bottom-left">왼쪽 아래</option><option value="bottom-center">아래 가운데</option><option value="bottom-right" selected>오른쪽 아래</option></select></label>
        <div class="grid2">
          <label class="field"><span>좌우 여백 mm</span><input id="advNumberingMarginX" type="number" min="0" max="50" step="0.5" value="1.5"></label>
          <label class="field"><span>상하 여백 mm</span><input id="advNumberingMarginY" type="number" min="0" max="50" step="0.5" value="1.5"></label>
        </div>
        <p class="hint">선택한 위치를 기준으로 좌우·상하 여백을 조절합니다. 양면은 앞면과 대응하는 뒷면에 같은 번호가 인쇄됩니다.</p>
      </div>`;
    anchor.insertAdjacentElement('afterend', panel);
  }

  function removePreviewGuideCards() {
    document.querySelector('.guide-row')?.remove();
  }

  function orientation() {
    return $('paperOrientation')?.value === 'landscape' ? 'landscape' : 'portrait';
  }

  function applyOrientation({ recalculate = true } = {}) {
    const width = $('paperWidth');
    const height = $('paperHeight');
    const preset = $('paperPreset');
    if (!width || !height || !preset) return;

    const base = PAPER[preset.value];
    let w;
    let h;
    if (base) {
      [w, h] = base;
    } else {
      w = Number(width.value) || 297;
      h = Number(height.value) || 420;
      const short = Math.min(w, h);
      const long = Math.max(w, h);
      w = short;
      h = long;
    }
    if (orientation() === 'landscape') [w, h] = [h, w];
    width.value = round1(w);
    height.value = round1(h);
    if (recalculate) {
      width.dispatchEvent(new Event('input', { bubbles: true }));
      height.dispatchEvent(new Event('input', { bubbles: true }));
    }
    requestFitCanvas();
  }

  function syncOrientationFromDimensions() {
    const width = Number($('paperWidth')?.value || 0);
    const height = Number($('paperHeight')?.value || 0);
    const control = $('paperOrientation');
    if (!control || !width || !height) return;
    control.value = width > height ? 'landscape' : 'portrait';
  }

  function nativePageCount(item) {
    return Number(item?.__nativePageCount ?? item?.pageCount ?? 1);
  }

  function restoreFront(front) {
    if (!front) return;
    if (front.__nativePageCount != null) front.pageCount = front.__nativePageCount;
    if (Object.prototype.hasOwnProperty.call(front, '__nativeBackThumb')) front.backThumb = front.__nativeBackThumb;
    delete front.__pairedBackId;
  }

  function findBackIndex(frontId) {
    const items = layoutApi()?.state?.items || [];
    return items.findIndex(item => item?.backForId === frontId);
  }

  function normalizePairs() {
    const items = layoutApi()?.state?.items || [];
    const byId = new Map(items.map(item => [item.id, item]));
    items.forEach(item => {
      if (!item?.backForId) return;
      const front = byId.get(item.backForId);
      if (!front || front === item || nativePageCount(front) !== 1 || nativePageCount(item) !== 1) {
        delete item.backForId;
      }
    });
    items.forEach(item => {
      if (!item?.__pairedBackId) return;
      const back = byId.get(item.__pairedBackId);
      if (!back || back.backForId !== item.id) restoreFront(item);
    });
    items.forEach(back => {
      if (!back?.backForId) return;
      const front = byId.get(back.backForId);
      if (!front) return;
      if (front.__nativePageCount == null) front.__nativePageCount = Number(front.pageCount || 1);
      if (!Object.prototype.hasOwnProperty.call(front, '__nativeBackThumb')) front.__nativeBackThumb = front.backThumb || null;
      front.__pairedBackId = back.id;
      front.pageCount = 2;
      front.backThumb = back.frontThumb || null;
    });
  }

  function pairSizeMatches(front, back) {
    return Math.abs(Number(front?.widthMm || 0) - Number(back?.widthMm || 0)) <= 0.8
      && Math.abs(Number(front?.heightMm || 0) - Number(back?.heightMm || 0)) <= 0.8;
  }

  function setPair(back, front, enabled) {
    if (!back || !front) return;
    if (enabled) {
      if (nativePageCount(front) !== 1 || nativePageCount(back) !== 1) {
        setStatus('별도 뒷면 연결은 1페이지 파일끼리만 사용할 수 있습니다.', 'error');
        return;
      }
      if (!pairSizeMatches(front, back)) {
        setStatus(`앞면과 뒷면 크기를 같게 맞춰 주세요. 앞면 ${round1(front.widthMm)}×${round1(front.heightMm)}mm / 뒷면 ${round1(back.widthMm)}×${round1(back.heightMm)}mm`, 'error');
        return;
      }
      back.backForId = front.id;
      if ($('sideMode')?.value === 'single') $('sideMode').value = 'auto';
      setStatus('두 파일을 앞면·뒷면 한 세트로 연결했습니다.', 'success');
    } else {
      delete back.backForId;
      restoreFront(front);
      setStatus('별도 뒷면 연결을 해제했습니다.');
    }
    normalizePairs();
    syncPairControls();
    recalculateAndPatch();
  }

  function syncPairControls() {
    normalizePairs();
    const api = layoutApi();
    const list = $('fileList');
    if (!api?.state?.items || !list) return;
    const items = api.state.items;
    const rows = Array.from(list.children).filter(node => node.classList?.contains('file-item'));

    rows.forEach((row, index) => {
      const item = items[index];
      if (!item) return;
      row.querySelector('.duplex-pair-row')?.remove();
      row.dataset.duplexRole = item.backForId ? 'back' : (findBackIndex(item.id) >= 0 ? 'front-paired' : 'front');
      const pill = row.querySelector('.side-pill');
      if (pill && item.backForId) pill.textContent = '뒷면';
      else if (pill && findBackIndex(item.id) >= 0) pill.textContent = '앞·뒤';

      if (index < 1 || nativePageCount(item) !== 1) return;
      const previous = items[index - 1];
      const currentPair = item.backForId === previous?.id;
      const previousAvailable = previous
        && nativePageCount(previous) === 1
        && !previous.backForId
        && (findBackIndex(previous.id) < 0 || currentPair);
      if (!previousAvailable) return;

      const label = document.createElement('label');
      label.className = 'duplex-pair-row';
      const checkbox = document.createElement('input');
      checkbox.type = 'checkbox';
      checkbox.checked = currentPair;
      const copy = document.createElement('span');
      copy.innerHTML = `<strong>뒷면으로 사용</strong><br>바로 위 파일과 한 세트로 양면 출력`;
      checkbox.addEventListener('change', () => {
        const wanted = checkbox.checked;
        if (wanted && !pairSizeMatches(previous, item)) {
          checkbox.checked = false;
          setPair(item, previous, false);
          setStatus(`앞면과 뒷면 크기를 같게 맞춰 주세요. 앞면 ${round1(previous.widthMm)}×${round1(previous.heightMm)}mm / 뒷면 ${round1(item.widthMm)}×${round1(item.heightMm)}mm`, 'error');
          return;
        }
        setPair(item, previous, wanted);
      });
      label.append(checkbox, copy);
      row.appendChild(label);
    });
  }

  function pairedBackIndexes() {
    const items = layoutApi()?.state?.items || [];
    const indexes = new Set();
    items.forEach((item, index) => { if (item?.backForId) indexes.add(index); });
    return indexes;
  }

  function updateSummary() {
    const api = layoutApi();
    const plan = api?.state?.plan;
    const card = $('summaryCard');
    if (!card || !plan) return;
    const printSides = plan.sheets.length * (plan.duplex ? 2 : 1);
    const counts = plan.sheets.map((sheet, index) => `${index + 1}번 ${sheet.length}개`);
    const countText = counts.length <= 3 ? counts.join(' · ') : `${counts.slice(0, 3).join(' · ')} · 외 ${counts.length - 3}개 작업`;
    card.innerHTML = `<div class="summary-grid"><div class="summary-cell"><span>출력 용지</span><strong>${plan.sheets.length}장</strong></div><div class="summary-cell"><span>총 인쇄면</span><strong>${printSides}면</strong></div><div class="summary-cell"><span>자동 배치</span><strong>${plan.totalCopies}개</strong></div><div class="summary-cell"><span>평균 사용률</span><strong>${round1(plan.utilization)}%</strong></div></div><div class="summary-note">${countText} · ${orientation() === 'landscape' ? '가로 출력' : '세로 출력'} · ${plan.duplex ? `양면 / ${plan.cfg.flipEdge === 'long' ? '긴쪽' : '짧은쪽'} 넘김` : '단면'}${plan.cfg.allowRotate ? ' · 90° 회전 허용' : ''}</div>`;
  }

  function validatePairSizes() {
    const items = layoutApi()?.state?.items || [];
    for (const back of items) {
      if (!back?.backForId) continue;
      const front = items.find(item => item.id === back.backForId);
      if (front && !pairSizeMatches(front, back)) {
        return `앞면과 뒷면 크기가 다릅니다. ${round1(front.widthMm)}×${round1(front.heightMm)}mm / ${round1(back.widthMm)}×${round1(back.heightMm)}mm`;
      }
    }
    return '';
  }

  function patchPlan() {
    if (patching) return;
    const api = layoutApi();
    const plan = api?.state?.plan;
    if (!api || !plan) {
      scheduleOverlay();
      requestFitCanvas();
      return;
    }
    const mismatch = validatePairSizes();
    if (mismatch) {
      api.state.plan = null;
      $('downloadBtn').disabled = true;
      setStatus(mismatch, 'error');
      scheduleOverlay();
      return;
    }

    const backIndexes = pairedBackIndexes();
    if (backIndexes.size) {
      plan.sheets = plan.sheets.filter(sheet => !sheet.some(placement => backIndexes.has(placement.fileIndex)));
      plan.totalCopies = plan.sheets.reduce((sum, sheet) => sum + sheet.length, 0);
      const usedArea = plan.sheets.flat().reduce((sum, p) => sum + p.width * p.height, 0);
      plan.utilization = plan.sheets.length ? usedArea / (plan.sheets.length * plan.cfg.paperW * plan.cfg.paperH) * 100 : 0;
      if ($('sideMode')?.value !== 'single') plan.duplex = true;
    }

    if (api.state.sheetIndex >= plan.sheets.length) api.state.sheetIndex = Math.max(0, plan.sheets.length - 1);
    updateSummary();
    patching = true;
    try {
      const activeButton = api.state.side === 'back' && !$('backBtn')?.disabled ? $('backBtn') : $('frontBtn');
      activeButton?.click();
    } finally {
      patching = false;
    }
    scheduleOverlay();
    requestFitCanvas();
  }

  function recalculateAndPatch() {
    const api = layoutApi();
    if (!api?.recalculate) return;
    api.recalculate();
    patchPlan();
  }

  function numberingConfig() {
    return {
      enabled: Boolean($('advNumberingEnabled')?.checked),
      start: Math.round(clamp($('advNumberingStart')?.value, 0, 9_999_999, 1)),
      format: $('advNumberingFormat')?.value || 'pad3',
      position: $('advNumberingPosition')?.value || 'bottom-right',
      font_size_pt: clamp($('advNumberingFontSize')?.value, 5, 36, 9),
      font: $('advNumberingFont')?.value || 'helvetica-bold',
      margin_x_mm: clamp($('advNumberingMarginX')?.value, 0, 50, 1.5),
      margin_y_mm: clamp($('advNumberingMarginY')?.value, 0, 50, 1.5),
    };
  }

  function formatNumber(value, format) {
    if (format === 'plain') return String(value);
    if (format === 'no-pad3') return `NO.${String(value).padStart(3, '0')}`;
    return String(value).padStart(3, '0');
  }

  function updateNumberingControls() {
    const enabled = Boolean($('advNumberingEnabled')?.checked);
    const options = $('advNumberingOptions');
    options?.classList.toggle('is-disabled', !enabled);
    options?.querySelectorAll('input,select').forEach(control => { control.disabled = !enabled; });
    scheduleOverlay();
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
    overlayFrame = requestAnimationFrame(syncOverlay);
  }

  function syncOverlay() {
    const shell = $('canvasShell');
    const canvas = $('layoutCanvas');
    const api = layoutApi();
    if (!shell || !canvas || !api) return;
    let overlay = $('advancedNumberingOverlay');
    if (!overlay) {
      overlay = document.createElement('div');
      overlay.id = 'advancedNumberingOverlay';
      overlay.className = 'advanced-numbering-overlay';
      shell.appendChild(overlay);
    }
    overlay.replaceChildren();
    const config = numberingConfig();
    const plan = api.state.plan;
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
    const sheetIndex = api.state.sheetIndex || 0;
    const sheet = plan.sheets[sheetIndex] || [];
    const sequenceOffset = plan.sheets.slice(0, sheetIndex).reduce((sum, entries) => sum + entries.length, 0);
    const insetX = config.margin_x_mm * scale;
    const insetY = config.margin_y_mm * scale;
    const font = FONT_CSS[config.font] || FONT_CSS['helvetica-bold'];

    sheet.forEach((frontPlacement, index) => {
      const placement = api.state.side === 'back' ? mirrorBack(frontPlacement, cfg) : frontPlacement;
      const element = document.createElement('span');
      element.className = 'advanced-numbering-label';
      element.textContent = formatNumber(config.start + sequenceOffset + index, config.format);
      element.style.fontFamily = font.family;
      element.style.fontWeight = font.weight;
      element.style.fontSize = `${Math.max(7, config.font_size_pt * 25.4 / 72 * scale)}px`;
      const left = placement.x * scale;
      const top = placement.y * scale;
      const width = placement.width * scale;
      const height = placement.height * scale;
      const position = config.position;
      if (position.endsWith('right')) {
        element.style.left = `${left + width - insetX}px`;
        element.style.transform = position.startsWith('top') ? 'translateX(-100%)' : 'translate(-100%,-100%)';
      } else if (position.endsWith('center')) {
        element.style.left = `${left + width / 2}px`;
        element.style.transform = position.startsWith('top') ? 'translateX(-50%)' : 'translate(-50%,-100%)';
      } else {
        element.style.left = `${left + insetX}px`;
        if (!position.startsWith('top')) element.style.transform = 'translateY(-100%)';
      }
      element.style.top = position.startsWith('top') ? `${top + insetY}px` : `${top + height - insetY}px`;
      overlay.appendChild(element);
    });
  }

  function requestFitCanvas() {
    cancelAnimationFrame(fitFrame);
    fitFrame = requestAnimationFrame(fitCanvas);
  }

  function fitCanvas() {
    const shell = $('canvasShell');
    const canvas = $('layoutCanvas');
    const plan = layoutApi()?.state?.plan;
    if (!shell || !canvas || !plan?.cfg || canvas.style.display === 'none') return;
    const styles = getComputedStyle(shell);
    const availW = Math.max(120, shell.clientWidth - parseFloat(styles.paddingLeft || 0) - parseFloat(styles.paddingRight || 0) - 4);
    const availH = Math.max(120, shell.clientHeight - parseFloat(styles.paddingTop || 0) - parseFloat(styles.paddingBottom || 0) - 4);
    const ratio = plan.cfg.paperW / plan.cfg.paperH;
    let width = Math.min(availW, availH * ratio);
    let height = width / ratio;
    if (height > availH) {
      height = availH;
      width = height * ratio;
    }
    width = Math.max(120, Math.floor(width));
    height = Math.max(120, Math.floor(height));
    if (Math.abs(canvas.clientWidth - width) > 1 || Math.abs(canvas.clientHeight - height) > 1) {
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
    }
    scheduleOverlay();
  }

  function installFetchAdapter() {
    if (originalFetch) return;
    originalFetch = window.fetch.bind(window);
    window.fetch = function smartPrintAdvancedFetch(input, init = {}) {
      try {
        const url = typeof input === 'string' ? input : String(input?.url || '');
        const body = init?.body;
        if (url.includes('/api/pdf/smart-layout') && body instanceof FormData) {
          const raw = body.get('settings');
          const settings = JSON.parse(typeof raw === 'string' ? raw : '{}');
          const items = layoutApi()?.state?.items || [];
          const existing = new Map((Array.isArray(settings.jobs) ? settings.jobs : []).map(job => [Number(job.file_index), job]));
          settings.jobs = items.flatMap((item, index) => {
            if (item?.backForId) return [];
            const prior = existing.get(index) || {};
            const job = { file_index: index, quantity: Number(prior.quantity) || 1 };
            const backIndex = findBackIndex(item.id);
            if (backIndex >= 0) job.back_file_index = backIndex;
            return [job];
          });
          settings.numbering = numberingConfig();
          body.set('settings', JSON.stringify(settings));
        }
      } catch (error) {
        console.error('[smart-print-advanced] request adaptation failed', error);
      }
      return originalFetch(input, init);
    };
  }

  function wrapExportedRecalculate() {
    const api = layoutApi();
    if (!api?.recalculate || originalRecalculate) return;
    originalRecalculate = api.recalculate.bind(api);
    api.recalculate = (...args) => {
      const result = originalRecalculate(...args);
      patchPlan();
      return result;
    };
  }

  function bind() {
    $('paperOrientation')?.addEventListener('change', () => applyOrientation());
    $('paperPreset')?.addEventListener('change', () => requestAnimationFrame(() => applyOrientation()));
    ['paperWidth', 'paperHeight', 'marginMm', 'gapMm'].forEach(id => {
      $(id)?.addEventListener('input', () => requestAnimationFrame(patchPlan));
    });
    ['allowRotate', 'sideMode', 'flipEdge', 'cropMarks'].forEach(id => {
      $(id)?.addEventListener('change', () => requestAnimationFrame(patchPlan));
    });

    $('advNumberingEnabled')?.addEventListener('change', updateNumberingControls);
    ['advNumberingStart', 'advNumberingFormat', 'advNumberingFont', 'advNumberingFontSize', 'advNumberingPosition', 'advNumberingMarginX', 'advNumberingMarginY'].forEach(id => {
      $(id)?.addEventListener('input', scheduleOverlay);
      $(id)?.addEventListener('change', scheduleOverlay);
    });
    ['prevSheet', 'nextSheet', 'frontBtn', 'backBtn'].forEach(id => $(id)?.addEventListener('click', () => requestAnimationFrame(() => { requestFitCanvas(); scheduleOverlay(); })));

    const list = $('fileList');
    if (list) {
      new MutationObserver(() => requestAnimationFrame(() => { syncPairControls(); patchPlan(); }))
        .observe(list, { childList: true });
    }
    const canvas = $('layoutCanvas');
    if (canvas) {
      new MutationObserver(() => requestFitCanvas()).observe(canvas, { attributes: true, attributeFilter: ['width', 'height'] });
    }
    window.addEventListener('resize', () => { requestFitCanvas(); scheduleOverlay(); });
    $('resetBtn')?.addEventListener('click', () => requestAnimationFrame(() => {
      $('advNumberingEnabled').checked = false;
      $('advNumberingStart').value = '1';
      $('advNumberingFormat').value = 'pad3';
      $('advNumberingFont').value = 'helvetica-bold';
      $('advNumberingFontSize').value = '9';
      $('advNumberingPosition').value = 'bottom-right';
      $('advNumberingMarginX').value = '1.5';
      $('advNumberingMarginY').value = '1.5';
      syncOrientationFromDimensions();
      updateNumberingControls();
      syncPairControls();
      patchPlan();
    }));
  }

  function boot() {
    injectStyles();
    injectOrientationControl();
    injectNumberingPanel();
    removePreviewGuideCards();
    syncOrientationFromDimensions();
    installFetchAdapter();
    wrapExportedRecalculate();
    bind();
    updateNumberingControls();
    syncPairControls();
    patchPlan();
    requestFitCanvas();
    document.documentElement.dataset.smartPrintAdvanced = 'v2';
  }

  window.SmartPrintAdvancedControls = {
    numberingConfig,
    patchPlan,
    syncPairControls,
    applyOrientation,
    stage: 'smart-print-orientation-duplex-numbering-preview-v2',
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once: true });
  else boot();
})();
