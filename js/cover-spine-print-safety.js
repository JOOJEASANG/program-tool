// Spine text diagnostics for the actual multi-layer cover text renderer.
(function () {
  'use strict';
  if (window.__coverSpinePrintSafetyV1) return;
  window.__coverSpinePrintSafetyV1 = true;
  if (!location.pathname.includes('perfect-binding-cover')) return;

  const MM_PER_PT = 25.4 / 72;
  const MAX_TEXT_WIDTH_RATIO = 0.28;
  const INSTALL_DELAYS = [0, 220, 560, 1000, 1700, 2600, 3800];
  const WATCH_IDS = new Set([
    'pageCount', 'paperCaliper', 'bindingAdjust', 'manualSpine', 'spineManual',
    'trimH', 'spineTextSize', 'spineDirection',
  ]);
  const ZONES = ['top', 'center', 'bottom'];

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

  function layerScale(entry) {
    return clamp(positive(entry?.scale, 100) / 100, 0.5, 2);
  }

  function evaluateSpineLayer(source = {}) {
    const spineMm = Math.max(0, finite(source.spineMm, 0));
    const trimHeightMm = positive(source.trimHeightMm, 297);
    const text = String(source.text || '').trim();
    const basePt = clamp(positive(source.size, 10), 5, 30);
    const scaleFactor = clamp(positive(source.scale, 100) / 100, 0.5, 2);
    const renderedPt = basePt * scaleFactor;
    const units = weightedCharacters(text);
    const fontHeightMm = renderedPt * MM_PER_PT;
    const crossFillRatio = spineMm > 0 ? fontHeightMm / spineMm : Infinity;
    const naturalLengthMm = units * renderedPt * MM_PER_PT;
    const maxLengthMm = trimHeightMm * MAX_TEXT_WIDTH_RATIO;
    const compressionRatio = naturalLengthMm > 0 ? Math.min(1, maxLengthMm / naturalLengthMm) : 1;
    const printedLengthMm = Math.min(naturalLengthMm, maxLengthMm);
    const hidden = Boolean(text && spineMm < 2.2);

    const safeCrossRenderedPt = spineMm * 0.72 / MM_PER_PT;
    const safeLengthRenderedPt = units > 0
      ? maxLengthMm / (units * MM_PER_PT * 0.85)
      : renderedPt;
    const recommendedRenderedPt = Math.min(renderedPt, safeCrossRenderedPt, safeLengthRenderedPt);
    const recommendedBasePt = hidden || !text
      ? null
      : Math.max(5, Math.floor((recommendedRenderedPt / scaleFactor) * 2) / 2);
    const needsAdjustment = Boolean(recommendedBasePt && basePt - recommendedBasePt >= 0.5);

    let level = 'ok';
    let label = '적합';
    let message = `${renderedPt.toFixed(1)}pt · 책등 폭의 ${Math.round(crossFillRatio * 100)}%`;
    if (!text) {
      level = 'empty';
      label = '빈 글자';
      message = '내용이 없는 책등 글자 레이어입니다.';
    } else if (hidden) {
      level = 'error';
      label = '출력 안 됨';
      message = `${spineMm.toFixed(1)}mm 책등에서는 모든 책등 글자가 생략됩니다.`;
    } else if (crossFillRatio > 0.9) {
      level = 'error';
      label = '폭 초과';
      message = `${renderedPt.toFixed(1)}pt 글자가 ${spineMm.toFixed(1)}mm 책등 밖으로 번질 수 있습니다.`;
    } else if (compressionRatio < 0.65) {
      level = 'error';
      label = '심한 가로 압축';
      message = `문구가 원래 너비의 ${Math.round(compressionRatio * 100)}%로 눌려 출력됩니다.`;
    } else if (crossFillRatio > 0.72) {
      level = 'warn';
      label = '여백 부족';
      message = `글자 높이가 책등 폭의 ${Math.round(crossFillRatio * 100)}%라 좌우 여백이 좁습니다.`;
    } else if (compressionRatio < 0.85) {
      level = 'warn';
      label = '가로 압축';
      message = `긴 문구가 원래 너비의 ${Math.round(compressionRatio * 100)}%로 줄어듭니다.`;
    } else if (renderedPt < 6) {
      level = 'warn';
      label = '작은 글자';
      message = `${renderedPt.toFixed(1)}pt · 인쇄 후 읽기 어려울 수 있습니다.`;
    } else if (needsAdjustment) {
      level = 'adjusted';
      label = '크기 조정 권장';
      message = `${basePt.toFixed(1)}pt 입력 → ${recommendedBasePt.toFixed(1)}pt 권장`;
    }

    return {
      id: String(source.id || ''), zone: String(source.zone || 'center'), text, basePt,
      scaleFactor, renderedPt, spineMm, trimHeightMm, units, fontHeightMm,
      crossFillRatio, naturalLengthMm, maxLengthMm, printedLengthMm, compressionRatio,
      hidden, recommendedBasePt, needsAdjustment, level, label, message,
      y: clamp(finite(source.y, 50), 0, 100),
    };
  }

  function overlapWarnings(layers, trimHeightMm) {
    const active = layers.filter((layer) => layer.text && !layer.hidden);
    const warnings = [];
    for (let leftIndex = 0; leftIndex < active.length; leftIndex += 1) {
      const left = active[leftIndex];
      const leftCenter = trimHeightMm * left.y / 100;
      const leftStart = leftCenter - left.printedLengthMm / 2;
      const leftEnd = leftCenter + left.printedLengthMm / 2;
      for (let rightIndex = leftIndex + 1; rightIndex < active.length; rightIndex += 1) {
        const right = active[rightIndex];
        const rightCenter = trimHeightMm * right.y / 100;
        const rightStart = rightCenter - right.printedLengthMm / 2;
        const rightEnd = rightCenter + right.printedLengthMm / 2;
        const overlapMm = Math.min(leftEnd, rightEnd) - Math.max(leftStart, rightStart);
        if (overlapMm > 2) warnings.push({ left: left.id, right: right.id, overlapMm });
      }
    }
    return warnings;
  }

  function evaluateSpineLayers(source = {}) {
    const spineMm = Math.max(0, finite(source.spineMm, 0));
    const trimHeightMm = positive(source.trimHeightMm, 297);
    const rawEntries = Array.isArray(source.entries) ? source.entries : [];
    const layers = rawEntries
      .map((entry) => evaluateSpineLayer({ ...entry, spineMm, trimHeightMm }))
      .filter((entry) => entry.text);
    const overlaps = overlapWarnings(layers, trimHeightMm);
    const errors = layers.filter((entry) => entry.level === 'error').length;
    const warnings = layers.filter((entry) => entry.level === 'warn').length + overlaps.length;
    const adjusted = layers.filter((entry) => entry.level === 'adjusted').length;
    const adjustable = layers.filter((entry) => entry.needsAdjustment && !entry.hidden);

    let level = 'ok';
    let label = '적합';
    let message = `${layers.length}개 책등 글자 레이어가 인쇄 범위에 맞습니다.`;
    if (!layers.length) {
      level = spineMm >= 2.2 ? 'empty' : 'muted';
      label = '문구 없음';
      message = spineMm >= 2.2
        ? `${spineMm.toFixed(1)}mm 책등에 글자를 추가할 수 있습니다.`
        : `${spineMm.toFixed(1)}mm 책등은 글자 없이 출력하는 것이 안전합니다.`;
    } else if (errors) {
      level = 'error';
      label = `오류 ${errors}개`;
      message = layers.find((entry) => entry.level === 'error')?.message || '책등 글자 크기를 조정하세요.';
    } else if (warnings) {
      level = 'warn';
      label = `주의 ${warnings}개`;
      message = overlaps.length
        ? `책등 글자 레이어 ${overlaps.length}쌍이 서로 겹칠 수 있습니다.`
        : layers.find((entry) => entry.level === 'warn')?.message || '책등 글자를 확인하세요.';
    } else if (adjusted) {
      level = 'adjusted';
      label = `조정 권장 ${adjusted}개`;
      message = '입력 크기보다 작은 권장 크기로 맞추면 좌우 여백이 안정적입니다.';
    }
    return { spineMm, trimHeightMm, layers, overlaps, errors, warnings, adjusted, adjustable, level, label, message };
  }

  function currentSpineWidth() {
    try { if (typeof getSpine === 'function') return Math.max(0, finite(getSpine(), 0)); } catch (_) {}
    if (byId('manualSpine')?.checked) return Math.max(0, finite(byId('spineManual')?.value, 0));
    const pages = Math.max(2, Math.ceil(finite(byId('pageCount')?.value, 160)));
    return Math.max(0, Math.ceil(pages / 2) * finite(byId('paperCaliper')?.value, 0.1) + finite(byId('bindingAdjust')?.value, 0.5));
  }

  function currentSpineEntries() {
    const output = [];
    try {
      const data = window.CoverTextZones?.data?.spine;
      if (data) {
        for (const zone of ZONES) {
          for (const entry of data[zone] || []) {
            const layout = typeof state !== 'undefined' ? state.layout?.[entry.id] : null;
            output.push({ ...entry, zone, scale: finite(layout?.scale, finite(entry.scale, 100)), y: finite(layout?.y, finite(entry.y, zone === 'top' ? 18 : zone === 'bottom' ? 84 : 50)) });
          }
        }
      }
    } catch (_) {}
    if (output.some((entry) => String(entry.text || '').trim())) return output;
    const legacy = String(byId('spineTitle')?.value || '').trim();
    return legacy ? [{ id: 'legacySpineTitle', zone: 'center', text: legacy, size: positive(byId('spineTextSize')?.value, 11), scale: 100, y: 50 }] : [];
  }

  function currentEvaluation() {
    return evaluateSpineLayers({ spineMm: currentSpineWidth(), trimHeightMm: positive(byId('trimH')?.value, 297), entries: currentSpineEntries() });
  }

  function preflightIssue(result = currentEvaluation()) {
    if (!result.layers.length) return result.spineMm >= 2.2 ? { level: 'warn', title: '책등 문구 없음', detail: result.message } : null;
    if (result.level === 'error') return { level: 'error', title: '책등 글자 인쇄 오류', detail: result.message };
    if (result.level === 'warn' || result.level === 'adjusted') return { level: 'warn', title: '책등 글자 확인 필요', detail: result.message };
    return { level: 'ok', title: '책등 글자 인쇄 적합', detail: result.message };
  }

  function installStyles() {
    if (byId('coverSpinePrintSafetyStyles')) return;
    const style = document.createElement('style');
    style.id = 'coverSpinePrintSafetyStyles';
    style.textContent = `.cover-spine-safety{margin:0 0 8px;padding:8px;border:1px solid #dbe5ee;border-radius:9px;background:#f8fafc}.cover-spine-safety-top{display:flex;align-items:center;gap:7px}.cover-spine-safety-title{font-size:8px;font-weight:900;color:#64748b}.cover-spine-safety-badge{margin-left:auto;border-radius:999px;padding:2px 6px;font-size:8px;font-weight:900;white-space:nowrap}.cover-spine-safety-detail{margin-top:4px;font-size:8px;line-height:1.4;color:#64748b}.cover-spine-safety-layers{display:grid;gap:4px;margin-top:6px}.cover-spine-safety-layer{display:flex;gap:5px;align-items:center;padding:5px 6px;border-radius:7px;background:#fff;font-size:8px;color:#64748b}.cover-spine-safety-layer strong{color:#334155}.cover-spine-safety-layer span:last-child{margin-left:auto}.cover-spine-safety-action{display:none;width:100%;margin-top:6px;border:1px solid #67c7d8;border-radius:7px;background:#ecfeff;color:#0e7490;padding:6px 7px;font-size:8px;font-weight:900;cursor:pointer}.cover-spine-safety[data-level="ok"] .cover-spine-safety-badge{background:#dcfce7;color:#166534}.cover-spine-safety[data-level="adjusted"] .cover-spine-safety-badge{background:#e0f2fe;color:#075985}.cover-spine-safety[data-level="warn"] .cover-spine-safety-badge{background:#fef3c7;color:#92400e}.cover-spine-safety[data-level="error"] .cover-spine-safety-badge{background:#fee2e2;color:#b91c1c}.cover-spine-safety[data-level="empty"] .cover-spine-safety-badge,.cover-spine-safety[data-level="muted"] .cover-spine-safety-badge{background:#e2e8f0;color:#64748b}.cover-spine-safety[data-can-apply="1"] .cover-spine-safety-action{display:block}`;
    document.head.appendChild(style);
  }

  function ensurePanel() {
    let panel = byId('coverSpinePrintSafety');
    if (panel) return panel;
    const root = byId('coverTextZones');
    const textPanel = byId('coverTextZonePanel');
    if (!root || !textPanel) return null;
    panel = document.createElement('div');
    panel.id = 'coverSpinePrintSafety'; panel.className = 'cover-spine-safety';
    panel.setAttribute('role', 'status'); panel.setAttribute('aria-live', 'polite');
    panel.innerHTML = '<div class="cover-spine-safety-top"><span class="cover-spine-safety-title">책등 인쇄 글자</span><span class="cover-spine-safety-badge">계산 중</span></div><div class="cover-spine-safety-detail"></div><div class="cover-spine-safety-layers"></div><button class="cover-spine-safety-action" id="coverSpineApplyRecommended" type="button">안전한 크기로 맞추기</button>';
    textPanel.insertBefore(panel, root);
    byId('coverSpineApplyRecommended')?.addEventListener('click', applyRecommendedSizes);
    return panel;
  }

  function renderEvaluation(result = currentEvaluation()) {
    const panel = ensurePanel();
    if (!panel) return result;
    panel.dataset.level = result.level; panel.dataset.canApply = result.adjustable.length ? '1' : '0'; panel.dataset.blocking = String(result.level === 'error'); panel.dataset.spineMm = result.spineMm.toFixed(2);
    const badge = panel.querySelector('.cover-spine-safety-badge'); const detail = panel.querySelector('.cover-spine-safety-detail'); const layers = panel.querySelector('.cover-spine-safety-layers');
    if (badge) badge.textContent = result.label;
    if (detail) detail.textContent = `책등 ${result.spineMm.toFixed(1)}mm · ${result.message}`;
    if (layers) {
      layers.replaceChildren();
      for (const entry of result.layers.slice(0, 4)) {
        const row = document.createElement('div'); row.className = 'cover-spine-safety-layer';
        const name = document.createElement('strong'); name.textContent = entry.zone === 'top' ? '상단' : entry.zone === 'bottom' ? '하단' : '중앙';
        const text = document.createElement('span'); text.textContent = entry.text.length > 16 ? `${entry.text.slice(0, 16)}…` : entry.text;
        const stateLabel = document.createElement('span'); stateLabel.textContent = `${entry.renderedPt.toFixed(1)}pt · ${entry.label}`;
        row.append(name, text, stateLabel); layers.appendChild(row);
      }
    }
    const action = byId('coverSpineApplyRecommended');
    if (action) action.textContent = result.adjustable.length ? `문제 있는 ${result.adjustable.length}개 글자 크기 맞추기` : '안전한 크기로 맞추기';
    return result;
  }

  function applyRecommendedSizes() {
    const result = currentEvaluation();
    if (!result.adjustable.length) return false;
    const api = window.CoverTextZones;
    if (!api?.data?.spine) return false;
    const recommendations = new Map(result.adjustable.map((entry) => [entry.id, entry.recommendedBasePt]));
    let changed = 0;
    for (const zone of ZONES) for (const entry of api.data.spine[zone] || []) {
      const recommended = recommendations.get(entry.id);
      if (!recommended || recommended >= finite(entry.size, 10)) continue;
      entry.size = recommended; changed += 1;
    }
    if (!changed) return false;
    api.save?.();
    document.querySelector('#coverTextZonePanel .cover-text-side-tab[data-side="spine"]')?.click();
    try { window.requestRender?.(); } catch (_) {}
    renderEvaluation();
    return true;
  }

  function appendPreflightRow(item) {
    const list = byId('coverPreflightList');
    if (!list || !item) return;
    const icon = { error: '✕', warn: '!', ok: '✓' }; const color = { error: '#b91c1c', warn: '#92400e', ok: '#166534' }; const background = { error: '#fef2f2', warn: '#fffbeb', ok: '#f0fdf4' };
    const row = document.createElement('div'); row.dataset.coverSpineSafetyIssue = '1'; row.style.cssText = `padding:7px 8px;border-radius:8px;background:${background[item.level]};font-size:9px;color:${color[item.level]}`;
    const title = document.createElement('strong'); title.textContent = `${icon[item.level]} ${item.title}`;
    const detail = document.createElement('div'); detail.style.cssText = 'font-size:8px;margin-top:2px;opacity:.85'; detail.textContent = item.detail || '';
    row.append(title, detail); list.appendChild(row);
  }

  function updatePreflightSummary(items) {
    const summary = byId('coverPreflightSummary'); if (!summary || !Array.isArray(items)) return;
    const errors = items.filter((item) => item.level === 'error').length; const warnings = items.filter((item) => item.level === 'warn').length; const normal = items.filter((item) => item.level === 'ok').length;
    summary.textContent = errors ? `출력 전 수정 필요 · 오류 ${errors}개 · 주의 ${warnings}개` : warnings ? `출력 가능 · 주의사항 ${warnings}개 확인` : `점검 완료 · ${normal}개 항목 정상`;
    summary.style.borderColor = errors ? '#fecaca' : warnings ? '#fde68a' : '#bbf7d0'; summary.style.background = errors ? '#fef2f2' : warnings ? '#fffbeb' : '#f0fdf4'; summary.style.color = errors ? '#b91c1c' : warnings ? '#92400e' : '#166534';
  }

  function wrapPreflightButton(id) {
    const button = byId(id);
    if (!button || typeof button.onclick !== 'function') return false;
    if (button.onclick.__coverSpinePrintSafetyV1) return true;
    const previous = button.onclick;
    const wrapped = function coverSpineSafetyPreflightWrapper(...args) {
      const base = previous.apply(this, args); const items = Array.isArray(base) ? base : [];
      const item = preflightIssue(renderEvaluation()); if (item) items.push(item);
      appendPreflightRow(item); updatePreflightSummary(items); return items;
    };
    wrapped.__coverSpinePrintSafetyV1 = true; wrapped.__coverSpinePrintSafetyDelegate = previous; button.onclick = wrapped; return true;
  }

  function update() {
    const result = renderEvaluation(); wrapPreflightButton('runCoverPreflight'); wrapPreflightButton('refreshCoverPreflight'); return result;
  }
  function scheduleUpdate() { cancelAnimationFrame(frame); frame = requestAnimationFrame(update); }
  function handleChange(event) { if (WATCH_IDS.has(event.target?.id) || event.target?.closest?.('#coverTextZonePanel')) scheduleUpdate(); }
  function install() {
    installStyles(); ensurePanel();
    if (!installed) { installed = true; document.addEventListener('input', handleChange, true); document.addEventListener('change', handleChange, true); document.addEventListener('cover-recovery-restored', scheduleUpdate); }
    update();
  }

  window.CoverSpinePrintSafety = { weightedCharacters, layerScale, evaluateSpineLayer, overlapWarnings, evaluateSpineLayers, currentSpineEntries, currentEvaluation, preflightIssue, renderEvaluation, applyRecommendedSizes, update, stage: 'multi-layer-spine-print-fit-safety' };
  for (const delay of INSTALL_DELAYS) setTimeout(install, delay);
})();
