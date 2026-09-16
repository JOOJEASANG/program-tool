(() => {
  'use strict';
  if (window.__smartPrintNumberingPreviewSyncV2) return;
  window.__smartPrintNumberingPreviewSyncV2 = true;

  const $ = id => document.getElementById(id);
  const KOREAN_STACK = '"Malgun Gothic","Apple SD Gothic Neo","Noto Sans KR",Arial,sans-serif';
  const WATCHED_CONTROLS = new Set([
    'numberingEnabled', 'numberingStart', 'numberingEnd', 'numberingPrefix',
    'numberingFormat', 'numberingPosition', 'numberingFont', 'numberingFontSize',
    'numberingTransparent', 'numberingMarginX', 'numberingMarginY', 'numberingTargetSide',
  ]);
  let frame = 0;
  let shellObserver = null;

  const numberValue = (id, fallback, min, max) => {
    const value = Number($(id)?.value);
    if (!Number.isFinite(value)) return fallback;
    return Math.min(max, Math.max(min, value));
  };

  function hasKorean(text) {
    return /[\u1100-\u11ff\u3130-\u318f\ua960-\ua97f\uac00-\ud7a3\ud7b0-\ud7ff]/u.test(String(text || ''));
  }

  function formatNumber(value) {
    const format = $('numberingFormat')?.value || 'pad3';
    let number;
    if (format === 'plain') number = String(value);
    else if (format === 'no-pad3') number = `NO.${String(value).padStart(3, '0')}`;
    else number = String(value).padStart(3, '0');
    const prefix = String($('numberingPrefix')?.value || '').trim();
    return prefix ? `${prefix}${number}` : number;
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
        .numbering-side-row,.numbering-offset-row{column-gap:12px}
      `;
      document.head.appendChild(style);
    }
    prefixRow?.classList.add('numbering-prefix-format-row');

    if (!$('numberingTargetSide')) {
      const sideRow = document.createElement('div');
      sideRow.className = 'grid2 numbering-side-row';
      sideRow.innerHTML = `
        <label class="field"><span>넘버링 적용 면</span><select id="numberingTargetSide"><option value="front">앞면만</option><option value="back">뒷면만</option><option value="both" selected>앞·뒷면 모두</option></select></label>
        <div></div>`;
      positionRow.insertAdjacentElement('afterend', sideRow);
    }

    if (!$('numberingMarginX') || !$('numberingMarginY')) {
      const offsetRow = document.createElement('div');
      offsetRow.className = 'grid2 numbering-offset-row';
      offsetRow.innerHTML = `
        <label class="field"><span>좌우 위치 조절 mm</span><input id="numberingMarginX" type="number" min="0" max="50" step="0.5" value="1.5"></label>
        <label class="field"><span>상하 위치 조절 mm</span><input id="numberingMarginY" type="number" min="0" max="50" step="0.5" value="1.5"></label>`;
      const sideRow = $('numberingTargetSide')?.closest('.grid2') || positionRow;
      sideRow.insertAdjacentElement('afterend', offsetRow);
    }
    return true;
  }

  function patchEnhancementConfig() {
    const enhancements = window.SmartPrintLayoutEnhancements;
    if (!enhancements || enhancements.__numberingSideOffsetsPatched) return;
    const original = enhancements.numberingConfig;
    if (typeof original !== 'function') return;
    enhancements.numberingConfig = function numberingConfigWithSideAndOffsets() {
      const config = original();
      config.target_side = $('numberingTargetSide')?.value || 'both';
      config.margin_x_mm = numberValue('numberingMarginX', 1.5, 0, 50);
      config.margin_y_mm = numberValue('numberingMarginY', 1.5, 0, 50);
      config.prefix = String(config.prefix || '').trim();
      return config;
    };
    enhancements.__numberingSideOffsetsPatched = true;
  }

  function mirrorBack(placement, cfg) {
    const portrait = cfg.paperH >= cfg.paperW;
    const mirrorX = (cfg.flipEdge === 'long' && portrait) || (cfg.flipEdge === 'short' && !portrait);
    return mirrorX
      ? { ...placement, x: cfg.paperW - placement.x - placement.width }
      : { ...placement, y: cfg.paperH - placement.y - placement.height };
  }

  function applyPosition(element, placement, scale, position, marginX, marginY) {
    const left = placement.x * scale;
    const top = placement.y * scale;
    const width = placement.width * scale;
    const height = placement.height * scale;
    const insetX = marginX * scale;
    const insetY = marginY * scale;

    element.style.margin = '0';
    if (position === 'top-left') {
      element.style.left = `${left + insetX}px`;
      element.style.top = `${top + insetY}px`;
      element.style.transform = 'none';
    } else if (position === 'top-center') {
      element.style.left = `${left + width / 2}px`;
      element.style.top = `${top + insetY}px`;
      element.style.transform = 'translateX(-50%)';
    } else if (position === 'top-right') {
      element.style.left = `${left + width - insetX}px`;
      element.style.top = `${top + insetY}px`;
      element.style.transform = 'translateX(-100%)';
    } else if (position === 'bottom-left') {
      element.style.left = `${left + insetX}px`;
      element.style.top = `${top + height - insetY}px`;
      element.style.transform = 'translateY(-100%)';
    } else if (position === 'bottom-center') {
      element.style.left = `${left + width / 2}px`;
      element.style.top = `${top + height - insetY}px`;
      element.style.transform = 'translate(-50%,-100%)';
    } else {
      element.style.left = `${left + width - insetX}px`;
      element.style.top = `${top + height - insetY}px`;
      element.style.transform = 'translate(-100%,-100%)';
    }
  }

  function updateHint() {
    const hint = document.querySelector('#numberingOptions .hint');
    if (!hint) return;
    hint.textContent = '문구와 번호는 붙여서 출력합니다. 좌우·상하 위치 조절과 적용 면 선택은 미리보기와 저장 PDF에 동일하게 반영됩니다. 한글 문구는 저장 PDF에서 한국어 글꼴로 자동 처리합니다.';
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
    const marginX = numberValue('numberingMarginX', 1.5, 0, 50);
    const marginY = numberValue('numberingMarginY', 1.5, 0, 50);
    const prefix = String($('numberingPrefix')?.value || '').trim();

    let labelIndex = 0;
    sheet.forEach((frontPlacement, index) => {
      const value = start + sequenceOffset + index;
      if (end != null && value > end) return;
      const element = labels[labelIndex++];
      if (!element) return;
      const placement = api.state.side === 'back' ? mirrorBack(frontPlacement, cfg) : frontPlacement;
      const text = formatNumber(value);
      if (element.textContent !== text) element.textContent = text;
      if (hasKorean(prefix) || hasKorean(text)) element.style.fontFamily = KOREAN_STACK;
      applyPosition(element, placement, scale, position, marginX, marginY);
    });
  }

  function normalizeExportSettings(settings) {
    if (!settings?.numbering?.enabled) return settings;
    settings.numbering.margin_x_mm = numberValue('numberingMarginX', 1.5, 0, 50);
    settings.numbering.margin_y_mm = numberValue('numberingMarginY', 1.5, 0, 50);
    settings.numbering.target_side = $('numberingTargetSide')?.value || 'both';
    settings.numbering.prefix = String(settings.numbering.prefix || '').trim();
    return settings;
  }

  function installFetchGuard() {
    if (window.__smartPrintNumberingFetchGuardV2 || typeof window.fetch !== 'function') return;
    window.__smartPrintNumberingFetchGuardV2 = true;
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
      if ($('numberingMarginX')) $('numberingMarginX').value = '1.5';
      if ($('numberingMarginY')) $('numberingMarginY').value = '1.5';
      schedule();
    }));
    window.addEventListener('resize', schedule);
    schedule();
    document.documentElement.dataset.smartLayoutNumberingPreviewSync = 'v2-position-side-font-safe';
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', bind, { once: true });
  else bind();
})();
