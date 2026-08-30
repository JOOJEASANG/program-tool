// User-owned local image layers for PDF divider pages.
(function () {
  'use strict';
  // Keep the original guard name so older boot checks remain compatible.
  if (window.__pdfDividerLocalImageUploadV1) return;
  window.__pdfDividerLocalImageUploadV1 = true;
  const pathname = location.pathname.replace(/\/+$/, '') || '/';
  if (!['/tools/pdf-editor.html','/pdf-editor','/pdf-editor/index.html'].some((p) => pathname === p || pathname.endsWith(p))) return;

  const MAX_SOURCE_BYTES = 500 * 1024 * 1024;
  const MAX_EMBED_BYTES = 5 * 1024 * 1024;
  const MAX_TOTAL_EMBED_BYTES = 15 * 1024 * 1024;
  const MAX_SOURCE_PIXELS = 80_000_000;
  const MAX_EMBED_PIXELS = 20_000_000;
  const MAX_LAYERS = 6;
  const TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);
  const STYLE_ID = 'pdfDividerLocalImageStyles';
  const PANEL_ID = 'pdfDividerLocalImagePanel';
  const imageCache = new Map();
  let installed = false;
  let selectedLayers = [];
  let selectedLayerId = '';
  let originalGetDividerContent = null;
  let originalRenderDividerCanvas = null;
  let originalOpenDividerInsert = null;
  let originalEditDivider = null;
  let originalMakeDividerPageObj = null;
  const $ = (id) => document.getElementById(id);
  const text = (v) => String(v == null ? '' : v);
  const clamp = (value, min, max, fallback) => {
    const number = Number(value);
    return Number.isFinite(number) ? Math.max(min, Math.min(max, number)) : fallback;
  };

  function styles() {
    if ($(STYLE_ID)) return;
    const el = document.createElement('style');
    el.id = STYLE_ID;
    el.textContent = `
      .pdf-div-local{border-top:1px solid #e5e7eb;margin-top:10px;padding-top:9px}
      .pdf-div-local-head{display:flex;align-items:center;justify-content:space-between;gap:7px;margin-bottom:7px}
      .pdf-div-local-head strong{font-size:11px}.pdf-div-local-head span{font-size:8px;color:#64748b;font-weight:700}
      .pdf-div-local-row{display:flex;align-items:center;gap:7px}.pdf-div-local-row input{min-width:0;flex:1;font-size:9px}.pdf-div-local-row button{width:auto!important;white-space:nowrap}
      .pdf-div-local-note{font-size:8px;color:#64748b;line-height:1.45;margin-top:5px}.pdf-div-local-active{font-size:8px;font-weight:900;color:#166534;margin-top:5px}
      .pdf-div-layer-list{display:flex;flex-direction:column;gap:5px;margin-top:8px;max-height:130px;overflow:auto}
      .pdf-div-layer-item{display:grid;grid-template-columns:minmax(0,1fr) auto;align-items:center;gap:7px;padding:7px 8px;border:1px solid #dbe3ee;border-radius:8px;background:#f8fafc;cursor:pointer;text-align:left}
      .pdf-div-layer-item:hover{border-color:#bfdbfe;background:#f5f9ff}.pdf-div-layer-item.active{border-color:#60a5fa;background:#eff6ff;box-shadow:inset 3px 0 0 #2563eb}
      .pdf-div-layer-item strong{display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:9px;color:#334155}.pdf-div-layer-item small{font-size:8px;color:#94a3b8;font-weight:700}
      .pdf-div-layer-controls{display:none;margin-top:8px;padding:9px;border:1px solid #dbe3ee;border-radius:9px;background:#fbfdff}.pdf-div-layer-controls.active{display:block}
      .pdf-div-layer-control{display:grid;grid-template-columns:38px minmax(0,1fr) 42px;align-items:center;gap:6px;margin-bottom:7px}.pdf-div-layer-control:last-of-type{margin-bottom:0}
      .pdf-div-layer-control label{font-size:9px;font-weight:800;color:#475569;margin:0}.pdf-div-layer-control input[type=range]{width:100%;min-width:0}.pdf-div-layer-value{font-size:8px;font-weight:800;color:#334155;text-align:right}
      .pdf-div-layer-actions{display:flex;flex-wrap:wrap;gap:5px;margin-top:8px}.pdf-div-layer-actions button{width:auto!important;padding:5px 7px!important;font-size:8px!important}
      .pdf-div-layer-danger{color:#b91c1c!important;border-color:#fecaca!important;background:#fff!important}
    `;
    document.head.appendChild(el);
  }

  function validateFile(file) {
    if (!file) return { ok: false, message: '이미지를 선택해 주세요.' };
    if (!TYPES.has(file.type)) return { ok: false, message: 'JPG·PNG·WEBP 이미지만 사용할 수 있습니다.' };
    if (Number(file.size || 0) > MAX_SOURCE_BYTES) return { ok: false, message: '간지 원본 이미지는 한 파일 최대 500MB까지 사용할 수 있습니다.' };
    return { ok: true, message: '' };
  }

  function status(message, error = false) {
    const el = $('pdfDividerLocalStatus');
    if (!el) return;
    el.textContent = message;
    el.style.color = error ? '#dc2626' : '#64748b';
  }

  function blobToDataUrl(blob) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result || ''));
      reader.onerror = () => reject(new Error('최적화 이미지를 읽지 못했습니다.'));
      reader.readAsDataURL(blob);
    });
  }

  function canvasToBlob(canvas, quality) {
    return new Promise((resolve, reject) => {
      canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error('간지 이미지 최적화에 실패했습니다.')), 'image/webp', quality);
    });
  }

  async function decodeFile(file) {
    if (typeof createImageBitmap === 'function') {
      const bitmap = await createImageBitmap(file);
      return {
        image: bitmap,
        width: bitmap.width,
        height: bitmap.height,
        close: () => { try { bitmap.close(); } catch (_) {} },
      };
    }
    const url = URL.createObjectURL(file);
    return new Promise((resolve, reject) => {
      const image = new Image();
      image.onload = () => resolve({
        image,
        width: image.naturalWidth,
        height: image.naturalHeight,
        close: () => { try { URL.revokeObjectURL(url); } catch (_) {} },
      });
      image.onerror = () => { try { URL.revokeObjectURL(url); } catch (_) {}; reject(new Error('간지 이미지를 불러오지 못했습니다.')); };
      image.src = url;
    });
  }

  function drawScaled(source, width, height) {
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(width));
    canvas.height = Math.max(1, Math.round(height));
    const ctx = canvas.getContext('2d', { alpha: false });
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(source, 0, 0, canvas.width, canvas.height);
    return canvas;
  }

  async function optimizeFile(file) {
    const decoded = await decodeFile(file);
    try {
      const sourcePixels = Number(decoded.width || 0) * Number(decoded.height || 0);
      if (!sourcePixels || sourcePixels > MAX_SOURCE_PIXELS) {
        throw new Error('간지 이미지 해상도는 8천만 픽셀 이하로 사용해 주세요.');
      }
      let scale = Math.min(1, Math.sqrt(MAX_EMBED_PIXELS / sourcePixels));
      let width = Math.max(1, Math.round(decoded.width * scale));
      let height = Math.max(1, Math.round(decoded.height * scale));
      let canvas = drawScaled(decoded.image, width, height);
      let blob = null;
      const qualities = [.9, .82, .72, .62, .52, .42];

      for (let round = 0; round < 5; round += 1) {
        for (const quality of qualities) {
          blob = await canvasToBlob(canvas, quality);
          if (blob.size <= MAX_EMBED_BYTES) break;
        }
        if (blob && blob.size <= MAX_EMBED_BYTES) break;
        const ratio = Math.max(.45, Math.min(.88, Math.sqrt(MAX_EMBED_BYTES / Math.max(1, blob?.size || MAX_EMBED_BYTES * 2)) * .92));
        width = Math.max(320, Math.round(canvas.width * ratio));
        height = Math.max(320, Math.round(canvas.height * ratio));
        const next = drawScaled(canvas, width, height);
        canvas.width = 1; canvas.height = 1;
        canvas = next;
      }
      if (!blob || blob.size > MAX_EMBED_BYTES) throw new Error('이미지를 안전한 내부 용량으로 줄이지 못했습니다. 더 작은 해상도의 이미지를 사용해 주세요.');
      const dataUrl = await blobToDataUrl(blob);
      canvas.width = 1; canvas.height = 1;
      return { dataUrl, embeddedBytes: blob.size, width, height };
    } finally {
      decoded.close();
    }
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

  function newLayerId() {
    return `divider-layer-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  }

  function normalizedLayer(layer, fallbackIndex = 0) {
    if (!layer || !layer.dataUrl) return null;
    return {
      id: text(layer.id || `saved-layer-${fallbackIndex}-${Date.now()}`),
      dataUrl: text(layer.dataUrl),
      name: text(layer.name || `이미지 ${fallbackIndex + 1}`).slice(0, 180),
      x: clamp(layer.x, 0, 100, 50),
      y: clamp(layer.y, 0, 100, 50),
      scale: clamp(layer.scale, 10, 300, 100),
      fit: layer.fit === 'cover' ? 'cover' : 'contain',
      embeddedBytes: clamp(layer.embeddedBytes, 0, MAX_EMBED_BYTES, 0),
    };
  }

  function contentLayers(content) {
    if (Array.isArray(content?.localImageLayers) && content.localImageLayers.length) {
      return content.localImageLayers.slice(0, MAX_LAYERS).map(normalizedLayer).filter(Boolean);
    }
    if (content?.localImageDataUrl) {
      return [normalizedLayer({
        id: 'legacy-local-image',
        dataUrl: content.localImageDataUrl,
        name: content.localImageName || '기존 배경 이미지',
        x: 50,
        y: 50,
        scale: 100,
        fit: 'cover',
      }, 0)].filter(Boolean);
    }
    return [];
  }

  function serializableLayers() {
    return selectedLayers.map((layer) => ({
      id: layer.id,
      dataUrl: layer.dataUrl,
      name: layer.name,
      x: layer.x,
      y: layer.y,
      scale: layer.scale,
      fit: layer.fit === 'cover' ? 'cover' : 'contain',
    }));
  }

  function selectedLayer() {
    return selectedLayers.find((layer) => layer.id === selectedLayerId) || null;
  }

  function selectedBytes() {
    return selectedLayers.reduce((sum, layer) => sum + Math.max(0, Number(layer.embeddedBytes) || 0), 0);
  }

  function updatePreview() {
    try { updateDividerPreview(); } catch (_) {}
  }

  function makePanel() {
    if ($(PANEL_ID)) return $(PANEL_ID);
    const modal = $('dividerModal')?.querySelector('.modal-box');
    if (!modal) return null;
    const panel = document.createElement('div');
    panel.id = PANEL_ID;
    panel.className = 'pdf-div-local';
    panel.innerHTML = `
      <div class="pdf-div-local-head"><strong>간지 이미지 레이어</strong><span>아래 → 위 순서로 겹침</span></div>
      <div class="pdf-div-local-row"><input id="pdfDividerLocalFile" type="file" multiple accept="image/jpeg,image/png,image/webp"><button type="button" class="btn-sm" id="pdfDividerLocalClear">전체 삭제</button></div>
      <div class="pdf-div-local-note">이미지를 여러 번 추가하면 레이어로 쌓입니다. JPG·PNG·WEBP 원본은 파일당 최대 500MB이며 내부용으로 자동 최적화됩니다. 최대 ${MAX_LAYERS}개 레이어까지 사용할 수 있습니다.</div>
      <div id="pdfDividerLayerList" class="pdf-div-layer-list"></div>
      <div id="pdfDividerLayerControls" class="pdf-div-layer-controls">
        <div class="pdf-div-layer-control"><label for="pdfDividerLayerScale">크기</label><input id="pdfDividerLayerScale" type="range" min="10" max="300" step="1"><span id="pdfDividerLayerScaleValue" class="pdf-div-layer-value"></span></div>
        <div class="pdf-div-layer-control"><label for="pdfDividerLayerX">가로</label><input id="pdfDividerLayerX" type="range" min="0" max="100" step="1"><span id="pdfDividerLayerXValue" class="pdf-div-layer-value"></span></div>
        <div class="pdf-div-layer-control"><label for="pdfDividerLayerY">세로</label><input id="pdfDividerLayerY" type="range" min="0" max="100" step="1"><span id="pdfDividerLayerYValue" class="pdf-div-layer-value"></span></div>
        <div class="pdf-div-layer-actions"><button type="button" class="btn-sm" id="pdfDividerLayerBack">뒤로</button><button type="button" class="btn-sm" id="pdfDividerLayerFront">앞으로</button><button type="button" class="btn-sm" id="pdfDividerLayerReset">위치·크기 초기화</button><button type="button" class="btn-sm pdf-div-layer-danger" id="pdfDividerLayerDelete">선택 삭제</button></div>
      </div>
      <div id="pdfDividerLocalActive" class="pdf-div-local-active"></div><div id="pdfDividerLocalStatus" class="pdf-div-local-note"></div>`;
    const confirm = $('dividerConfirmBtn')?.parentElement;
    modal.insertBefore(panel, confirm || null);
    return panel;
  }

  function syncPanel() {
    const list = $('pdfDividerLayerList');
    const controls = $('pdfDividerLayerControls');
    const active = $('pdfDividerLocalActive');
    if (active) active.textContent = selectedLayers.length ? `이미지 레이어 ${selectedLayers.length}개 사용 중` : '이미지 레이어 없음';
    if (list) {
      list.innerHTML = '';
      [...selectedLayers].reverse().forEach((layer, reverseIndex) => {
        const actualIndex = selectedLayers.length - 1 - reverseIndex;
        const button = document.createElement('button');
        button.type = 'button';
        button.className = `pdf-div-layer-item${layer.id === selectedLayerId ? ' active' : ''}`;
        const order = selectedLayers.length === 1 ? '유일한 레이어' : actualIndex === selectedLayers.length - 1 ? '맨 앞' : actualIndex === 0 ? '맨 뒤' : `${actualIndex + 1}번째`;
        button.innerHTML = `<span><strong></strong><small>${order} · 크기 ${Math.round(layer.scale)}%</small></span><small>선택</small>`;
        button.querySelector('strong').textContent = layer.name || `이미지 ${actualIndex + 1}`;
        button.addEventListener('click', () => { selectedLayerId = layer.id; syncPanel(); });
        list.appendChild(button);
      });
    }
    const layer = selectedLayer();
    controls?.classList.toggle('active', !!layer);
    if (!layer) return;
    const scale = $('pdfDividerLayerScale');
    const x = $('pdfDividerLayerX');
    const y = $('pdfDividerLayerY');
    if (scale) scale.value = String(layer.scale);
    if (x) x.value = String(layer.x);
    if (y) y.value = String(layer.y);
    if ($('pdfDividerLayerScaleValue')) $('pdfDividerLayerScaleValue').textContent = `${Math.round(layer.scale)}%`;
    if ($('pdfDividerLayerXValue')) $('pdfDividerLayerXValue').textContent = `${Math.round(layer.x)}%`;
    if ($('pdfDividerLayerYValue')) $('pdfDividerLayerYValue').textContent = `${Math.round(layer.y)}%`;
    const index = selectedLayers.indexOf(layer);
    if ($('pdfDividerLayerBack')) $('pdfDividerLayerBack').disabled = index <= 0;
    if ($('pdfDividerLayerFront')) $('pdfDividerLayerFront').disabled = index < 0 || index >= selectedLayers.length - 1;
  }

  function clearImage() {
    selectedLayers = [];
    selectedLayerId = '';
    if ($('pdfDividerLocalFile')) $('pdfDividerLocalFile').value = '';
    syncPanel();
    status('이미지 레이어를 모두 삭제했습니다.');
    updatePreview();
  }

  function updateSelected(field, value) {
    const layer = selectedLayer();
    if (!layer) return;
    if (field === 'scale') layer.scale = clamp(value, 10, 300, 100);
    else if (field === 'x') layer.x = clamp(value, 0, 100, 50);
    else if (field === 'y') layer.y = clamp(value, 0, 100, 50);
    syncPanel();
    updatePreview();
  }

  function moveSelected(delta) {
    const layer = selectedLayer();
    const index = selectedLayers.indexOf(layer);
    const next = index + delta;
    if (!layer || index < 0 || next < 0 || next >= selectedLayers.length) return;
    [selectedLayers[index], selectedLayers[next]] = [selectedLayers[next], selectedLayers[index]];
    syncPanel();
    updatePreview();
  }

  function deleteSelected() {
    const index = selectedLayers.findIndex((layer) => layer.id === selectedLayerId);
    if (index < 0) return;
    selectedLayers.splice(index, 1);
    selectedLayerId = selectedLayers[Math.min(index, selectedLayers.length - 1)]?.id || '';
    syncPanel();
    updatePreview();
  }

  function drawText(ctx, content, w, h) {
    const fg = content.fg || '#1f2937';
    const vAlign = content.textVAlign || 'center';
    const vOffsetPct = (Number(content.textVOffset) || 0) / 100;
    let cy = vAlign === 'top' ? h * .22 : vAlign === 'bottom' ? h * .78 : h * .5;
    cy += h * vOffsetPct;
    const titleOffset = content.subtitle ? -h * .06 : 0;
    ctx.save();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.shadowColor = 'rgba(0,0,0,.18)';
    ctx.shadowBlur = Math.max(1, h * .003);
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

  function drawLayer(ctx, layer, w, h) {
    const img = imageCache.get(layer.dataUrl);
    if (!img || !img.naturalWidth || !img.naturalHeight) return;
    const base = layer.fit === 'cover'
      ? Math.max(w / img.naturalWidth, h / img.naturalHeight)
      : Math.min(w / img.naturalWidth, h / img.naturalHeight);
    const scale = base * clamp(layer.scale, 10, 300, 100) / 100;
    const dw = img.naturalWidth * scale;
    const dh = img.naturalHeight * scale;
    const cx = w * clamp(layer.x, 0, 100, 50) / 100;
    const cy = h * clamp(layer.y, 0, 100, 50) / 100;
    ctx.drawImage(img, cx - dw / 2, cy - dh / 2, dw, dh);
  }

  function renderLocalDivider(content, w, h) {
    const c = document.createElement('canvas');
    c.width = w; c.height = h;
    const ctx = c.getContext('2d');
    ctx.fillStyle = content.noBg === false ? (content.bg || '#ffffff') : '#ffffff';
    ctx.fillRect(0, 0, w, h);
    contentLayers(content).forEach((layer) => drawLayer(ctx, layer, w, h));
    drawText(ctx, content, w, h);
    return c;
  }

  function canRenderLayers(content) {
    const layers = contentLayers(content);
    return layers.length > 0 && layers.every((layer) => imageCache.has(layer.dataUrl));
  }

  async function preloadLayers(layers) {
    await Promise.all((layers || []).map((layer) => preload(layer.dataUrl).catch(() => null)));
  }

  function setNewDividerDefaults() {
    const bg = $('dividerBg');
    const noBg = $('dividerNoBg');
    const fg = $('dividerFg');
    if (bg) { bg.value = '#ffffff'; bg.disabled = true; }
    if (noBg) noBg.checked = true;
    if (fg) fg.value = '#1f2937';
    updatePreview();
  }

  function patchFunctions() {
    if (!originalRenderDividerCanvas && typeof window.renderDividerCanvas === 'function') originalRenderDividerCanvas = window.renderDividerCanvas;
    if (originalRenderDividerCanvas && !window.renderDividerCanvas.__localImageV1) {
      const patched = function (content, w, h) {
        if (canRenderLayers(content)) return renderLocalDivider(content, w, h);
        return originalRenderDividerCanvas(content, w, h);
      };
      patched.__localImageV1 = true;
      patched.__localImageLayersV2 = true;
      window.renderDividerCanvas = patched;
    }

    if (!originalGetDividerContent && typeof window.getDividerContent === 'function') originalGetDividerContent = window.getDividerContent;
    if (originalGetDividerContent && !window.getDividerContent.__localImageV1) {
      const patched = function () {
        const content = originalGetDividerContent();
        const layers = serializableLayers();
        if (layers.length) {
          content.localImageLayers = layers;
          // Keep the first legacy fields for older saved sessions/readers.
          content.localImageDataUrl = layers[0].dataUrl;
          content.localImageName = layers[0].name;
        } else {
          delete content.localImageLayers;
          delete content.localImageDataUrl;
          delete content.localImageName;
        }
        return content;
      };
      patched.__localImageV1 = true;
      patched.__localImageLayersV2 = true;
      window.getDividerContent = patched;
    }

    if (!originalOpenDividerInsert && typeof window.openDividerInsert === 'function') originalOpenDividerInsert = window.openDividerInsert;
    if (originalOpenDividerInsert && !window.openDividerInsert.__localImageV1) {
      const patched = function () {
        selectedLayers = [];
        selectedLayerId = '';
        const result = Reflect.apply(originalOpenDividerInsert, this, arguments);
        setNewDividerDefaults();
        syncPanel();
        status('기본 배경은 없음(흰색)입니다. 필요한 이미지만 레이어로 추가하세요.');
        return result;
      };
      patched.__localImageV1 = true;
      patched.__localImageLayersV2 = true;
      window.openDividerInsert = patched;
    }

    if (!originalEditDivider && typeof window.editDivider === 'function') originalEditDivider = window.editDivider;
    if (originalEditDivider && !window.editDivider.__localImageV1) {
      const patched = function (page) {
        selectedLayers = contentLayers(page?.dividerContent || {});
        selectedLayerId = selectedLayers[selectedLayers.length - 1]?.id || '';
        const result = Reflect.apply(originalEditDivider, this, arguments);
        syncPanel();
        preloadLayers(selectedLayers).then(updatePreview).catch(() => {});
        return result;
      };
      patched.__localImageV1 = true;
      patched.__localImageLayersV2 = true;
      window.editDivider = patched;
    }

    if (!originalMakeDividerPageObj && typeof window.makeDividerPageObj === 'function') originalMakeDividerPageObj = window.makeDividerPageObj;
    if (originalMakeDividerPageObj && !window.makeDividerPageObj.__localImageV1) {
      const patched = function (content) {
        const page = originalMakeDividerPageObj(content);
        const layers = contentLayers(content);
        if (layers.some((layer) => !imageCache.has(layer.dataUrl))) {
          preloadLayers(layers).then(() => {
            page.thumbCanvas = window.renderDividerCanvas(content, 200, 283);
            try { renderThumbs(); } catch (_) {}
          }).catch(() => {});
        }
        return page;
      };
      patched.__localImageV1 = true;
      patched.__localImageLayersV2 = true;
      window.makeDividerPageObj = patched;
    }
  }

  async function addFiles(files) {
    const queue = Array.from(files || []);
    if (!queue.length) return;
    let added = 0;
    const failures = [];
    for (const file of queue) {
      if (selectedLayers.length >= MAX_LAYERS) {
        failures.push(`레이어는 최대 ${MAX_LAYERS}개까지 추가할 수 있습니다.`);
        break;
      }
      const validation = validateFile(file);
      if (!validation.ok) { failures.push(`${file?.name || '파일'}: ${validation.message}`); continue; }
      try {
        status(`${file.name} 최적화 중...`);
        const optimized = await optimizeFile(file);
        if (selectedBytes() + optimized.embeddedBytes > MAX_TOTAL_EMBED_BYTES) {
          failures.push(`${file.name}: 전체 이미지 용량 한도(15MB)를 초과합니다.`);
          continue;
        }
        await preload(optimized.dataUrl);
        const layer = normalizedLayer({
          id: newLayerId(),
          dataUrl: optimized.dataUrl,
          name: file.name,
          x: 50,
          y: 50,
          scale: 100,
          fit: 'contain',
          embeddedBytes: optimized.embeddedBytes,
        }, selectedLayers.length);
        selectedLayers.push(layer);
        selectedLayerId = layer.id;
        added += 1;
      } catch (error) {
        failures.push(`${file?.name || '파일'}: ${error?.message || '이미지를 불러오지 못했습니다.'}`);
      }
    }
    syncPanel();
    updatePreview();
    if (failures.length) status(`${added ? `${added}개 추가 · ` : ''}${failures[0]}`, true);
    else status(`${added}개 이미지 레이어를 추가했습니다.`);
  }

  function bind() {
    $('pdfDividerLocalFile')?.addEventListener('change', async (event) => {
      const files = event.target.files;
      event.target.value = '';
      await addFiles(files);
    });
    $('pdfDividerLocalClear')?.addEventListener('click', clearImage);
    $('pdfDividerLayerScale')?.addEventListener('input', (event) => updateSelected('scale', event.target.value));
    $('pdfDividerLayerX')?.addEventListener('input', (event) => updateSelected('x', event.target.value));
    $('pdfDividerLayerY')?.addEventListener('input', (event) => updateSelected('y', event.target.value));
    $('pdfDividerLayerBack')?.addEventListener('click', () => moveSelected(-1));
    $('pdfDividerLayerFront')?.addEventListener('click', () => moveSelected(1));
    $('pdfDividerLayerDelete')?.addEventListener('click', deleteSelected);
    $('pdfDividerLayerReset')?.addEventListener('click', () => {
      const layer = selectedLayer();
      if (!layer) return;
      layer.x = 50; layer.y = 50; layer.scale = 100;
      syncPanel();
      updatePreview();
    });
  }

  function install() {
    patchFunctions();
    if (installed) return true;
    if (!$('dividerModal') || typeof window.renderDividerCanvas !== 'function') return false;
    styles();
    if (!makePanel()) return false;
    bind();
    syncPanel();
    installed = true;
    document.documentElement.dataset.pdfDividerLocalImageUpload = '2';
    return true;
  }

  window.PdfDividerLocalImageUpload = {
    install,
    validateFile,
    optimizeFile,
    clearImage,
    preload,
    renderLocalDivider,
    addFiles,
    getLayers: () => serializableLayers(),
    stage: 'user-local-pdf-divider-source-500mb-auto-optimized',
    layerStage: 'pdf-divider-image-layers-v2',
    maxBytes: MAX_SOURCE_BYTES,
    maxEmbeddedBytes: MAX_EMBED_BYTES,
    maxTotalEmbeddedBytes: MAX_TOTAL_EMBED_BYTES,
    maxSourcePixels: MAX_SOURCE_PIXELS,
    maxLayers: MAX_LAYERS,
  };
  [700, 1300, 2200, 3200].forEach((delay) => setTimeout(install, delay));
})();