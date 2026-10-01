import { advancedState, selectedPage, isSheetLayoutMode } from './state.js';
import { currentLayout, outputPagePoints, renderThumbnail } from './preview.js';

const $ = id => document.getElementById(id);
const MM_PER_PT = 25.4 / 72;
const STANDARD_TRIMS = [
  { name: 'A5', width: 148, height: 210 },
  { name: 'B5', width: 182, height: 257 },
  { name: 'A4', width: 210, height: 297 },
  { name: 'B4', width: 257, height: 364 },
  { name: 'A3', width: 297, height: 420 },
];

let trimMode = 'auto';
let trimWidthMm = 0;
let trimHeightMm = 0;
let guideFrame = 0;
let thumbnailObserver = null;
let pageListObserver = null;

function actualSizeMm(page) {
  if (!page) return null;
  const out = outputPagePoints(page);
  return {
    width: Math.max(0, Number(out.width || 0) * MM_PER_PT),
    height: Math.max(0, Number(out.height || 0) * MM_PER_PT),
  };
}

function detectTrim(actual) {
  if (!actual?.width || !actual?.height) return { width: 0, height: 0, name: '' };
  const candidates = [];
  for (const preset of STANDARD_TRIMS) {
    for (const rotated of [false, true]) {
      const width = rotated ? preset.height : preset.width;
      const height = rotated ? preset.width : preset.height;
      const dw = actual.width - width;
      const dh = actual.height - height;
      if (dw < -0.6 || dh < -0.6) continue;
      if (dw / 2 > 10.5 || dh / 2 > 10.5) continue;
      candidates.push({
        width,
        height,
        name: preset.name,
        score: Math.abs(dw) + Math.abs(dh) + Math.abs(dw - dh) * 0.25,
      });
    }
  }
  candidates.sort((a, b) => a.score - b.score);
  return candidates[0] || { width: actual.width, height: actual.height, name: '파일크기' };
}

function activeTrim(actual) {
  if (!actual) return { width: 0, height: 0, name: '' };
  if (trimMode === 'manual' && trimWidthMm > 0 && trimHeightMm > 0) {
    return { width: trimWidthMm, height: trimHeightMm, name: '직접입력' };
  }
  return detectTrim(actual);
}

