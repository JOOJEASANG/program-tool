(() => {
  'use strict';
  if (window.__smartPrintNumberingPositionExportSyncV1) return;
  window.__smartPrintNumberingPositionExportSyncV1 = true;

  const $ = id => document.getElementById(id);
  const clamp = (value, min, max, fallback) => {
    const number = Number(value);
    if (!Number.isFinite(number)) return fallback;
    return Math.min(max, Math.max(min, number));
  };
  const hasKorean = text => /[\u1100-\u11ff\u3130-\u318f\ua960-\ua97f\uac00-\ud7a3\ud7b0-\ud7ff]/u.test(String(text || ''));

  function ensureOffsetControls() {
    if ($('numberingMarginX') && $('numberingMarginY')) return true;
    const options = $('numberingOptions');
    const position = $('numberingPosition')?.closest('.grid2');
    if (!options || !position) return false;

    const row = document.createElement('div');
    row.className = 'grid2 numbering-offset-controls';
    row.innerHTML = `
      <label class="field"><span>좌우 위치 조절 mm</span><input id="numberingMarginX" type="number" min="0" max="50" step="0.5" value="1.5"></label>
      <label class="field"><span>상하 위치 조절 mm</span><input id="numberingMarginY" type="number" min="0" max="50" step="0.5" value="1.5"></label>`;
    position.insertAdjacentElement('afterend', row);

    for (const id of ['numberingMarginX', 'numberingMarginY']) {
      $(id)?.addEventListener('input', () => window.SmartPrintLayoutEnhancements?.scheduleOverlay?.());
      $(id)?.addEventListener('change', () => window.SmartPrintLayoutEnhancements?.scheduleOverlay?.());
    }
    return true;
  }

  function currentMargins() {
    return {
      margin_x_mm: clamp($('numberingMarginX')?.value, 0, 50, 1.5),
      margin_y_mm: clamp($('numberingMarginY')?.value, 0, 50, 1.5),
    };
  }

  function normalizeNumbering(settings) {
    if (!settings?.numbering?.enabled) return settings;
    const margins = currentMargins();
    settings.numbering.margin_x_mm = margins.margin_x_mm;
    settings.numbering.margin_y_mm = margins.margin_y_mm;
    settings.numbering.prefix = String(settings.numbering.prefix || '').trim();
    if (hasKorean(settings.numbering.prefix)) settings.numbering.font = 'korean';
    return settings;
  }

  function installFetchGuard() {
    if (window.__smartPrintNumberingFetchGuardV1 || typeof window.fetch !== 'function') return;
    window.__smartPrintNumberingFetchGuardV1 = true;
    const originalFetch = window.fetch.bind(window);
    window.fetch = function smartLayoutNumberingFetch(input, init = {}) {
      try {
        const url = typeof input === 'string' ? input : input?.url || '';
        const body = init?.body;
        if (/\/api\/pdf\/smart-layout(?:\?|$)/.test(url) && body instanceof FormData) {
          const raw = body.get('settings');
          if (typeof raw === 'string') {
            const settings = JSON.parse(raw);
            normalizeNumbering(settings);
            body.set('settings', JSON.stringify(settings));
          }
        }
      } catch (error) {
        console.warn('[smart-layout-numbering] export settings sync failed', error);
      }
      return originalFetch(input, init);
    };
  }

  function updateHint() {
    const hint = document.querySelector('#numberingOptions .hint');
    if (!hint) return;
    hint.textContent = '문구와 번호 사이는 자동으로 한 칸 띄웁니다. 좌우·상하 위치 조절값은 미리보기와 저장 PDF에 동일하게 적용됩니다. 한글 문구는 저장 시 한국어 글꼴로 자동 처리하며, 양면은 앞·뒤에 같은 번호가 들어갑니다.';
  }

  function bindReset() {
    $('resetBtn')?.addEventListener('click', () => requestAnimationFrame(() => {
      if ($('numberingMarginX')) $('numberingMarginX').value = '1.5';
      if ($('numberingMarginY')) $('numberingMarginY').value = '1.5';
      window.SmartPrintLayoutEnhancements?.scheduleOverlay?.();
    }));
  }

  function boot() {
    ensureOffsetControls();
    updateHint();
    installFetchGuard();
    bindReset();
    window.SmartPrintNumberingPositionExportSync = Object.freeze({ currentMargins, normalizeNumbering, ensureOffsetControls });
    document.documentElement.dataset.smartLayoutNumberingPositionExport = 'v1-margin-pdf-korean-safe';
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once: true });
  else boot();
})();