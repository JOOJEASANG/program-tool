// Realistic spine text size and fit diagnostics aligned with the cover renderer.
(function () {
  'use strict';
  if (window.__coverSpinePrintSafetyV1) return;
  window.__coverSpinePrintSafetyV1 = true;
  if (!location.pathname.includes('perfect-binding-cover')) return;

  const MM_PER_PT = 25.4 / 72;
  const INSTALL_DELAYS = [0, 220, 560, 1000, 1700, 2600, 3800];
  const WATCH_IDS = new Set([
    'pageCount', 'paperCaliper', 'bindingAdjust', 'manualSpine', 'spineManual',
    'trimH', 'spineTitle', 'spineTextSize', 'spineDirection',
    'spineTop', 'spineCenter', 'spineBottom',
  ]);

  let installed = false;
  let frame = 0;

  const byId = (id) => document.getElementById(id);
  const finite = (value, fallback = 0) => Number.isFinite(Number(value)) ? Number(value) : fallback;
  const positive = (value, fallback) => {
    const number = finite(value, fallback);
    return number > 0 ? number : fallback;
  };
  const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

  function weightedCharacters(text) {
    let units = 0;
    for (const character of String(text || '').replace(/\s+/g, ' ').trim()) {
      if (/\s/.test(character)) units += 0.42;
      else if (/[\u0000-\u00ff]/.test(character)) units += 0.62;
      else units += 1;
    }
    return units;
  }

  function evaluateSpineText(source = {}) {
    const spineMm = Math.max(0, finite(source.spineMm, 0));
    const trimHeightMm = positive(source.trimHeightMm, 297);
    const requestedPt = clamp(positive(source.requestedPt, 11), 5, 30);
    const direction = source.direction === 'vertical'
      ? 'vertical'
      : source.direction === 'topToBottom' ? 'topToBottom' : 'bottomToTop';
    const text = String(source.text || '').trim();
    const characters = [...text.replace(/\s+/g, '')].length;
    const units = weightedCharacters(text);
    const crossWidthLimitPt = Math.max(5, spineMm / MM_PER_PT * 0.56);
    const widthLimitedPt = Math.min(requestedPt, crossWidthLimitPt);
    let finalPt = widthLimitedPt;
    let spacingRatio = 1;
    let lengthLimited = false;

    if (text && direction === 'vertical') {
      const availableMm = Math.max(1, trimHeightMm - 26);
      const naturalGapMm = widthLimitedPt * MM_PER_PT * 1.08;
      const availableGapMm = availableMm / Math.max(1, characters);
      spacingRatio = Math.min(1, availableGapMm / Math.max(0.01, naturalGapMm));
    } else if (text) {
      const availableMm = Math.max(1, trimHeightMm - 28);
      const naturalWidthMm = units * widthLimitedPt * MM_PER_PT;
      if (naturalWidthMm > availableMm) {
        finalPt = Math.max(4.25, widthLimitedPt * availableMm / naturalWidthMm);
        lengthLimited = true;
      }
    }

    const hidden = Boolean(text && spineMm < 2.2);
    const crossLimited = requestedPt - widthLimitedPt > 0.05;
    const reduced = requestedPt - finalPt > 0.05 || spacingRatio < 0.98;
    let level = 'ok';
    let label = '적합';
    let message = `${finalPt.toFixed(1)}pt 예상 · 인쇄 가능`;

    if (!text) {
      level = spineMm >= 2.2 ? 'empty' : 'muted';
      label = '문구 없음';
      message = spineMm >= 2.2 ? '책등 문구를 입력할 수 있습니다.' : '책등이 좁아 문구 없이 출력합니다.';
    } else if (hidden) {
      level = 'error';
      label = '출력 안 됨';
      message = `${spineMm.toFixed(1)}mm 책등은 렌더러에서 문구를 생략합니다.`;
    } else if (direction === 'vertical' && spacingRatio < 0.7) {
      level = 'error';
      label = '글자 겹침 위험';
      message = `세로 글자 간격이 정상의 ${Math.round(spacingRatio * 100)}%로 압축됩니다.`;
    } else if (finalPt < 5.5) {
      level = 'error';
      label = '너무 작음';
      message = `${finalPt.toFixed(1)}pt 예상 · 인쇄 후 읽기 어렵습니다.`;
    } else if (spineMm < 3.5 || finalPt < 7 || (direction === 'vertical' && spacingRatio < 0.9)) {
      level = 'warn';
      label = '주의';
      message = direction === 'vertical' && spacingRatio < 0.9
        ? `${finalPt.toFixed(1)}pt · 글자 간격 ${Math.round(spacingRatio * 100)}%`
        : `${finalPt.toFixed(1)}pt 예상 · 작은 책등 글자입니다.`;
    } else if (reduced) {
      level = 'adjusted';
      label = '자동 축소';
      message = `${requestedPt.toFixed(1)}pt 입력 → 실제 약 ${finalPt.toFixed(1)}pt`;
    }

    const recommendedPt = hidden || !text
      ? null
      : Math.max(5, Math.floor(finalPt * 2) / 2);
    return {
      spineMm,
      trimHeightMm,
      requestedPt,
      finalPt,
      recommendedPt,
      direction,
      text,
      characters,
      units,
      spacingRatio,
      hidden,
      crossLimited,
      lengthLimited,
      reduced,
      level,
      label,
      message,
    };
  }

  function currentSpineWidth() {
    try {
      if (typeof getSpine === 'function') return Math.max(0, finite(getSpine(), 0));
    } catch (_) {}
    const manual = Boolean(byId('manualSpine')?.checked);
    if (manual) return Math.max(0, finite(byId('spineManual')?.value, 0));
    const pages = Math.max(2, Math.ceil(finite(byId('pageCount')?.value, 160)));
    return Math.max(
      0,
      Math.ceil(pages / 2) * finite(byId('paperCaliper')?.value, 0.1)
        + finite(byId('bindingAdjust')?.value, 0.5),
    );
  }

  function currentSpineText() {
    try {
      const current = window.CoverProjectStateBridge?.primaryText?.('spine');
      if (String(current || '').trim()) return String(current).trim();
    } catch (_) {}
    const legacy = String(byId('spineTitle')?.value || '').trim();
    if (legacy) return legacy;
    return ['spineTop', 'spineCenter', 'spineBottom']
      .map((id) => String(byId(id)?.value || '').trim())
      .filter(Boolean)
      .join(' ');
  }

  function currentEvaluation() {
    return evaluateSpineText({
      spineMm: currentSpineWidth(),
      trimHeightMm: positive(byId('trimH')?.value, 297),
      requestedPt: positive(byId('spineTextSize')?.value, 11),
      direction: byId('spineDirection')?.value || 'bottomToTop',
      text: currentSpineText(),
    });
  }

  function preflightIssue(result = currentEvaluation()) {
    if (!result.text) {
      return result.spineMm >= 2.2
        ? { level: 'warn', title: '책등 문구 없음', detail: `${result.spineMm.toFixed(1)}mm 책등에 문구를 넣을 수 있습니다.` }
        : null;
    }
    if (result.level === 'error') {
      return { level: 'error', title: `책등 글자 ${result.label}`, detail: result.message };
    }
    if (result.level === 'warn' || result.level === 'adjusted') {
      return { level: 'warn', title: `책등 글자 ${result.label}`, detail: result.message };
    }
    return { level: 'ok', title: '책등 글자 크기 적합', detail: result.message };
  }

  function installStyles() {
    if (byId('coverSpinePrintSafetyStyles')) return;
    const style = document.createElement('style');
    style.id = 'coverSpinePrintSafetyStyles';
    style.textContent = `
      .cover-spine-safety{margin-top:7px;padding:8px;border:1px solid #dbe5ee;border-radius:9px;background:#f8fafc}
      .cover-spine-safety-top{display:flex;align-items:center;gap:7px}
      .cover-spine-safety-title{font-size:8px;font-weight:900;color:#64748b}
      .cover-spine-safety-badge{margin-left:auto;border-radius:999px;padding:2px 6px;font-size:8px;font-weight:900;white-space:nowrap}
      .cover-spine-safety-detail{margin-top:4px;font-size:8px;line-height:1.4;color:#64748b}
      .cover-spine-safety-action{display:none;width:100%;margin-top:6px;border:1px solid #67c7d8;border-radius:7px;background:#ecfeff;color:#0e7490;padding:6px 7px;font-size:8px;font-weight:900;cursor:pointer}
      .cover-spine-safety[data-level="ok"] .cover-spine-safety-badge{background:#dcfce7;color:#166534}
      .cover-spine-safety[data-level="adjusted"] .cover-spine-safety-badge{background:#e0f2fe;color:#075985}
      .cover-spine-safety[data-level="warn"] .cover-spine-safety-badge{background:#fef3c7;color:#92400e}
      .cover-spine-safety[data-level="error"] .cover-spine-safety-badge{background:#fee2e2;color:#b91c1c}
      .cover-spine-safety[data-level="empty"] .cover-spine-safety-badge,.cover-spine-safety[data-level="muted"] .cover-spine-safety-badge{background:#e2e8f0;color:#64748b}
      .cover-spine-safety[data-can-apply="1"] .cover-spine-safety-action{display:block}
    `;
    document.head.appendChild(style);
  }

  function ensurePanel() {
    let panel = byId('coverSpinePrintSafety');
    if (panel) return panel;
    const input = byId('spineTitle');
    const anchor = input?.closest?.('.field');
    if (!anchor) return null;
    panel = document.createElement('div');
    panel.id = 'coverSpinePrintSafety';
    panel.className = 'cover-spine-safety';
    panel.setAttribute('role', 'status');
    panel.setAttribute('aria-live', 'polite');
    panel.innerHTML = '<div class="cover-spine-safety-top"><span class="cover-spine-safety-title">책등 인쇄 글자</span><span class="cover-spine-safety-badge">계산 중</span></div><div class="cover-spine-safety-detail"></div><button class="cover-spine-safety-action" id="coverSpineApplyRecommended" type="button">실제 출력 크기로 맞추기</button>';
    anchor.insertAdjacentElement('afterend', panel);
    byId('coverSpineApplyRecommended')?.addEventListener('click', applyRecommendedSize);
    return panel;
  }

  function renderEvaluation(result = currentEvaluation()) {
    const panel = ensurePanel();
    if (!panel) return result;
    panel.dataset.level = result.level;
    const canApply = Boolean(
      result.recommendedPt
      && result.requestedPt - result.recommendedPt >= 0.5
      && !result.hidden,
    );
    panel.dataset.canApply = canApply ? '1' : '0';
    const badge = panel.querySelector('.cover-spine-safety-badge');
    const detail = panel.querySelector('.cover-spine-safety-detail');
    if (badge) badge.textContent = result.label;
    if (detail) {
      const width = `책등 ${result.spineMm.toFixed(1)}mm`;
      detail.textContent = result.text ? `${width} · ${result.message}` : `${width} · ${result.message}`;
    }
    const action = byId('coverSpineApplyRecommended');
    if (action && result.recommendedPt) {
      action.textContent = `${result.recommendedPt.toFixed(1)}pt로 맞추기`;
      action.dataset.recommendedPt = String(result.recommendedPt);
    }
    panel.dataset.expectedPt = result.text ? result.finalPt.toFixed(2) : '';
    panel.dataset.blocking = String(result.level === 'error');
    return result;
  }

  function applyRecommendedSize() {
    const result = currentEvaluation();
    if (!result.recommendedPt || result.hidden) return;
    const input = byId('spineTextSize');
    if (!input) return;
    input.value = result.recommendedPt.toFixed(1);
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.dispatchEvent(new Event('change', { bubbles: true }));
    renderEvaluation();
    try { window.requestRender?.(); } catch (_) {}
  }

  function appendPreflightRow(item) {
    const list = byId('coverPreflightList');
    if (!list || !item) return;
    const icon = { error: '✕', warn: '!', ok: '✓' };
    const color = { error: '#b91c1c', warn: '#92400e', ok: '#166534' };
    const background = { error: '#fef2f2', warn: '#fffbeb', ok: '#f0fdf4' };
    const row = document.createElement('div');
    row.dataset.coverSpineSafetyIssue = '1';
    row.style.cssText = `padding:7px 8px;border-radius:8px;background:${background[item.level]};font-size:9px;color:${color[item.level]}`;
    const title = document.createElement('strong');
    title.textContent = `${icon[item.level]} ${item.title}`;
    const detail = document.createElement('div');
    detail.style.cssText = 'font-size:8px;margin-top:2px;opacity:.85';
    detail.textContent = item.detail || '';
    row.append(title, detail);
    list.appendChild(row);
  }

  function updatePreflightSummary(items) {
    const summary = byId('coverPreflightSummary');
    if (!summary || !Array.isArray(items)) return;
    const errors = items.filter((item) => item.level === 'error').length;
    const warnings = items.filter((item) => item.level === 'warn').length;
    const normal = items.filter((item) => item.level === 'ok').length;
    summary.textContent = errors
      ? `출력 전 수정 필요 · 오류 ${errors}개 · 주의 ${warnings}개`
      : warnings ? `출력 가능 · 주의사항 ${warnings}개 확인` : `점검 완료 · ${normal}개 항목 정상`;
    summary.style.borderColor = errors ? '#fecaca' : warnings ? '#fde68a' : '#bbf7d0';
    summary.style.background = errors ? '#fef2f2' : warnings ? '#fffbeb' : '#f0fdf4';
    summary.style.color = errors ? '#b91c1c' : warnings ? '#92400e' : '#166534';
  }

  function wrapPreflightButton(id) {
    const button = byId(id);
    if (!button || typeof button.onclick !== 'function') return false;
    if (button.onclick.__coverSpinePrintSafetyV1) return true;
    const previous = button.onclick;
    const wrapped = function coverSpineSafetyPreflightWrapper(...args) {
      const base = previous.apply(this, args);
      const items = Array.isArray(base) ? base : [];
      const item = preflightIssue(renderEvaluation());
      if (item) items.push(item);
      appendPreflightRow(item);
      updatePreflightSummary(items);
      return items;
    };
    wrapped.__coverSpinePrintSafetyV1 = true;
    wrapped.__coverSpinePrintSafetyDelegate = previous;
    button.onclick = wrapped;
    return true;
  }

  function update() {
    const result = renderEvaluation();
    wrapPreflightButton('runCoverPreflight');
    wrapPreflightButton('refreshCoverPreflight');
    return result;
  }

  function scheduleUpdate() {
    cancelAnimationFrame(frame);
    frame = requestAnimationFrame(update);
  }

  function handleChange(event) {
    if (WATCH_IDS.has(event.target?.id)) scheduleUpdate();
  }

  function install() {
    installStyles();
    ensurePanel();
    if (!installed) {
      installed = true;
      document.addEventListener('input', handleChange, true);
      document.addEventListener('change', handleChange, true);
      document.addEventListener('cover-recovery-restored', scheduleUpdate);
    }
    update();
  }

  window.CoverSpinePrintSafety = {
    weightedCharacters,
    evaluateSpineText,
    currentEvaluation,
    preflightIssue,
    renderEvaluation,
    applyRecommendedSize,
    update,
    stage: 'spine-text-print-fit-safety',
  };

  for (const delay of INSTALL_DELAYS) setTimeout(install, delay);
})();