function installStyles() {
  if ($('pdfAdvancedInlineReviewV4Styles')) return;
  const style = document.createElement('style');
  style.id = 'pdfAdvancedInlineReviewV4Styles';
  style.textContent = `
    .advanced-app{grid-template-columns:340px minmax(0,1fr) 238px!important}
    .advanced-page-sidebar{grid-column:3;grid-row:1;height:100vh;min-height:0;overflow:hidden;background:#fff;border-left:1px solid var(--line);display:flex;flex-direction:column;padding:12px 10px 10px}
    .advanced-page-sidebar .page-section{border-top:0;padding:0;display:flex;flex-direction:column;min-height:0;flex:1}
    .advanced-page-sidebar .section-title-row{flex:0 0 auto;margin:2px 2px 5px}
    .advanced-page-sidebar .page-sidebar-help{font-size:9px;line-height:1.45;color:#64748b;margin:0 2px 9px}
    .advanced-page-sidebar .page-list{max-height:none;min-height:0;flex:1;overflow:auto;padding:2px 3px 12px;gap:7px;scrollbar-gutter:stable}
    .advanced-page-sidebar .page-item{grid-template-columns:54px minmax(0,1fr) 26px;min-height:70px;padding:6px;gap:7px;border-radius:10px}
    .advanced-page-sidebar .page-item canvas.page-sidebar-thumb{display:block;width:52px;height:64px;object-fit:contain;background:#fff;border:1px solid #dfe5ec;border-radius:4px}
    .advanced-page-sidebar .page-item-info strong{font-size:10px}
    .advanced-page-sidebar .page-item-info span{font-size:8px;line-height:1.35;white-space:normal;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}
    .advanced-page-sidebar .page-item.selected{box-shadow:inset 3px 0 0 #2563eb}

    .advanced-size-inspector{min-height:48px;flex:0 0 auto;display:flex;align-items:center;gap:10px;padding:7px 12px;background:#fff;border-bottom:1px solid #dce3ea;color:#334155;z-index:7}
    .advanced-size-block{display:flex;align-items:baseline;gap:5px;white-space:nowrap}
    .advanced-size-block strong{font-size:10px;color:#12396d}.advanced-size-block span{font-size:10px;font-weight:800;color:#475569}
    .advanced-trim-inputs{display:flex;align-items:center;gap:4px;margin-left:auto;white-space:nowrap}
    .advanced-trim-inputs label{font-size:9px;font-weight:900;color:#475569}
    .advanced-trim-inputs input{width:66px;height:30px;border:1px solid #d6dee7;border-radius:7px;padding:4px 6px;font-size:10px;font-weight:800;color:#172033;background:#fff}
    .advanced-trim-inputs .times{font-size:10px;color:#94a3b8}.advanced-trim-inputs .unit{font-size:9px;color:#64748b}
    .advanced-trim-auto{height:30px;border:1px solid #bfd0e3;border-radius:7px;background:#f8fbff;color:#12396d;padding:0 9px;font-size:9px;font-weight:900;cursor:pointer}
    .advanced-trim-status{min-width:116px;font-size:9px;font-weight:850;color:#166534;text-align:right;white-space:nowrap}.advanced-trim-status.warn{color:#b91c1c}

    .advanced-size-guide{position:absolute;pointer-events:none;z-index:3;border-radius:1px}
    .advanced-size-guide.actual{border:1.5px solid rgba(37,99,235,.9);box-shadow:0 0 0 1px rgba(255,255,255,.8) inset}
    .advanced-size-guide.trim{border:1.5px dashed rgba(220,38,38,.95);background:rgba(220,38,38,.025);z-index:4}
    .advanced-size-guide.warn{border-color:#b91c1c;background:rgba(185,28,28,.06)}
    .advanced-size-guide-label{position:absolute;left:4px;top:4px;padding:2px 5px;border-radius:5px;background:rgba(255,255,255,.94);font:850 8px Pretendard,"Noto Sans KR",sans-serif;white-space:nowrap;box-shadow:0 1px 4px rgba(15,23,42,.12)}
    .advanced-size-guide.actual .advanced-size-guide-label{color:#1d4ed8}.advanced-size-guide.trim .advanced-size-guide-label{color:#b91c1c}

    .output-section.advanced-output-grid{display:grid;grid-template-columns:minmax(0,1fr) 42px;gap:6px;align-items:stretch}
    .output-section.advanced-output-grid #downloadBtn{grid-column:1;grid-row:1;margin:0}
    .output-section.advanced-output-grid #advancedWorkspaceResetBtn{grid-column:2;grid-row:1;width:42px;min-height:44px;margin:0;border:1px solid #cfd8e3;border-radius:9px;background:#fff;color:#475569;padding:0;display:grid;place-items:center;cursor:pointer}
    .output-section.advanced-output-grid #advancedWorkspaceResetBtn:hover:not(:disabled){background:#f8fafc;color:#12396d;border-color:#9fb3ca}
    .output-section.advanced-output-grid #advancedWorkspaceResetBtn svg{width:18px;height:18px}
    .output-section.advanced-output-grid .program-direct-print-btn{grid-column:1/-1!important;grid-row:2!important;width:100%!important;margin-top:0!important}

    .advanced-print-review-section,#advancedPrintReviewWorkspace,#advancedPrintReviewConfig{display:none!important}
    body.print-review-active .workspace-toolbar,body.print-review-active #previewScroll{display:flex!important}

    @media(max-width:1180px){.advanced-app{grid-template-columns:310px minmax(0,1fr) 210px!important}.advanced-page-sidebar{width:auto}.advanced-size-inspector{gap:7px;padding-inline:9px}.advanced-trim-status{display:none}}
    @media(max-width:900px){.advanced-app{grid-template-columns:290px minmax(0,1fr) 184px!important}.advanced-page-sidebar{padding-inline:7px}.advanced-page-sidebar .page-item{grid-template-columns:46px minmax(0,1fr) 24px}.advanced-page-sidebar .page-item canvas.page-sidebar-thumb{width:44px;height:58px}.advanced-size-block span{font-size:9px}.advanced-trim-inputs input{width:58px}}
    @media(max-width:720px){body{overflow:auto}.advanced-app{display:grid!important;grid-template-columns:1fr!important;height:auto!important;min-height:100vh}.advanced-sidebar{grid-column:1;grid-row:1;height:auto}.advanced-workspace{grid-column:1;grid-row:2;height:70vh;min-height:520px}.advanced-page-sidebar{grid-column:1;grid-row:3;height:300px;border-left:0;border-top:1px solid var(--line)}.advanced-page-sidebar .page-list{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));align-content:start}.advanced-size-inspector{min-height:84px;flex-wrap:wrap}.advanced-trim-inputs{margin-left:0}.advanced-trim-status{display:block;margin-left:auto}}
  `;
  document.head.appendChild(style);
}

