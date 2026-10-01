const DEFAULT_PAPER = {
  preset: 'original',
  customWidthMm: 210,
  customHeightMm: 297,
  landscape: false,
  cropMarks: false,
  trimMode: 'auto',
  trimWidthMm: 0,
  trimHeightMm: 0,
};

const PAPER_PRESETS_MM = {
  a5: { width: 148, height: 210 },
  b5: { width: 182, height: 257 },
  a4: { width: 210, height: 297 },
  b4: { width: 257, height: 364 },
  a3: { width: 297, height: 420 },
};
const TRIM_PRESETS_MM = [
  { name: 'A5', width: 148, height: 210 },
  { name: 'B5', width: 182, height: 257 },
  { name: 'A4', width: 210, height: 297 },
  { name: 'B4', width: 257, height: 364 },
  { name: 'A3', width: 297, height: 420 },
];
const PT_PER_MM = 72 / 25.4;

export const advancedState = {
  files: [],
  documents: [],
  pages: [],
  selectedId: null,
  paper: { ...DEFAULT_PAPER },
  margins: { left: 0, right: 0, top: 0, bottom: 0, facingPages: false },
  headerFooter: {
    enabled: false,
    headerLeft: '', headerCenter: '', headerRight: '',
    footerLeft: '', footerCenter: '', footerRight: '',
    fontSize: 10,
    color: '#333333',
    margin: 8,
  },
  pageNumbers: {
    enabled: false,
    position: 'bottom-center',
    format: '1',
    start: 1,
    fontSize: 10,
    color: '#333333',
    margin: 5,
    excludeFirst: false,
  },
  history: [],
  future: [],
  busy: false,
  eraseMode: false,
  zoom: 1,
};

const MAX_HISTORY = 60;

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function outputPointsForPage(page) {
  const rotation = ((Number(page?.rotation || 0) % 360) + 360) % 360;
  const width = Number(page?.widthPt || page?.sourceWidthPt || 0);
  const height = Number(page?.heightPt || page?.sourceHeightPt || 0);
  return rotation === 90 || rotation === 270
    ? { width: height, height: width }
    : { width, height };
}

