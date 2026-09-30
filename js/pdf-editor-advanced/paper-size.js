import {
  advancedState,
  selectedPage,
  checkpoint,
  emitStateChange,
  paperSizeMmForPage,
  isSheetLayoutMode,
} from './state.js';

const $ = id => document.getElementById(id);
const PT_PER_MM = 72 / 25.4;
const PRESETS = new Set(['original', 'a5', 'b5', 'a4', 'b4', 'a3', 'custom']);

const clamp = (value, min, max) => Math.max(min, Math.min(max, Number(value) || 0));

function ensurePaperState() {
  if (!advancedState.paper || typeof advancedState.paper !== 'object') advancedState.paper = {};
  if (!PRESETS.has(String(advancedState.paper.preset || ''))) advancedState.paper.preset = 'original';
  advancedState.paper.customWidthMm = clamp(advancedState.paper.customWidthMm || 210, 20, 1200);
  advancedState.paper.customHeightMm = clamp(advancedState.paper.customHeightMm || 297, 20, 1200);
  advancedState.paper.landscape = !!advancedState.paper.landscape;
  advancedState.paper.cropMarks = !!advancedState.paper.cropMarks;
}

function ensureSourceSize(page) {
  if (!Number.isFinite(Number(page.sourceWidthPt)) || Number(page.sourceWidthPt) <= 0) page.sourceWidthPt = Number(page.widthPt || 0);
  if (!Number.isFinite(Number(page.sourceHeightPt)) || Number(page.sourceHeightPt) <= 0) page.sourceHeightPt = Number(page.heightPt || 0);
}

function visibleSourceMm(page) {
  if (!page) return null;
  ensureSourceSize(page);
  const rotation = ((Number(page.rotation || 0) % 360) + 360) % 360;
  let widthPt = Number(page.sourceWidthPt || page.widthPt || 0);
  let heightPt = Number(page.sourceHeightPt || page.heightPt || 0);
  if (rotation === 90 || rotation === 270) [widthPt, heightPt] = [heightPt, widthPt];
  widthPt *= Math.max(.05, 1 - Number(page.crop?.left || 0) - Number(page.crop?.right || 0));
  heightPt *= Math.max(.05, 1 - Number(page.crop?.top || 0) - Number(page.crop?.bottom || 0));
  return { width: widthPt / PT_PER_MM, height: heightPt / PT_PER_MM };
}

function render(reason = 'paper-layout') {
  emitStateChange(reason);
  window.dispatchEvent(new Event('resize'));
  syncUi();
}

function installStyles() {
  if ($('pdfAdvancedPaperSizeStyles')) return;
  const style = document.createElement('style');
  style.id = 'pdfAdvancedPaperSizeStyles';
  style.textContent = `
    .advanced-paper-size-select{width:100%;height:32px;border:1px solid var(--line);border-radius:7px;background:#fff;padding:5px 7px;font-size:10px;color:#172033;outline:none}
    .advanced-paper-size-select:focus{border-color:#3b82f6;box-shadow:0 0 0 2px rgba(59,130,246,.08)}
    .advanced-paper-custom{display:grid;grid-template-columns:1fr 1fr;gap:6px;margin-top:7px}
    .advanced-paper-custom[hidden]{display:none!important}
    .advanced-paper-custom label{font-size:8px;color:#64748b;font-weight:800}
    .advanced-paper-custom input{width:100%;height:31px;border:1px solid var(--line);border-radius:7px;background:#fff;padding:5px 6px;font-size:10px;color:#172033}
    .advanced-paper-options{display:flex;flex-direction:column;gap:7px;margin-top:8px}
    .advanced-paper-check{display:flex;align-items:center;gap:7px;font-size:9px;font-weight:800;color:#475569;cursor:pointer}
    .advanced-paper-check input{width:auto}
    .advanced-paper-summary{margin-top:8px;padding:8px 9px;border:1px solid #dbe5ee;border-radius:8px;background:#f8fafc;font-size:9px;line-height:1.55;color:#526174}
    .advanced-paper-summary strong{color:#12396d}
    .advanced-paper-center{width:100%;height:31px;margin-top:7px;border:1px solid #d7e0e9;border-radius:8px;background:#fff;color:#334155;font-size:9px;font-weight:900;cursor:pointer}
    .advanced-paper-center:disabled{opacity:.45;cursor:not-allowed}
  `;
  document.head.appendChild(style);
}

