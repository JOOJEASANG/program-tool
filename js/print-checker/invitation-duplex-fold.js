/* invitation-duplex-fold.js — invitation/notice duplex preview and variable fold position */
(function () {
  'use strict';
  if (window.__printCheckerInvitationDuplexFoldV1) return;
  window.__printCheckerInvitationDuplexFoldV1 = true;

  const $ = (id) => document.getElementById(id);
  const GUIDE = Object.freeze({
    work: { stroke: '#2563eb', width: 1.2, dash: [4, 4] },
    trim: { stroke: '#dc2626', width: 1.2, dash: [4, 4] },
    safe: { stroke: '#16a34a', width: 1.2, dash: [4, 4] },
    fold: { stroke: '#d97706', width: 1.2, dash: [4, 4] },
  });
  const settings = { type: 'half', direction: 'auto', position: '' };
  let queued = false;
  let observer = null;

  function currentProduct() {
    return window.PrintChecker?.getState?.()?.product
      || document.querySelector('.product-card.selected')?.dataset?.product
      || new URL(location.href).searchParams.get('product')
      || 'cover';
  }

  function numberValue(id, fallback = 0) {
    const value = Number($(id)?.value);
    return Number.isFinite(value) ? value : fallback;
  }

  function specs() {
    return {
      trimW: Math.max(1, numberValue('trimW', 148)),
      trimH: Math.max(1, numberValue('trimH', 210)),
      bleed: Math.max(0, numberValue('bleed', 3)),
      safe: Math.max(0, numberValue('safeZone', 10)),
    };
  }

  function resolvedFold(current = specs()) {
    const type = $('invitationFoldType')?.value || settings.type || 'half';
    if (type === 'none') return { type: 'none', direction: 'none', position: 0, axis: 0, ratio: 0 };

    let direction = $('invitationFoldDirection')?.value || settings.direction || 'auto';
    if (direction === 'auto') direction = current.trimW >= current.trimH ? 'vertical' : 'horizontal';
    const axis = direction === 'vertical' ? current.trimW : current.trimH;
    const raw = Number($('invitationFoldPosition')?.value);
    const position = Number.isFinite(raw) && raw > 0
      ? Math.min(Math.max(raw, 0.1), Math.max(0.1, axis - 0.1))
      : axis / 2;
    return { type: 'half', direction, position, axis, ratio: axis > 0 ? position / axis : 0.5 };
  }

  function installStyles() {
    if ($('invitationDuplexFoldStyle')) return;
    const style = document.createElement('style');
    style.id = 'invitationDuplexFoldStyle';
    style.textContent = `
      .invitation-fold-field .invitation-fold-grid{display:grid;grid-template-columns:1fr 1fr;gap:7px;margin-top:7px}
      .invitation-fold-field .invitation-fold-position{grid-column:1/-1}
      .invitation-fold-field .invitation-fold-sub{display:block;margin:5px 0 0;font-size:9px;line-height:1.5;color:#64748b;font-weight:650}
      .invitation-fold-field[data-fold-disabled="1"] .invitation-fold-grid{display:none}
      .invitation-duplex-note{margin-top:7px;padding:7px 9px;border:1px solid #bfdbfe;border-radius:8px;background:#eff6ff;color:#1e3a8a;font-size:9.5px;font-weight:750;line-height:1.5}
      @media(max-width:520px){.invitation-fold-field .invitation-fold-grid{grid-template-columns:1fr}}
    `;
    document.head.appendChild(style);
  }

  function rememberControls() {
    const type = $('invitationFoldType')?.value;
    const direction = $('invitationFoldDirection')?.value;
    const position = $('invitationFoldPosition')?.value;
    if (type) settings.type = type;
    if (direction) settings.direction = direction;
    if (position !== undefined) settings.position = position;
  }

  function updateControlHint() {
    const wrap = document.querySelector('.invitation-fold-field[data-variable-fold="1"]');
    if (!wrap) return;
    const type = $('invitationFoldType')?.value || 'half';
    wrap.dataset.foldDisabled = type === 'none' ? '1' : '0';
    const current = specs();
    const directionValue = $('invitationFoldDirection')?.value || 'auto';
    const resolved = resolvedFold(current);
    const input = $('invitationFoldPosition');
    if (input) {
      input.max = String(Math.max(0.1, resolved.axis - 0.1));
      input.placeholder = (resolved.axis / 2).toFixed(1);
      input.setAttribute('aria-label', resolved.direction === 'vertical' ? '왼쪽에서 접는선 위치' : '위쪽에서 접는선 위치');
    }
    const hint = $('invitationFoldPositionHint');
    if (hint && type !== 'none') {
      const basis = resolved.direction === 'vertical' ? '왼쪽' : '위쪽';
      const autoText = directionValue === 'auto' ? ' · 방향 자동' : '';
      hint.textContent = `${basis}에서 ${resolved.position.toFixed(1)}mm 위치${autoText} · 위치를 비우면 정중앙`;
    }
  }

  function ensureControls() {
    if (currentProduct() !== 'invitation') return false;
    const form = $('specForm');
    const safeField = $('safeZone')?.closest('.spec-field');
    if (!form || !safeField) return false;

    let wrap = form.querySelector('.invitation-fold-field');
    if (!wrap) {
      wrap = document.createElement('div');
      wrap.className = 'spec-field invitation-fold-field';
      safeField.insertAdjacentElement('afterend', wrap);
    }
    if (wrap.dataset.variableFold !== '1') {
      const previousType = $('invitationFoldType')?.value || settings.type;
      wrap.dataset.variableFold = '1';
      wrap.innerHTML = `
        <label class="spec-label" for="invitationFoldType">접는선<small class="spec-hint">초대장·안내장의 실제 접지 방향과 위치를 지정합니다.</small></label>
        <select class="spec-input" id="invitationFoldType">
          <option value="half">접지 있음 · 1줄</option>
          <option value="none">접지 없음</option>
        </select>
        <div class="invitation-fold-grid">
          <select class="spec-input" id="invitationFoldDirection" aria-label="접는선 방향">
            <option value="auto">방향 자동</option>
            <option value="vertical">세로 접지선</option>
            <option value="horizontal">가로 접지선</option>
          </select>
          <div class="spec-input-row invitation-fold-position">
            <input class="spec-input" id="invitationFoldPosition" type="number" min="0.1" step="0.1" inputmode="decimal">
            <span class="spec-unit">mm</span>
          </div>
        </div>
        <small class="invitation-fold-sub" id="invitationFoldPositionHint"></small>
        <div class="invitation-duplex-note">앞·뒷면 파일은 2페이지 PDF로 올리면 1p=앞면, 2p=뒷면을 각각 전환해 확인할 수 있습니다.</div>`;
      $('invitationFoldType').value = previousType || 'half';
      $('invitationFoldDirection').value = settings.direction || 'auto';
      $('invitationFoldPosition').value = settings.position || '';
    }
    updateControlHint();
    return true;
  }

  function decorateInvitationUi() {
    const invitationCard = document.querySelector('.product-card[data-product="invitation"]');
    const desc = invitationCard?.querySelector('.pc-desc');
    if (desc) desc.textContent = '앞면·뒷면 · 접지 위치 확인';

    const invitation = currentProduct() === 'invitation';
    const uploadSub = document.querySelector('#uploadZone .upload-sub');
    if (uploadSub) {
      uploadSub.innerHTML = invitation
        ? 'PDF·PNG·JPEG·WEBP<br>앞·뒷면은 2페이지 PDF 권장'
        : 'PDF·PNG·JPEG·WEBP<br>클릭하거나 끌어다 놓으세요';
    }
    const sideLabel = document.querySelector('#sideSelectRow .side-label');
    if (sideLabel) sideLabel.textContent = invitation ? '초대장 앞·뒷면' : 'PDF 면 선택';

    if (invitation) {
      const state = window.PrintChecker?.getState?.();
      if ((state?.pdfPageCount || 0) >= 2 && $('sideSelectRow')) $('sideSelectRow').hidden = false;
    }
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

  function label(ctx, text, x, y) {
    ctx.save();
    ctx.font = '800 15px Pretendard, "Noto Sans KR", sans-serif';
    ctx.textBaseline = 'middle';
    const width = ctx.measureText(text).width + 18;
    const height = 27;
    const left = Math.max(3, Math.min(x, ctx.canvas.width - width - 3));
    const top = Math.max(3, Math.min(y - height / 2, ctx.canvas.height - height - 3));
    ctx.fillStyle = 'rgba(255,247,237,.96)';
    ctx.fillRect(left, top, width, height);
    ctx.fillStyle = GUIDE.fold.stroke;
    ctx.fillText(text, left + 9, top + height / 2);
    ctx.restore();
  }

  function drawInvitationGuides() {
    if (currentProduct() !== 'invitation') return false;
    const canvas = $('productionGuideLayer');
    const stack = $('previewCanvas')?.closest('.preview-canvas-stack');
    if (!canvas || !stack) return false;

    const current = specs();
    const workW = current.trimW + current.bleed * 2;
    const workH = current.trimH + current.bleed * 2;
    if (workW <= 0 || workH <= 0) return false;

    stack.style.setProperty('--pc-work-ratio', `${workW} / ${workH}`);
    stack.dataset.productionProduct = 'invitation';
    const cssWidth = Math.max(320, Math.round(stack.getBoundingClientRect().width || 900));
    const internalWidth = Math.min(2200, Math.max(900, cssWidth * 2));
    const internalHeight = Math.max(300, Math.round(internalWidth * workH / workW));
    if (canvas.width !== internalWidth) canvas.width = internalWidth;
    if (canvas.height !== internalHeight) canvas.height = internalHeight;

    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    const pad = 8;
    const work = { x: pad, y: pad, w: canvas.width - pad * 2, h: canvas.height - pad * 2 };
    const scaleX = work.w / workW;
    const scaleY = work.h / workH;
    const trim = {
      x: work.x + current.bleed * scaleX,
      y: work.y + current.bleed * scaleY,
      w: current.trimW * scaleX,
      h: current.trimH * scaleY,
    };
    rect(ctx, work.x, work.y, work.w, work.h, GUIDE.work);
    rect(ctx, trim.x, trim.y, trim.w, trim.h, GUIDE.trim);

    const fold = resolvedFold(current);
    const panels = [];
    if (fold.type === 'none') {
      panels.push({ x: trim.x, y: trim.y, w: trim.w, h: trim.h });
    } else if (fold.direction === 'vertical') {
      const split = trim.w * fold.ratio;
      panels.push(
        { x: trim.x, y: trim.y, w: split, h: trim.h },
        { x: trim.x + split, y: trim.y, w: trim.w - split, h: trim.h },
      );
      const x = trim.x + split;
      line(ctx, x, trim.y, x, trim.y + trim.h, GUIDE.fold);
      label(ctx, `접는선 · 왼쪽 ${fold.position.toFixed(1)}mm`, x + 9, trim.y + 26);
    } else {
      const split = trim.h * fold.ratio;
      panels.push(
        { x: trim.x, y: trim.y, w: trim.w, h: split },
        { x: trim.x, y: trim.y + split, w: trim.w, h: trim.h - split },
      );
      const y = trim.y + split;
      line(ctx, trim.x, y, trim.x + trim.w, y, GUIDE.fold);
      label(ctx, `접는선 · 위쪽 ${fold.position.toFixed(1)}mm`, trim.x + 9, y - 20);
    }

    const safeX = current.safe * scaleX;
    const safeY = current.safe * scaleY;
    panels.forEach((panel) => {
      const insetX = Math.min(safeX, Math.max(0, panel.w / 2 - 1));
      const insetY = Math.min(safeY, Math.max(0, panel.h / 2 - 1));
      rect(ctx, panel.x + insetX, panel.y + insetY, Math.max(0, panel.w - insetX * 2), Math.max(0, panel.h - insetY * 2), GUIDE.safe);
    });

    document.documentElement.dataset.printCheckerInvitationGuides = 'v1-duplex-variable-fold';
    return true;
  }

  function syncDuplexReport() {
    const existing = $('invitationDuplexReportCard');
    if (currentProduct() !== 'invitation') {
      existing?.remove();
      return;
    }
    const report = $('reportSection');
    const grid = $('reportGrid');
    if (!report || report.hidden || !grid) return;
    const state = window.PrintChecker?.getState?.() || {};
    const pages = Number(state.pdfPageCount || 0);
    const status = pages >= 2 ? 'pass' : pages === 1 ? 'warn' : 'info';
    const detail = pages >= 2 ? '앞면 1p · 뒷면 2p' : pages === 1 ? '1페이지 PDF' : '파일 확인 전';
    const guide = pages >= 2
      ? '앞면과 뒷면을 각각 전환해 규격·안전영역·접는선을 확인할 수 있습니다.'
      : pages === 1
        ? '양면 초대장·안내장은 앞면과 뒷면을 2페이지 PDF로 준비하면 두 면을 모두 확인할 수 있습니다.'
        : '2페이지 PDF를 올리면 앞면과 뒷면을 각각 확인합니다.';
    const card = existing || document.createElement('div');
    card.id = 'invitationDuplexReportCard';
    card.className = `report-card status-${status}`;
    card.innerHTML = `<div class="rc-head"><span class="rc-icon">${status === 'pass' ? '✅' : status === 'warn' ? '⚠️' : 'ℹ️'}</span><strong class="rc-label">초대장·안내장 앞·뒷면</strong></div><div class="rc-detail">${detail}</div><div class="rc-guide">${guide}</div>`;
    if (!existing) grid.prepend(card);
  }

  function queue() {
    if (queued) return;
    queued = true;
    requestAnimationFrame(() => requestAnimationFrame(() => {
      queued = false;
      ensureControls();
      decorateInvitationUi();
      updateControlHint();
      drawInvitationGuides();
      syncDuplexReport();
    }));
  }

  function bind() {
    installStyles();
    ensureControls();
    decorateInvitationUi();
    queue();

    document.addEventListener('input', (event) => {
      if (!event.target?.closest?.('#specForm,#adjPanel')) return;
      rememberControls();
      queue();
    }, true);
    document.addEventListener('change', (event) => {
      if (!event.target?.closest?.('#specForm,#adjPanel')) return;
      rememberControls();
      queue();
    }, true);
    document.addEventListener('click', (event) => {
      if (event.target?.closest?.('.product-card,#resetBtn,.side-btn,#runBtn')) setTimeout(queue, 0);
    }, true);
    window.addEventListener('programstudio:print-checker-file-rendered', queue);
    window.addEventListener('programstudio:print-checker-product-stable', queue);
    window.addEventListener('programstudio:print-checker-zoom-changed', queue);

    const form = $('specForm');
    if (form && typeof MutationObserver === 'function') {
      observer = new MutationObserver(queue);
      observer.observe(form, { childList: true, subtree: true });
    }
  }

  window.PrintCheckerInvitationDuplexFold = Object.freeze({
    currentProduct,
    resolvedFold,
    ensureControls,
    drawInvitationGuides,
    syncDuplexReport,
    stage: 'v1-duplex-variable-fold',
  });

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', bind, { once: true });
  else bind();
})();
