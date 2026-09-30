import { advancedState } from './state.js';
import { renderPagePreview, outputPagePoints } from './preview.js';

const $ = id => document.getElementById(id);
const MM_PER_PT = 25.4 / 72;
const TOLERANCE = 0.8;
const SHEETS = {
  a3: { label: 'A3', w: 297, h: 420 },
  b4: { label: 'B4', w: 257, h: 364 },
  a4: { label: 'A4', w: 210, h: 297 },
  b5: { label: 'B5', w: 182, h: 257 },
  isoB5: { label: 'ISO B5', w: 176, h: 250 },
  a5: { label: 'A5', w: 148, h: 210 },
  custom: { label: '직접 입력', w: 0, h: 0 },
};

let active = false;
let currentPage = 1;
let renderSerial = 0;
let resizeFrame = 0;
let thumbObserver = null;
let specs = {
  sheetPreset: 'b5',
  sheetW: 182,
  sheetH: 257,
  trimW: 0,
  trimH: 0,
  bleed: 3,
  safeZone: 5,
  bindingSafe: 10,
};

function pages() { return advancedState.pages || []; }
function round1(value) { return Math.round((Number(value) || 0) * 10) / 10; }
function fmt(value) { return Number.isFinite(Number(value)) ? round1(value).toFixed(1) : '-'; }
function pageMm(page) {
  const out = outputPagePoints(page);
  return { width: out.width * MM_PER_PT, height: out.height * MM_PER_PT };
}

