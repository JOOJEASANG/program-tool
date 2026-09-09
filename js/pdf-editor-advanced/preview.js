import { advancedState, selectedPage } from './state.js';

const PT_PER_MM = 72 / 25.4;
const MAX_SOURCE_CANVAS_CACHE = 8;
const sourceCanvasCache = new Map();
let lastLayout = null;

function clamp(value, min, max) { return Math.max(min, Math.min(max, value)); }

function cacheSourceCanvas(key, canvas) {
  if (sourceCanvasCache.has(key)) sourceCanvasCache.delete(key);
  sourceCanvasCache.set(key, canvas);
  while (sourceCanvasCache.size > MAX_SOURCE_CANVAS_CACHE) {
    const oldestKey = sourceCanvasCache.keys().next().value;
    if (oldestKey == null) break;
    sourceCanvasCache.delete(oldestKey);
  }
}

export function clearPreviewCache() {
  sourceCanvasCache.clear();
  lastLayout = null;
}

export async function sourceCanvasFor(page) {
  const key = `${page.fileIndex}:${page.pageIndex}`;
  if (sourceCanvasCache.has(key)) {
    const cached = sourceCanvasCache.get(key);
    sourceCanvasCache.delete(key);
    sourceCanvasCache.set(key, cached);
    return cached;
  }
  const pdf = advancedState.documents[page.fileIndex];
  if (!pdf) throw new Error('원본 PDF를 찾을 수 없습니다.');
  const pdfPage = await pdf.getPage(page.pageIndex + 1);
  const base = pdfPage.getViewport({ scale: 1, rotation: 0 });
  const maxDim = Math.max(base.width, base.height);
  const renderScale = clamp(1600 / Math.max(1, maxDim), 1.1, 2.4);
  const viewport = pdfPage.getViewport({ scale: renderScale, rotation: 0 });
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(viewport.width));
  canvas.height = Math.max(1, Math.round(viewport.height));
  const context = canvas.getContext('2d', { alpha: false });
  context.fillStyle = '#fff'; context.fillRect(0, 0, canvas.width, canvas.height);
  await pdfPage.render({ canvasContext: context, viewport }).promise;
  cacheSourceCanvas(key, canvas);
  return canvas;
}

function outputPagePoints(page) {
  const quarter = Number(page.rotation || 0) % 360;
  return quarter === 90 || quarter === 270
    ? { width: page.heightPt, height: page.widthPt }
    : { width: page.widthPt, height: page.heightPt };
}

function pageNumberFor(page) {
  const index = advancedState.pages.findIndex(item => item.id === page.id);
  return index >= 0 ? index + 1 : 1;
}

function isFacingEvenPage(page) {
  return !!advancedState.margins.facingPages && pageNumberFor(page) % 2 === 0;
}

function effectiveMargins(page) {
  const margin = advancedState.margins;
  if (isFacingEvenPage(page)) {
    return { left: margin.right, right: margin.left, top: margin.top, bottom: margin.bottom };
  }
  return { left: margin.left, right: margin.right, top: margin.top, bottom: margin.bottom };
}

function mirroredPosition(position, page) {
  if (!isFacingEvenPage(page)) return position;
  if (position.includes('left')) return position.replace('left', 'right');
  if (position.includes('right')) return position.replace('right', 'left');
  return position;
}

function drawSourceWithErase(page, source) {
  if (!page.eraseRegions?.length) return source;
  const canvas = document.createElement('canvas');
  canvas.width = source.width; canvas.height = source.height;
  const ctx = canvas.getContext('2d', { alpha: false });
  ctx.drawImage(source, 0, 0);
  ctx.fillStyle = '#fff';
  for (const region of page.eraseRegions) {
    const x0 = clamp(Number(region.x0 || 0), 0, 1) * source.width;
    const y0 = clamp(Number(region.y0 || 0), 0, 1) * source.height;
    const x1 = clamp(Number(region.x1 || 0), 0, 1) * source.width;
    const y1 = clamp(Number(region.y1 || 0), 0, 1) * source.height;
    ctx.fillRect(x0, y0, Math.max(0, x1 - x0), Math.max(0, y1 - y0));
  }
  return canvas;
}