function removeLegacyPrintReview() {
  document.body?.classList.remove('print-review-active');
  document.querySelector('.advanced-print-review-section')?.remove();
  $('advancedPrintReviewWorkspace')?.remove();
  $('advancedPrintReviewConfig')?.remove();
}

function buildPageSidebar() {
  const app = $('advancedApp');
  const section = document.querySelector('.page-section');
  if (!app || !section) return;
  let sidebar = document.querySelector('.advanced-page-sidebar');
  if (!sidebar) {
    sidebar = document.createElement('aside');
    sidebar.className = 'advanced-page-sidebar';
    sidebar.setAttribute('aria-label', '페이지 선택');
    app.appendChild(sidebar);
  }
  if (section.parentElement !== sidebar) sidebar.appendChild(section);
  const title = section.querySelector('.section-title');
  if (title) title.textContent = '페이지 선택';
  if (!section.querySelector('.page-sidebar-help')) {
    const help = document.createElement('p');
    help.className = 'page-sidebar-help';
    help.textContent = '페이지를 클릭하면 가운데 편집창에서 즉시 해당 페이지를 편집합니다.';
    section.querySelector('.section-title-row')?.insertAdjacentElement('afterend', help);
  }
}

function renderSidebarThumb(canvas) {
  if (!canvas || canvas.dataset.rendering === '1' || canvas.dataset.rendered === '1') return;
  const item = canvas.closest('.page-item');
  const page = advancedState.pages.find(entry => String(entry.id) === String(item?.dataset.pageId));
  if (!page) return;
  canvas.dataset.rendering = '1';
  renderThumbnail(page, canvas)
    .then(() => { canvas.dataset.rendered = '1'; })
    .catch(error => console.warn('[pdf-advanced] page thumbnail failed', error))
    .finally(() => { canvas.dataset.rendering = '0'; });
}

function observeThumb(canvas) {
  if (!canvas) return;
  if (!('IntersectionObserver' in window)) return renderSidebarThumb(canvas);
  if (!thumbnailObserver) {
    thumbnailObserver = new IntersectionObserver(entries => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        renderSidebarThumb(entry.target);
      }
    }, { root: $('pageList'), rootMargin: '220px 0px' });
  }
  thumbnailObserver.observe(canvas);
}

