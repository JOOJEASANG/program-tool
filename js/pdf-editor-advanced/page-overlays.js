import { advancedState, selectedPage, checkpoint, emitStateChange } from './state.js';

const $ = id => document.getElementById(id);
const META_MARKER = '\n__PS_OVERLAYS_V1__=';
const MAX_OVERLAYS_PER_PAGE = 20;
const MAX_IMAGE_DATA_CHARS = 550000;
const MAX_SINGLE_IMAGE_CHARS = 340000;
let selectedOverlayId = null;
let dragState = null;
let editTransaction = false;
let resizeObserver = null;

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const clone = value => JSON.parse(JSON.stringify(value));

function setStatus(message, type = 'info') {
  const node = $('statusLine');
  if (!node) return;
  node.textContent = message;
  node.style.color = type === 'error' ? '#b91c1c' : type === 'success' ? '#166534' : '#64748b';
}

function splitOrientationMetadata(value) {
  const text = String(value || '');
  const index = text.indexOf(META_MARKER);
  if (index < 0) return { base: text, overlays: null };
  const base = text.slice(0, index);
  try {
    const overlays = JSON.parse(text.slice(index + META_MARKER.length));
    return { base, overlays: Array.isArray(overlays) ? overlays : [] };
  } catch (_) {
    return { base, overlays: [] };
  }
}

function sanitizeOverlay(item) {
  if (!item || (item.type !== 'text' && item.type !== 'image')) return null;
  const base = {
    id: String(item.id || `ov-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`),
    type: item.type,
    x: clamp(Number(item.x ?? .15), 0, .98),
    y: clamp(Number(item.y ?? .15), 0, .98),
    width: clamp(Number(item.width ?? .3), .02, 1),
    height: clamp(Number(item.height ?? .08), .02, 1),
  };
  base.width = Math.min(base.width, 1 - base.x);
  base.height = Math.min(base.height, 1 - base.y);
  if (base.type === 'text') {
    return {
      ...base,
      text: String(item.text || '텍스트').slice(0, 500),
      fontSize: clamp(Number(item.fontSize || 18), 5, 96),
      color: /^#[0-9a-f]{6}$/i.test(String(item.color || '')) ? String(item.color) : '#111111',
      bold: !!item.bold,
      align: ['left', 'center', 'right'].includes(item.align) ? item.align : 'left',
    };
  }
  const dataUrl = String(item.dataUrl || '');
  if (!/^data:image\/(png|jpeg);base64,/i.test(dataUrl)) return null;
  return {
    ...base,
    dataUrl,
    name: String(item.name || '삽입 이미지').slice(0, 120),
  };
}

function ensurePageOverlays(page) {
  if (!page) return [];
  if (Array.isArray(page.overlays)) {
    page.overlays = page.overlays.map(sanitizeOverlay).filter(Boolean).slice(0, MAX_OVERLAYS_PER_PAGE);
    return page.overlays;
  }
  const decoded = splitOrientationMetadata(page.orientationSource);
  page.orientationSource = decoded.base;
  page.overlays = (decoded.overlays || []).map(sanitizeOverlay).filter(Boolean).slice(0, MAX_OVERLAYS_PER_PAGE);
  persistPageMetadata(page);
  return page.overlays;
}

function persistPageMetadata(page) {
  if (!page) return;
  const decoded = splitOrientationMetadata(page.orientationSource);
  const base = decoded.base || '';
  const overlays = Array.isArray(page.overlays) ? page.overlays.map(sanitizeOverlay).filter(Boolean) : [];
  page.overlays = overlays;
  page.orientationSource = overlays.length ? `${base}${META_MARKER}${JSON.stringify(overlays)}` : base;
}

function hydrateAllPages() {
  advancedState.pages.forEach(ensurePageOverlays);
}

function totalImageChars() {
  let total = 0;
  for (const page of advancedState.pages) {
    for (const overlay of ensurePageOverlays(page)) {
      if (overlay.type === 'image') total += String(overlay.dataUrl || '').length;
    }
  }
  return total;
}

