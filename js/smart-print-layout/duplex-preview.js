(() => {
  'use strict';
  if (window.__smartPrintDuplexPreviewV1) return;
  window.__smartPrintDuplexPreviewV1 = true;

  const $ = id => document.getElementById(id);
  const FONT_PREVIEW = {
    korean: '"Malgun Gothic","Apple SD Gothic Neo","Noto Sans KR",Arial,sans-serif',
    helvetica: 'Arial, Helvetica, sans-serif',
    'helvetica-bold': 'Arial, Helvetica, sans-serif',
    'helvetica-oblique': 'Arial, Helvetica, sans-serif',
    'helvetica-bold-oblique': 'Arial, Helvetica, sans-serif',
    times: '"Times New Roman", Times, serif',
    'times-bold': '"Times New Roman", Times, serif',
    'times-italic': '"Times New Roman", Times, serif',
    'times-bold-italic': '"Times New Roman", Times, serif',
    courier: '"Courier New", Courier, monospace',
    'courier-bold': '"Courier New", Courier, monospace',
    'courier-oblique': '"Courier New", Courier, monospace',
    'courier-bold-oblique': '"Courier New", Courier, monospace',
  };
  let frame = 0;
  let fileObserver = null;
  let recalculatePatched = false;

  const round1 = value => Math.round(Number(value || 0) * 10) / 10;
  const isImageItem = item => item?.sourceType === 'image' || item?.file?.__sourceType === 'image';

  function injectStyles() {
    if ($('smartDuplexPreviewStyles')) return;
    const style = document.createElement('style');
    style.id = 'smartDuplexPreviewStyles';
    style.textContent = `
      #layoutCanvasBack{display:none;background:#fff;box-shadow:0 8px 28px rgba(15,23,42,.16);max-width:100%;max-height:calc(100vh - 177px)}
      .canvas-shell.duplex-preview-active{display:flex;align-items:center;justify-content:center;gap:28px;flex-wrap:nowrap;padding-top:42px}
      .canvas-shell.duplex-preview-active #layoutCanvas,.canvas-shell.duplex-preview-active #layoutCanvasBack{display:block;flex:0 0 auto;max-width:calc(50% - 18px);max-height:calc(100vh - 195px)}
      .duplex-face-label{position:absolute;z-index:8;display:none;padding:4px 9px;border-radius:999px;background:rgba(15,118,110,.94);color:#fff;font:900 9px/1 Pretendard,sans-serif;letter-spacing:.2px;pointer-events:none;box-shadow:0 2px 8px rgba(15,23,42,.14)}
      .canvas-shell.duplex-preview-active .duplex-face-label{display:block}
      #duplexBackOverlay{position:absolute;z-index:6;pointer-events:none;overflow:hidden;display:none}
      .canvas-shell.duplex-preview-active #duplexBackOverlay{display:block}
      .preview-controls.duplex-preview-mode .side-btn,.preview-controls.duplex-preview-mode .divider{display:none!important}
      .preview-controls.duplex-preview-mode::after{content:'앞·뒤 동시 미리보기';font-size:9px;font-weight:850;color:#0f766e;padding:0 7px;white-space:nowrap}
      @media(max-width:1100px){.canvas-shell.duplex-preview-active{gap:16px;padding-left:16px;padding-right:16px}.canvas-shell.duplex-preview-active #layoutCanvas,.canvas-shell.duplex-preview-active #layoutCanvasBack{max-width:calc(50% - 10px)}}
      @media(max-width:700px){.canvas-shell.duplex-preview-active{gap:10px;padding:38px 8px 16px}.duplex-face-label{font-size:8px;padding:3px 7px}.preview-controls.duplex-preview-mode::after{width:100%;text-align:center;padding-top:2px}}
    `;
    document.head.appendChild(style);
  }

  function ensureElements() {
    const shell = $('canvasShell');
    const front = $('layoutCanvas');
    const empty = $('emptyPreview');
    if (!shell || !front) return null;
    let back = $('layoutCanvasBack');
    if (!back) {
      back = document.createElement('canvas');
      back.id = 'layoutCanvasBack';
      back.setAttribute('aria-label', '스마트 인쇄배치 뒷면 미리보기');
      shell.insertBefore(back, empty || null);
    }
    let frontLabel = $('duplexFrontLabel');
    if (!frontLabel) {
      frontLabel = document.createElement('span');
      frontLabel.id = 'duplexFrontLabel';
      frontLabel.className = 'duplex-face-label';
      frontLabel.textContent = '앞면';
      shell.appendChild(frontLabel);
    }
    let backLabel = $('duplexBackLabel');
    if (!backLabel) {
      backLabel = document.createElement('span');
      backLabel.id = 'duplexBackLabel';
      backLabel.className = 'duplex-face-label';
      backLabel.textContent = '뒷면';
      shell.appendChild(backLabel);
    }
    let overlay = $('duplexBackOverlay');
    if (!overlay) {
      overlay = document.createElement('div');
      overlay.id = 'duplexBackOverlay';
      overlay.className = 'numbering-preview-overlay';
      shell.appendChild(overlay);
    }
    return { shell, front, back, empty, frontLabel, backLabel, overlay };
  }

  function mirrorBack(placement, cfg) {
    const portrait = cfg.paperH >= cfg.paperW;
    const mirrorX = (cfg.flipEdge === 'long' && portrait) || (cfg.flipEdge === 'short' && !portrait);
    return mirrorX
      ? { ...placement, x: cfg.paperW - placement.x - placement.width }
      : { ...placement, y: cfg.paperH - placement.y - placement.height };
  }

  function canvasSize(cfg, shell) {
    const shellWidth = Math.max(360, shell.clientWidth || 820);
    const availableWidth = Math.max(320, shellWidth - 84);
    const perSideWidth = Math.max(150, (availableWidth - 28) / 2);
    const maxCssW = Math.min(690, perSideWidth);
    const maxCssH = Math.max(300, Math.min(720, window.innerHeight - 260));
    const scale = Math.min(maxCssW / cfg.paperW, maxCssH / cfg.paperH);
    return {
      cssW: Math.max(150, Math.round(cfg.paperW * scale)),
      cssH: Math.max(190, Math.round(cfg.paperH * scale)),
    };
  }

  function drawSide(canvas, side, size) {
    const api = window.SmartPrintLayout;
    const plan = api?.state?.plan;
    if (!canvas || !plan?.cfg || !plan.sheets?.length) return;
    const { cssW, cssH } = size;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    canvas.width = Math.round(cssW * dpr);
    canvas.height = Math.round(cssH * dpr);
    canvas.style.width = `${cssW}px`;
    canvas.style.height = `${cssH}px`;
    canvas.style.display = 'block';
    const ctx = canvas.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, cssW, cssH);
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, cssW, cssH);
    const mmScale = cssW / plan.cfg.paperW;
    const sheet = plan.sheets[api.state.sheetIndex || 0] || [];
    sheet.forEach(frontPlacement => {
      const placement = side === 'back' ? mirrorBack(frontPlacement, plan.cfg) : frontPlacement;
      const item = api.state.items?.[frontPlacement.fileIndex];
      if (!item) return;
      const thumb = side === 'back' ? item.backThumb : item.frontThumb;
      const x = placement.x * mmScale;
      const y = placement.y * mmScale;
      const w = placement.width * mmScale;
      const h = placement.height * mmScale;
      ctx.save();
      ctx.beginPath();
      ctx.rect(x, y, w, h);
      ctx.clip();
      if (thumb) {
        if (placement.rotated) {
          ctx.translate(x + w / 2, y + h / 2);
          ctx.rotate(Math.PI / 2);
          ctx.drawImage(thumb, -h / 2, -w / 2, h, w);
        } else {
          ctx.drawImage(thumb, x, y, w, h);
        }
      } else {
        ctx.fillStyle = '#f8fafc';
        ctx.fillRect(x, y, w, h);
        ctx.fillStyle = '#94a3b8';
        ctx.font = '700 10px Pretendard';
        ctx.textAlign = 'center';
        ctx.fillText('뒷면 없음', x + w / 2, y + h / 2);
      }
      ctx.restore();
      ctx.strokeStyle = '#0f766e';
      ctx.lineWidth = 1;
      ctx.strokeRect(x, y, w, h);
      const label = `${frontPlacement.fileIndex + 1}-${frontPlacement.copyIndex + 1}`;
      ctx.fillStyle = 'rgba(15,118,110,.88)';
      ctx.fillRect(x + 2, y + 2, Math.min(44, Math.max(0, w - 4)), 14);
      ctx.fillStyle = '#fff';
      ctx.font = '800 8px Pretendard';
      ctx.textAlign = 'left';
      ctx.fillText(label, x + 5, y + 12);
    });
    ctx.strokeStyle = '#94a3b8';
    ctx.lineWidth = 1;
    ctx.strokeRect(.5, .5, cssW - 1, cssH - 1);
  }

  function addMarginMask(overlay, left, top, width, height) {
    if (width <= 0 || height <= 0) return;
    const mask = document.createElement('span');
    mask.className = 'image-margin-preview';
    mask.style.left = `${left}px`;
    mask.style.top = `${top}px`;
    mask.style.width = `${width}px`;
    mask.style.height = `${height}px`;
    overlay.appendChild(mask);
  }

  function drawTrimGuide(overlay, placement, item, scale, config) {
    const target = isImageItem(item) ? item.__smartTargetSize : null;
    const trimWidthSource = Number(target?.trimWidthMm || (config.enabled ? config.widthMm : 0));
    const trimHeightSource = Number(target?.trimHeightMm || (config.enabled ? config.heightMm : 0));
    if (!(trimWidthSource >= 2 && trimHeightSource >= 2)) return;
    const sourceWidth = Number(item?.widthMm || placement.width);
    const sourceHeight = Number(item?.heightMm || placement.height);
    const sourceDisplayWidth = placement.rotated ? sourceHeight : sourceWidth;
    const sourceDisplayHeight = placement.rotated ? sourceWidth : sourceHeight;
    const trimDisplayWidth = placement.rotated ? trimHeightSource : trimWidthSource;
    const trimDisplayHeight = placement.rotated ? trimWidthSource : trimHeightSource;
    const guideWidthMm = trimDisplayWidth * placement.width / Math.max(.001, sourceDisplayWidth);
    const guideHeightMm = trimDisplayHeight * placement.height / Math.max(.001, sourceDisplayHeight);
    const left = (placement.x + (placement.width - guideWidthMm) / 2) * scale;
    const top = (placement.y + (placement.height - guideHeightMm) / 2) * scale;
    const width = guideWidthMm * scale;
    const height = guideHeightMm * scale;
    if (target?.marginMm > 0) {
      const px = placement.x * scale;
      const py = placement.y * scale;
      const pw = placement.width * scale;
      const ph = placement.height * scale;
      addMarginMask(overlay, px, py, pw, Math.max(0, top - py));
      addMarginMask(overlay, px, top + height, pw, Math.max(0, py + ph - top - height));
      addMarginMask(overlay, px, top, Math.max(0, left - px), height);
      addMarginMask(overlay, left + width, top, Math.max(0, px + pw - left - width), height);
    }
    const guide = document.createElement('span');
    guide.className = 'trim-guide-preview';
    if (trimDisplayWidth > sourceDisplayWidth + .2 || trimDisplayHeight > sourceDisplayHeight + .2) guide.classList.add('is-over');
    guide.style.left = `${left}px`;
    guide.style.top = `${top}px`;
    guide.style.width = `${width}px`;
    guide.style.height = `${height}px`;
    const label = document.createElement('span');
    label.className = 'trim-guide-label';
    label.textContent = `재단 ${round1(trimWidthSource)}×${round1(trimHeightSource)}mm`;
    guide.appendChild(label);
    overlay.appendChild(guide);
  }

  function formatNumber(value, config) {
    let number;
    if (config.format === 'plain') number = String(value);
    else if (config.format === 'no-pad3') number = `NO.${String(value).padStart(3, '0')}`;
    else number = String(value).padStart(3, '0');
    const prefix = String(config.prefix || '').trim();
    return prefix ? `${prefix}${number}` : number;
  }

  function applyNumberPosition(element, placement, scale, config) {
    const position = config.position || 'bottom-right';
    const inset = 1.6 * scale;
    const dx = Number(config.offset_x_mm || 0) * scale;
    const dy = Number(config.offset_y_mm || 0) * scale;
    const left = placement.x * scale;
    const top = placement.y * scale;
    const width = placement.width * scale;
    const height = placement.height * scale;
    if (position === 'top-left') {
      element.style.left = `${left + inset + dx}px`; element.style.top = `${top + inset + dy}px`;
    } else if (position === 'top-center') {
      element.style.left = `${left + width / 2 + dx}px`; element.style.top = `${top + inset + dy}px`; element.style.transform = 'translateX(-50%)';
    } else if (position === 'top-right') {
      element.style.left = `${left + width - inset + dx}px`; element.style.top = `${top + inset + dy}px`; element.style.transform = 'translateX(-100%)';
    } else if (position === 'bottom-left') {
      element.style.left = `${left + inset + dx}px`; element.style.top = `${top + height - inset + dy}px`; element.style.transform = 'translateY(-100%)';
    } else if (position === 'bottom-center') {
      element.style.left = `${left + width / 2 + dx}px`; element.style.top = `${top + height - inset + dy}px`; element.style.transform = 'translate(-50%,-100%)';
    } else {
      element.style.left = `${left + width - inset + dx}px`; element.style.top = `${top + height - inset + dy}px`; element.style.transform = 'translate(-100%,-100%)';
    }
  }

  function drawNumberLabel(overlay, placement, scale, value, config) {
    const targetSide = config.target_side || 'both';
    if (targetSide !== 'both' && targetSide !== 'back') return;
    const element = document.createElement('span');
    element.className = 'numbering-preview-label';
    if (config.transparent_background) element.classList.add('is-transparent');
    element.textContent = formatNumber(value, config);
    const fontPx = Math.max(7, Number(config.font_size_pt || 9) * 25.4 / 72 * scale);
    element.style.fontSize = `${fontPx}px`;
    element.style.fontFamily = FONT_PREVIEW[config.font] || FONT_PREVIEW['helvetica-bold'];
    element.style.fontWeight = String(config.font || '').includes('bold') ? '700' : '400';
    element.style.fontStyle = /italic|oblique/.test(String(config.font || '')) ? 'italic' : 'normal';
    applyNumberPosition(element, placement, scale, config);
    overlay.appendChild(element);
  }

  function syncBackOverlay(elements) {
    const api = window.SmartPrintLayout;
    const plan = api?.state?.plan;
    const overlay = elements.overlay;
    overlay.replaceChildren();
    if (!plan?.duplex || !plan.sheets?.length || elements.back.style.display === 'none') {
      overlay.style.display = 'none';
      return;
    }
    overlay.style.display = 'block';
    overlay.style.left = `${elements.back.offsetLeft}px`;
    overlay.style.top = `${elements.back.offsetTop}px`;
    overlay.style.width = `${elements.back.clientWidth}px`;
    overlay.style.height = `${elements.back.clientHeight}px`;
    const scale = elements.back.clientWidth / plan.cfg.paperW;
    const sheetIndex = api.state.sheetIndex || 0;
    const sheet = plan.sheets[sheetIndex] || [];
    const sequenceOffset = plan.sheets.slice(0, sheetIndex).reduce((sum, entries) => sum + entries.length, 0);
    const numbering = window.SmartPrintLayoutEnhancements?.numberingConfig?.() || { enabled: false };
    const trim = window.SmartPrintLayoutEnhancements?.trimGuideConfig?.() || { enabled: false };
    const hasImageTrim = (api.state.items || []).some(item => isImageItem(item) && item.__smartTargetSize);
    if (!numbering.enabled && !trim.enabled && !hasImageTrim) {
      overlay.style.display = 'none';
      return;
    }
    sheet.forEach((frontPlacement, index) => {
      const placement = mirrorBack(frontPlacement, plan.cfg);
      const item = api.state.items?.[frontPlacement.fileIndex];
      if (item) drawTrimGuide(overlay, placement, item, scale, trim);
      const value = Number(numbering.start || 1) + sequenceOffset + index;
      if (numbering.enabled && (numbering.end == null || value <= numbering.end)) {
        drawNumberLabel(overlay, placement, scale, value, numbering);
      }
    });
  }

  function positionFaceLabels(elements) {
    const topOffset = 25;
    elements.frontLabel.style.left = `${elements.front.offsetLeft + Math.max(0, elements.front.clientWidth / 2 - 22)}px`;
    elements.frontLabel.style.top = `${Math.max(6, elements.front.offsetTop - topOffset)}px`;
    elements.backLabel.style.left = `${elements.back.offsetLeft + Math.max(0, elements.back.clientWidth / 2 - 22)}px`;
    elements.backLabel.style.top = `${Math.max(6, elements.back.offsetTop - topOffset)}px`;
  }

  function setControlsDuplex(duplex) {
    const controls = document.querySelector('.preview-controls');
    controls?.classList.toggle('duplex-preview-mode', duplex);
  }

  function disableDualMode(elements) {
    elements.shell.classList.remove('duplex-preview-active');
    elements.back.style.display = 'none';
    elements.frontLabel.style.display = 'none';
    elements.backLabel.style.display = 'none';
    elements.overlay.style.display = 'none';
    elements.overlay.replaceChildren();
    setControlsDuplex(false);
  }

  function sync() {
    const elements = ensureElements();
    const api = window.SmartPrintLayout;
    const plan = api?.state?.plan;
    if (!elements || !api) return;
    if (!plan?.duplex || !plan.sheets?.length) {
      disableDualMode(elements);
      return;
    }
    api.state.side = 'front';
    elements.empty && (elements.empty.style.display = 'none');
    elements.shell.classList.add('duplex-preview-active');
    setControlsDuplex(true);
    const size = canvasSize(plan.cfg, elements.shell);
    drawSide(elements.front, 'front', size);
    drawSide(elements.back, 'back', size);
    positionFaceLabels(elements);
    syncBackOverlay(elements);
    window.SmartPrintLayoutEnhancements?.scheduleOverlay?.();
    document.documentElement.dataset.smartLayoutDuplexPreview = 'v1-side-by-side';
  }

  function schedule() {
    cancelAnimationFrame(frame);
    frame = requestAnimationFrame(() => requestAnimationFrame(sync));
  }

  function patchRecalculate() {
    const api = window.SmartPrintLayout;
    if (!api || recalculatePatched || typeof api.recalculate !== 'function') return;
    const original = api.recalculate.bind(api);
    api.recalculate = (...args) => {
      const result = original(...args);
      schedule();
      return result;
    };
    recalculatePatched = true;
  }

  function bind() {
    injectStyles();
    ensureElements();
    patchRecalculate();
    const fileList = $('fileList');
    if (fileList && typeof MutationObserver === 'function') {
      fileObserver = new MutationObserver(schedule);
      fileObserver.observe(fileList, { childList: true, subtree: true });
    }
    document.addEventListener('input', event => {
      if (event.target?.closest?.('.sidebar')) schedule();
    }, true);
    document.addEventListener('change', event => {
      if (event.target?.closest?.('.sidebar')) schedule();
    }, true);
    ['prevSheet', 'nextSheet', 'frontBtn', 'backBtn', 'resetBtn'].forEach(id => $(id)?.addEventListener('click', schedule));
    window.addEventListener('resize', schedule);
    schedule();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', bind, { once: true });
  else bind();
})();