function installStyles() {
  if ($('pdfAdvancedPrintReviewStyles')) return;
  const style = document.createElement('style');
  style.id = 'pdfAdvancedPrintReviewStyles';
  style.textContent = `
    .advanced-print-review-section .hint{margin-top:6px}
    .advanced-print-review-btn{width:100%;border:0;border-radius:8px;background:#12396d;color:#fff;padding:9px 10px;font:900 11px Pretendard,sans-serif;cursor:pointer}
    .advanced-print-review-btn:disabled{opacity:.45;cursor:not-allowed}
    body.print-review-active .workspace-toolbar,body.print-review-active #previewScroll{display:none!important}
    .advanced-print-review-workspace{display:none;position:absolute;inset:0;padding:10px;grid-template-columns:minmax(0,1fr) 260px;gap:10px;background:#eef3f7;z-index:20}
    body.print-review-active .advanced-print-review-workspace{display:grid}
    .apr-stage{min-width:0;min-height:0;display:flex;flex-direction:column;background:#fff;border:1px solid #dbe3eb;border-radius:14px;overflow:hidden;position:relative}
    .apr-toolbar{display:flex;align-items:center;gap:7px;padding:9px 10px;border-bottom:1px solid #e5e7eb;background:#fff}
    .apr-toolbar strong{font-size:12px;color:#12396d}.apr-toolbar .apr-spacer{flex:1}.apr-toolbar button{border:1px solid #d7e0e9;border-radius:8px;background:#fff;color:#475569;padding:6px 9px;font:850 10px Pretendard,sans-serif;cursor:pointer}.apr-toolbar button.primary{background:#12396d;border-color:#12396d;color:#fff}
    .apr-canvas-wrap{flex:1;min-height:0;display:grid;place-items:center;overflow:hidden;padding:10px;background:#f5f7fa}.apr-canvas-wrap canvas{max-width:100%;max-height:100%;display:block}
    .apr-report{position:absolute;left:16px;bottom:16px;max-width:min(590px,calc(100% - 32px));background:rgba(15,23,42,.92);color:#fff;border-radius:11px;padding:10px 12px;font-size:9px;line-height:1.55;box-shadow:0 8px 24px rgba(0,0,0,.2)}
    .apr-report strong{font-size:10px}.apr-ok{color:#86efac}.apr-warn{color:#fde68a}.apr-fail{color:#fca5a5}
    .apr-side{min-height:0;background:#fff;border:1px solid #dbe3eb;border-radius:14px;display:flex;flex-direction:column;overflow:hidden}.apr-side-head{padding:10px;border-bottom:1px solid #e5e7eb}.apr-side-title{font-size:12px;font-weight:900;color:#12396d}.apr-side-sub{font-size:9px;color:#64748b;line-height:1.45;margin-top:3px}.apr-nav{display:grid;grid-template-columns:1fr auto 1fr;gap:6px;align-items:center;margin-top:8px}.apr-nav button{border:1px solid #dbe3eb;background:#fff;border-radius:7px;padding:6px;font:800 9px Pretendard,sans-serif;cursor:pointer}.apr-nav strong{font-size:10px;color:#334155}.apr-thumbs{flex:1;min-height:0;overflow:auto;padding:8px;display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:7px;align-content:start}.apr-thumb{border:2px solid transparent;border-radius:9px;background:#f8fafc;padding:5px;cursor:pointer;min-width:0}.apr-thumb.active{border-color:#2563eb;background:#eff6ff}.apr-thumb canvas{display:block;width:100%;height:92px;object-fit:contain;background:#fff;border:1px solid #e2e8f0}.apr-thumb span{display:block;margin-top:4px;text-align:center;font-size:9px;font-weight:800;color:#475569;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
    .apr-config{display:none;position:fixed;inset:0;z-index:2600;background:rgba(15,23,42,.62);align-items:center;justify-content:center;padding:18px}.apr-config.open{display:flex}.apr-config-box{width:min(470px,100%);max-height:90vh;overflow:auto;background:#fff;border-radius:18px;padding:18px;box-shadow:0 28px 90px rgba(0,0,0,.28)}.apr-config-head{display:flex;align-items:center;gap:8px;margin-bottom:13px}.apr-config-head strong{font-size:16px;color:#12396d}.apr-config-head button{margin-left:auto;border:0;background:#f1f5f9;border-radius:8px;width:32px;height:32px;cursor:pointer}.apr-fields{display:grid;grid-template-columns:1fr 1fr;gap:9px}.apr-field.full{grid-column:1/-1}.apr-field label{font-size:9px;font-weight:850;color:#475569;display:block;margin-bottom:4px}.apr-field input,.apr-field select{width:100%;height:34px;border:1px solid #dbe3eb;border-radius:8px;background:#fff;padding:6px 8px;font:750 10px Pretendard,sans-serif}.apr-custom[hidden]{display:none!important}.apr-config-actions{display:flex;gap:8px;margin-top:14px}.apr-config-actions button{flex:1;border:0;border-radius:9px;padding:9px;font:900 11px Pretendard,sans-serif;cursor:pointer}.apr-config-actions .cancel{background:#e5e7eb;color:#334155}.apr-config-actions .run{background:#12396d;color:#fff}
    @media(max-width:980px){.advanced-print-review-workspace{grid-template-columns:minmax(0,1fr) 220px}.apr-thumbs{grid-template-columns:1fr}}@media(max-width:720px){.advanced-print-review-workspace{grid-template-columns:1fr;overflow:auto}.apr-stage{min-height:70vh}.apr-side{max-height:360px}.apr-thumbs{grid-template-columns:repeat(3,minmax(0,1fr))}}
  `;
  document.head.appendChild(style);
}

function installSidebarSection() {
  if ($('advancedPrintReviewBtn')) return;
  const output = document.querySelector('.output-section');
  if (!output) return;
  const section = document.createElement('section');
  section.className = 'tool-section advanced-print-review-section';
  section.innerHTML = `
    <div class="section-title">인쇄 검토</div>
    <button id="advancedPrintReviewBtn" class="advanced-print-review-btn" type="button" disabled>문서 인쇄 검토</button>
    <p class="hint">인쇄용지 중앙 배치 · 실제 재단선 · 사방 재단표시 · 안전영역 · 전체 페이지 규격을 확인합니다.</p>`;
  output.parentElement.insertBefore(section, output);
  $('advancedPrintReviewBtn').addEventListener('click', openConfig);
}

