/* production-guides-v2.js — transparent production guide overlay for print checker */
(function () {
  'use strict';
  if (window.__printCheckerProductionGuidesV2) return;
  window.__printCheckerProductionGuidesV2 = true;

  const LINE_STYLE = Object.freeze({
    work: { label: '작업사이즈 전체', stroke: '#2563eb', width: 3, dash: [] },
    trim: { label: '재단선(실제사이즈)', stroke: '#dc2626', width: 2.5, dash: [] },
    safe: { label: '안쪽 여백', stroke: '#16a34a', width: 2, dash: [10, 7] },
    fold: { label: '접는선', stroke: '#d97706', width: 2.2, dash: [14, 6, 2, 6] },
    spine: { label: '책등', stroke: '#7c3aed', width: 2.2, dash: [] },
  });

  const byId = (id) => document.getElementById(id);
  let overlay = null;
  let stack = null;
  let resizeObserver = null;
  let mutationObserver = null;
  let queued = false;

  function numberValue(id, fallback = 0) {
    const value = Number(byId(id)?.value);
    return Number.isFinite(value) ? value : fallback;
  }

  function currentProduct() {
    const state = window.PrintChecker?.getState?.();
    if (state?.product) return state.product;
    const selected = document.querySelector('.product-card.selected');
    return selected?.dataset?.product || new URL(location.href).searchParams.get('product') || 'cover';
  }

  function currentSpecs() {
    return {
      trimW: Math.max(1, numberValue('trimW', 210)),
      trimH: Math.max(1, numberValue('trimH', 297)),
      bleed: Math.max(0, numberValue('bleed', 3)),
      safeZone: Math.max(0, numberValue('safeZone', 5)),
      spine: Math.max(0, numberValue('spine', 0)),
      wingW: Math.max(0, numberValue('wingW', 0)),
      hasWing: Boolean(byId('hasWing')?.checked),
      invitationFoldType: byId('invitationFoldType')?.value || 'half',
    };
  }

  function geometry(product, specs) {
    const isCover = product === 'cover';
    const trimWidth = isCover
      ? specs.trimW * 2 + specs.spine + (specs.hasWing ? specs.wingW * 2 : 0)
      : specs.trimW;
    const trimHeight = specs.trimH;
    const workWidth = trimWidth + specs.bleed * 2;
    const workHeight = trimHeight + specs.bleed * 2;
    return { isCover, trimWidth, trimHeight, workWidth, workHeight };
  }

  function ensureStack() {
    const base = byId('previewCanvas');
    if (!base) return null;
    stack = base.closest('.preview-canvas-stack');
    if (!stack) {
      stack = document.createElement('div');
      stack.className = 'preview-canvas-stack production-guide-stack';
      base.parentNode.insertBefore(stack, base);
      stack.appendChild(base);
    }
    stack.classList.add('production-guide-stack');
    return stack;
  }

  function ensureOverlay() {
    if (!ensureStack()) return null;
    overlay = byId('productionGuideLayer');
    if (!overlay) {
      overlay = document.createElement('canvas');
      overlay.id = 'productionGuideLayer';
      overlay.setAttribute('aria-label', '인쇄 작업 안내선');
      overlay.setAttribute('aria-hidden', 'true');
      stack.appendChild(overlay);
    }
    return overlay;
  }

  function line(ctx, x1, y1, x2, y2, style) {
    ctx.save();
    ctx.strokeStyle = style.stroke;
    ctx.lineWidth = style.width;
    ctx.setLineDash(style.dash);
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();
    ctx.restore();
  }

  function rect(ctx, x, y, w, h, style) {
    if (w <= 0 || h <= 0) return;
    ctx.save();
    ctx.strokeStyle = style.stroke;
    ctx.lineWidth = style.width;
    ctx.setLineDash(style.dash);
    ctx.strokeRect(x, y, w, h);
    ctx.restore();
  }

  function label(ctx, text, x, y, options = {}) {
    ctx.save();
    const size = options.size || 19;
    ctx.font = `800 ${size}px Pretendard, "Noto Sans KR", sans-serif`;
    ctx.textBaseline = 'middle';
    const width = ctx.measureText(text).width + 18;
    const height = size + 12;
    const left = Math.max(3, Math.min(x, ctx.canvas.width - width - 3));
    const top = Math.max(3, Math.min(y - height / 2, ctx.canvas.height - height - 3));
    ctx.fillStyle = options.background || 'rgba(255,255,255,.88)';
    ctx.fillRect(left, top, width, height);
    ctx.fillStyle = options.color || '#0f172a';
    ctx.fillText(text, left + 9, top + height / 2);
    ctx.restore();
  }

  function drawCoverGuides(ctx, g, specs, trim) {
    const scaleX = trim.w / g.trimWidth;
    const scaleY = trim.h / g.trimHeight;
    const wing = specs.hasWing ? specs.wingW : 0;
    const safe = Math.min(specs.safeZone, Math.max(0, Math.min(specs.trimW, specs.trimH) / 2 - 0.5));

    const backStartMm = wing;
    const backEndMm = wing + specs.trimW;
    const spineStartMm = backEndMm;
    const spineEndMm = spineStartMm + specs.spine;
    const frontStartMm = spineEndMm;
    const frontEndMm = frontStartMm + specs.trimW;

    const mmX = (value) => trim.x + value * scaleX;
    const mmY = (value) => trim.y + value * scaleY;

    if (specs.hasWing && wing > 0) {
      line(ctx, mmX(wing), trim.y, mmX(wing), trim.y + trim.h, LINE_STYLE.fold);
      line(ctx, mmX(frontEndMm), trim.y, mmX(frontEndMm), trim.y + trim.h, LINE_STYLE.fold);
    }

    if (specs.spine > 0) {
      line(ctx, mmX(spineStartMm), trim.y, mmX(spineStartMm), trim.y + trim.h, LINE_STYLE.spine);
      line(ctx, mmX(spineEndMm), trim.y, mmX(spineEndMm), trim.y + trim.h, LINE_STYLE.spine);
      label(ctx, `책등 ${specs.spine.toFixed(1)}mm`, (mmX(spineStartMm) + mmX(spineEndMm)) / 2 - 48, trim.y + 22, { color: LINE_STYLE.spine.stroke, size: 16 });
    }

    const safeY = mmY(safe);
    const safeH = Math.max(0, (specs.trimH - safe * 2) * scaleY);
    const backX = mmX(backStartMm + safe);
    const backW = Math.max(0, (specs.trimW - safe * 2) * scaleX);
    const frontX = mmX(frontStartMm + safe);
    const frontW = Math.max(0, (specs.trimW - safe * 2) * scaleX);

    rect(ctx, backX, safeY, backW, safeH, LINE_STYLE.safe);
    rect(ctx, frontX, safeY, frontW, safeH, LINE_STYLE.safe);
    label(ctx, '뒷면 안쪽 여백', backX + 8, safeY + 18, { color: LINE_STYLE.safe.stroke, size: 15 });
    label(ctx, '앞면 안쪽 여백', frontX + 8, safeY + 18, { color: LINE_STYLE.safe.stroke, size: 15 });
  }

  function drawInvitationFolds(ctx, specs, trim) {
    const type = specs.invitationFoldType || 'half';
    if (type === 'none') return;
    const landscape = specs.trimW >= specs.trimH;
    const positions = type === 'half' ? [0.5] : [1 / 3, 2 / 3];
    positions.forEach((ratio, index) => {
      if (landscape) {
        const x = trim.x + trim.w * ratio;
        line(ctx, x, trim.y, x, trim.y + trim.h, LINE_STYLE.fold);
        label(ctx, `접는선${positions.length > 1 ? ` ${index + 1}` : ''}`, x + 7, trim.y + 24, { color: LINE_STYLE.fold.stroke, size: 15 });
      } else {
        const y = trim.y + trim.h * ratio;
        line(ctx, trim.x, y, trim.x + trim.w, y, LINE_STYLE.fold);
        label(ctx, `접는선${positions.length > 1 ? ` ${index + 1}` : ''}`, trim.x + 8, y - 18, { color: LINE_STYLE.fold.stroke, size: 15 });
      }
    });
  }

  function drawStandardSafe(ctx, specs, trim, g) {
    const scaleX = trim.w / g.trimWidth;
    const scaleY = trim.h / g.trimHeight;
    const safe = Math.min(specs.safeZone, Math.max(0, Math.min(specs.trimW, specs.trimH) / 2 - 0.5));
    rect(
      ctx,
      trim.x + safe * scaleX,
      trim.y + safe * scaleY,
      Math.max(0, trim.w - safe * scaleX * 2),
      Math.max(0, trim.h - safe * scaleY * 2),
      LINE_STYLE.safe
    );
  }

  function syncFileLayer(g) {
    const layer = byId('previewFileLayer');
    if (!layer) return;
    const hasBleed = Boolean(byId('fileHasBleed')?.checked);
    if (hasBleed || g.workWidth <= 0 || g.workHeight <= 0) {
      layer.style.left = '0';
      layer.style.top = '0';
      layer.style.width = '100%';
      layer.style.height = '100%';
      layer.style.right = 'auto';
      layer.style.bottom = 'auto';
      return;
    }
    const specs = currentSpecs();
    layer.style.left = `${(specs.bleed / g.workWidth) * 100}%`;
    layer.style.top = `${(specs.bleed / g.workHeight) * 100}%`;
    layer.style.width = `${(g.trimWidth / g.workWidth) * 100}%`;
    layer.style.height = `${(g.trimHeight / g.workHeight) * 100}%`;
    layer.style.right = 'auto';
    layer.style.bottom = 'auto';
  }

  function render() {
    queued = false;
    const canvas = ensureOverlay();
    if (!canvas || !stack) return;

    const product = currentProduct();
    const specs = currentSpecs();
    const g = geometry(product, specs);
    if (!g.workWidth || !g.workHeight) return;

    stack.style.setProperty('--pc-work-ratio', `${g.workWidth} / ${g.workHeight}`);
    stack.dataset.productionProduct = product;

    const cssWidth = Math.max(320, Math.round(stack.getBoundingClientRect().width || 900));
    const internalWidth = Math.min(2200, Math.max(900, cssWidth * 2));
    const internalHeight = Math.max(300, Math.round(internalWidth * g.workHeight / g.workWidth));
    if (canvas.width !== internalWidth) canvas.width = internalWidth;
    if (canvas.height !== internalHeight) canvas.height = internalHeight;

    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const pad = 8;
    const work = { x: pad, y: pad, w: canvas.width - pad * 2, h: canvas.height - pad * 2 };
    const scaleX = work.w / g.workWidth;
    const scaleY = work.h / g.workHeight;
    const trim = {
      x: work.x + specs.bleed * scaleX,
      y: work.y + specs.bleed * scaleY,
      w: g.trimWidth * scaleX,
      h: g.trimHeight * scaleY,
    };

    rect(ctx, work.x, work.y, work.w, work.h, LINE_STYLE.work);
    rect(ctx, trim.x, trim.y, trim.w, trim.h, LINE_STYLE.trim);

    if (g.isCover) drawCoverGuides(ctx, g, specs, trim);
    else drawStandardSafe(ctx, specs, trim, g);

    if (product === 'invitation') drawInvitationFolds(ctx, specs, trim);

    syncFileLayer(g);
    document.documentElement.dataset.printCheckerProductionGuides = 'v2-transparent-production-overlay';
  }

  function injectInvitationFoldControl() {
    if (currentProduct() !== 'invitation') return false;
    const form = byId('specForm');
    if (!form || byId('invitationFoldType')) return false;
    const safeField = byId('safeZone')?.closest('.spec-field');
    if (!safeField) return false;
    const wrap = document.createElement('div');
    wrap.className = 'spec-field invitation-fold-field';
    wrap.innerHTML = '<label class="spec-label" for="invitationFoldType">접는선<small class="spec-hint">초대장·안내장의 완성 접지 위치를 표시합니다.</small></label><select class="spec-input" id="invitationFoldType"><option value="half">반접기 · 가운데 1줄</option><option value="tri_z">3단 Z접기 · 2줄</option><option value="tri_roll">3단 말아접기 · 2줄</option><option value="none">접지 없음</option></select>';
    safeField.insertAdjacentElement('afterend', wrap);
    return true;
  }

  function queueRender() {
    if (queued) return;
    queued = true;
    requestAnimationFrame(() => {
      injectInvitationFoldControl();
      render();
    });
  }

  function bind() {
    ensureOverlay();
    injectInvitationFoldControl();
    render();

    document.addEventListener('input', (event) => {
      if (event.target?.closest?.('#specForm,#adjPanel')) queueRender();
    }, true);
    document.addEventListener('change', (event) => {
      if (event.target?.closest?.('#specForm,#adjPanel')) queueRender();
    }, true);
    document.addEventListener('click', (event) => {
      if (event.target?.closest?.('.product-card,#resetBtn,.side-btn')) setTimeout(queueRender, 0);
    }, true);
    window.addEventListener('programstudio:print-checker-file-rendered', queueRender);

    if (typeof ResizeObserver === 'function') {
      resizeObserver = new ResizeObserver(queueRender);
      resizeObserver.observe(stack);
    }
    const form = byId('specForm');
    if (form && typeof MutationObserver === 'function') {
      mutationObserver = new MutationObserver(queueRender);
      mutationObserver.observe(form, { childList: true, subtree: true });
    }
  }

  window.PrintCheckerProductionGuides = Object.freeze({
    render,
    geometry,
    drawCoverGuides,
    drawInvitationFolds,
    lineStyle: LINE_STYLE,
    stage: 'v2-transparent-production-overlay',
  });

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', bind, { once: true });
  else bind();
})();
