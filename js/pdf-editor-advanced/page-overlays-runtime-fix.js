import { advancedState, selectedPage, emitStateChange } from './state.js';

const $ = id => document.getElementById(id);
const MAX_FILE_BYTES = 10 * 1024 * 1024;
const MAX_SINGLE_IMAGE_CHARS = 340000;
let gesture = null;
let bound = false;

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

function overlayApi() {
  return window.PdfAdvancedPageOverlays || null;
}

function setStatus(message, type = 'info') {
  const node = $('statusLine');
  if (!node) return;
  node.textContent = message;
  node.style.color = type === 'error' ? '#b91c1c' : type === 'success' ? '#166534' : '#64748b';
}

function pageById(id) {
  return advancedState.pages.find(page => String(page.id) === String(id)) || null;
}

function overlayById(page, id) {
  if (!page || !Array.isArray(page.overlays)) return null;
  return page.overlays.find(item => String(item.id) === String(id)) || null;
}

function currentOverlayNode(id) {
  const layer = $('pdfAdvancedOverlayLayer');
  if (!layer) return null;
  return [...layer.querySelectorAll('.pdf-advanced-overlay')]
    .find(node => String(node.dataset.overlayId) === String(id)) || null;
}

function onStagePointerDown(event) {
  const target = event.target instanceof Element ? event.target.closest('.pdf-advanced-overlay') : null;
  if (!target || event.button !== 0 || advancedState.busy) return;
  const page = selectedPage();
  const api = overlayApi();
  if (!page || !api) return;

  // Capture the gesture before the legacy target listener selects the overlay
  // and rebuilds its DOM. Only stable ids/geometry are retained here; every
  // pointermove resolves the current live page overlay again by id.
  const overlay = overlayById(page, target.dataset.overlayId);
  const layer = $('pdfAdvancedOverlayLayer');
  if (!overlay || !layer) return;

  gesture = {
    pointerId: event.pointerId,
    pageId: page.id,
    overlayId: overlay.id,
    resize: event.target?.dataset?.overlayResize === '1',
    startX: event.clientX,
    startY: event.clientY,
    x: Number(overlay.x || 0),
    y: Number(overlay.y || 0),
    width: Number(overlay.width || .02),
    height: Number(overlay.height || .02),
    layerWidth: Math.max(1, layer.clientWidth),
    layerHeight: Math.max(1, layer.clientHeight),
  };
  document.documentElement.dataset.pdfAdvancedOverlayDragging = 'true';
}

function onPointerMove(event) {
  const active = gesture;
  if (!active || event.pointerId !== active.pointerId) return;
  const page = pageById(active.pageId);
  const overlay = overlayById(page, active.overlayId);
  if (!page || !overlay) return;

  event.preventDefault();
  event.stopImmediatePropagation();

  const dx = (event.clientX - active.startX) / active.layerWidth;
  const dy = (event.clientY - active.startY) / active.layerHeight;
  if (active.resize) {
    overlay.width = clamp(active.width + dx, .02, 1 - Number(overlay.x || 0));
    overlay.height = clamp(active.height + dy, .02, 1 - Number(overlay.y || 0));
  } else {
    overlay.x = clamp(active.x + dx, 0, 1 - Number(overlay.width || .02));
    overlay.y = clamp(active.y + dy, 0, 1 - Number(overlay.height || .02));
  }

  // Keep pointer movement lightweight: update only the current DOM node while
  // dragging. Persist/sanitize once on pointerup so the live object reference
  // cannot be replaced in the middle of a gesture.
  const node = currentOverlayNode(active.overlayId);
  if (node) {
    node.style.left = `${overlay.x * 100}%`;
    node.style.top = `${overlay.y * 100}%`;
    node.style.width = `${overlay.width * 100}%`;
    node.style.height = `${overlay.height * 100}%`;
  }
}

function finishGesture(event) {
  const active = gesture;
  if (!active || event.pointerId !== active.pointerId) return;
  event.preventDefault();
  event.stopImmediatePropagation();
  gesture = null;
  delete document.documentElement.dataset.pdfAdvancedOverlayDragging;

  const page = pageById(active.pageId);
  const api = overlayApi();
  if (!page || !api) return;
  api.persistPageMetadata(page);
  api.render();
  emitStateChange(active.resize ? 'overlay-resize' : 'overlay-move');
}

function imageKind(file) {
  const type = String(file?.type || '').toLowerCase();
  const name = String(file?.name || '').toLowerCase();
  if (type === 'image/png' || /\.png$/i.test(name)) return 'png';
  if (type === 'image/jpeg' || type === 'image/jpg' || type === 'image/pjpeg' || /\.jpe?g$/i.test(name)) return 'jpeg';
  return '';
}

function loadImage(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => {
      URL.revokeObjectURL(url);
      if (!image.naturalWidth || !image.naturalHeight) reject(new Error('이미지 크기를 확인할 수 없습니다.'));
      else resolve(image);
    };
    image.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('이미지를 읽을 수 없습니다. PNG 또는 JPG 파일인지 확인해 주세요.'));
    };
    image.src = url;
  });
}

function canvasDataUrl(image, maxDimension, quality) {
  const scale = Math.min(1, maxDimension / Math.max(1, image.naturalWidth, image.naturalHeight));
  const width = Math.max(1, Math.round(image.naturalWidth * scale));
  const height = Math.max(1, Math.round(image.naturalHeight * scale));
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d', { alpha: false });
  if (!ctx) throw new Error('브라우저에서 이미지 편집 캔버스를 만들 수 없습니다.');
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, width, height);
  ctx.drawImage(image, 0, 0, width, height);
  return { dataUrl: canvas.toDataURL('image/jpeg', quality), width, height };
}

