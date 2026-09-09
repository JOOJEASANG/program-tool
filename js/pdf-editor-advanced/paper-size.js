import { advancedState, checkpoint, emitStateChange } from './state.js';

const $ = id => document.getElementById(id);
const PT_PER_MM = 72 / 25.4;
const PRESETS = {
  a4: [210, 297],
  a3: [297, 420],
  b4: [250, 354],
  b5: [176, 250],
  letter: [216, 279],
};

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, Number(value) || 0));
}

function normalizeQuarter(value) {
  const normalized = ((Number(value || 0) % 360) + 360) % 360;
  return [0, 90, 180, 270].reduce((best, candidate) => {
    const distance = Math.min(Math.abs(normalized - candidate), 360 - Math.abs(normalized - candidate));
    const bestDistance = Math.min(Math.abs(normalized - best), 360 - Math.abs(normalized - best));
    return distance < bestDistance ? candidate : best;
  }, 0);
}

function ensurePaperState() {
  if (!advancedState.paper || typeof advancedState.paper !== 'object') {
    advancedState.paper = { preset: 'original', customWidthMm: 210, customHeightMm: 297 };
  }
  if (!advancedState.paper.preset) advancedState.paper.preset = 'original';
  advancedState.paper.customWidthMm = clamp(advancedState.paper.customWidthMm || 210, 50, 1200);
  advancedState.paper.customHeightMm = clamp(advancedState.paper.customHeightMm || 297, 50, 1200);
}

function ensureSourceSize(page) {
  if (!Number.isFinite(Number(page.sourceWidthPt)) || Number(page.sourceWidthPt) <= 0) {
    page.sourceWidthPt = Number(page.widthPt || 0);
  }
  if (!Number.isFinite(Number(page.sourceHeightPt)) || Number(page.sourceHeightPt) <= 0) {
    page.sourceHeightPt = Number(page.heightPt || 0);
  }
}

function visibleSize(page) {
  const rotation = normalizeQuarter(page.rotation);
  const width = Number(page.widthPt || page.sourceWidthPt || 0);
  const height = Number(page.heightPt || page.sourceHeightPt || 0);
  return rotation === 90 || rotation === 270
    ? { width: height, height: width }
    : { width, height };
}

function targetMillimeters() {
  ensurePaperState();
  if (advancedState.paper.preset === 'custom') {
    return [advancedState.paper.customWidthMm, advancedState.paper.customHeightMm];
  }
  return PRESETS[advancedState.paper.preset] || null;
}

function applyPaperToPage(page) {
  ensureSourceSize(page);
  const target = targetMillimeters();
  if (!target) {
    page.widthPt = Number(page.sourceWidthPt || page.widthPt || 0);
    page.heightPt = Number(page.sourceHeightPt || page.heightPt || 0);
    return;
  }

  const current = visibleSize(page);
  const landscape = current.width > current.height;
  const shortMm = Math.min(target[0], target[1]);
  const longMm = Math.max(target[0], target[1]);
  const visibleWidthPt = (landscape ? longMm : shortMm) * PT_PER_MM;
  const visibleHeightPt = (landscape ? shortMm : longMm) * PT_PER_MM;
  const rotation = normalizeQuarter(page.rotation);

  if (rotation === 90 || rotation === 270) {
    page.widthPt = visibleHeightPt;
    page.heightPt = visibleWidthPt;
  } else {
    page.widthPt = visibleWidthPt;
    page.heightPt = visibleHeightPt;
  }
}

function applyPaperToAll({ recordHistory = false, reason = 'paper-size' } = {}) {
  ensurePaperState();
  if (recordHistory && advancedState.pages.length) checkpoint('페이지 크기');
  advancedState.pages.forEach(applyPaperToPage);
  emitStateChange(reason);
  window.dispatchEvent(new Event('resize'));
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
  `;
  document.head.appendChild(style);
}

function installSection() {
  if ($('advancedPaperSize')) return;
  const marginInput = $('marginLeft');
  const marginSection = marginInput?.closest('.tool-section');
  if (!marginSection) return;

  const section = document.createElement('section');
  section.className = 'tool-section';
  section.id = 'advancedPaperSizeSection';
  section.innerHTML = `
    <div class="section-title">페이지 크기</div>
    <select id="advancedPaperSize" class="advanced-paper-size-select" aria-label="페이지 크기">
      <option value="original">원본 크기 유지</option>
      <option value="a4">A4 (210×297mm)</option>
      <option value="a3">A3 (297×420mm)</option>
      <option value="b4">B4 (250×354mm)</option>
      <option value="b5">B5 (176×250mm)</option>
      <option value="letter">Letter (216×279mm)</option>
      <option value="custom">직접 입력...</option>
    </select>
    <div id="advancedPaperCustomRow" class="advanced-paper-custom" hidden>
      <label>너비(mm)<input id="advancedPaperCustomW" type="number" min="50" max="1200" step="0.1" value="210"></label>
      <label>높이(mm)<input id="advancedPaperCustomH" type="number" min="50" max="1200" step="0.1" value="297"></label>
    </div>
    <p class="hint">선택한 규격은 각 페이지의 현재 세로·가로 방향을 유지해서 적용합니다.</p>
  `;
  marginSection.parentElement.insertBefore(section, marginSection);

  $('advancedPaperSize').addEventListener('change', () => {
    ensurePaperState();
    advancedState.paper.preset = $('advancedPaperSize').value;
    applyPaperToAll({ recordHistory: true, reason: 'paper-size' });
    syncUi();
  });

  const applyCustom = () => {
    if (advancedState.paper.preset !== 'custom') return;
    advancedState.paper.customWidthMm = clamp($('advancedPaperCustomW').value, 50, 1200);
    advancedState.paper.customHeightMm = clamp($('advancedPaperCustomH').value, 50, 1200);
    applyPaperToAll({ recordHistory: true, reason: 'paper-custom-size' });
    syncUi();
  };
  $('advancedPaperCustomW').addEventListener('change', applyCustom);
  $('advancedPaperCustomH').addEventListener('change', applyCustom);
}

function syncUi() {
  ensurePaperState();
  installSection();
  const select = $('advancedPaperSize');
  if (!select) return;
  if ([...select.options].some(option => option.value === advancedState.paper.preset)) {
    select.value = advancedState.paper.preset;
  } else {
    select.value = 'original';
  }
  const custom = advancedState.paper.preset === 'custom';
  $('advancedPaperCustomRow').hidden = !custom;
  $('advancedPaperCustomW').value = String(advancedState.paper.customWidthMm);
  $('advancedPaperCustomH').value = String(advancedState.paper.customHeightMm);
}

function handleStateChange(event) {
  const reason = event?.detail?.reason || '';
  if (reason === 'upload') {
    advancedState.pages.forEach(ensureSourceSize);
    advancedState.pages.forEach(applyPaperToPage);
  }
  syncUi();
}

installStyles();
installSection();
ensurePaperState();
advancedState.pages.forEach(ensureSourceSize);
syncUi();
window.addEventListener('pdf-advanced-state-change', handleStateChange);
document.documentElement.dataset.pdfAdvancedPaperSize = '1';