function enhancePageItems() {
  const list = $('pageList');
  if (!list) return;
  for (const item of list.querySelectorAll('.page-item')) {
    const page = advancedState.pages.find(entry => String(entry.id) === String(item.dataset.pageId));
    if (!page) continue;
    let canvas = item.querySelector('canvas.page-sidebar-thumb');
    if (!canvas) {
      canvas = document.createElement('canvas');
      canvas.className = 'page-sidebar-thumb';
      canvas.setAttribute('aria-hidden', 'true');
      item.insertBefore(canvas, item.firstChild);
      observeThumb(canvas);
    }
    const info = item.querySelector('.page-item-info');
    if (info && !info.querySelector('span')) {
      const source = document.createElement('span');
      source.textContent = page.sourceName || 'PDF';
      info.appendChild(source);
    }
  }
}

function watchPageList() {
  const list = $('pageList');
  if (!list || pageListObserver) return;
  enhancePageItems();
  pageListObserver = new MutationObserver(() => enhancePageItems());
  pageListObserver.observe(list, { childList: true, subtree: false });
  list.addEventListener('click', () => {
    setTimeout(() => {
      list.querySelector('.page-item.selected')?.scrollIntoView({ block: 'nearest' });
      scheduleGuide();
    }, 40);
  });
}

function installSizeInspector() {
  const workspace = document.querySelector('.advanced-workspace');
  const toolbar = document.querySelector('.workspace-toolbar');
  const scroll = $('previewScroll');
  if (!workspace || !toolbar || !scroll || $('advancedSizeInspector')) return;
  const inspector = document.createElement('div');
  inspector.id = 'advancedSizeInspector';
  inspector.className = 'advanced-size-inspector';
  inspector.innerHTML = `
    <div class="advanced-size-block"><strong>파일 실제</strong><span id="advancedActualSizeText">-</span></div>
    <div class="advanced-size-block"><strong>재단</strong><span id="advancedTrimPresetText">자동</span></div>
    <div class="advanced-trim-inputs">
      <label for="advancedTrimWidth">재단사이즈</label>
      <input id="advancedTrimWidth" type="number" min="1" max="1200" step="0.1" aria-label="재단 폭 mm">
      <span class="times">×</span>
      <input id="advancedTrimHeight" type="number" min="1" max="1200" step="0.1" aria-label="재단 높이 mm">
      <span class="unit">mm</span>
      <button id="advancedTrimAuto" class="advanced-trim-auto" type="button">자동</button>
    </div>
    <div id="advancedTrimStatus" class="advanced-trim-status">PDF를 불러와 주세요</div>`;
  toolbar.insertAdjacentElement('afterend', inspector);

  const applyManual = () => {
    trimWidthMm = Math.max(1, Math.min(1200, Number($('advancedTrimWidth')?.value) || 0));
    trimHeightMm = Math.max(1, Math.min(1200, Number($('advancedTrimHeight')?.value) || 0));
    trimMode = 'manual';
    syncSizeInspector();
    scheduleGuide();
  };
  $('advancedTrimWidth').addEventListener('change', applyManual);
  $('advancedTrimHeight').addEventListener('change', applyManual);
  $('advancedTrimWidth').addEventListener('input', applyManual);
  $('advancedTrimHeight').addEventListener('input', applyManual);
  $('advancedTrimAuto').addEventListener('click', () => {
    trimMode = 'auto';
    syncSizeInspector();
    scheduleGuide();
  });
}

function ensureGuides() {
  const stage = $('pageStage');
  const layer = $('interactionLayer');
  if (!stage || !layer) return null;
  let actual = $('advancedActualGuide');
  if (!actual) {
    actual = document.createElement('div');
    actual.id = 'advancedActualGuide';
    actual.className = 'advanced-size-guide actual';
    actual.innerHTML = '<span class="advanced-size-guide-label">파일 실제</span>';
    stage.insertBefore(actual, layer);
  }
  let trim = $('advancedTrimGuide');
  if (!trim) {
    trim = document.createElement('div');
    trim.id = 'advancedTrimGuide';
    trim.className = 'advanced-size-guide trim';
    trim.innerHTML = '<span class="advanced-size-guide-label">재단</span>';
    stage.insertBefore(trim, layer);
  }
  return { actual, trim };
}

