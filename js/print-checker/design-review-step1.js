/* Design Review/Maker step 1 — A4 defaults, remembered geometry, print-safe AI PNG export */
'use strict';

(() => {
  if (window.__designReviewStep1V1) return;
  window.__designReviewStep1V1 = true;

  const GEOMETRY_KEY = 'programStudio.designReview.geometry.v1';
  const DEFAULT_GEOMETRY = Object.freeze({ trimW: 210, trimH: 297, spine: 0, bleed: 3 });
  const EXPORT_DPI = 300;
  const MAX_EXPORT_PIXELS = 42_000_000;
  let capturedLayout = null;
  let typographyObserver = null;

  const $ = (id) => document.getElementById(id);
  const numberOr = (value, fallback) => {
    const n = Number(value);
    return Number.isFinite(n) ? n : fallback;
  };
  const clamp = (value, min, max) => Math.max(min, Math.min(max, numberOr(value, min)));

  function readRememberedGeometry() {
    try {
      const parsed = JSON.parse(localStorage.getItem(GEOMETRY_KEY) || '{}');
      return {
        trimW: clamp(parsed.trimW || DEFAULT_GEOMETRY.trimW, 50, 1000),
        trimH: clamp(parsed.trimH || DEFAULT_GEOMETRY.trimH, 50, 1000),
        spine: clamp(parsed.spine || 0, 0, 100),
        bleed: clamp(parsed.bleed ?? DEFAULT_GEOMETRY.bleed, 0, 20),
      };
    } catch (_) {
      return { ...DEFAULT_GEOMETRY };
    }
  }

  function saveGeometry(source = document) {
    const previous = readRememberedGeometry();
    const next = {
      trimW: clamp(source.querySelector?.('#trimW')?.value || previous.trimW, 50, 1000),
      trimH: clamp(source.querySelector?.('#trimH')?.value || previous.trimH, 50, 1000),
      spine: clamp(source.querySelector?.('#spine')?.value || previous.spine, 0, 100),
      bleed: clamp(source.querySelector?.('#bleed')?.value ?? previous.bleed, 0, 20),
    };
    localStorage.setItem(GEOMETRY_KEY, JSON.stringify(next));
    return next;
  }

  function dispatchInput(node) {
    if (!node) return;
    node.dispatchEvent(new Event('input', { bubbles: true }));
    node.dispatchEvent(new Event('change', { bubbles: true }));
  }

  function applyA4Defaults() {
    const trimW = $('trimW');
    const trimH = $('trimH');
    if (!trimW || !trimH) return;

    const remembered = readRememberedGeometry();
    let changed = false;
    if (!numberOr(trimW.value, 0)) {
      trimW.value = String(remembered.trimW || DEFAULT_GEOMETRY.trimW);
      changed = true;
    }
    if (!numberOr(trimH.value, 0)) {
      trimH.value = String(remembered.trimH || DEFAULT_GEOMETRY.trimH);
      changed = true;
    }
    const bleed = $('bleed');
    if (bleed && !numberOr(bleed.value, 0)) {
      bleed.value = String(remembered.bleed ?? DEFAULT_GEOMETRY.bleed);
      changed = true;
    }
    const spine = $('spine');
    if (spine && !numberOr(spine.value, 0) && remembered.spine > 0) {
      spine.value = String(remembered.spine);
      spine.dataset.manual = '1';
      changed = true;
    }
    if (changed) {
      dispatchInput(trimW);
      dispatchInput(trimH);
      if (bleed) dispatchInput(bleed);
      if (spine?.value) dispatchInput(spine);
    }
    saveGeometry();
  }

  function bindGeometryMemory() {
    const form = $('specForm');
    if (!form) return;
    form.addEventListener('input', (event) => {
      if (['trimW', 'trimH', 'spine', 'bleed'].includes(event.target?.id)) saveGeometry();
    });
    form.addEventListener('change', (event) => {
      if (['trimW', 'trimH', 'spine', 'bleed'].includes(event.target?.id)) saveGeometry();
    });
    const observer = new MutationObserver(() => queueMicrotask(applyA4Defaults));
    observer.observe(form, { childList: true, subtree: true });
    applyA4Defaults();
  }

  function syncAiGeometryFromReview() {
    const geometry = saveGeometry();
    const pairs = [
      ['aiTrimW', geometry.trimW],
      ['aiTrimH', geometry.trimH],
      ['aiSpine', geometry.spine],
      ['aiBleed', geometry.bleed],
    ];
    pairs.forEach(([id, value]) => {
      const node = $(id);
      if (!node) return;
      node.value = String(value);
      dispatchInput(node);
    });
  }

  function interceptAiLayoutResponse() {
    if (window.__designReviewFetchWrapped) return;
    window.__designReviewFetchWrapped = true;
    const originalFetch = window.fetch.bind(window);
    window.fetch = async (...args) => {
      const response = await originalFetch(...args);
      const requestUrl = String(args[0]?.url || args[0] || '');
      if (requestUrl.includes('/api/preflight/ai-design/layout')) {
        response.clone().json().then((data) => {
          if (data && typeof data === 'object' && data.background) {
            capturedLayout = data;
            window.__designReviewAiLayout = data;
            queueMicrotask(normalizeAllLayerTypography);
          }
        }).catch(() => {});
      }
      return response;
    };
  }

  function getAiSpec() {
    const type = $('aiDocType')?.value === 'poster' ? 'poster' : 'cover';
    const trimW = clamp($('aiTrimW')?.value || 210, 50, 1000);
    const trimH = clamp($('aiTrimH')?.value || 297, 50, 1000);
    const bleed = clamp($('aiBleed')?.value ?? 3, 0, 20);
    const spine = type === 'cover' ? clamp($('aiSpine')?.value || 0, 0, 100) : 0;
    return {
      type,
      trimW,
      trimH,
      spine,
      bleed,
      workW: type === 'cover' ? trimW * 2 + spine + bleed * 2 : trimW + bleed * 2,
      workH: trimH + bleed * 2,
    };
  }

  function stagePreviewScale(spec) {
    const stage = $('aiStage');
    return stage?.clientWidth ? stage.clientWidth / spec.workW : 1;
  }

  function pointSizeFromNode(node) {
    const stored = Number(node?.dataset?.fontPt);
    if (Number.isFinite(stored) && stored > 0) return stored;
    const inline = String(node?.style?.fontSize || '').trim();
    const raw = parseFloat(inline);
    if (Number.isFinite(raw) && raw > 0) {
      if (inline.endsWith('pt')) return raw;
      if (inline.endsWith('px')) return raw * 72 / 96;
    }
    const computed = parseFloat(getComputedStyle(node).fontSize);
    return Number.isFinite(computed) ? computed * 72 / 96 : 14;
  }

  function normalizeLayerTypography(node) {
    if (!(node instanceof HTMLElement) || !node.classList.contains('ai-design-layer') || node.dataset.kind !== 'text') return;
    if (node.dataset.typographyNormalizing === '1') return;
    const spec = getAiSpec();
    const previewScale = stagePreviewScale(spec);
    const inline = String(node.style.fontSize || '');
    let pt = Number(node.dataset.fontPt);
    if (inline.endsWith('pt')) pt = parseFloat(inline);
    if (!Number.isFinite(pt) || pt <= 0) pt = pointSizeFromNode(node);
    node.dataset.fontPt = String(pt);
    const previewPx = pt * 25.4 / 72 * previewScale;
    node.dataset.typographyNormalizing = '1';
    node.style.fontSize = `${previewPx.toFixed(3)}px`;
    node.dataset.typographyNormalizing = '0';
  }

  function normalizeAllLayerTypography() {
    document.querySelectorAll('#aiStage .ai-design-layer[data-kind="text"]').forEach(normalizeLayerTypography);
  }

  function bindTypographyFix() {
    const stage = $('aiStage');
    if (!stage) return;
    typographyObserver?.disconnect();
    typographyObserver = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        if (mutation.type === 'childList') {
          mutation.addedNodes.forEach((node) => {
            if (node instanceof HTMLElement && node.classList.contains('ai-design-layer')) normalizeLayerTypography(node);
          });
        } else if (mutation.type === 'attributes') {
          const node = mutation.target;
          if (node instanceof HTMLElement && node.classList.contains('ai-design-layer') && node.dataset.typographyNormalizing !== '1') {
            const inline = String(node.style.fontSize || '');
            if (inline.endsWith('pt')) normalizeLayerTypography(node);
          }
        }
      });
    });
    typographyObserver.observe(stage, { childList: true, subtree: true, attributes: true, attributeFilter: ['style'] });
  }

  function syncToolbarPointSize() {
    const selected = document.querySelector('#aiStage .ai-design-layer.is-selected[data-kind="text"]');
    const select = $('aiFontSize');
    if (!selected || !select) return;
    const pt = Math.round(pointSizeFromNode(selected));
    if (![...select.options].some((option) => Number(option.value) === pt)) {
      const option = document.createElement('option');
      option.value = String(pt);
      option.textContent = String(pt);
      select.appendChild(option);
    }
    select.value = String(pt);
  }

  function paintShape(ctx, shape, width, height) {
    const x = width * Number(shape.x || 0) / 100;
    const y = height * Number(shape.y || 0) / 100;
    const w = width * Number(shape.w || 0) / 100;
    const h = height * Number(shape.h || 0) / 100;
    ctx.save();
    ctx.globalAlpha = clamp(shape.opacity, 0.03, 1);
    ctx.fillStyle = shape.color || '#1F4E79';
    ctx.strokeStyle = shape.color || '#1F4E79';
    ctx.translate(x + w / 2, y + h / 2);
    ctx.rotate((Number(shape.rotation || 0) * Math.PI) / 180);
    if (shape.kind === 'circle') {
      ctx.beginPath();
      ctx.ellipse(0, 0, Math.abs(w / 2), Math.abs(h / 2), 0, 0, Math.PI * 2);
      ctx.fill();
    } else if (shape.kind === 'line') {
      ctx.lineWidth = Math.max(1, Math.min(16, Math.abs(h)));
      ctx.beginPath();
      ctx.moveTo(-w / 2, 0);
      ctx.lineTo(w / 2, 0);
      ctx.stroke();
    } else {
      ctx.fillRect(-w / 2, -h / 2, w, h);
    }
    ctx.restore();
  }

  function drawWrappedText(ctx, text, x, y, maxWidth, lineHeight, align) {
    const paragraphs = String(text).split(/\n/);
    let cursorY = y;
    paragraphs.forEach((paragraph) => {
      const chars = [...paragraph];
      let line = '';
      const lines = [];
      chars.forEach((char) => {
        const test = line + char;
        if (line && ctx.measureText(test).width > maxWidth) {
          lines.push(line);
          line = char;
        } else {
          line = test;
        }
      });
      if (line || !chars.length) lines.push(line);
      lines.forEach((value) => {
        let drawX = x;
        if (align === 'center') {
          ctx.textAlign = 'center';
          drawX = x + maxWidth / 2;
        } else if (align === 'right') {
          ctx.textAlign = 'right';
          drawX = x + maxWidth;
        } else {
          ctx.textAlign = 'left';
        }
        ctx.fillText(value, drawX, cursorY);
        cursorY += lineHeight;
      });
    });
  }

  function rotationDegrees(node) {
    const inline = String(node.style.transform || '');
    const match = inline.match(/rotate\(([-+]?\d*\.?\d+)deg\)/i);
    return match ? Number(match[1]) || 0 : 0;
  }

  function layerText(node) {
    return [...node.childNodes]
      .filter((child) => child.nodeType === Node.TEXT_NODE)
      .map((child) => child.textContent)
      .join('')
      .trim();
  }

  function waitForImage(image) {
    if (!image) return Promise.resolve();
    if (image.complete && image.naturalWidth > 0) return Promise.resolve();
    return new Promise((resolve) => {
      image.addEventListener('load', resolve, { once: true });
      image.addEventListener('error', resolve, { once: true });
    });
  }

  function crc32(bytes) {
    let crc = 0xFFFFFFFF;
    for (let i = 0; i < bytes.length; i += 1) {
      crc ^= bytes[i];
      for (let bit = 0; bit < 8; bit += 1) crc = (crc >>> 1) ^ (0xEDB88320 & -(crc & 1));
    }
    return (crc ^ 0xFFFFFFFF) >>> 0;
  }

  function u32(value) {
    return new Uint8Array([(value >>> 24) & 255, (value >>> 16) & 255, (value >>> 8) & 255, value & 255]);
  }

  function concatBytes(...parts) {
    const total = parts.reduce((sum, part) => sum + part.length, 0);
    const out = new Uint8Array(total);
    let offset = 0;
    parts.forEach((part) => { out.set(part, offset); offset += part.length; });
    return out;
  }

  async function withPngDpi(blob, dpi) {
    const source = new Uint8Array(await blob.arrayBuffer());
    if (source.length < 33) return blob;
    const signature = [137, 80, 78, 71, 13, 10, 26, 10];
    if (!signature.every((value, index) => source[index] === value)) return blob;
    const type = new TextEncoder().encode('pHYs');
    const ppm = Math.round(dpi / 0.0254);
    const data = concatBytes(u32(ppm), u32(ppm), new Uint8Array([1]));
    const crc = u32(crc32(concatBytes(type, data)));
    const chunk = concatBytes(u32(data.length), type, data, crc);
    const patched = concatBytes(source.slice(0, 33), chunk, source.slice(33));
    return new Blob([patched], { type: 'image/png' });
  }

  function canvasBlob(canvas) {
    return new Promise((resolve, reject) => {
      canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error('PNG 파일을 만들지 못했습니다.')), 'image/png');
    });
  }

  function setAiStatus(text, tone = '') {
    const node = $('aiStatus');
    if (!node) return;
    node.textContent = text;
    node.className = `ai-design-status${tone ? ` is-${tone}` : ''}`;
  }

  async function exportTrue300Dpi(event) {
    event.preventDefault();
    event.stopImmediatePropagation();
    const stage = $('aiStage');
    if (!stage || !document.querySelector('#aiStage .ai-design-layer')) return;

    const spec = getAiSpec();
    const pxPerMm = EXPORT_DPI / 25.4;
    const width = Math.round(spec.workW * pxPerMm);
    const height = Math.round(spec.workH * pxPerMm);
    if (width * height > MAX_EXPORT_PIXELS) {
      setAiStatus(`현재 규격은 300dpi 저장 시 ${(width * height / 1_000_000).toFixed(1)}MP가 되어 브라우저 안전 한도를 초과합니다. 규격을 줄이거나 후속 대용량 출력 기능을 사용해 주세요.`, 'error');
      return;
    }

    const button = $('aiExportPng');
    if (button) button.disabled = true;
    setAiStatus('실제 300dpi 기준으로 글자 크기와 회전을 적용해 PNG를 만드는 중입니다…');

    try {
      await document.fonts?.ready;
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      const layout = capturedLayout || window.__designReviewAiLayout || {};
      ctx.fillStyle = layout.background?.base_color || '#FFFFFF';
      ctx.fillRect(0, 0, width, height);
      (layout.background?.shapes || []).forEach((shape) => paintShape(ctx, shape, width, height));

      const previewScale = stagePreviewScale(spec);
      const outputScale = pxPerMm;
      const layers = [...document.querySelectorAll('#aiStage .ai-design-layer')];
      await Promise.all(layers.map((node) => waitForImage(node.querySelector('img'))));

      layers.forEach((node) => {
        const left = (parseFloat(node.style.left) || 0) / previewScale * outputScale;
        const top = (parseFloat(node.style.top) || 0) / previewScale * outputScale;
        const boxW = node.offsetWidth / previewScale * outputScale;
        const boxH = node.offsetHeight / previewScale * outputScale;
        const angle = rotationDegrees(node) * Math.PI / 180;
        const centerX = left + boxW / 2;
        const centerY = top + boxH / 2;

        ctx.save();
        ctx.translate(centerX, centerY);
        ctx.rotate(angle);
        const localX = -boxW / 2;
        const localY = -boxH / 2;

        if (node.dataset.kind === 'logo') {
          const image = node.querySelector('img');
          if (image?.naturalWidth) ctx.drawImage(image, localX, localY, boxW, boxH);
          ctx.restore();
          return;
        }

        const text = layerText(node);
        if (!text) {
          ctx.restore();
          return;
        }
        const style = getComputedStyle(node);
        const pt = pointSizeFromNode(node);
        const fontPx = pt * EXPORT_DPI / 72;
        ctx.fillStyle = style.color || '#172033';
        ctx.font = `${style.fontWeight || 600} ${fontPx}px Pretendard, Arial, sans-serif`;
        ctx.textBaseline = 'top';
        drawWrappedText(ctx, text, localX, localY, boxW, fontPx * 1.18, node.dataset.align || 'left');
        ctx.restore();
      });

      const rawBlob = await canvasBlob(canvas);
      const pngBlob = await withPngDpi(rawBlob, EXPORT_DPI);
      const url = URL.createObjectURL(pngBlob);
      const link = document.createElement('a');
      link.download = `design-cover-${spec.trimW}x${spec.trimH}mm-300dpi-${Date.now()}.png`;
      link.href = url;
      link.click();
      setTimeout(() => URL.revokeObjectURL(url), 3000);
      setAiStatus('300dpi PNG 저장 완료. 글자 pt 크기와 회전, PNG 해상도 메타데이터까지 반영했습니다.', 'ok');
    } catch (error) {
      setAiStatus(error?.message || '300dpi PNG 저장 중 오류가 발생했습니다.', 'error');
    } finally {
      if (button) button.disabled = false;
    }
  }

  function bindExportFix() {
    const button = $('aiExportPng');
    if (!button || button.dataset.true300DpiBound === '1') return;
    button.dataset.true300DpiBound = '1';
    button.title = '실제 300dpi · pt 크기 고정 · 회전 반영';
    button.addEventListener('click', exportTrue300Dpi, true);
  }

  function boot() {
    bindGeometryMemory();
    interceptAiLayoutResponse();
    bindTypographyFix();
    bindExportFix();

    document.addEventListener('click', (event) => {
      if (event.target?.closest?.('#aiDesignLaunch')) setTimeout(() => {
        syncAiGeometryFromReview();
        bindTypographyFix();
        bindExportFix();
      }, 0);
      if (event.target?.closest?.('.ai-design-layer')) setTimeout(syncToolbarPointSize, 0);
    });
    window.addEventListener('resize', normalizeAllLayerTypography);

    window.DesignReviewGeometry = Object.freeze({
      get: readRememberedGeometry,
      save: saveGeometry,
      syncAi: syncAiGeometryFromReview,
      defaults: { ...DEFAULT_GEOMETRY },
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once: true });
  else boot();
})();