function detectedTrimSizeMm(page) {
  const points = outputPointsForPage(page);
  const actualWidth = Math.max(0, points.width / PT_PER_MM);
  const actualHeight = Math.max(0, points.height / PT_PER_MM);
  if (!actualWidth || !actualHeight) return { width: 0, height: 0, name: '' };
  const candidates = [];
  for (const preset of TRIM_PRESETS_MM) {
    for (const rotated of [false, true]) {
      const width = rotated ? preset.height : preset.width;
      const height = rotated ? preset.width : preset.height;
      const dw = actualWidth - width;
      const dh = actualHeight - height;
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
  return candidates[0] || { width: actualWidth, height: actualHeight, name: '파일크기' };
}

export function trimSizeMmForPage(page) {
  const manualWidth = Number(advancedState.paper?.trimWidthMm || 0);
  const manualHeight = Number(advancedState.paper?.trimHeightMm || 0);
  if (String(advancedState.paper?.trimMode || 'auto') === 'manual' && manualWidth > 0 && manualHeight > 0) {
    return { width: manualWidth, height: manualHeight, name: '직접입력' };
  }
  return detectedTrimSizeMm(page);
}

export function isSheetLayoutMode() {
  return String(advancedState.paper?.preset || 'original') !== 'original';
}

export function paperSizeMmForPage(page) {
  if (!isSheetLayoutMode()) {
    const points = outputPointsForPage(page);
    return { width: points.width / PT_PER_MM, height: points.height / PT_PER_MM };
  }
  const preset = String(advancedState.paper?.preset || 'a4').toLowerCase();
  let size = PAPER_PRESETS_MM[preset];
  if (!size) {
    size = {
      width: Math.max(20, Math.min(1200, Number(advancedState.paper?.customWidthMm) || 210)),
      height: Math.max(20, Math.min(1200, Number(advancedState.paper?.customHeightMm) || 297)),
    };
  }
  const landscape = !!advancedState.paper?.landscape;
  return landscape
    ? { width: Math.max(size.width, size.height), height: Math.min(size.width, size.height) }
    : { width: Math.min(size.width, size.height), height: Math.max(size.width, size.height) };
}

export function paperPointsForPage(page) {
  if (!isSheetLayoutMode()) return outputPointsForPage(page);
  const mm = paperSizeMmForPage(page);
  return { width: mm.width * PT_PER_MM, height: mm.height * PT_PER_MM };
}

export function selectedPage() {
  return advancedState.pages.find(page => page.id === advancedState.selectedId) || null;
}

export function pageById(id) {
  return advancedState.pages.find(page => page.id === id) || null;
}

export function snapshotEditableState() {
  return {
    pages: clone(advancedState.pages),
    selectedId: advancedState.selectedId,
    paper: clone(advancedState.paper),
    margins: clone(advancedState.margins),
    headerFooter: clone(advancedState.headerFooter),
    pageNumbers: clone(advancedState.pageNumbers),
  };
}

function restoreSnapshot(snapshot) {
  advancedState.pages = clone(snapshot.pages || []);
  advancedState.selectedId = snapshot.selectedId || advancedState.pages[0]?.id || null;
  advancedState.paper = { ...DEFAULT_PAPER, ...clone(snapshot.paper || {}) };
  if (!advancedState.paper.preset) advancedState.paper.preset = 'original';
  if (!Number.isFinite(Number(advancedState.paper.customWidthMm))) advancedState.paper.customWidthMm = 210;
  if (!Number.isFinite(Number(advancedState.paper.customHeightMm))) advancedState.paper.customHeightMm = 297;
  advancedState.paper.landscape = !!advancedState.paper.landscape;
  advancedState.paper.cropMarks = !!advancedState.paper.cropMarks;
  advancedState.paper.trimMode = advancedState.paper.trimMode === 'manual' ? 'manual' : 'auto';
  advancedState.paper.trimWidthMm = Math.max(0, Math.min(1200, Number(advancedState.paper.trimWidthMm) || 0));
  advancedState.paper.trimHeightMm = Math.max(0, Math.min(1200, Number(advancedState.paper.trimHeightMm) || 0));
  advancedState.margins = clone(snapshot.margins || { left: 0, right: 0, top: 0, bottom: 0, facingPages: false });
  if (typeof advancedState.margins.facingPages !== 'boolean') advancedState.margins.facingPages = false;
  advancedState.headerFooter = clone(snapshot.headerFooter || advancedState.headerFooter);
  advancedState.pageNumbers = clone(snapshot.pageNumbers || advancedState.pageNumbers);
  emitStateChange('history');
}

export function checkpoint(label = '편집') {
  advancedState.history.push({ label, snapshot: snapshotEditableState() });
  if (advancedState.history.length > MAX_HISTORY) advancedState.history.shift();
  advancedState.future = [];
  emitHistoryChange();
}

export function undo() {
  const entry = advancedState.history.pop();
  if (!entry) return false;
  advancedState.future.push({ label: entry.label, snapshot: snapshotEditableState() });
  restoreSnapshot(entry.snapshot);
  emitHistoryChange();
  return true;
}

export function redo() {
  const entry = advancedState.future.pop();
  if (!entry) return false;
  advancedState.history.push({ label: entry.label, snapshot: snapshotEditableState() });
  restoreSnapshot(entry.snapshot);
  emitHistoryChange();
  return true;
}

export function clearHistory() {
  advancedState.history = [];
  advancedState.future = [];
  emitHistoryChange();
}

export function emitStateChange(reason = 'edit') {
  window.dispatchEvent(new CustomEvent('pdf-advanced-state-change', { detail: { reason } }));
}

export function emitHistoryChange() {
  window.dispatchEvent(new CustomEvent('pdf-advanced-history-change', {
    detail: {
      undo: advancedState.history.length,
      redo: advancedState.future.length,
      undoLabel: advancedState.history.at(-1)?.label || '',
      redoLabel: advancedState.future.at(-1)?.label || '',
    }
  }));
}

export function resetAllState() {
  advancedState.files = [];
  advancedState.documents = [];
  advancedState.pages = [];
  advancedState.selectedId = null;
  advancedState.paper = { ...DEFAULT_PAPER };
  advancedState.margins = { left: 0, right: 0, top: 0, bottom: 0, facingPages: false };
  advancedState.headerFooter = {
    enabled: false,
    headerLeft: '', headerCenter: '', headerRight: '',
    footerLeft: '', footerCenter: '', footerRight: '',
    fontSize: 10,
    color: '#333333',
    margin: 8,
  };
  advancedState.pageNumbers = {
    enabled: false,
    position: 'bottom-center',
    format: '1',
    start: 1,
    fontSize: 10,
    color: '#333333',
    margin: 5,
    excludeFirst: false,
  };
  advancedState.history = [];
  advancedState.future = [];
  advancedState.eraseMode = false;
  advancedState.zoom = 1;
  emitStateChange('reset');
  emitHistoryChange();
}

export function serializeSettings() {
  const sheetMode = isSheetLayoutMode();
  return {
    pages: advancedState.pages.map(page => {
      const output = paperPointsForPage(page);
      const trim = trimSizeMmForPage(page);
      return {
        file_index: page.fileIndex,
        page_index: page.pageIndex,
        rotation: page.rotation,
        fine_rotation_deg: Number(page.fineRotation || 0),
        output_width_pt: output.width > 0 ? output.width : null,
        output_height_pt: output.height > 0 ? output.height : null,
        crop_left_ratio: page.crop.left,
        crop_top_ratio: page.crop.top,
        crop_right_ratio: page.crop.right,
        crop_bottom_ratio: page.crop.bottom,
        erase_regions: clone(page.eraseRegions || []),
        overlays: clone(page.overlays || []),
        edit_scale: page.scale,
        offset_x_mm: page.offsetX,
        offset_y_mm: page.offsetY,
        preserve_actual_size: sheetMode,
        crop_marks: sheetMode && !!advancedState.paper.cropMarks,
        trim_width_mm: sheetMode && trim.width > 0 ? trim.width : null,
        trim_height_mm: sheetMode && trim.height > 0 ? trim.height : null,
        crop_mark_length_mm: 5,
        crop_mark_gap_mm: 2,
        excluded: false,
      };
    }),
    margins: {
      left_mm: advancedState.margins.left,
      right_mm: advancedState.margins.right,
      top_mm: advancedState.margins.top,
      bottom_mm: advancedState.margins.bottom,
      facing_pages: !!advancedState.margins.facingPages,
    },
    header_footer: {
      enabled: advancedState.headerFooter.enabled,
      header_left: advancedState.headerFooter.headerLeft,
      header_center: advancedState.headerFooter.headerCenter,
      header_right: advancedState.headerFooter.headerRight,
      footer_left: advancedState.headerFooter.footerLeft,
      footer_center: advancedState.headerFooter.footerCenter,
      footer_right: advancedState.headerFooter.footerRight,
      font_size: advancedState.headerFooter.fontSize,
      color: advancedState.headerFooter.color,
      margin_mm: advancedState.headerFooter.margin,
      apply_to: 'all',
      sections: [],
    },
    page_numbers: {
      enabled: advancedState.pageNumbers.enabled,
      position: advancedState.pageNumbers.position,
      format: advancedState.pageNumbers.format,
      start: advancedState.pageNumbers.start,
      font_size: advancedState.pageNumbers.fontSize,
      color: advancedState.pageNumbers.color,
      exclude_first: advancedState.pageNumbers.excludeFirst,
      apply_to: 'all',
      margin_mm: advancedState.pageNumbers.margin,
      auto_reserve_space: false,
    },
  };
}