function originalBoxFromLayout(page, layout) {
  const canvas = $('previewCanvas');
  if (!canvas || !layout) return null;
  if (!isSheetLayoutMode()) {
    return { x: 0, y: 0, width: canvas.width, height: canvas.height };
  }
  const rotation = ((Number(page.rotation || 0) % 360) + 360) % 360;
  const cropX = Math.max(.05, 1 - Number(page.crop?.left || 0) - Number(page.crop?.right || 0));
  const cropY = Math.max(.05, 1 - Number(page.crop?.top || 0) - Number(page.crop?.bottom || 0));
  const ratioX = rotation === 90 || rotation === 270 ? cropY : cropX;
  const ratioY = rotation === 90 || rotation === 270 ? cropX : cropY;
  const width = layout.dest.width / ratioX;
  const height = layout.dest.height / ratioY;
  return {
    x: layout.dest.x + layout.dest.width / 2 - width / 2,
    y: layout.dest.y + layout.dest.height / 2 - height / 2,
    width,
    height,
  };
}

function placeGuideNode(node, box, canvas) {
  if (!node || !box || !canvas) return;
  const sx = canvas.clientWidth / Math.max(1, canvas.width);
  const sy = canvas.clientHeight / Math.max(1, canvas.height);
  node.style.left = `${box.x * sx}px`;
  node.style.top = `${box.y * sy}px`;
  node.style.width = `${Math.max(2, box.width * sx)}px`;
  node.style.height = `${Math.max(2, box.height * sy)}px`;
}

function syncSizeInspector() {
  installSizeInspector();
  const page = selectedPage();
  const actualText = $('advancedActualSizeText');
  const presetText = $('advancedTrimPresetText');
  const status = $('advancedTrimStatus');
  const widthInput = $('advancedTrimWidth');
  const heightInput = $('advancedTrimHeight');
  if (!actualText || !presetText || !status || !widthInput || !heightInput) return;
  if (!page) {
    actualText.textContent = '-';
    presetText.textContent = '자동';
    widthInput.value = '';
    heightInput.value = '';
    widthInput.disabled = true;
    heightInput.disabled = true;
    $('advancedTrimAuto').disabled = true;
    status.classList.remove('warn');
    status.textContent = 'PDF를 불러와 주세요';
    return;
  }
  const actual = actualSizeMm(page);
  const trim = activeTrim(actual);
  widthInput.disabled = false;
  heightInput.disabled = false;
  $('advancedTrimAuto').disabled = false;
  if (document.activeElement !== widthInput) widthInput.value = trim.width.toFixed(1);
  if (document.activeElement !== heightInput) heightInput.value = trim.height.toFixed(1);
  actualText.textContent = `${actual.width.toFixed(1)} × ${actual.height.toFixed(1)} mm`;
  presetText.textContent = trimMode === 'auto' ? `${trim.name || '자동'} ${trim.width.toFixed(1)} × ${trim.height.toFixed(1)} mm` : `직접 ${trim.width.toFixed(1)} × ${trim.height.toFixed(1)} mm`;
  const bleedX = (actual.width - trim.width) / 2;
  const bleedY = (actual.height - trim.height) / 2;
  const invalid = bleedX < -0.25 || bleedY < -0.25;
  status.classList.toggle('warn', invalid);
  if (invalid) status.textContent = '재단사이즈가 파일보다 큽니다';
  else if (Math.abs(bleedX - bleedY) < 0.15) status.textContent = `재단여유 사방 ${Math.max(0, bleedX).toFixed(1)} mm`;
  else status.textContent = `재단여유 좌우 ${Math.max(0, bleedX).toFixed(1)} · 상하 ${Math.max(0, bleedY).toFixed(1)} mm`;
}