function selectedOverlay() {
  const page = selectedPage();
  return ensurePageOverlays(page).find(item => item.id === selectedOverlayId) || null;
}

function installStyles() {
  if ($('pdfAdvancedPageOverlayStyles')) return;
  const style = document.createElement('style');
  style.id = 'pdfAdvancedPageOverlayStyles';
  style.textContent = `
    #insertOverlaySection .overlay-actions{margin-bottom:8px}
    #insertOverlaySection .overlay-editor{border:1px solid #dbe3ec;border-radius:9px;background:#f8fafc;padding:9px;margin-top:8px}
    #insertOverlaySection .overlay-editor[hidden]{display:none!important}
    #insertOverlaySection textarea{width:100%;min-height:62px;resize:vertical;border:1px solid #cfd8e3;border-radius:7px;padding:7px;font:500 11px Pretendard,sans-serif;color:#1e293b;background:#fff;outline:none}
    #insertOverlaySection textarea:focus{border-color:#3b82f6;box-shadow:0 0 0 2px rgba(59,130,246,.08)}
    #insertOverlaySection .overlay-props{display:grid;grid-template-columns:1fr 1fr;gap:6px;margin-top:7px}
    #insertOverlaySection .overlay-props label{font-size:9px;font-weight:800;color:#64748b}
    #insertOverlaySection .overlay-props input,#insertOverlaySection .overlay-props select{width:100%;height:31px;margin-top:3px;border:1px solid #cfd8e3;border-radius:6px;background:#fff;font-size:10px;padding:0 6px}
    #insertOverlaySection .overlay-check{display:flex;align-items:center;gap:6px;margin-top:8px;font-size:10px;font-weight:800;color:#475569}
    #insertOverlaySection .overlay-check input{width:auto}
    #overlayDeleteBtn{width:100%;height:32px;margin-top:8px;border:1px solid #fecaca;border-radius:7px;background:#fff;color:#b91c1c;font-size:10px;font-weight:850;cursor:pointer}
    #pdfAdvancedOverlayLayer{position:absolute;z-index:12;pointer-events:none;overflow:hidden}
    .pdf-advanced-overlay{position:absolute;box-sizing:border-box;pointer-events:auto;cursor:move;user-select:none;border:1px solid transparent;touch-action:none}
    .pdf-advanced-overlay:hover{border-color:rgba(37,99,235,.5)}
    .pdf-advanced-overlay.selected{border:1.5px solid #2563eb;box-shadow:0 0 0 2px rgba(37,99,235,.12)}
    .pdf-advanced-overlay.text{display:flex;align-items:flex-start;overflow:hidden;white-space:pre-wrap;word-break:break-word;line-height:1.25;padding:2px}
    .pdf-advanced-overlay.image{background:#fff center/contain no-repeat}
    .pdf-advanced-overlay .overlay-resize{position:absolute;right:-5px;bottom:-5px;width:11px;height:11px;border:2px solid #fff;border-radius:50%;background:#2563eb;box-shadow:0 0 0 1px #2563eb;cursor:nwse-resize;display:none}
    .pdf-advanced-overlay.selected .overlay-resize{display:block}
    html[data-pdf-advanced-erase-sticky="true"] .pdf-advanced-overlay{pointer-events:auto}
  `;
  document.head.appendChild(style);
}