function croppedRotatedCanvas(page, source) {
  const left = clamp(page.crop.left, 0, .9);
  const top = clamp(page.crop.top, 0, .9);
  const right = clamp(page.crop.right, 0, .9);
  const bottom = clamp(page.crop.bottom, 0, .9);
  const cx = Math.round(source.width * left);
  const cy = Math.round(source.height * top);
  const cw = Math.max(1, Math.round(source.width * (1 - left - right)));
  const ch = Math.max(1, Math.round(source.height * (1 - top - bottom)));
  const crop = document.createElement('canvas'); crop.width = cw; crop.height = ch;
  crop.getContext('2d', { alpha: false }).drawImage(source, cx, cy, cw, ch, 0, 0, cw, ch);

  const rotation = Number(page.rotation || 0) % 360;
  if (!rotation) return { canvas: crop, cropPx: { x: cx, y: cy, width: cw, height: ch }, full: { width: source.width, height: source.height } };
  const rotated = document.createElement('canvas');
  if (rotation === 90 || rotation === 270) { rotated.width = ch; rotated.height = cw; }
  else { rotated.width = cw; rotated.height = ch; }
  const ctx = rotated.getContext('2d', { alpha: false });
  ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, rotated.width, rotated.height);
  if (rotation === 90) { ctx.translate(ch, 0); ctx.rotate(Math.PI / 2); }
  else if (rotation === 180) { ctx.translate(cw, ch); ctx.rotate(Math.PI); }
  else if (rotation === 270) { ctx.translate(0, cw); ctx.rotate(-Math.PI / 2); }
  ctx.drawImage(crop, 0, 0);
  return { canvas: rotated, cropPx: { x: cx, y: cy, width: cw, height: ch }, full: { width: source.width, height: source.height } };
}

function substitute(text, pageNumber, total) {
  return String(text || '')
    .replaceAll('{page}', String(pageNumber))
    .replaceAll('{pages}', String(total));
}

function drawAlignedText(ctx, text, x0, x1, y, align, size, color) {
  if (!text) return;
  ctx.save();
  ctx.fillStyle = color; ctx.font = `${Math.max(8, size)}px Pretendard, Arial, sans-serif`;
  ctx.textBaseline = 'top'; ctx.textAlign = align;
  const x = align === 'left' ? x0 : align === 'right' ? x1 : (x0 + x1) / 2;
  ctx.fillText(text, x, y, Math.max(1, x1 - x0));
  ctx.restore();
}