function installConfig() {
  if ($('advancedPrintReviewConfig')) return;
  const modal = document.createElement('div');
  modal.id = 'advancedPrintReviewConfig';
  modal.className = 'apr-config';
  modal.innerHTML = `
    <div class="apr-config-box" role="dialog" aria-modal="true" aria-labelledby="aprConfigTitle">
      <div class="apr-config-head"><strong id="aprConfigTitle">문서 인쇄 검토 설정</strong><button id="aprConfigClose" type="button">×</button></div>
      <div class="apr-fields">
        <div class="apr-field full"><label for="aprSheetPreset">인쇄 용지</label><select id="aprSheetPreset">${Object.entries(SHEETS).map(([key,item])=>`<option value="${key}">${item.label}${key==='custom'?'':` · ${item.w}×${item.h}mm`}</option>`).join('')}</select></div>
        <div class="apr-field apr-custom" id="aprCustomWField" hidden><label for="aprSheetW">용지 폭(mm)</label><input id="aprSheetW" type="number" min="1" step="0.1"></div>
        <div class="apr-field apr-custom" id="aprCustomHField" hidden><label for="aprSheetH">용지 높이(mm)</label><input id="aprSheetH" type="number" min="1" step="0.1"></div>
        <div class="apr-field"><label for="aprTrimW">실제 재단 폭(mm)</label><input id="aprTrimW" type="number" min="1" step="0.1" placeholder="예: 133"></div>
        <div class="apr-field"><label for="aprTrimH">실제 재단 높이(mm)</label><input id="aprTrimH" type="number" min="1" step="0.1" placeholder="예: 203"></div>
        <div class="apr-field"><label for="aprBleed">권장 재단 여유(mm)</label><input id="aprBleed" type="number" min="0" step="0.1"></div>
        <div class="apr-field"><label for="aprSafeZone">일반 안전 영역(mm)</label><input id="aprSafeZone" type="number" min="0" step="0.1"></div>
        <div class="apr-field full"><label for="aprBindingSafe">제본쪽 안전 여백(mm) · 홀수 왼쪽 / 짝수 오른쪽</label><input id="aprBindingSafe" type="number" min="0" step="0.1"></div>
      </div>
      <div class="apr-config-actions"><button class="cancel" id="aprConfigCancel" type="button">취소</button><button class="run" id="aprConfigRun" type="button">검토 시작</button></div>
    </div>`;
  document.body.appendChild(modal);
  const close = () => modal.classList.remove('open');
  $('aprConfigClose').addEventListener('click', close);
  $('aprConfigCancel').addEventListener('click', close);
  modal.addEventListener('click', event => { if (event.target === modal) close(); });
  $('aprSheetPreset').addEventListener('change', syncCustomFields);
  $('aprConfigRun').addEventListener('click', () => {
    readSpecs();
    if (!specs.sheetW || !specs.sheetH) return alert('인쇄 용지 크기를 확인해 주세요.');
    close();
    activate();
  });
}

function syncCustomFields() {
  const custom = $('aprSheetPreset')?.value === 'custom';
  if ($('aprCustomWField')) $('aprCustomWField').hidden = !custom;
  if ($('aprCustomHField')) $('aprCustomHField').hidden = !custom;
}

function openConfig() {
  if (!pages().length) return alert('PDF 파일을 먼저 불러와 주세요.');
  installConfig();
  $('aprSheetPreset').value = specs.sheetPreset;
  $('aprSheetW').value = specs.sheetW || '';
  $('aprSheetH').value = specs.sheetH || '';
  $('aprTrimW').value = specs.trimW || '';
  $('aprTrimH').value = specs.trimH || '';
  $('aprBleed').value = specs.bleed;
  $('aprSafeZone').value = specs.safeZone;
  $('aprBindingSafe').value = specs.bindingSafe;
  syncCustomFields();
  $('advancedPrintReviewConfig').classList.add('open');
}

function readSpecs() {
  const preset = $('aprSheetPreset')?.value || specs.sheetPreset || 'b5';
  const item = SHEETS[preset] || SHEETS.b5;
  specs.sheetPreset = preset;
  specs.sheetW = preset === 'custom' ? (parseFloat($('aprSheetW')?.value) || 0) : item.w;
  specs.sheetH = preset === 'custom' ? (parseFloat($('aprSheetH')?.value) || 0) : item.h;
  specs.trimW = parseFloat($('aprTrimW')?.value) || 0;
  specs.trimH = parseFloat($('aprTrimH')?.value) || 0;
  specs.bleed = Math.max(0, parseFloat($('aprBleed')?.value) || 0);
  specs.safeZone = Math.max(0, parseFloat($('aprSafeZone')?.value) || 0);
  specs.bindingSafe = Math.max(0, parseFloat($('aprBindingSafe')?.value) || 0);
}