function installUi() {
  if ($('insertOverlaySection')) return;
  const anchor = $('pageEditSection');
  if (!anchor) return;
  const section = document.createElement('section');
  section.className = 'tool-section';
  section.id = 'insertOverlaySection';
  section.innerHTML = `
    <div class="section-title">삽입</div>
    <div class="button-grid two overlay-actions">
      <button id="addTextOverlayBtn" class="tool-btn" type="button" disabled>T 텍스트 추가</button>
      <button id="addImageOverlayBtn" class="tool-btn" type="button" disabled>▧ 이미지 추가</button>
    </div>
    <input id="overlayImageInput" type="file" accept="image/png,image/jpeg" hidden>
    <div id="overlayEditPanel" class="overlay-editor" hidden>
      <div id="overlayTextFields">
        <textarea id="overlayTextInput" maxlength="500" placeholder="삽입할 텍스트"></textarea>
        <div class="overlay-props">
          <label>글자크기<input id="overlayFontSize" type="number" min="5" max="96" step="1" value="18"></label>
          <label>정렬<select id="overlayAlign"><option value="left">왼쪽</option><option value="center">가운데</option><option value="right">오른쪽</option></select></label>
          <label>색상<input id="overlayColor" type="color" value="#111111"></label>
        </div>
        <label class="overlay-check"><input id="overlayBold" type="checkbox"> 굵게</label>
      </div>
      <div id="overlayImageFields" class="hint" hidden>이미지를 드래그하여 이동하고 오른쪽 아래 파란 점으로 크기를 조절합니다.</div>
      <button id="overlayDeleteBtn" type="button">선택 항목 삭제</button>
    </div>
    <p class="hint">현재 페이지에만 추가됩니다. 텍스트·이미지를 직접 드래그하고 크기를 조절할 수 있습니다.</p>`;
  anchor.insertAdjacentElement('afterend', section);

  $('addTextOverlayBtn').addEventListener('click', addTextOverlay);
  $('addImageOverlayBtn').addEventListener('click', () => $('overlayImageInput').click());
  $('overlayImageInput').addEventListener('change', handleImagePick);
  $('overlayDeleteBtn').addEventListener('click', deleteSelectedOverlay);

  for (const id of ['overlayTextInput','overlayFontSize','overlayAlign','overlayColor','overlayBold']) {
    const input = $(id);
    input.addEventListener('focus', beginEditTransaction);
    input.addEventListener('pointerdown', beginEditTransaction);
    input.addEventListener('input', applyOverlayEditor);
    input.addEventListener('change', () => { applyOverlayEditor(); endEditTransaction(); });
    input.addEventListener('blur', endEditTransaction);
  }
}

function ensureOverlayLayer() {
  const stage = $('pageStage');
  const canvas = $('previewCanvas');
  if (!stage || !canvas) return null;
  let layer = $('pdfAdvancedOverlayLayer');
  if (!layer) {
    layer = document.createElement('div');
    layer.id = 'pdfAdvancedOverlayLayer';
    stage.appendChild(layer);
  }
  const stageRect = stage.getBoundingClientRect();
  const canvasRect = canvas.getBoundingClientRect();
  layer.style.left = `${canvasRect.left - stageRect.left}px`;
  layer.style.top = `${canvasRect.top - stageRect.top}px`;
  layer.style.width = `${canvasRect.width}px`;
  layer.style.height = `${canvasRect.height}px`;
  layer.hidden = canvasRect.width < 2 || canvasRect.height < 2 || !selectedPage();
  return layer;
}

function outputPoints(page) {
  const rotation = ((Number(page?.rotation || 0) % 360) + 360) % 360;
  const width = Number(page?.widthPt || page?.sourceWidthPt || 595);
  const height = Number(page?.heightPt || page?.sourceHeightPt || 842);
  return rotation === 90 || rotation === 270 ? { width: height, height: width } : { width, height };
}