function drawOverlays(ctx, page, out, scaleX, scaleY) {
  const index = advancedState.pages.findIndex(item => item.id === page.id);
  const number = index + 1; const total = advancedState.pages.length;
  const facingEven = isFacingEvenPage(page);
  const margin = effectiveMargins(page);
  const hf = advancedState.headerFooter;
  if (hf.enabled) {
    const marginY = hf.margin * PT_PER_MM * scaleY;
    const marginX = Math.max(hf.margin, margin.left) * PT_PER_MM * scaleX;
    const rightMargin = Math.max(hf.margin, margin.right) * PT_PER_MM * scaleX;
    const fontPx = hf.fontSize * scaleY;
    const left = marginX, right = ctx.canvas.width - rightMargin;
    const topY = marginY, bottomY = Math.max(0, ctx.canvas.height - marginY - fontPx * 1.5);
    const headerLeft = facingEven ? hf.headerRight : hf.headerLeft;
    const headerRight = facingEven ? hf.headerLeft : hf.headerRight;
    const footerLeft = facingEven ? hf.footerRight : hf.footerLeft;
    const footerRight = facingEven ? hf.footerLeft : hf.footerRight;
    drawAlignedText(ctx, substitute(headerLeft, number, total), left, (left + right) / 2, topY, 'left', fontPx, hf.color);
    drawAlignedText(ctx, substitute(hf.headerCenter, number, total), left, right, topY, 'center', fontPx, hf.color);
    drawAlignedText(ctx, substitute(headerRight, number, total), (left + right) / 2, right, topY, 'right', fontPx, hf.color);
    drawAlignedText(ctx, substitute(footerLeft, number, total), left, (left + right) / 2, bottomY, 'left', fontPx, hf.color);
    drawAlignedText(ctx, substitute(hf.footerCenter, number, total), left, right, bottomY, 'center', fontPx, hf.color);
    drawAlignedText(ctx, substitute(footerRight, number, total), (left + right) / 2, right, bottomY, 'right', fontPx, hf.color);
  }

  const pn = advancedState.pageNumbers;
  if (pn.enabled && !(pn.excludeFirst && index === 0)) {
    const visible = index + pn.start - (pn.excludeFirst ? 1 : 0);
    const visibleTotal = Math.max(0, total - (pn.excludeFirst ? 1 : 0)) + pn.start - 1;
    let text = String(visible);
    if (pn.format === '1/N') text = `${visible}/${visibleTotal}`;
    else if (pn.format === '-1-') text = `- ${visible} -`;
    else if (pn.format === '-1/N-') text = `- ${visible}/${visibleTotal} -`;
    const fontPx = pn.fontSize * scaleY;
    const gapY = Math.max(pn.margin, margin.top) * PT_PER_MM * scaleY;
    const bottomGapY = Math.max(pn.margin, margin.bottom) * PT_PER_MM * scaleY;
    const leftGapX = Math.max(pn.margin, margin.left) * PT_PER_MM * scaleX;
    const rightGapX = Math.max(pn.margin, margin.right) * PT_PER_MM * scaleX;
    const position = mirroredPosition(pn.position, page);
    const isBottom = position.startsWith('bottom');
    const y = isBottom ? ctx.canvas.height - bottomGapY - fontPx * 1.45 : gapY;
    const horizontal = position.split('-')[1];
    const align = horizontal === 'center' ? 'center' : horizontal;
    drawAlignedText(ctx, text, leftGapX, ctx.canvas.width - rightGapX, y, align, fontPx, pn.color);
  }
}

export async function renderSelectedPreview(canvas) {
  const page = selectedPage();
  if (!page) { lastLayout = null; return null; }
  const sourceBase = await sourceCanvasFor(page);
  const source = drawSourceWithErase(page, sourceBase);
  const rotated = croppedRotatedCanvas(page, source);
  const out = outputPagePoints(page);
  const zoom = clamp(advancedState.zoom || 1, .5, 2.5);
  const maxCssWidth = 900 * zoom, maxCssHeight = 1250 * zoom;
  const fit = Math.min(maxCssWidth / out.width, maxCssHeight / out.height);
  const cssWidth = Math.max(180, Math.round(out.width * fit));
  const cssHeight = Math.max(180, Math.round(out.height * fit));
  const dpr = clamp(window.devicePixelRatio || 1, 1, 2);
  canvas.width = Math.round(cssWidth * dpr); canvas.height = Math.round(cssHeight * dpr);
  canvas.style.width = `${cssWidth}px`; canvas.style.height = `${cssHeight}px`;
  const ctx = canvas.getContext('2d', { alpha: false });
  ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, canvas.width, canvas.height);
  const scaleX = canvas.width / out.width, scaleY = canvas.height / out.height;
  const margin = effectiveMargins(page);
  const content = {
    x: margin.left * PT_PER_MM * scaleX,
    y: margin.top * PT_PER_MM * scaleY,
    width: canvas.width - (margin.left + margin.right) * PT_PER_MM * scaleX,
    height: canvas.height - (margin.top + margin.bottom) * PT_PER_MM * scaleY,
  };
  content.width = Math.max(2, content.width); content.height = Math.max(2, content.height);

  const fitScale = Math.min(content.width / rotated.canvas.width, content.height / rotated.canvas.height);
  const baseW = rotated.canvas.width * fitScale, baseH = rotated.canvas.height * fitScale;
  const pxPerMmX = PT_PER_MM * scaleX, pxPerMmY = PT_PER_MM * scaleY;
  const destW = baseW * page.scale, destH = baseH * page.scale;
  const centerX = content.x + content.width / 2 + page.offsetX * pxPerMmX;
  const centerY = content.y + content.height / 2 + page.offsetY * pxPerMmY;
  const dest = { x: centerX - destW / 2, y: centerY - destH / 2, width: destW, height: destH };

  ctx.save();
  ctx.beginPath(); ctx.rect(content.x, content.y, content.width, content.height); ctx.clip();
  ctx.drawImage(rotated.canvas, dest.x, dest.y, dest.width, dest.height);
  ctx.restore();

  if (margin.left || margin.right || margin.top || margin.bottom) {
    ctx.save(); ctx.strokeStyle = 'rgba(30,100,190,.45)'; ctx.lineWidth = Math.max(1, dpr); ctx.setLineDash([6*dpr,4*dpr]);
    ctx.strokeRect(content.x, content.y, content.width, content.height); ctx.restore();
  }
  drawOverlays(ctx, page, out, scaleX, scaleY);

  lastLayout = {
    pageId: page.id,
    canvasWidth: canvas.width, canvasHeight: canvas.height,
    cssWidth, cssHeight,
    dest, content,
    cropPx: rotated.cropPx,
    full: rotated.full,
    rotatedWidth: rotated.canvas.width,
    rotatedHeight: rotated.canvas.height,
    rotation: Number(page.rotation || 0) % 360,
  };
  return lastLayout;
}