function installWorkspace() {
  if ($('advancedPrintReviewWorkspace')) return;
  const main = document.querySelector('.advanced-workspace');
  if (!main) return;
  main.style.position = 'relative';
  const workspace = document.createElement('section');
  workspace.id = 'advancedPrintReviewWorkspace';
  workspace.className = 'advanced-print-review-workspace';
  workspace.innerHTML = `
    <div class="apr-stage">
      <div class="apr-toolbar"><strong>문서 인쇄 검토</strong><span id="aprCurrentInfo" style="font-size:9px;color:#64748b"></span><span class="apr-spacer"></span><button id="aprCheckAll" type="button">전체 페이지 검사</button><button id="aprSettings" type="button">설정</button><button id="aprExit" class="primary" type="button">편집으로 돌아가기</button></div>
      <div id="aprCanvasWrap" class="apr-canvas-wrap"><canvas id="aprCanvas"></canvas></div>
      <div id="aprReport" class="apr-report"></div>
    </div>
    <aside class="apr-side">
      <div class="apr-side-head"><div class="apr-side-title">전체 페이지</div><div class="apr-side-sub">페이지를 누르면 가운데에서 크게 확인합니다.</div><div class="apr-nav"><button id="aprPrev" type="button">← 이전</button><strong id="aprPageLabel">0 / 0p</strong><button id="aprNext" type="button">다음 →</button></div></div>
      <div id="aprThumbs" class="apr-thumbs"></div>
    </aside>`;
  main.appendChild(workspace);
  $('aprExit').addEventListener('click', deactivate);
  $('aprSettings').addEventListener('click', openConfig);
  $('aprCheckAll').addEventListener('click', renderFullReport);
  $('aprPrev').addEventListener('click', () => showPage(currentPage - 1));
  $('aprNext').addEventListener('click', () => showPage(currentPage + 1));
}

function drawBadge(ctx, text, x, y, background) {
  ctx.save();
  ctx.font = '800 11px Pretendard, sans-serif';
  const width = Math.ceil(ctx.measureText(text).width) + 16;
  ctx.fillStyle = background;
  if (ctx.roundRect) { ctx.beginPath(); ctx.roundRect(x, y, width, 24, 6); ctx.fill(); }
  else ctx.fillRect(x, y, width, 24);
  ctx.fillStyle = '#fff'; ctx.textBaseline = 'middle'; ctx.fillText(text, x + 8, y + 12);
  ctx.restore();
}

function drawCropMarks(ctx, rect) {
  const gap = 8, len = 20;
  const x = rect.x, y = rect.y, r = rect.x + rect.w, b = rect.y + rect.h;
  const lines = [
    [x-gap-len,y,x-gap,y],[x,y-gap-len,x,y-gap],
    [r+gap,y,r+gap+len,y],[r,y-gap-len,r,y-gap],
    [x-gap-len,b,x-gap,b],[x,b+gap,x,b+gap+len],
    [r+gap,b,r+gap+len,b],[r,b+gap,r,b+gap+len],
  ];
  ctx.save(); ctx.strokeStyle = '#111827'; ctx.lineWidth = 1.5; ctx.setLineDash([]); ctx.beginPath();
  for (const line of lines) { ctx.moveTo(line[0], line[1]); ctx.lineTo(line[2], line[3]); }
  ctx.stroke(); ctx.restore();
}

function shadeOutsideTrim(ctx, fileRect, trimRect) {
  const left = Math.max(fileRect.x, trimRect.x), top = Math.max(fileRect.y, trimRect.y);
  const right = Math.min(fileRect.x + fileRect.w, trimRect.x + trimRect.w), bottom = Math.min(fileRect.y + fileRect.h, trimRect.y + trimRect.h);
  ctx.save(); ctx.fillStyle = 'rgba(15,23,42,.24)';
  if (top > fileRect.y) ctx.fillRect(fileRect.x, fileRect.y, fileRect.w, top - fileRect.y);
  if (bottom < fileRect.y + fileRect.h) ctx.fillRect(fileRect.x, bottom, fileRect.w, fileRect.y + fileRect.h - bottom);
  if (left > fileRect.x && bottom > top) ctx.fillRect(fileRect.x, top, left - fileRect.x, bottom - top);
  if (right < fileRect.x + fileRect.w && bottom > top) ctx.fillRect(right, top, fileRect.x + fileRect.w - right, bottom - top);
  ctx.restore();
}