function renderOverlayLayer() {
  const layer = ensureOverlayLayer();
  const page = selectedPage();
  if (!layer || !page) return;
  const overlays = ensurePageOverlays(page);
  if (!overlays.some(item => item.id === selectedOverlayId)) selectedOverlayId = null;
  layer.replaceChildren();
  const pagePoints = outputPoints(page);
  const layerWidth = Math.max(1, layer.clientWidth);
  for (const overlay of overlays) {
    const node = document.createElement('div');
    node.className = `pdf-advanced-overlay ${overlay.type}${overlay.id === selectedOverlayId ? ' selected' : ''}`;
    node.dataset.overlayId = overlay.id;
    node.style.left = `${overlay.x * 100}%`;
    node.style.top = `${overlay.y * 100}%`;
    node.style.width = `${overlay.width * 100}%`;
    node.style.height = `${overlay.height * 100}%`;
    if (overlay.type === 'text') {
      node.textContent = overlay.text;
      node.style.color = overlay.color;
      node.style.fontWeight = overlay.bold ? '800' : '500';
      node.style.textAlign = overlay.align;
      node.style.justifyContent = overlay.align === 'center' ? 'center' : overlay.align === 'right' ? 'flex-end' : 'flex-start';
      node.style.fontSize = `${Math.max(7, overlay.fontSize * layerWidth / Math.max(1, pagePoints.width))}px`;
    } else {
      node.style.backgroundImage = `url(${overlay.dataUrl})`;
      node.setAttribute('aria-label', overlay.name || '삽입 이미지');
    }
    const handle = document.createElement('i');
    handle.className = 'overlay-resize';
    handle.dataset.overlayResize = '1';
    node.appendChild(handle);
    node.addEventListener('pointerdown', startOverlayGesture);
    layer.appendChild(node);
  }
  syncEditorPanel();
}

function syncButtons() {
  const disabled = !selectedPage() || advancedState.busy;
  if ($('addTextOverlayBtn')) $('addTextOverlayBtn').disabled = disabled;
  if ($('addImageOverlayBtn')) $('addImageOverlayBtn').disabled = disabled;
}

function syncEditorPanel() {
  const panel = $('overlayEditPanel');
  if (!panel) return;
  const overlay = selectedOverlay();
  panel.hidden = !overlay;
  if (!overlay) return;
  const isText = overlay.type === 'text';
  $('overlayTextFields').hidden = !isText;
  $('overlayImageFields').hidden = isText;
  if (isText) {
    $('overlayTextInput').value = overlay.text;
    $('overlayFontSize').value = String(overlay.fontSize);
    $('overlayColor').value = overlay.color;
    $('overlayBold').checked = !!overlay.bold;
    $('overlayAlign').value = overlay.align;
  }
}

function beginEditTransaction() {
  if (editTransaction || !selectedOverlay()) return;
  checkpoint('삽입 항목 편집');
  editTransaction = true;
}
function endEditTransaction() { editTransaction = false; }

function applyOverlayEditor() {
  const overlay = selectedOverlay();
  const page = selectedPage();
  if (!overlay || overlay.type !== 'text' || !page) return;
  overlay.text = String($('overlayTextInput').value || '').slice(0, 500);
  overlay.fontSize = clamp(Number($('overlayFontSize').value || 18), 5, 96);
  overlay.color = $('overlayColor').value;
  overlay.bold = $('overlayBold').checked;
  overlay.align = $('overlayAlign').value;
  persistPageMetadata(page);
  renderOverlayLayer();
  emitStateChange('overlay-text-edit');
}

