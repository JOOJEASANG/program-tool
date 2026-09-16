(() => {
  'use strict';
  if (window.__smartPrintFinalControlsV1) return;
  window.__smartPrintFinalControlsV1 = true;

  const MAX_NUMBERED_COPIES = 2000;
  const $ = id => document.getElementById(id);
  let previousFetch = null;
  let downloadObserver = null;

  const clamp = (value, min, max, fallback = min) => {
    const number = Number(value);
    if (!Number.isFinite(number)) return fallback;
    return Math.min(max, Math.max(min, number));
  };

  function setStatus(message, type = '') {
    const line = $('statusLine');
    if (!line) return;
    line.textContent = message;
    line.className = `status${type ? ` ${type}` : ''}`;
  }

  function trimConfig() {
    const widthMm = Number($('trimGuideWidth')?.value || 0);
    const heightMm = Number($('trimGuideHeight')?.value || 0);
    return {
      widthMm,
      heightMm,
      valid: Number.isFinite(widthMm) && Number.isFinite(heightMm) && widthMm >= 2 && heightMm >= 2 && widthMm <= 2000 && heightMm <= 2000,
    };
  }

  function validateTrimConfig({ showStatus = false, focus = false } = {}) {
    const trim = trimConfig();
    if (trim.valid) return trim;
    const message = '재단크기는 필수입력입니다. 재단 가로와 세로를 2~2,000mm 범위로 입력해 주세요.';
    if (showStatus) setStatus(message, 'error');
    if (focus) {
      const target = !(Number($('trimGuideWidth')?.value) >= 2) ? $('trimGuideWidth') : $('trimGuideHeight');
      target?.focus();
    }
    throw new Error(message);
  }

  function numberingConfig() {
    const base = window.SmartPrintLayoutEnhancements?.numberingConfig?.() || {};
    const start = Math.round(clamp($('numberingStart')?.value || 1, 0, 9_999_999, 1));
    const rawEnd = String($('numberingEnd')?.value || '').trim();
    const end = rawEnd === '' ? null : Math.round(clamp(rawEnd, 0, 9_999_999, start));
    return {
      ...base,
      enabled: Boolean($('numberingEnabled')?.checked),
      start,
      end,
      prefix: String($('numberingPrefix')?.value || '').slice(0, 40),
      format: $('numberingFormat')?.value || 'pad3',
      position: $('numberingPosition')?.value || 'bottom-right',
      font: $('numberingFont')?.value || 'helvetica-bold',
      font_size_pt: clamp($('numberingFontSize')?.value || 9, 5, 36, 9),
      transparent_background: Boolean($('numberingTransparent')?.checked),
      margin_x_mm: clamp($('numberingMarginX')?.value || 1.5, 0, 50, 1.5),
      margin_y_mm: clamp($('numberingMarginY')?.value || 1.5, 0, 50, 1.5),
    };
  }

  function validateNumberingConfig(config = numberingConfig()) {
    if (!config.enabled || config.end == null) return config;
    if (config.end < config.start) throw new Error('넘버링 끝번호는 시작번호보다 크거나 같아야 합니다.');
    if (config.end - config.start + 1 > MAX_NUMBERED_COPIES) {
      throw new Error(`한 번에 생성할 넘버링은 최대 ${MAX_NUMBERED_COPIES.toLocaleString()}개까지 가능합니다.`);
    }
    return config;
  }

  function hideLegacyNumbering() {
    const legacy = document.querySelector('.smart-numbering-v2-panel');
    if (legacy) {
      legacy.hidden = true;
      legacy.setAttribute('aria-hidden', 'true');
    }
    const legacyEnabled = $('advNumberingEnabled');
    if (legacyEnabled) legacyEnabled.checked = false;
  }

  function injectUnifiedNumberingPanel() {
    hideLegacyNumbering();
    if ($('numberingEnabled')) return;
    const anchor = $('cropMarks')?.closest('.panel');
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
        <div class="grid2">
          <label class="field"><span>좌우 여백 mm</span><input id="numberingMarginX" type="number" min="0" max="50" step="0.5" value="1.5"></label>
          <label class="field"><span>상하 여백 mm</span><input id="numberingMarginY" type="number" min="0" max="50" step="0.5" value="1.5"></label>
        </div>
        <p id="numberingEstimate" class="numbering-estimate">끝번호를 입력하면 필요한 출력 용지를 자동 생성합니다.</p>
        <p class="hint">한 번에 최대 2,000개 번호를 생성합니다. 한글 문구를 사용할 때는 ‘한국어 기본’ 글꼴을 선택해 주세요. 양면은 앞·뒤에 같은 번호가 들어갑니다.</p>
      </div>`;
    anchor.insertAdjacentElement('afterend', panel);
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
      element.textContent = '끝번호를 비워두면 현재 자동배치 1회분만 생성합니다.';
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

  function scheduleNumberingOverlay() {
    window.SmartPrintLayoutEnhancements?.scheduleOverlay?.();
  }

  function updateNumberingControls() {
    const enabled = Boolean($('numberingEnabled')?.checked);
    const options = $('numberingOptions');
    options?.classList.toggle('is-disabled', !enabled);
    options?.querySelectorAll('input,select').forEach(control => { control.disabled = !enabled; });
    updateNumberingEstimate();
    scheduleNumberingOverlay();
  }

  function bindUnifiedNumbering() {
    $('numberingEnabled')?.addEventListener('change', updateNumberingControls);
    ['numberingStart', 'numberingEnd', 'numberingPrefix', 'numberingFormat', 'numberingPosition', 'numberingFont', 'numberingFontSize', 'numberingTransparent', 'numberingMarginX', 'numberingMarginY'].forEach(id => {
      $(id)?.addEventListener('input', () => { updateNumberingEstimate(); scheduleNumberingOverlay(); });
      $(id)?.addEventListener('change', () => { updateNumberingEstimate(); scheduleNumberingOverlay(); });
    });
    updateNumberingControls();
  }

  function refreshDownloadState({ recalculate = false } = {}) {
    const button = $('downloadBtn');
    const layout = window.SmartPrintLayout;
    if (!button || !layout) return;
    const hasItems = Boolean(layout.state?.items?.length);
    const trimValid = trimConfig().valid;
    if (hasItems && !trimValid) {
      if (!button.disabled) button.disabled = true;
      return;
    }
    if (recalculate && hasItems && trimValid && !layout.state?.busy) {
      layout.recalculate?.();
    }
  }

  function bindRequiredTrim() {
    const enabled = $('trimGuideEnabled');
    if (enabled) {
      enabled.checked = true;
      enabled.hidden = true;
      enabled.setAttribute('aria-hidden', 'true');
    }
    ['trimGuideWidth', 'trimGuideHeight'].forEach(id => {
      const input = $(id);
      if (!input) return;
      input.required = true;
      input.setAttribute('aria-required', 'true');
      input.addEventListener('input', () => {
        scheduleNumberingOverlay();
        refreshDownloadState({ recalculate: trimConfig().valid });
      });
      input.addEventListener('change', () => {
        scheduleNumberingOverlay();
        refreshDownloadState({ recalculate: trimConfig().valid });
      });
    });

    const button = $('downloadBtn');
    button?.addEventListener('click', event => {
      try {
        validateTrimConfig({ showStatus: true, focus: true });
        validateNumberingConfig();
      } catch (_) {
        event.preventDefault();
        event.stopImmediatePropagation();
      }
    }, true);

    if (button && !downloadObserver) {
      downloadObserver = new MutationObserver(() => refreshDownloadState());
      downloadObserver.observe(button, { attributes: true, attributeFilter: ['disabled'] });
    }
    const list = $('fileList');
    if (list) new MutationObserver(() => requestAnimationFrame(() => refreshDownloadState())).observe(list, { childList: true });
    refreshDownloadState();
  }

  function finalizedSettings(raw) {
    const settings = raw && typeof raw === 'object' ? raw : {};
    const trim = validateTrimConfig({ showStatus: true });
    settings.trim_width_mm = trim.widthMm;
    settings.trim_height_mm = trim.heightMm;
    settings.numbering = validateNumberingConfig(numberingConfig());
    return settings;
  }

  function installFinalFetchAdapter() {
    if (previousFetch) return;
    previousFetch = window.fetch.bind(window);
    window.fetch = function smartPrintFinalFetch(input, init = {}) {
      const url = typeof input === 'string' ? input : String(input?.url || '');
      const body = init?.body;
      if (!url.includes('/api/pdf/smart-layout') || !(body instanceof FormData)) {
        return previousFetch(input, init);
      }

      try {
        validateTrimConfig({ showStatus: true });
        validateNumberingConfig();
      } catch (error) {
        return Promise.reject(error);
      }

      const hadOwnSet = Object.prototype.hasOwnProperty.call(body, 'set');
      const priorOwnSet = body.set;
      const nativeSet = FormData.prototype.set;
      body.set = function finalSmartSettingsSet(name, value, filename) {
        let nextValue = value;
        if (name === 'settings' && typeof value === 'string') {
          try {
            nextValue = JSON.stringify(finalizedSettings(JSON.parse(value || '{}')));
          } catch (error) {
            setStatus(error?.message || '스마트 인쇄배치 설정을 확인해 주세요.', 'error');
            throw error;
          }
        }
        if (arguments.length >= 3) return nativeSet.call(body, name, nextValue, filename);
        return nativeSet.call(body, name, nextValue);
      };

      try {
        const current = body.get('settings');
        if (typeof current === 'string') body.set('settings', current);
        return previousFetch(input, init);
      } catch (error) {
        return Promise.reject(error);
      } finally {
        if (hadOwnSet) body.set = priorOwnSet;
        else delete body.set;
      }
    };
  }

  function bindReset() {
    $('resetBtn')?.addEventListener('click', () => requestAnimationFrame(() => {
      hideLegacyNumbering();
      if ($('numberingEnabled')) $('numberingEnabled').checked = false;
      if ($('numberingStart')) $('numberingStart').value = '1';
      if ($('numberingEnd')) $('numberingEnd').value = '';
      if ($('numberingPrefix')) $('numberingPrefix').value = '';
      if ($('numberingFormat')) $('numberingFormat').value = 'pad3';
      if ($('numberingFont')) $('numberingFont').value = 'helvetica-bold';
      if ($('numberingFontSize')) $('numberingFontSize').value = '9';
      if ($('numberingPosition')) $('numberingPosition').value = 'bottom-right';
      if ($('numberingTransparent')) $('numberingTransparent').checked = false;
      if ($('numberingMarginX')) $('numberingMarginX').value = '1.5';
      if ($('numberingMarginY')) $('numberingMarginY').value = '1.5';
      if ($('trimGuideWidth')) $('trimGuideWidth').value = '';
      if ($('trimGuideHeight')) $('trimGuideHeight').value = '';
      const enabled = $('trimGuideEnabled');
      if (enabled) enabled.checked = true;
      updateNumberingControls();
      refreshDownloadState();
      scheduleNumberingOverlay();
    }));
  }

  function boot() {
    injectUnifiedNumberingPanel();
    bindUnifiedNumbering();
    bindRequiredTrim();
    installFinalFetchAdapter();
    bindReset();
    hideLegacyNumbering();
    document.documentElement.dataset.smartPrintFinalControls = 'required-trim-v1';
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once: true });
  else boot();
})();