async function renderReview() {
  if (!active || !pages().length) return;
  const serial = ++renderSerial;
  const list = pages();
  currentPage = Math.max(1, Math.min(list.length, currentPage));
  const page = list[currentPage - 1];
  advancedState.selectedId = page.id;
  const pageSize = pageMm(page);
  const canvas = $('aprCanvas'), wrap = $('aprCanvasWrap');
  if (!canvas || !wrap) return;
  const width = Math.max(360, wrap.clientWidth - 18), height = Math.max(420, wrap.clientHeight - 18);
  canvas.width = Math.floor(width); canvas.height = Math.floor(height);
  const ctx = canvas.getContext('2d', { alpha: false });
  ctx.fillStyle = '#f5f7fa'; ctx.fillRect(0, 0, canvas.width, canvas.height);

  const sheetW = Math.max(1, specs.sheetW), sheetH = Math.max(1, specs.sheetH);
  const ppm = Math.min((canvas.width - 64) / sheetW, (canvas.height - 64) / sheetH);
  const sheet = { w: sheetW * ppm, h: sheetH * ppm };
  sheet.x = (canvas.width - sheet.w) / 2; sheet.y = (canvas.height - sheet.h) / 2;
  ctx.save(); ctx.shadowColor = 'rgba(15,23,42,.2)'; ctx.shadowBlur = 18; ctx.shadowOffsetY = 5; ctx.fillStyle = '#fff'; ctx.fillRect(sheet.x, sheet.y, sheet.w, sheet.h); ctx.restore();
  ctx.strokeStyle = '#64748b'; ctx.lineWidth = 2; ctx.strokeRect(sheet.x, sheet.y, sheet.w, sheet.h);
  drawBadge(ctx, `인쇄용지 · ${fmt(sheetW)}×${fmt(sheetH)}mm`, sheet.x + 10, sheet.y + 10, '#0f3b6d');

  const offscreen = document.createElement('canvas');
  await renderPagePreview(page, offscreen, { zoom: 1, maxCssWidth: 1200, maxCssHeight: 1600 });
  if (serial !== renderSerial || !active) return;
  const fileRect = {
    w: pageSize.width * ppm, h: pageSize.height * ppm,
    x: sheet.x + (sheet.w - pageSize.width * ppm) / 2,
    y: sheet.y + (sheet.h - pageSize.height * ppm) / 2,
  };
  ctx.fillStyle = '#fff'; ctx.fillRect(fileRect.x, fileRect.y, fileRect.w, fileRect.h);
  ctx.drawImage(offscreen, fileRect.x, fileRect.y, fileRect.w, fileRect.h);
  ctx.strokeStyle = '#6d28d9'; ctx.lineWidth = 2.5; ctx.strokeRect(fileRect.x, fileRect.y, fileRect.w, fileRect.h);
  drawBadge(ctx, `편집 결과 · ${fmt(pageSize.width)}×${fmt(pageSize.height)}mm · P${currentPage}`, fileRect.x + 8, fileRect.y + 8, '#6d28d9');

  if (specs.trimW > 0 && specs.trimH > 0) {
    const trim = { w: specs.trimW * ppm, h: specs.trimH * ppm };
    trim.x = sheet.x + (sheet.w - trim.w) / 2; trim.y = sheet.y + (sheet.h - trim.h) / 2;
    shadeOutsideTrim(ctx, fileRect, trim);
    ctx.strokeStyle = '#2563eb'; ctx.lineWidth = 3; ctx.setLineDash([]); ctx.strokeRect(trim.x, trim.y, trim.w, trim.h);
    drawCropMarks(ctx, trim);
    drawBadge(ctx, `실제 재단 · ${fmt(specs.trimW)}×${fmt(specs.trimH)}mm`, trim.x + 8, trim.y + 36, '#1d4ed8');

    const safe = specs.safeZone * ppm;
    if (safe > 0 && trim.w > safe * 2 && trim.h > safe * 2) {
      ctx.save(); ctx.strokeStyle = '#16a34a'; ctx.lineWidth = 2; ctx.setLineDash([7,4]); ctx.strokeRect(trim.x + safe, trim.y + safe, trim.w - safe*2, trim.h - safe*2); ctx.restore();
    }
    const binding = specs.bindingSafe * ppm;
    if (binding > 0 && binding < trim.w) {
      const odd = currentPage % 2 === 1;
      const bx = odd ? trim.x + binding : trim.x + trim.w - binding;
      ctx.save(); ctx.strokeStyle = '#f97316'; ctx.lineWidth = 2; ctx.setLineDash([9,5]); ctx.beginPath(); ctx.moveTo(bx, trim.y); ctx.lineTo(bx, trim.y + trim.h); ctx.stroke(); ctx.restore();
    }
  }

  $('aprCurrentInfo').textContent = `편집결과 ${fmt(pageSize.width)}×${fmt(pageSize.height)}mm · 인쇄용지 ${fmt(sheetW)}×${fmt(sheetH)}mm${specs.trimW&&specs.trimH?` · 재단 ${fmt(specs.trimW)}×${fmt(specs.trimH)}mm`:''}`;
  syncNav();
  renderQuickReport();
}

