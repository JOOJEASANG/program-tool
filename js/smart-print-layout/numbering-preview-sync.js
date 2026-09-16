(() => {
  'use strict';
  if (window.__smartPrintNumberingPreviewSyncV4) return;
  window.__smartPrintNumberingPreviewSyncV4 = true;

  const $ = id => document.getElementById(id);
  const KOREAN_STACK = '"Malgun Gothic","Apple SD Gothic Neo","Noto Sans KR",Arial,sans-serif';
  const WATCHED_CONTROLS = new Set([
    'numberingEnabled', 'numberingStart', 'numberingEnd', 'numberingPrefix',
    'numberingFormat', 'numberingPosition', 'numberingFontSize',
    'numberingTransparent', 'numberingOffsetX', 'numberingOffsetY', 'numberingTargetSide',
  ]);
  let frame = 0;
  let shellObserver = null;

  const numberValue = (id, fallback, min, max) => {
    const value = Number($(id)?.value);
    if (!Number.isFinite(value)) return fallback;
    return Math.min(max, Math.max(min, value));
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
        .numbering-fixed-font{min-height:34px;display:flex;align-items:center;border:1px solid #cfd9e3;border-radius:8px;background:#f8fafc;padding:7px 9px;color:#334155;font-size:11px;font-weight:800}
      `;
      document.head.appendChild(style);
    }
    prefixRow?.classList.add('numbering-prefix-format-row');
    lockFontControl();

    if (!$('numberingTargetSide')) {
      const sideRow = document.createElement('div');
      sideRow.className = 'grid2 numbering-side-row';
      sideRow.innerHTML = `
        <label class="field"><span>넘버링 적용 면</span><select id="numberingTargetSide"><option value="front">앞면만</option><option value="back">뒷면만</option><option value="both" selected>앞·뒷면 모두</option></select></label>
        <div></div>`;
      positionRow.insertAdjacentElement('afterend', sideRow);
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
    for (const id of ['numberingTargetSide', 'numberingOffsetX', 'numberingOffsetY']) {
      const control = $(id);
      if (control) control.disabled = !enabled;
    }
    lockFontControl();
    return true;
  }

  function patchEnhancementConfig() {
    const enhancements = window.SmartPrintLayoutEnhancements;
    if (!enhancements || enhancements.__numberingSideOffsetsPatchedV3) return;
    const original = enhancements.numberingConfig;
    if (typeof original !== 'function') return;
    enhancements.numberingConfig = function numberingConfigWithFixedFontSideAndOffsets() {
      const config = original();
      config.target_side = $('numberingTargetSide')?.value || 'both';
      config.offset_x_mm = numberValue('numberingOffsetX', 0, -50, 50);
      config.offset_y_mm = numberValue('numberingOffsetY', 0, -50, 50);
      config.prefix = String(config.prefix || '').trim();
      config.font = 'korean';
      return config;
    };
    enhancements.__numberingSideOffsetsPatchedV3 = true;
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
    hint.textContent = '넘버링 글꼴은 한국어 기본 하나로 고정됩니다. 문구가 있으면 문구와 번호 사이를 한 칸 띄워 출력합니다. 기준 위치를 선택한 뒤 좌우·상하 값을 -/+로 미세 이동할 수 있으며, 적용 면과 위치는 미리보기와 저장 PDF에 동일하게 반영됩니다.';
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
      element.style.fontWeight = '400';
      element.style.fontStyle = 'normal';
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
    return settings;
  }

  function installFetchGuard() {
    if (window.__smartPrintNumberingFetchGuardV4 || typeof window.fetch !== 'function') return;
    window.__smartPrintNumberingFetchGuardV4 = true;
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
      lockFontControl();
      schedule();
    }));
    window.addEventListener('resize', schedule);
    schedule();
    document.documentElement.dataset.smartLayoutNumberingPreviewSync = 'v4-position-side-fixed-font-space';
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', bind, { once: true });
  else bind();
})();