function addTextOverlay() {
  const page = selectedPage();
  if (!page || advancedState.busy) return;
  const overlays = ensurePageOverlays(page);
  if (overlays.length >= MAX_OVERLAYS_PER_PAGE) return setStatus(`한 페이지에는 최대 ${MAX_OVERLAYS_PER_PAGE}개까지 삽입할 수 있습니다.`, 'error');
  checkpoint('텍스트 추가');
  const overlay = sanitizeOverlay({
    id: `txt-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
    type: 'text', x: .16, y: .16, width: .34, height: .08,
    text: '텍스트', fontSize: 18, color: '#111111', bold: false, align: 'left',
  });
  overlays.push(overlay);
  selectedOverlayId = overlay.id;
  persistPageMetadata(page);
  renderOverlayLayer();
  emitStateChange('overlay-add-text');
  setTimeout(() => { $('overlayTextInput')?.focus(); $('overlayTextInput')?.select(); }, 0);
}

function loadImage(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => { URL.revokeObjectURL(url); resolve(image); };
    image.onerror = () => { URL.revokeObjectURL(url); reject(new Error('이미지를 읽을 수 없습니다.')); };
    image.src = url;
  });
}

function canvasDataUrl(image, maxDimension, quality) {
  const scale = Math.min(1, maxDimension / Math.max(1, image.naturalWidth, image.naturalHeight));
  const width = Math.max(1, Math.round(image.naturalWidth * scale));
  const height = Math.max(1, Math.round(image.naturalHeight * scale));
  const canvas = document.createElement('canvas');
  canvas.width = width; canvas.height = height;
  const ctx = canvas.getContext('2d', { alpha: false });
  ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, width, height);
  ctx.drawImage(image, 0, 0, width, height);
  return { dataUrl: canvas.toDataURL('image/jpeg', quality), width, height };
}

async function compressImage(file) {
  if (!/^image\/(png|jpeg)$/i.test(file.type) || file.size > 10 * 1024 * 1024) {
    throw new Error('PNG/JPG 이미지만 사용할 수 있으며 원본은 10MB 이하여야 합니다.');
  }
  const image = await loadImage(file);
  let maxDimension = 1600;
  let quality = .9;
  let result = canvasDataUrl(image, maxDimension, quality);
  while (result.dataUrl.length > MAX_SINGLE_IMAGE_CHARS && maxDimension > 520) {
    maxDimension = Math.round(maxDimension * .82);
    quality = Math.max(.72, quality - .04);
    result = canvasDataUrl(image, maxDimension, quality);
  }
  if (result.dataUrl.length > MAX_SINGLE_IMAGE_CHARS) throw new Error('이미지 용량을 충분히 줄일 수 없습니다. 더 작은 이미지를 사용해 주세요.');
  return result;
}

async function handleImagePick(event) {
  const input = event.currentTarget;
  const file = input.files?.[0];
  input.value = '';
  const page = selectedPage();
  if (!file || !page || advancedState.busy) return;
  const overlays = ensurePageOverlays(page);
  if (overlays.length >= MAX_OVERLAYS_PER_PAGE) return setStatus(`한 페이지에는 최대 ${MAX_OVERLAYS_PER_PAGE}개까지 삽입할 수 있습니다.`, 'error');
  try {
    setStatus('삽입 이미지를 가볍게 최적화하는 중...');
    const result = await compressImage(file);
    if (totalImageChars() + result.dataUrl.length > MAX_IMAGE_DATA_CHARS) {
      throw new Error('삽입 이미지가 너무 많습니다. 편집저장과 속도 보호를 위해 이미지 총량을 줄여 주세요.');
    }
    const canvas = $('previewCanvas');
    const rect = canvas?.getBoundingClientRect();
    const aspect = result.height / Math.max(1, result.width);
    const width = .28;
    const height = clamp(width * aspect * ((rect?.width || 1) / Math.max(1, rect?.height || 1)), .05, .42);
    checkpoint('이미지 추가');
    const overlay = sanitizeOverlay({
      id: `img-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
      type: 'image', x: .18, y: .18, width, height,
      dataUrl: result.dataUrl, name: file.name,
    });
    overlays.push(overlay);
    selectedOverlayId = overlay.id;
    persistPageMetadata(page);
    renderOverlayLayer();
    emitStateChange('overlay-add-image');
    setStatus('이미지를 추가했습니다. 드래그하여 위치와 크기를 조절하세요.', 'success');
  } catch (error) {
    setStatus(error.message || '이미지를 추가하지 못했습니다.', 'error');
  }
}

function deleteSelectedOverlay() {
  const page = selectedPage();
  const overlay = selectedOverlay();
  if (!page || !overlay) return;
  checkpoint('삽입 항목 삭제');
  page.overlays = ensurePageOverlays(page).filter(item => item.id !== overlay.id);
  selectedOverlayId = null;
  persistPageMetadata(page);
  renderOverlayLayer();
  emitStateChange('overlay-delete');
}