async function renderThumb(button, page, index) {
  if (!button || button.dataset.rendered === '1') return;
  const canvas = button.querySelector('canvas');
  if (!canvas) return;
  try {
    await renderPagePreview(page, canvas, { zoom: .5, maxCssWidth: 120, maxCssHeight: 150 });
    canvas.style.width = '100%'; canvas.style.height = '92px';
    const size = pageMm(page);
    button.querySelector('span').textContent = `${index + 1}p · ${fmt(size.width)}×${fmt(size.height)}`;
    button.dataset.rendered = '1';
  } catch (_) {
    button.querySelector('span').textContent = `${index + 1}p · 미리보기 오류`;
  }
}

function rebuildThumbs() {
  const holder = $('aprThumbs');
  if (!holder) return;
  thumbObserver?.disconnect(); holder.replaceChildren();
  const list = pages();
  thumbObserver = 'IntersectionObserver' in window ? new IntersectionObserver(entries => {
    for (const entry of entries) {
      if (!entry.isIntersecting) continue;
      thumbObserver.unobserve(entry.target);
      const index = Number(entry.target.dataset.index || 0);
      renderThumb(entry.target, list[index], index);
    }
  }, { root: holder, rootMargin: '180px 0px' }) : null;
  list.forEach((page, index) => {
    const button = document.createElement('button');
    button.type = 'button'; button.className = 'apr-thumb'; button.dataset.index = String(index);
    button.innerHTML = '<canvas aria-hidden="true"></canvas><span>불러오는 중</span>';
    button.addEventListener('click', () => showPage(index + 1));
    holder.appendChild(button);
    if (thumbObserver) thumbObserver.observe(button); else if (index < 12) renderThumb(button, page, index);
  });
  syncNav();
}

function syncNav() {
  const total = pages().length;
  currentPage = Math.max(1, Math.min(total || 1, currentPage));
  if ($('aprPageLabel')) $('aprPageLabel').textContent = total ? `${currentPage} / ${total}p` : '0 / 0p';
  if ($('aprPrev')) $('aprPrev').disabled = !total || currentPage <= 1;
  if ($('aprNext')) $('aprNext').disabled = !total || currentPage >= total;
  document.querySelectorAll('.apr-thumb').forEach((button, index) => {
    const selected = index === currentPage - 1;
    button.classList.toggle('active', selected);
    if (selected) button.scrollIntoView({ block: 'nearest' });
  });
}

function showPage(number) {
  if (!pages().length) return;
  currentPage = Math.max(1, Math.min(pages().length, Number(number) || 1));
  renderReview();
}

