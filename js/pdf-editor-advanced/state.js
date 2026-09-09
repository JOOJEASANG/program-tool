export const advancedState = {
  files: [],
  documents: [],
  pages: [],
  selectedId: null,
  margins: { left: 0, right: 0, top: 0, bottom: 0 },
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
    margins: clone(advancedState.margins),
    headerFooter: clone(advancedState.headerFooter),
    pageNumbers: clone(advancedState.pageNumbers),
  };
}

function restoreSnapshot(snapshot) {
  advancedState.pages = clone(snapshot.pages || []);
  advancedState.selectedId = snapshot.selectedId || advancedState.pages[0]?.id || null;
  advancedState.margins = clone(snapshot.margins || { left: 0, right: 0, top: 0, bottom: 0 });
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
  advancedState.margins = { left: 0, right: 0, top: 0, bottom: 0 };
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
  return {
    pages: advancedState.pages.map(page => ({
      file_index: page.fileIndex,
      page_index: page.pageIndex,
      rotation: page.rotation,
      crop_left_ratio: page.crop.left,
      crop_top_ratio: page.crop.top,
      crop_right_ratio: page.crop.right,
      crop_bottom_ratio: page.crop.bottom,
      erase_regions: clone(page.eraseRegions || []),
      edit_scale: page.scale,
      offset_x_mm: page.offsetX,
      offset_y_mm: page.offsetY,
      excluded: false,
    })),
    margins: {
      left_mm: advancedState.margins.left,
      right_mm: advancedState.margins.right,
      top_mm: advancedState.margins.top,
      bottom_mm: advancedState.margins.bottom,
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