export function currentLayout() { return lastLayout; }

export function backingPointFromClient(canvas, clientX, clientY) {
  const rect = canvas.getBoundingClientRect();
  return {
    x: (clientX - rect.left) * (canvas.width / Math.max(1, rect.width)),
    y: (clientY - rect.top) * (canvas.height / Math.max(1, rect.height)),
  };
}

export function sourceNormalizedFromBacking(point, layout = lastLayout) {
  if (!layout) return null;
  const d = layout.dest;
  const rx = clamp((point.x - d.x) / Math.max(1e-6, d.width), 0, 1) * layout.rotatedWidth;
  const ry = clamp((point.y - d.y) / Math.max(1e-6, d.height), 0, 1) * layout.rotatedHeight;
  const cw = layout.cropPx.width, ch = layout.cropPx.height;
  let u = rx, v = ry;
  if (layout.rotation === 90) { u = ry; v = ch - rx; }
  else if (layout.rotation === 180) { u = cw - rx; v = ch - ry; }
  else if (layout.rotation === 270) { u = cw - ry; v = rx; }
  return {
    x: clamp((layout.cropPx.x + u) / layout.full.width, 0, 1),
    y: clamp((layout.cropPx.y + v) / layout.full.height, 0, 1),
  };
}

export function sourceSideForVisualEdge(edge, rotation) {
  const maps = {
    0: { left: 'left', right: 'right', top: 'top', bottom: 'bottom' },
    90: { left: 'bottom', right: 'top', top: 'left', bottom: 'right' },
    180: { left: 'right', right: 'left', top: 'bottom', bottom: 'top' },
    270: { left: 'top', right: 'bottom', top: 'right', bottom: 'left' },
  };
  return (maps[Number(rotation || 0) % 360] || maps[0])[edge];
}

export async function renderThumbnail(page, canvas) {
  const pdf = advancedState.documents[page.fileIndex];
  if (!pdf) return;
  const pdfPage = await pdf.getPage(page.pageIndex + 1);
  const base = pdfPage.getViewport({ scale: 1, rotation: 0 });
  const maxW = 72, maxH = 92;
  const scale = clamp(Math.min(maxW / Math.max(1, base.width), maxH / Math.max(1, base.height)), .05, .5);
  const viewport = pdfPage.getViewport({ scale, rotation: 0 });
  canvas.width = Math.max(1, Math.round(viewport.width));
  canvas.height = Math.max(1, Math.round(viewport.height));
  const ctx = canvas.getContext('2d', { alpha: false });
  ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, canvas.width, canvas.height);
  await pdfPage.render({ canvasContext: ctx, viewport }).promise;
}