function updateGuides() {
  guideFrame = 0;
  syncSizeInspector();
  const page = selectedPage();
  const canvas = $('previewCanvas');
  const layout = currentLayout();
  const guides = ensureGuides();
  if (!page || !canvas || !layout || !guides || $('pageStage')?.hidden) {
    if (guides?.actual) guides.actual.hidden = true;
    if (guides?.trim) guides.trim.hidden = true;
    return;
  }
  const actual = actualSizeMm(page);
  const trim = activeTrim(actual);
  const base = originalBoxFromLayout(page, layout);
  if (!base || !actual?.width || !actual?.height) return;
  guides.actual.hidden = false;
  guides.trim.hidden = false;
  guides.actual.querySelector('.advanced-size-guide-label').textContent = `파일 실제 ${actual.width.toFixed(1)}×${actual.height.toFixed(1)}mm`;
  placeGuideNode(guides.actual, base, canvas);

  const ratioW = trim.width / actual.width;
  const ratioH = trim.height / actual.height;
  const trimBox = {
    x: base.x + (base.width - base.width * ratioW) / 2,
    y: base.y + (base.height - base.height * ratioH) / 2,
    width: base.width * ratioW,
    height: base.height * ratioH,
  };
  guides.trim.classList.toggle('warn', ratioW > 1.002 || ratioH > 1.002);
  guides.trim.querySelector('.advanced-size-guide-label').textContent = `재단 ${trim.width.toFixed(1)}×${trim.height.toFixed(1)}mm`;
  placeGuideNode(guides.trim, trimBox, canvas);
}

function scheduleGuide() {
  if (guideFrame) cancelAnimationFrame(guideFrame);
  guideFrame = requestAnimationFrame(() => {
    requestAnimationFrame(updateGuides);
  });
}

function decorateResetButton() {
  const output = document.querySelector('.output-section');
  const download = $('downloadBtn');
  const reset = $('advancedWorkspaceResetBtn');
  if (!output || !download || !reset) return false;
  output.classList.add('advanced-output-grid');
  download.textContent = 'PDF 저장';
  reset.className = '';
  reset.setAttribute('aria-label', '편집 초기화');
  reset.title = '편집 초기화 · PDF 원본은 유지하고 편집 내용과 출력 설정을 초기화합니다.';
  reset.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 12a9 9 0 1 0 3-6.7"/><path d="M3 4v6h6"/></svg>';
  if (reset.previousElementSibling !== download) download.insertAdjacentElement('afterend', reset);
  return true;
}

function initializeResetPlacement() {
  if (decorateResetButton()) return;
  let tries = 0;
  const timer = setInterval(() => {
    tries += 1;
    if (decorateResetButton() || tries > 80) clearInterval(timer);
  }, 50);
}

function installObservers() {
  const canvas = $('previewCanvas');
  if (canvas && 'ResizeObserver' in window) new ResizeObserver(scheduleGuide).observe(canvas);
  window.addEventListener('resize', scheduleGuide);
  window.addEventListener('pdf-advanced-state-change', event => {
    const reason = String(event?.detail?.reason || '');
    if (reason === 'workspace-reset' || reason === 'reset') trimMode = 'auto';
    if (/upload|rotate|orientation|reset|history|paper|crop|fine/.test(reason)) {
      document.querySelectorAll('canvas.page-sidebar-thumb').forEach(canvasNode => {
        canvasNode.dataset.rendered = '0';
        observeThumb(canvasNode);
      });
    }
    scheduleGuide();
  });
  document.querySelector('.toolbar-actions')?.addEventListener('click', () => setTimeout(scheduleGuide, 50), true);
}

function install() {
  installStyles();
  buildPageSidebar();
  watchPageList();
  removeLegacyPrintReview();
  installSizeInspector();
  ensureGuides();
  initializeResetPlacement();
  installObservers();
  syncSizeInspector();
  scheduleGuide();
  document.documentElement.dataset.pdfAdvancedInlineReview = 'workspace-v4';
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', install, { once: true });
else install();