async function compressImage(file) {
  if (!imageKind(file)) throw new Error('PNG/JPG 이미지만 추가할 수 있습니다.');
  if (Number(file.size || 0) > MAX_FILE_BYTES) throw new Error('이미지 원본은 10MB 이하만 추가할 수 있습니다.');
  const image = await loadImage(file);
  let maxDimension = 1600;
  let quality = .9;
  let result = canvasDataUrl(image, maxDimension, quality);
  while (result.dataUrl.length > MAX_SINGLE_IMAGE_CHARS && maxDimension > 520) {
    maxDimension = Math.round(maxDimension * .82);
    quality = Math.max(.72, quality - .04);
    result = canvasDataUrl(image, maxDimension, quality);
  }
  if (result.dataUrl.length > MAX_SINGLE_IMAGE_CHARS) {
    throw new Error('이미지를 충분히 최적화할 수 없습니다. 더 작은 이미지를 사용해 주세요.');
  }
  return result;
}

function totalImageChars(api) {
  let total = 0;
  for (const page of advancedState.pages) {
    const overlays = Array.isArray(page.overlays) ? page.overlays : api.ensurePageOverlays(page);
    for (const overlay of overlays) {
      if (overlay.type === 'image') total += String(overlay.dataUrl || '').length;
    }
  }
  return total;
}

async function addImageFile(file) {
  const api = overlayApi();
  const page = selectedPage();
  if (!api) throw new Error('이미지 삽입 기능을 불러오지 못했습니다.');
  if (!page) throw new Error('먼저 PDF 페이지를 선택해 주세요.');
  if (advancedState.busy) throw new Error('현재 PDF 처리 작업이 끝난 뒤 이미지를 추가해 주세요.');

  const pageId = page.id;
  const overlays = api.ensurePageOverlays(page);
  if (overlays.length >= 20) throw new Error('한 페이지에는 최대 20개까지 삽입할 수 있습니다.');

  setStatus('삽입 이미지를 최적화하는 중...');
  const result = await compressImage(file);
  const targetPage = pageById(pageId);
  if (!targetPage) throw new Error('이미지를 추가할 페이지를 찾을 수 없습니다.');
  const targetOverlays = api.ensurePageOverlays(targetPage);
  const maxTotal = Number(api.maxImageDataChars || 550000);
  if (totalImageChars(api) + result.dataUrl.length > maxTotal) {
    throw new Error('삽입 이미지가 너무 많습니다. 편집저장과 속도 보호를 위해 이미지 총량을 줄여 주세요.');
  }

  const canvas = $('previewCanvas');
  const rect = canvas?.getBoundingClientRect();
  const aspect = result.height / Math.max(1, result.width);
  const width = .28;
  const height = clamp(width * aspect * ((rect?.width || 1) / Math.max(1, rect?.height || 1)), .05, .42);
  const overlay = {
    id: `img-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
    type: 'image',
    x: .18,
    y: .18,
    width,
    height,
    dataUrl: result.dataUrl,
    name: String(file.name || '삽입 이미지').slice(0, 120),
  };

  targetOverlays.push(overlay);
  api.persistPageMetadata(targetPage);
  if (String(selectedPage()?.id) === String(pageId)) api.render();
  emitStateChange('overlay-add-image');
  setStatus('이미지를 추가했습니다. 이미지를 클릭한 뒤 드래그하여 이동할 수 있습니다.', 'success');
  return overlay;
}

async function onImageChange(event) {
  const input = event.currentTarget;
  const file = input.files?.[0];
  if (!file) return;

  // Capture the change before the legacy handler so only one image is added.
  event.stopImmediatePropagation();
  input.disabled = true;
  try {
    await addImageFile(file);
  } catch (error) {
    setStatus(error?.message || '이미지를 추가하지 못했습니다.', 'error');
  } finally {
    input.value = '';
    input.disabled = false;
  }
}

function bind() {
  if (bound) return true;
  const api = overlayApi();
  const stage = $('pageStage');
  const input = $('overlayImageInput');
  if (!api || !stage || !input) return false;
  bound = true;

  input.accept = 'image/png,image/jpeg,image/jpg,.png,.jpg,.jpeg';
  $('addImageOverlayBtn')?.addEventListener('click', () => { input.value = ''; }, true);
  input.addEventListener('change', onImageChange, true);

  // Capture before the legacy target handler can rebuild the overlay DOM.
  // Pointer movement is then owned at window capture phase using stable ids.
  stage.addEventListener('pointerdown', onStagePointerDown, true);
  window.addEventListener('pointermove', onPointerMove, { capture: true, passive: false });
  window.addEventListener('pointerup', finishGesture, { capture: true, passive: false });
  window.addEventListener('pointercancel', finishGesture, { capture: true, passive: false });

  document.documentElement.dataset.pdfAdvancedOverlayInteractionFix = 'v2';
  window.PdfAdvancedOverlayInteractionFix = {
    addImageFile,
    stage: 'drag-live-object-image-compat-v2',
  };
  return true;
}

function boot(attempt = 0) {
  if (bind()) return;
  if (attempt < 20) setTimeout(() => boot(attempt + 1), 50 + attempt * 10);
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => boot(), { once: true });
else boot();
