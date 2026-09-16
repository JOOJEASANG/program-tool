(() => {
  'use strict';
  if (window.__smartPrintNumberingPreviewSyncV6) return;
  window.__smartPrintNumberingPreviewSyncV6 = true;

  const $ = id => document.getElementById(id);
  const DEFAULT_COLOR = '#111827';
  const DEFAULT_FONT = 'korean-sans';
  const FONT_OPTIONS = [
    { value: 'korean-sans', label: '한국어 고딕 · 돋움 (권장)', stack: '"Malgun Gothic","Apple SD Gothic Neo","Noto Sans KR",Arial,sans-serif' },
    { value: 'korean-serif', label: '한국어 명조 · 바탕', stack: 'Batang,"AppleMyungjo","Noto Serif KR","Times New Roman",serif' },
    { value: 'helvetica', label: 'Helvetica', stack: 'Arial,Helvetica,"Malgun Gothic",sans-serif' },
    { value: 'times', label: 'Times Roman', stack: '"Times New Roman",Times,Batang,serif' },
    { value: 'courier', label: 'Courier', stack: '"Courier New",Courier,"Malgun Gothic",monospace' },
  ];
  const FONT_KEYS = new Set(FONT_OPTIONS.map(option => option.value));
  const LEGACY_FONT_MAP = {
    korean: 'korean-sans',
    'helvetica-bold': 'helvetica',
    'helvetica-oblique': 'helvetica',
    'helvetica-bold-oblique': 'helvetica',
    'times-bold': 'times',
    'times-italic': 'times',
    'times-bold-italic': 'times',
    'courier-bold': 'courier',
    'courier-oblique': 'courier',
    'courier-bold-oblique': 'courier',
  };
  const WATCHED_CONTROLS = new Set([
    'numberingEnabled', 'numberingStart', 'numberingEnd', 'numberingPrefix',
    'numberingFormat', 'numberingFont', 'numberingPosition', 'numberingFontSize',
    'numberingTransparent', 'numberingOffsetX', 'numberingOffsetY', 'numberingTargetSide',
    'numberingBold', 'numberingColor',
  ]);
  let frame = 0;
  let shellObserver = null;

  const numberValue = (id, fallback, min, max) => {
    const value = Number($(id)?.value);
    if (!Number.isFinite(value)) return fallback;
    return Math.min(max, Math.max(min, value));
  };

  const colorValue = () => {
    const value = String($('numberingColor')?.value || DEFAULT_COLOR).trim();
    return /^#[0-9a-f]{6}$/i.test(value) ? value.toLowerCase() : DEFAULT_COLOR;
  };

  function fontValue() {
    const raw = String($('numberingFont')?.value || DEFAULT_FONT).trim().toLowerCase();
    const normalized = LEGACY_FONT_MAP[raw] || raw;
    return FONT_KEYS.has(normalized) ? normalized : DEFAULT_FONT;
  }

  function fontStack() {
    const selected = FONT_OPTIONS.find(option => option.value === fontValue());
    return selected?.stack || FONT_OPTIONS[0].stack;
  }

  function formatNumber(value) {
    const format = $('numberingFormat')?.value || 'pad3';
    let number;
    if (format === 'plain') number = String(value);
    else if (format === 'no-pad3') number = `NO.${String(value).padStart(3, '0')}`;
    else number = String(value).padStart(3, '0');
    const prefix = String($('numberingPrefix')?.value || '').trim();
    return prefix ? `${prefix} ${number}` : number;
  }

  function setupFontControl() {
    const fontSelect = $('numberingFont');
    if (!fontSelect) return;
    if (fontSelect.dataset.smartFontOptionsReady !== '1') {
      const previousRaw = String(fontSelect.value || DEFAULT_FONT).toLowerCase();
      const previous = LEGACY_FONT_MAP[previousRaw] || previousRaw;
      fontSelect.innerHTML = FONT_OPTIONS
        .map(option => `<option value="${option.value}">${option.label}</option>`)
        .join('');
      fontSelect.value = FONT_KEYS.has(previous) ? previous : DEFAULT_FONT;
      fontSelect.dataset.smartFontOptionsReady = '1';
    }
    fontSelect.hidden = false;
    fontSelect.removeAttribute('aria-hidden');
    fontSelect.disabled = !$('numberingEnabled')?.checked;
    fontSelect.closest('.field')?.querySelector('.numbering-fixed-font')?.remove();
  }

  function removeLegacyMarginControls() {
    const rows = new Set();
    ['numberingMarginX', 'numberingMarginY', 'advNumberingMarginX', 'advNumberingMarginY'].forEach(id => {
      const control = $(id);
      if (control) rows.add(control.closest('.grid2') || control.closest('.field'));
    });
    rows.forEach(row => row?.remove());
  }

  function ensureControls() {
    const options = $('numberingOptions');
    const positionRow = $('numberingPosition')?.closest('.grid2');
    const prefixRow = $('numberingPrefix')?.closest('.grid2');
    if (!options || !positionRow) return false;

    if (!$('numberingPreviewSyncStyles')) {
      const style = document.createElement('style');
      style.id = 'numberingPreviewSyncStyles';
      style.textContent = `
        .numbering-prefix-format-row{column-gap:16px!important}
        .numbering-side-row,.numbering-offset-row,.numbering-appearance-row{column-gap:12px}
        .numbering-color-field input[type="color"]{width:100%;height:36px;padding:3px;border:1px solid #cfd9e3;border-radius:8px;background:#fff;cursor:pointer}
        .numbering-bold-check{min-height:36px;margin-top:16px}
      `;
      document.head.appendChild(style);
    }
    prefixRow?.classList.add('numbering-prefix-format-row');
    setupFontControl();
    removeLegacyMarginControls();

    if (!$('numberingBold') || !$('numberingColor')) {
      const appearanceRow = document.createElement('div');
      appearanceRow.className = 'grid2 numbering-appearance-row';
      appearanceRow.innerHTML = `
        <label class="check-row numbering-bold-check"><input id="numberingBold" type="checkbox"><span>굵게 표시</span></label>
        <label class="field numbering-color-field"><span>글씨 색상</span><input id="numberingColor" type="color" value="${DEFAULT_COLOR}" aria-label="넘버링 글씨 색상"></label>`;
      positionRow.insertAdjacentElement('afterend', appearanceRow);
    }

    if (!$('numberingTargetSide')) {
      const sideRow = document.createElement('div');
      sideRow.className = 'grid2 numbering-side-row';
      sideRow.innerHTML = `
        <label class="field"><span>넘버링 적용 면</span><select id="numberingTargetSide"><option value="front">앞면만</option><option value="back">뒷면만</option><option value="both" selected>앞·뒷면 모두</option></select></label>
        <div></div>`;
      const appearanceRow = $('numberingBold')?.closest('.grid2') || positionRow;
      appearanceRow.insertAdjacentElement('afterend', sideRow);
    }

    if (!$('numberingOffsetX') || !$('numberingOffsetY')) {
      const offsetRow = document.createElement('div');
      offsetRow.className = 'grid2 numbering-offset-row';
      offsetRow.innerHTML = `
        <label class="field"><span>좌우 위치 조절 mm</span><input id="numberingOffsetX" type="number" min="-50" max="50" step="0.5" value="0"><small>- 왼쪽 / + 오른쪽</small></label>
        <label class="field"><span>상하 위치 조절 mm</span><input id="numberingOffsetY" type="number" min="-50" max="50" step="0.5" value="0"><small>- 위 / + 아래</small></label>`;
      const sideRow = $('numberingTargetSide')?.closest('.grid2') || positionRow;
      sideRow.insertAdjacentElement('afterend', offsetRow);
    }

    const enabled = Boolean($('numberingEnabled')?.checked);
    for (const id of ['numberingFont', 'numberingTargetSide', 'numberingOffsetX', 'numberingOffsetY', 'numberingBold', 'numberingColor']) {
      const control = $(id);
      if (control) control.disabled = !enabled;
    }
    setupFontControl();
    removeLegacyMarginControls();
    return true;
  }

  function patchEnhancementConfig() {
    const enhancements = window.SmartPrintLayoutEnhancements;
    if (!enhancements || enhancements.__numberingAppearancePatchedV6) return;
    const original = enhancements.numberingConfig;
    if (typeof original !== 'function') return;
    enhancements.numberingConfig = function numberingConfigWithFontSideOffsetsAppearance() {
      const config = original();
      config.target_side = $('numberingTargetSide')?.value || 'both';
      config.offset_x_mm = numberValue('numberingOffsetX', 0, -50, 50);
      config.offset_y_mm = numberValue('numberingOffsetY', 0, -50, 50);
      config.prefix = String(config.prefix || '').trim();
      config.font = fontValue();
      config.bold = Boolean($('numberingBold')?.checked);
      config.color = colorValue();
      delete config.margin_x_mm;
      delete config.margin_y_mm;
      return config;
    };
    enhancements.__numberingAppearancePatchedV6 = true;
  }

  function mirrorBack(placement, cfg) {
    const portrait = cfg.paperH >= cfg.paperW;
    const mirrorX = (cfg.flipEdge === 'long' && portrait) || (cfg.flipEdge === 'short' && !portrait);
    return mirrorX
      ? { ...placement, x: cfg.paperW - placement.x - placement.width }
      : { ...placement, y: cfg.paperH - placement.y - placement.height };
  }

  function applyPosition(element, placement, scale, position, offsetX, offsetY) {
    const left = placement.x * scale;
    const top = placement.y * scale;
    const width = placement.width * scale;
    const height = placement.height * scale;
    const inset = 1.6 * scale;
    const dx = offsetX * scale;
    const dy = offsetY * scale;

    element.style.margin = '0';
    if (position === 'top-left') {
      element.style.left = `${left + inset + dx}px`;
      element.style.top = `${top + inset + dy}px`;
      element.style.transform = 'none';
    } else if (position === 'top-center') {
      element.style.left = `${left + width / 2 + dx}px`;
      element.style.top = `${top + inset + dy}px`;
      element.style.transform = 'translateX(-50%)';
    } else if (position === 'top-right') {
      element.style.left = `${left + width - inset + dx}px`;
      element.style.top = `${top + inset + dy}px`;
      element.style.transform = 'translateX(-100%)';
    } else if (position === 'bottom-left') {
      element.style.left = `${left + inset + dx}px`;
      element.style.top = `${top + height - inset + dy}px`;
      element.style.transform = 'translateY(-100%)';
    } else if (position === 'bottom-center') {
      element.style.left = `${left + width / 2 + dx}px`;
      element.style.top = `${top + height - inset + dy}px`;
      element.style.transform = 'translate(-50%,-100%)';
    } else {
      element.style.left = `${left + width - inset + dx}px`;
      element.style.top = `${top + height - inset + dy}px`;
      element.style.transform = 'translate(-100%,-100%)';
    }
  }

  function updateHint() {
    const hint = document.querySelector('#numberingOptions .hint');
    if (!hint) return;
    hint.textContent = 'PDF 저장 호환 글꼴 5종을 제공합니다. 한글 문구가 포함된 경우 비한글 글꼴을 선택해도 저장 시 한글 호환 글꼴로 자동 대체되며, 굵기·글씨색상·적용 면·좌우/상하 위치는 미리보기와 저장 PDF에 동일하게 반영됩니다.';
  }

  function shouldShowOnCurrentSide(api) {
    const target = $('numberingTargetSide')?.value || 'both';
    const side = api?.state?.side === 'back' ? 'back' : 'front';
    return target === 'both' || target === side;
  }

  function syncPreview() {
    ensureControls();
    patchEnhancementConfig();
    const overlay = $('numberingPreviewOverlay');
    const canvas = $('layoutCanvas');
    const api = window.SmartPrintLayout;
    const plan = api?.state?.plan;
    if (!overlay || !canvas || !plan?.cfg || !$('numberingEnabled')?.checked) return;

    const labels = Array.from(overlay.querySelectorAll('.numbering-preview-label'));
    if (!labels.length) return;
    const visible = shouldShowOnCurrentSide(api);
    labels.forEach(label => { label.style.display = visible ? '' : 'none'; });
    if (!visible) return;

    const cfg = plan.cfg;
    const scale = canvas.clientWidth / Number(cfg.paperW || 1);
    if (!Number.isFinite(scale) || scale <= 0) return;

    const sheetIndex = Number(api.state.sheetIndex || 0);
    const sheet = plan.sheets?.[sheetIndex] || [];
    const sequenceOffset = (plan.sheets || []).slice(0, sheetIndex)
      .reduce((sum, entries) => sum + (entries?.length || 0), 0);
    const start = Math.round(numberValue('numberingStart', 1, 0, 9_999_999));
    const rawEnd = String($('numberingEnd')?.value || '').trim();
    const end = rawEnd === '' ? null : Math.round(numberValue('numberingEnd', start, 0, 9_999_999));
    const position = $('numberingPosition')?.value || 'bottom-right';
    const offsetX = numberValue('numberingOffsetX', 0, -50, 50);
    const offsetY = numberValue('numberingOffsetY', 0, -50, 50);
    const bold = Boolean($('numberingBold')?.checked);
    const color = colorValue();
    const family = fontStack();

    let labelIndex = 0;
    sheet.forEach((frontPlacement, index) => {
      const value = start + sequenceOffset + index;
      if (end != null && value > end) return;
      const element = labels[labelIndex++];
      if (!element) return;
      const placement = api.state.side === 'back' ? mirrorBack(frontPlacement, cfg) : frontPlacement;
      const text = formatNumber(value);
      if (element.textContent !== text) element.textContent = text;
      element.style.fontFamily = family;
      element.style.fontWeight = bold ? '700' : '400';
      element.style.fontStyle = 'normal';
      element.style.color = color;
      applyPosition(element, placement, scale, position, offsetX, offsetY);
    });
  }

  function normalizeExportSettings(settings) {
    if (!settings?.numbering?.enabled) return settings;
    settings.numbering.offset_x_mm = numberValue('numberingOffsetX', 0, -50, 50);
    settings.numbering.offset_y_mm = numberValue('numberingOffsetY', 0, -50, 50);
    settings.numbering.target_side = $('numberingTargetSide')?.value || 'both';
    settings.numbering.prefix = String(settings.numbering.prefix || '').trim();
    settings.numbering.font = fontValue();
    settings.numbering.bold = Boolean($('numberingBold')?.checked);
    settings.numbering.color = colorValue();
    delete settings.numbering.margin_x_mm;
    delete settings.numbering.margin_y_mm;
    return settings;
  }

  function installFetchGuard() {
    if (window.__smartPrintNumberingFetchGuardV6 || typeof window.fetch !== 'function') return;
    window.__smartPrintNumberingFetchGuardV6 = true;
    const originalFetch = window.fetch.bind(window);
    window.fetch = function smartLayoutNumberingFetch(input, init = {}) {
      try {
        const url = typeof input === 'string' ? input : input?.url || '';
        const body = init?.body;
        if (/\/api\/pdf\/smart-layout(?:\?|$)/.test(url) && body instanceof FormData) {
          const raw = body.get('settings');
          if (typeof raw === 'string') {
            const settings = JSON.parse(raw);
            normalizeExportSettings(settings);
            body.set('settings', JSON.stringify(settings));
          }
        }
      } catch (error) {
        console.warn('[smart-layout-numbering] export sync failed', error);
      }
      return originalFetch(input, init);
    };
  }

  function schedule() {
    cancelAnimationFrame(frame);
    frame = requestAnimationFrame(() => requestAnimationFrame(syncPreview));
  }

  function bind() {
    ensureControls();
    patchEnhancementConfig();
    updateHint();
    installFetchGuard();
    const shell = $('canvasShell');
    if (shell && typeof MutationObserver === 'function') {
      shellObserver = new MutationObserver(schedule);
      shellObserver.observe(shell, { childList: true, subtree: true });
    }
    document.addEventListener('input', event => {
      if (WATCHED_CONTROLS.has(event.target?.id)) schedule();
    }, true);
    document.addEventListener('change', event => {
      if (WATCHED_CONTROLS.has(event.target?.id)) schedule();
    }, true);
    ['prevSheet', 'nextSheet', 'frontBtn', 'backBtn'].forEach(id => $(id)?.addEventListener('click', schedule));
    $('resetBtn')?.addEventListener('click', () => requestAnimationFrame(() => {
      if ($('numberingTargetSide')) $('numberingTargetSide').value = 'both';
      if ($('numberingOffsetX')) $('numberingOffsetX').value = '0';
      if ($('numberingOffsetY')) $('numberingOffsetY').value = '0';
      if ($('numberingBold')) $('numberingBold').checked = false;
      if ($('numberingColor')) $('numberingColor').value = DEFAULT_COLOR;
      if ($('numberingFont')) $('numberingFont').value = DEFAULT_FONT;
      setupFontControl();
      removeLegacyMarginControls();
      schedule();
    }));
    window.addEventListener('resize', schedule);
    schedule();
    document.documentElement.dataset.smartLayoutNumberingPreviewSync = 'v6-selectable-pdf-safe-fonts-position-side-bold-color-no-margins';
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', bind, { once: true });
  else bind();
})();
