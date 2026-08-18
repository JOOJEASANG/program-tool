// User-owned local image upload support for PDF divider pages.
(function () {
  'use strict';
  if (window.__pdfDividerLocalImageUploadV1) return;
  window.__pdfDividerLocalImageUploadV1 = true;
  const pathname = location.pathname.replace(/\/+$/, '') || '/';
  if (!['/tools/pdf-editor.html','/pdf-editor','/pdf-editor/index.html'].some((p) => pathname === p || pathname.endsWith(p))) return;

  const MAX_BYTES = 5 * 1024 * 1024;
  const TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);
  const STYLE_ID = 'pdfDividerLocalImageStyles';
  const PANEL_ID = 'pdfDividerLocalImagePanel';
  const imageCache = new Map();
  let installed = false;
  let selectedDataUrl = '';
  let selectedName = '';
  let originalGetDividerContent = null;
  let originalRenderDividerCanvas = null;
  let originalOpenDividerInsert = null;
  let originalEditDivider = null;
  let originalMakeDividerPageObj = null;
  const $ = (id) => document.getElementById(id);
  const text = (v) => String(v == null ? '' : v);

  function styles() {
    if ($(STYLE_ID)) return;
    const el = document.createElement('style');
    el.id = STYLE_ID;
    el.textContent = `
      .pdf-div-local{border-top:1px solid #e5e7eb;margin-top:10px;padding-top:9px}.pdf-div-local-head{display:flex;align-items:center;gap:7px;margin-bottom:6px}.pdf-div-local-head strong{font-size:11px}.pdf-div-local-row{display:flex;align-items:center;gap:7px}.pdf-div-local-row input{min-width:0;flex:1;font-size:9px}.pdf-div-local-row button{width:auto!important;white-space:nowrap}.pdf-div-local-note{font-size:8px;color:#64748b;line-height:1.45;margin-top:5px}.pdf-div-local-active{font-size:8px;font-weight:900;color:#166534;margin-top:5px}
    `;
    document.head.appendChild(el);
  }

  function validateFile(file) {
    if (!file) return { ok: false, message: '이미지를 선택해 주세요.' };
    if (!TYPES.has(file.type)) return { ok: false, message: 'JPG·PNG·WEBP 이미지만 사용할 수 있습니다.' };
    if (Number(file.size || 0) > MAX_BYTES) return { ok: false, message: '간지 이미지는 5MB 이하로 사용해 주세요.' };
    return { ok: true, message: '' };
  }

  function status(message, error = false) {
    const el = $('pdfDividerLocalStatus');
    if (!el) return;
    el.textContent = message;
    el.style.color = error ? '#dc2626' : '#64748b';
  }

  function readDataUrl(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result || ''));
      reader.onerror = () => reject(new Error('이미지 파일을 읽지 못했습니다.'));
      reader.readAsDataURL(file);
    });
  }

  function preload(dataUrl) {
    if (!dataUrl) return Promise.reject(new Error('이미지가 없습니다.'));
    if (imageCache.has(dataUrl)) return Promise.resolve(imageCache.get(dataUrl));
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => { imageCache.set(dataUrl, img); resolve(img); };
      img.onerror = () => reject(new Error('간지 이미지를 불러오지 못했습니다.'));
      img.src = dataUrl;
    });
  }

  function makePanel() {
    if ($(PANEL_ID)) return $(PANEL_ID);
    const modal = $('dividerModal')?.querySelector('.modal-box');
    if (!modal) return null;
    const panel = document.createElement('div');
    panel.id = PANEL_ID;
    panel.className = 'pdf-div-local';
    panel.innerHTML = `
      <div class="pdf-div-local-head"><strong>간지 배경 이미지 직접 업로드</strong></div>
      <div class="pdf-div-local-row"><input id="pdfDividerLocalFile" type="file" accept="image/jpeg,image/png,image/webp"><button type="button" class="btn-sm" id="pdfDividerLocalClear">이미지 해제</button></div>
      <div class="pdf-div-local-note">사용자가 직접 선택한 이미지가 현재 간지에만 저장됩니다. 사용 권한이 있는 이미지만 업로드해 주세요. 최대 5MB.</div>
      <div id="pdfDividerLocalActive" class="pdf-div-local-active"></div><div id="pdfDividerLocalStatus" class="pdf-div-local-note"></div>`;
    const confirm = $('dividerConfirmBtn')?.parentElement;
    modal.insertBefore(panel, confirm || null);
    return panel;
  }

  function syncLabel() {
    const active = $('pdfDividerLocalActive');
    if (active) active.textContent = selectedDataUrl ? `배경 이미지: ${selectedName || '직접 업로드 이미지'}` : '';
  }

  function clearImage() {
    selectedDataUrl = '';
    selectedName = '';
    if ($('pdfDividerLocalFile')) $('pdfDividerLocalFile').value = '';
    syncLabel();
    status('이미지 배경을 사용하지 않습니다.');
    try { updateDividerPreview(); } catch (_) {}
  }

  function drawText(ctx, content, w, h) {
    const fg = content.fg || '#ffffff';
    const vAlign = content.textVAlign || 'center';
    const vOffsetPct = (Number(content.textVOffset) || 0) / 100;
    let cy = vAlign === 'top' ? h * .22 : vAlign === 'bottom' ? h * .78 : h * .5;
    cy += h * vOffsetPct;
    const titleOffset = content.subtitle ? -h * .06 : 0;
    ctx.save();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.shadowColor = 'rgba(0,0,0,.28)';
    ctx.shadowBlur = Math.max(1, h * .004);
    if (content.title) {
      const fs = Math.min(w * .1, h * .1, 90);
      ctx.fillStyle = fg; ctx.globalAlpha = 1; ctx.font = `bold ${fs}px "Pretendard","Malgun Gothic",sans-serif`;
      ctx.fillText(content.title, w / 2, cy + titleOffset);
    }
    if (content.subtitle) {
      const fs = Math.min(w * .055, h * .055, 50);
      ctx.fillStyle = fg; ctx.globalAlpha = .86; ctx.font = `${fs}px "Pretendard","Malgun Gothic",sans-serif`;
      ctx.fillText(content.subtitle, w / 2, cy + h * .08);
    }
    if (content.note) {
      const fs = Math.min(w * .035, h * .035, 30);
      ctx.fillStyle = fg; ctx.globalAlpha = .72; ctx.font = `${fs}px "Pretendard","Malgun Gothic",sans-serif`;
      ctx.fillText(content.note, w / 2, h * .88);
    }
    ctx.restore();
    if (Array.isArray(content.extraTexts)) {
      for (const item of content.extraTexts.slice(0, 30)) {
        if (!item || item.hidden || !text(item.text).trim()) continue;
        ctx.save();
        ctx.translate(w * Math.max(0, Math.min(100, Number(item.x) || 50)) / 100, h * Math.max(0, Math.min(100, Number(item.y) || 70)) / 100);
        ctx.rotate((Number(item.rotation) || 0) * Math.PI / 180);
        ctx.globalAlpha = Math.max(.05, Math.min(1, Number(item.opacity) || 1));
        ctx.fillStyle = item.color || fg;
        ctx.textAlign = item.align === 'left' ? 'left' : item.align === 'right' ? 'right' : 'center';
        ctx.textBaseline = 'middle';
        const fs = Math.max(6, Math.min(96, Number(item.size) || 18));
        ctx.font = `${Number(item.weight) >= 700 ? 'bold ' : ''}${item.italic ? 'italic ' : ''}${fs}px "Pretendard","Malgun Gothic",sans-serif`;
        ctx.fillText(text(item.text).slice(0, 500), 0, 0);
        ctx.restore();
      }
    }
  }

  function renderLocalDivider(content, w, h) {
    const c = document.createElement('canvas');
    c.width = w; c.height = h;
    const ctx = c.getContext('2d');
    const img = imageCache.get(content.localImageDataUrl);
    ctx.fillStyle = content.bg || '#ffffff';
    ctx.fillRect(0, 0, w, h);
    if (img) {
      const scale = Math.max(w / img.naturalWidth, h / img.naturalHeight);
      const dw = img.naturalWidth * scale, dh = img.naturalHeight * scale;
      ctx.drawImage(img, (w - dw) / 2, (h - dh) / 2, dw, dh);
    }
    drawText(ctx, content, w, h);
    return c;
  }

  function patchFunctions() {
    if (!originalRenderDividerCanvas && typeof window.renderDividerCanvas === 'function') originalRenderDividerCanvas = window.renderDividerCanvas;
    if (originalRenderDividerCanvas && !window.renderDividerCanvas.__localImageV1) {
      const patched = function (content, w, h) {
        if (content?.localImageDataUrl && imageCache.has(content.localImageDataUrl)) return renderLocalDivider(content, w, h);
        return originalRenderDividerCanvas(content, w, h);
      };
      patched.__localImageV1 = true;
      window.renderDividerCanvas = patched;
    }
    if (!originalGetDividerContent && typeof window.getDividerContent === 'function') originalGetDividerContent = window.getDividerContent;
    if (originalGetDividerContent && !window.getDividerContent.__localImageV1) {
      const patched = function () {
        const content = originalGetDividerContent();
        if (selectedDataUrl) {
          content.localImageDataUrl = selectedDataUrl;
          content.localImageName = selectedName;
        }
        return content;
      };
      patched.__localImageV1 = true;
      window.getDividerContent = patched;
    }
    if (!originalOpenDividerInsert && typeof window.openDividerInsert === 'function') originalOpenDividerInsert = window.openDividerInsert;
    if (originalOpenDividerInsert && !window.openDividerInsert.__localImageV1) {
      const patched = function () {
        selectedDataUrl = ''; selectedName = ''; syncLabel();
        return Reflect.apply(originalOpenDividerInsert, this, arguments);
      };
      patched.__localImageV1 = true;
      window.openDividerInsert = patched;
    }
    if (!originalEditDivider && typeof window.editDivider === 'function') originalEditDivider = window.editDivider;
    if (originalEditDivider && !window.editDivider.__localImageV1) {
      const patched = function (page) {
        selectedDataUrl = page?.dividerContent?.localImageDataUrl || '';
        selectedName = page?.dividerContent?.localImageName || '';
        const result = Reflect.apply(originalEditDivider, this, arguments);
        syncLabel();
        if (selectedDataUrl) preload(selectedDataUrl).then(() => { try { updateDividerPreview(); } catch (_) {} }).catch(() => {});
        return result;
      };
      patched.__localImageV1 = true;
      window.editDivider = patched;
    }
    if (!originalMakeDividerPageObj && typeof window.makeDividerPageObj === 'function') originalMakeDividerPageObj = window.makeDividerPageObj;
    if (originalMakeDividerPageObj && !window.makeDividerPageObj.__localImageV1) {
      const patched = function (content) {
        const page = originalMakeDividerPageObj(content);
        if (content?.localImageDataUrl && !imageCache.has(content.localImageDataUrl)) {
          preload(content.localImageDataUrl).then(() => {
            page.thumbCanvas = window.renderDividerCanvas(content, 200, 283);
            try { renderThumbs(); } catch (_) {}
          }).catch(() => {});
        }
        return page;
      };
      patched.__localImageV1 = true;
      window.makeDividerPageObj = patched;
    }
  }

  function bind() {
    $('pdfDividerLocalFile')?.addEventListener('change', async (event) => {
      const file = event.target.files?.[0] || null;
      const validation = validateFile(file);
      if (!validation.ok) { status(validation.message, true); event.target.value = ''; return; }
      try {
        status('이미지를 불러오는 중입니다...');
        const dataUrl = await readDataUrl(file);
        await preload(dataUrl);
        selectedDataUrl = dataUrl;
        selectedName = file.name;
        syncLabel();
        status('직접 업로드한 이미지를 간지 배경으로 사용합니다.');
        try { updateDividerPreview(); } catch (_) {}
      } catch (error) {
        status(error?.message || '이미지를 불러오지 못했습니다.', true);
      }
    });
    $('pdfDividerLocalClear')?.addEventListener('click', clearImage);
  }

  function install() {
    patchFunctions();
    if (installed) return true;
    if (!$('dividerModal') || typeof window.renderDividerCanvas !== 'function') return false;
    styles();
    if (!makePanel()) return false;
    bind();
    installed = true;
    document.documentElement.dataset.pdfDividerLocalImageUpload = '1';
    return true;
  }

  window.PdfDividerLocalImageUpload = {
    install,
    validateFile,
    clearImage,
    preload,
    renderLocalDivider,
    stage: 'user-local-pdf-divider-image-only',
    maxBytes: MAX_BYTES,
  };
  [700, 1300, 2200, 3200].forEach((delay) => setTimeout(install, delay));
})();