function inspectAll() {
  const list = pages();
  const dimensions = list.map(pageMm);
  if (!dimensions.length) return { issues: [], total: 0 };
  const first = dimensions[0];
  const different = dimensions.filter(size => Math.abs(size.width - first.width) > TOLERANCE || Math.abs(size.height - first.height) > TOLERANCE).length;
  const oversized = dimensions.filter(size => size.width > specs.sheetW + TOLERANCE || size.height > specs.sheetH + TOLERANCE).length;
  const trimOutside = specs.trimW && specs.trimH && (specs.trimW > specs.sheetW + TOLERANCE || specs.trimH > specs.sheetH + TOLERANCE);
  const tooSmall = specs.trimW && specs.trimH ? dimensions.filter(size => size.width + TOLERANCE < specs.trimW || size.height + TOLERANCE < specs.trimH).length : 0;
  const bleedShort = specs.trimW && specs.trimH ? dimensions.filter(size => ((size.width - specs.trimW) / 2) + TOLERANCE < specs.bleed || ((size.height - specs.trimH) / 2) + TOLERANCE < specs.bleed).length : 0;
  const issues = [];
  if (different) issues.push({ type:'warn', text:`규격 다른 페이지 ${different}개` });
  if (oversized) issues.push({ type:'fail', text:`인쇄용지 초과 ${oversized}개` });
  if (trimOutside) issues.push({ type:'fail', text:'재단사이즈가 인쇄용지보다 큼' });
  if (tooSmall) issues.push({ type:'fail', text:`재단보다 작은 페이지 ${tooSmall}개` });
  if (bleedShort) issues.push({ type:'warn', text:`재단여유 부족 ${bleedShort}개` });
  if (list.length % 2) issues.push({ type:'warn', text:`홀수 페이지 ${list.length}p` });
  return { issues, total:list.length };
}

function reportHtml(full = false) {
  const result = inspectAll();
  if (!result.total) return '<strong>검사할 페이지가 없습니다.</strong>';
  const detail = result.issues.length
    ? result.issues.map(item => `<span class="apr-${item.type}">${item.text}</span>`).join(' · ')
    : '<span class="apr-ok">규격·배치 이상 없음</span>';
  return `<strong>${full ? '전체 페이지 검사 완료' : '자동 검사'} · ${result.total}p</strong> · ${detail}<br>보라=편집 결과 · 파랑=재단선 · 검정=사방 재단표시 · 초록=안전영역 · 주황=제본쪽`;
}
function renderQuickReport() { if ($('aprReport')) $('aprReport').innerHTML = reportHtml(false); }
function renderFullReport() { if ($('aprReport')) $('aprReport').innerHTML = reportHtml(true); }

function activate() {
  if (!pages().length) return;
  installWorkspace();
  active = true;
  document.body.classList.add('print-review-active');
  const selectedIndex = pages().findIndex(page => page.id === advancedState.selectedId);
  currentPage = selectedIndex >= 0 ? selectedIndex + 1 : Math.min(currentPage, pages().length);
  rebuildThumbs();
  requestAnimationFrame(renderReview);
}

function deactivate() {
  active = false;
  renderSerial += 1;
  document.body.classList.remove('print-review-active');
  thumbObserver?.disconnect(); thumbObserver = null;
  window.dispatchEvent(new Event('resize'));
}

function syncAvailability() {
  const button = $('advancedPrintReviewBtn');
  if (button) button.disabled = advancedState.busy || !pages().length;
}

function handleStateChange() {
  syncAvailability();
  if (!active) return;
  if (!pages().length) return deactivate();
  currentPage = Math.min(currentPage, pages().length);
  rebuildThumbs();
  renderReview();
}

function scheduleResize() {
  if (!active) return;
  cancelAnimationFrame(resizeFrame);
  resizeFrame = requestAnimationFrame(renderReview);
}

function initialize() {
  installStyles();
  installSidebarSection();
  installConfig();
  installWorkspace();
  syncAvailability();
  window.addEventListener('pdf-advanced-state-change', handleStateChange);
  window.addEventListener('resize', scheduleResize);
  document.documentElement.dataset.pdfAdvancedPrintReview = '1';
}

initialize();

window.PdfAdvancedPrintReview = Object.freeze({
  open: openConfig,
  activate,
  deactivate,
  render: renderReview,
  inspect: inspectAll,
  get state() { return { active, currentPage, pageCount: pages().length, specs: { ...specs } }; },
  stage: 'pdf-editor-advanced-print-review-v1',
});