function installSection() {
  if ($('advancedPaperSize')) return;
  const marginSection = $('marginLeft')?.closest('.tool-section');
  if (!marginSection) return;
  const section = document.createElement('section');
  section.className = 'tool-section';
  section.id = 'advancedPaperSizeSection';
  section.innerHTML = `
    <div class="section-title">출력 용지 · 실사이즈 배치</div>
    <select id="advancedPaperSize" class="advanced-paper-size-select" aria-label="출력 용지 크기">
      <option value="original">원본 크기로 편집 · 출력</option>
      <option value="a5">A5 (148×210mm)</option>
      <option value="b5">B5 (182×257mm)</option>
      <option value="a4">A4 (210×297mm)</option>
      <option value="b4">B4 (257×364mm)</option>
      <option value="a3">A3 (297×420mm)</option>
      <option value="custom">직접 입력...</option>
    </select>
    <div id="advancedPaperCustomRow" class="advanced-paper-custom" hidden>
      <label>너비(mm)<input id="advancedPaperCustomW" type="number" min="20" max="1200" step="0.1" value="210"></label>
      <label>높이(mm)<input id="advancedPaperCustomH" type="number" min="20" max="1200" step="0.1" value="297"></label>
    </div>
    <div class="advanced-paper-options">
      <label class="advanced-paper-check"><input id="advancedPaperLandscape" type="checkbox"> 출력 용지 가로 방향</label>
      <label class="advanced-paper-check"><input id="advancedPaperCropMarks" type="checkbox"> 재단표시 넣기</label>
    </div>
    <button id="advancedPaperCenter" class="advanced-paper-center" type="button">선택 페이지 용지 가운데 배치</button>
    <div id="advancedPaperSummary" class="advanced-paper-summary"></div>
    <p class="hint">인쇄용지를 선택하면 <strong>100%가 원본 실제 mm 크기</strong>입니다. 큰 용지 위에서 좌·우/상·하 이동으로 위치를 잡고 필요하면 재단표시를 켜세요.</p>
  `;
  marginSection.parentElement.insertBefore(section, marginSection);

  $('advancedPaperSize').addEventListener('change', () => {
    ensurePaperState();
    if (advancedState.pages.length) checkpoint('출력 용지');
    advancedState.paper.preset = $('advancedPaperSize').value;
    if (advancedState.paper.preset === 'original') advancedState.paper.cropMarks = false;
    render('paper-size');
  });

  const applyCustom = () => {
    if (advancedState.paper.preset !== 'custom') return;
    if (advancedState.pages.length) checkpoint('출력 용지 직접 입력');
    advancedState.paper.customWidthMm = clamp($('advancedPaperCustomW').value, 20, 1200);
    advancedState.paper.customHeightMm = clamp($('advancedPaperCustomH').value, 20, 1200);
    render('paper-custom-size');
  };
  $('advancedPaperCustomW').addEventListener('change', applyCustom);
  $('advancedPaperCustomH').addEventListener('change', applyCustom);
  $('advancedPaperLandscape').addEventListener('change', () => {
    if (advancedState.pages.length) checkpoint('출력 용지 방향');
    advancedState.paper.landscape = $('advancedPaperLandscape').checked;
    render('paper-orientation');
  });
  $('advancedPaperCropMarks').addEventListener('change', () => {
    if (advancedState.pages.length) checkpoint('재단표시');
    advancedState.paper.cropMarks = $('advancedPaperCropMarks').checked && isSheetLayoutMode();
    render('crop-marks');
  });
  $('advancedPaperCenter').addEventListener('click', () => {
    const page = selectedPage();
    if (!page || !isSheetLayoutMode()) return;
    checkpoint('용지 가운데 배치');
    page.offsetX = 0;
    page.offsetY = 0;
    $('offsetXRange').value = '0';
    $('offsetYRange').value = '0';
    $('offsetXValue').textContent = '0.0 mm';
    $('offsetYValue').textContent = '0.0 mm';
    render('paper-center');
  });
}

function syncUi() {
  ensurePaperState();
  installSection();
  const select = $('advancedPaperSize');
  if (!select) return;
  select.value = PRESETS.has(advancedState.paper.preset) ? advancedState.paper.preset : 'original';
  const custom = advancedState.paper.preset === 'custom';
  $('advancedPaperCustomRow').hidden = !custom;
  $('advancedPaperCustomW').value = String(advancedState.paper.customWidthMm);
  $('advancedPaperCustomH').value = String(advancedState.paper.customHeightMm);
  $('advancedPaperLandscape').checked = !!advancedState.paper.landscape;
  $('advancedPaperLandscape').disabled = !isSheetLayoutMode();
  $('advancedPaperCropMarks').checked = !!advancedState.paper.cropMarks && isSheetLayoutMode();
  $('advancedPaperCropMarks').disabled = !isSheetLayoutMode();
  $('advancedPaperCenter').disabled = !selectedPage() || !isSheetLayoutMode();

  const summary = $('advancedPaperSummary');
  const page = selectedPage();
  if (!page) {
    summary.innerHTML = 'PDF를 불러오면 원본 실제 크기와 출력 용지를 비교합니다.';
    return;
  }
  const source = visibleSourceMm(page);
  const paper = paperSizeMmForPage(page);
  if (!isSheetLayoutMode()) {
    summary.innerHTML = `<strong>원본 실사이즈</strong> ${source.width.toFixed(1)} × ${source.height.toFixed(1)} mm · 출력도 원본 크기 유지`;
  } else {
    summary.innerHTML = `<strong>원본</strong> ${source.width.toFixed(1)} × ${source.height.toFixed(1)} mm<br><strong>출력 용지</strong> ${paper.width.toFixed(1)} × ${paper.height.toFixed(1)} mm · 100% 실사이즈 배치`;
  }
}

function handleStateChange(event) {
  if (event?.detail?.reason === 'upload') advancedState.pages.forEach(ensureSourceSize);
  syncUi();
}

installStyles();
installSection();
ensurePaperState();
advancedState.pages.forEach(ensureSourceSize);
syncUi();
window.addEventListener('pdf-advanced-state-change', handleStateChange);
$('pageList')?.addEventListener('click', () => setTimeout(syncUi, 0));
document.documentElement.dataset.pdfAdvancedPaperSize = 'actual-size-sheet-v2';