function startOverlayGesture(event) {
  if (event.button !== 0) return;
  const node = event.currentTarget;
  const page = selectedPage();
  const overlay = ensurePageOverlays(page).find(item => item.id === node.dataset.overlayId);
  const layer = $('pdfAdvancedOverlayLayer');
  if (!page || !overlay || !layer || advancedState.busy) return;
  event.preventDefault(); event.stopPropagation();
  selectedOverlayId = overlay.id;
  renderOverlayLayer();
  checkpoint(event.target?.dataset?.overlayResize === '1' ? '삽입 항목 크기 조절' : '삽입 항목 이동');
  dragState = {
    pointerId: event.pointerId,
    overlay,
    resize: event.target?.dataset?.overlayResize === '1',
    startX: event.clientX,
    startY: event.clientY,
    x: overlay.x, y: overlay.y, width: overlay.width, height: overlay.height,
    layerWidth: Math.max(1, layer.clientWidth),
    layerHeight: Math.max(1, layer.clientHeight),
  };
  try { node.setPointerCapture?.(event.pointerId); } catch (_) {}
}

function moveOverlayGesture(event) {
  const gesture = dragState;
  if (!gesture || event.pointerId !== gesture.pointerId) return;
  event.preventDefault();
  const dx = (event.clientX - gesture.startX) / gesture.layerWidth;
  const dy = (event.clientY - gesture.startY) / gesture.layerHeight;
  if (gesture.resize) {
    gesture.overlay.width = clamp(gesture.width + dx, .02, 1 - gesture.overlay.x);
    gesture.overlay.height = clamp(gesture.height + dy, .02, 1 - gesture.overlay.y);
  } else {
    gesture.overlay.x = clamp(gesture.x + dx, 0, 1 - gesture.overlay.width);
    gesture.overlay.y = clamp(gesture.y + dy, 0, 1 - gesture.overlay.height);
  }
  persistPageMetadata(selectedPage());
  renderOverlayLayer();
}

function endOverlayGesture(event) {
  const gesture = dragState;
  if (!gesture || event.pointerId !== gesture.pointerId) return;
  dragState = null;
  persistPageMetadata(selectedPage());
  renderOverlayLayer();
  emitStateChange(gesture.resize ? 'overlay-resize' : 'overlay-move');
}

function handleStateChange(event) {
  const reason = String(event?.detail?.reason || '');
  hydrateAllPages();
  if (reason === 'reset') selectedOverlayId = null;
  if (reason === 'session-load' || reason === 'page-navigation' || reason === 'upload') selectedOverlayId = null;
  syncButtons();
  requestAnimationFrame(renderOverlayLayer);
}

function bindGlobalEvents() {
  window.addEventListener('pointermove', moveOverlayGesture, { passive: false });
  window.addEventListener('pointerup', endOverlayGesture);
  window.addEventListener('pointercancel', endOverlayGesture);
  window.addEventListener('resize', () => requestAnimationFrame(renderOverlayLayer));
  window.addEventListener('pdf-advanced-state-change', handleStateChange);
  $('pageList')?.addEventListener('click', () => { selectedOverlayId = null; setTimeout(renderOverlayLayer, 0); }, true);
  document.addEventListener('keydown', event => {
    if ((event.key !== 'Delete' && event.key !== 'Backspace') || !selectedOverlay()) return;
    const tag = String(document.activeElement?.tagName || '').toLowerCase();
    if (tag === 'input' || tag === 'textarea' || tag === 'select') return;
    event.preventDefault();
    deleteSelectedOverlay();
  });
  const canvas = $('previewCanvas');
  if (canvas && typeof ResizeObserver === 'function') {
    resizeObserver = new ResizeObserver(() => requestAnimationFrame(renderOverlayLayer));
    resizeObserver.observe(canvas);
  }
}

function boot() {
  installStyles();
  installUi();
  hydrateAllPages();
  syncButtons();
  ensureOverlayLayer();
  bindGlobalEvents();
  renderOverlayLayer();
  document.documentElement.dataset.pdfAdvancedPageOverlays = 'text-image-v1';
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once: true });
else boot();

window.PdfAdvancedPageOverlays = {
  ensurePageOverlays,
  persistPageMetadata,
  render: renderOverlayLayer,
  maxImageDataChars: MAX_IMAGE_DATA_CHARS,
  stage: 'selected-page-lightweight-overlays-v1',
};
