(() => {
  'use strict';
  if (window.__smartPrintNumberingPreviewSyncV5) return;
  window.__smartPrintNumberingPreviewSyncV5 = true;

  const $ = id => document.getElementById(id);
  const KOREAN_STACK = '"Malgun Gothic","Apple SD Gothic Neo","Noto Sans KR",Arial,sans-serif';
  const DEFAULT_COLOR = '#111827';
  const WATCHED_CONTROLS = new Set([
    'numberingEnabled', 'numberingStart', 'numberingEnd', 'numberingPrefix',
    'numberingFormat', 'numberingPosition', 'numberingFontSize',
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

  function formatNumber(value) {
    const format = $('numberingFormat')?.value || 'pad3';
    let number;
    if (format === 'plain') number = String(value);
    else if (format === 'no-pad3') number = `NO.${String(value).padStart(3, '0')}`;
    else number = String(value).padStart(3, '0');
    const prefix = String($('numberingPrefix')?.value || '').trim();
    return prefix ? `${prefix} ${number}` : number;
  }

  function lockFontControl() {
    const fontSelect = $('numberingFont');
    if (!fontSelect) return;
    fontSelect.value = 'korean';
    fontSelect.hidden = true;
    fontSelect.setAttribute('aria-hidden', 'true');
    const field = fontSelect.closest('.field');
    if (!field) return;
    const title = field.querySelector(':scope > span');
    if (title) title.textContent = '글꼴';
    let fixed = field.querySelector('.numbering-fixed-font');
    if (!fixed) {
      fixed = document.createElement('div');
      fixed.className = 'numbering-fixed-font';
      fixed.textContent = '한국어 기본 (고정)';
      fontSelect.insertAdjacentElement('afterend', fixed);
    }
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
        .numbering-fixed-font{min-height:34px;display:flex;align-items:center;border:1px solid #cfd9e3;border-radius:8px;background:#f8fafc;padding:7px 9px;color:#334155;font-size:11px;font-weight:800}
        .numbering-color-field input[type="color"]{width:100%;height:36px;padding:3px;border:1px solid #cfd9e3;border-radius:8px;background:#fff;cursor:pointer}
        .numbering-bold-check{min-height:36px;margin-top:16px}
      `;
      document.head.appendChild(style);
    }
    prefixRow?.classList.add('numbering-prefix-format-row');
    lockFontControl();
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
    for (const id of ['numberingTargetSide', 'numberingOffsetX', 'numberingOffsetY', 'numberingBold', 'numberingColor']) {
      const control = $(id);
      if (control) control.disabled = !enabled;
    }
    lockFontControl();
    removeLegacyMarginControls();
    return true;
  }

  function patchEnhancementConfig() {
    const enhancements = window.SmartPrintLayoutEnhancements;
    if (!enhancements || enhancements.__numberingAppearancePatchedV5) return;
    const original = enhancements.numberingConfig;
    if (typeof original !== 'function') return;
    enhancements.numberingConfig = function numberingConfigWithFixedFontSideOffsetsAppearance() {
      const config = original();
      config.target_side = $('numberingTargetSide')?.value || 'both';
      config.offset_x_mm = numberValue('numberingOffsetX', 0, -50, 50);
      config.offset_y_mm = numberValue('numberingOffsetY', 0, -50, 50);
      config.prefix = String(config.prefix || '').trim();
      config.font = 'korean';
      config.bold = Boolean($('numberingBold')?.checked);
      config.color = colorValue();
      delete config.margin_x_mm;
      delete config.margin_y_mm;
      return config;
    };
    enhancements.__numberingAppearancePatchedV5 = true;
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
    hint.textContent = '글꼴은 한국어 기본으로 고정됩니다. 문구와 번호 사이는 한 칸 띄우며, 굵기·글씨색상·적용 면·좌우/상하 위치 조절은 미리보기와 저장 PDF에 동일하게 반영됩니다.';
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

    let labelIndex = 0;
    sheet.forEach((frontPlacement, index) => {
      const value = start + sequenceOffset + index;
      if (end != null && value > end) return;
      const element = labels[labelIndex++];
      if (!element) return;
      const placement = api.state.side === 'back' ? mirrorBack(frontPlacement, cfg) : frontPlacement;
      const text = formatNumber(value);
      if (element.textContent !== text) element.textContent = text;
      element.style.fontFamily = KOREAN_STACK;
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
    settings.numbering.font = 'korean';
    settings.numbering.bold = Boolean($('numberingBold')?.checked);
    settings.numbering.color = colorValue();
    delete settings.numbering.margin_x_mm;
    delete settings.numbering.margin_y_mm;
    return settings;
  }

  function installFetchGuard() {
    if (window.__smartPrintNumberingFetchGuardV5 || typeof window.fetch !== 'function') return;
    window.__smartPrintNumberingFetchGuardV5 = true;
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
      lockFontControl();
      removeLegacyMarginControls();
      schedule();
    }));
    window.addEventListener('resize', schedule);
    schedule();
    document.documentElement.dataset.smartLayoutNumberingPreviewSync = 'v5-position-side-bold-color-no-margins';
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', bind, { once: true });
  else bind();
})();