// Bounded, transaction-safe undo and redo history for the perfect-binding cover maker.
(function () {
  'use strict';
  if (window.__coverEditHistoryV1) return;
  window.__coverEditHistoryV1 = true;
  if (!location.pathname.includes('perfect-binding-cover')) return;

  const MAX_HISTORY = 40;
  const INPUT_COMMIT_DELAY_MS = 320;
  const COALESCED_COMMIT_DELAY_MS = 220;
  const INSTALL_DELAYS = [2150, 2550, 2900, 3200, 3500];
  const FIELD_IDS = [
    'sizePreset', 'trimW', 'trimH', 'bleed', 'safeMargin',
    'pageCount', 'paperPreset', 'paperCaliper', 'bindingAdjust', 'manualSpine', 'spineManual',
    'imageFit', 'backColor', 'spineColor', 'frontColor',
    'frontTitle', 'frontSubtitle', 'publisher', 'publishYear', 'backText', 'spineTitle',
    'titleSize', 'spineTextSize', 'textColor', 'spineDirection',
    'institutionName', 'issuerName', 'publishYearLine', 'backTitleExtra', 'backBodyExtra',
    'spineTop', 'spineCenter', 'spineBottom',
  ];
  const CLICK_LABELS = {
    applySpineBtn: '책등 폭 적용',
    copyFrontBtn: '앞표지 이미지 복사',
    clearImagesBtn: '표지 이미지 삭제',
    resetTargetBtn: '선택 배치 초기화',
    centerTargetBtn: '선택 가운데 정렬',
    resetAllLayoutBtn: '전체 배치 초기화',
  };
  const FIELD_LABELS = {
    sizePreset: '완성 규격 변경', trimW: '표지 가로 변경', trimH: '표지 세로 변경',
    bleed: '재단 여백 변경', safeMargin: '안전 여백 변경', pageCount: '페이지 수 변경',
    paperPreset: '본문 용지 변경', paperCaliper: '종이 두께 변경', bindingAdjust: '책등 보정 변경',
    manualSpine: '책등 폭 입력 방식 변경', spineManual: '책등 폭 변경', imageFit: '이미지 맞춤 변경',
    backColor: '뒤표지 색상 변경', spineColor: '책등 색상 변경', frontColor: '앞표지 색상 변경',
    frontTitle: '앞표지 제목 변경', frontSubtitle: '앞표지 부제목 변경', publisher: '발행처 변경',
    publishYear: '발행 연도 변경', backText: '뒤표지 문구 변경', spineTitle: '책등 제목 변경',
    titleSize: '표지 글자 크기 변경', spineTextSize: '책등 글자 크기 변경', textColor: '글자색 변경',
    spineDirection: '책등 글자 방향 변경', institutionName: '기관명 변경', issuerName: '발행자 변경',
    publishYearLine: '발행 정보 변경', backTitleExtra: '뒤표지 제목 변경', backBodyExtra: '뒤표지 내용 변경',
    spineTop: '책등 상단 글자 변경', spineCenter: '책등 중앙 글자 변경', spineBottom: '책등 하단 글자 변경',
  };

  const past = [];
  const future = [];
  const imageIds = new WeakMap();
  let imageSequence = 0;
  let present = null;
  let applying = false;
  let installed = false;
  let pendingTimer = 0;
  let pendingLabel = '';
  let wrappedImageInput = false;
  let imageObserver = null;

  const byId = (id) => document.getElementById(id);
  const clone = (value) => JSON.parse(JSON.stringify(value ?? null));
  const plainObject = (value) => Boolean(value && typeof value === 'object' && !Array.isArray(value));

  function status(message, type = 'info') {
    try {
      if (typeof window.setStatus === 'function') {
        window.setStatus(message, type);
        return;
      }
    } catch (_) {}
    const element = byId('status');
    if (!element) return;
    element.textContent = message;
    element.className = `status ${type}`;
  }

  function stableStringify(value) {
    if (value === null || typeof value !== 'object') return JSON.stringify(value);
    if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`;
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stableStringify(value[key])}`).join(',')}}`;
  }

  function imageToken(image) {
    if (!image || (typeof image !== 'object' && typeof image !== 'function')) return 'none';
    if (!imageIds.has(image)) imageIds.set(image, `image-${++imageSequence}`);
    return imageIds.get(image);
  }

  function currentFields() {
    const fields = {};
    for (const id of FIELD_IDS) {
      const element = byId(id);
      if (!element) continue;
      fields[id] = element.type === 'checkbox' ? Boolean(element.checked) : String(element.value ?? '');
    }
    return fields;
  }

  function currentSelectIndexes() {
    const indexes = {};
    for (const id of FIELD_IDS) {
      const element = byId(id);
      if (String(element?.tagName || '').toUpperCase() !== 'SELECT') continue;
      indexes[id] = Number(element.selectedIndex);
    }
    return indexes;
  }

  function currentLayout() {
    try { return typeof state !== 'undefined' && plainObject(state.layout) ? clone(state.layout) : {}; }
    catch (_) { return {}; }
  }

  function currentExtended() {
    try { return clone(window.CoverProjectStateBridge?.snapshot?.() || null); }
    catch (_) { return null; }
  }

  function currentImages() {
    try {
      return typeof state === 'undefined'
        ? { front: null, back: null }
        : { front: state.frontImage || null, back: state.backImage || null };
    } catch (_) {
      return { front: null, back: null };
    }
  }

  function currentImageNames() {
    return {
      front: String(byId('frontName')?.textContent || '앞표지 이미지'),
      back: String(byId('backName')?.textContent || '뒤표지 이미지'),
    };
  }

  function captureSnapshot() {
    const images = currentImages();
    let active = 'frontImage';
    let showGuides = true;
    try {
      if (typeof state !== 'undefined') {
        active = String(state.active || 'frontImage');
        showGuides = state.showGuides !== false;
      }
    } catch (_) {}
    const serializable = {
      version: 1,
      fields: currentFields(),
      selectIndexes: currentSelectIndexes(),
      layout: currentLayout(),
      extended: currentExtended(),
      active,
      showGuides,
      imageNames: currentImageNames(),
      imageTokens: { front: imageToken(images.front), back: imageToken(images.back) },
    };
    const signatureSource = { ...serializable };
    delete signatureSource.active;
    delete signatureSource.showGuides;
    return {
      ...serializable,
      images,
      signature: stableStringify(signatureSource),
    };
  }

  function makeEntry(label, snapshot = captureSnapshot()) {
    return {
      label: String(label || '편집').slice(0, 80),
      snapshot,
      signature: snapshot.signature,
      createdAt: Date.now(),
    };
  }

  function trimPast() {
    if (past.length > MAX_HISTORY) past.splice(0, past.length - MAX_HISTORY);
  }

  function updateButtons() {
    const undo = byId('coverUndoBtn');
    const redo = byId('coverRedoBtn');
    if (undo) {
      undo.disabled = !past.length;
      undo.title = past.length ? `실행 취소: ${present?.label || '최근 편집'} (Ctrl+Z)` : '실행 취소할 편집이 없습니다. (Ctrl+Z)';
      undo.setAttribute('aria-disabled', String(!past.length));
    }
    if (redo) {
      redo.disabled = !future.length;
      redo.title = future.length ? `다시 실행: ${future[future.length - 1]?.label || '편집'} (Ctrl+Y)` : '다시 실행할 편집이 없습니다. (Ctrl+Y)';
      redo.setAttribute('aria-disabled', String(!future.length));
    }
    const count = byId('coverHistoryCount');
    if (count) count.textContent = `${past.length}/${MAX_HISTORY}`;
  }

  function dispatchHistoryChange(reason) {
    document.dispatchEvent(new CustomEvent('cover-edit-history-change', {
      detail: {
        reason,
        canUndo: Boolean(past.length),
        canRedo: Boolean(future.length),
        undoCount: past.length,
        redoCount: future.length,
      },
    }));
  }

  function commit(label = '편집') {
    if (applying) return false;
    clearTimeout(pendingTimer);
    pendingTimer = 0;
    pendingLabel = '';
    const next = captureSnapshot();
    if (!present) {
      present = makeEntry('초기 상태', next);
      updateButtons();
      return false;
    }
    if (next.signature === present.signature) return false;
    past.push(present);
    trimPast();
    present = makeEntry(label, next);
    future.length = 0;
    updateButtons();
    dispatchHistoryChange('commit');
    return true;
  }

  function scheduleCommit(label = '편집', delay = INPUT_COMMIT_DELAY_MS) {
    if (applying) return;
    pendingLabel = String(label || pendingLabel || '편집');
    clearTimeout(pendingTimer);
    pendingTimer = setTimeout(() => {
      pendingTimer = 0;
      const nextLabel = pendingLabel;
      pendingLabel = '';
      commit(nextLabel);
    }, Math.max(0, Number(delay) || 0));
  }

  function flushPending() {
    if (!pendingTimer) return false;
    clearTimeout(pendingTimer);
    pendingTimer = 0;
    const label = pendingLabel || '편집';
    pendingLabel = '';
    return commit(label);
  }

  function setFieldValue(element, value) {
    if (!element) return;
    if (element.type === 'checkbox') element.checked = Boolean(value);
    else element.value = value ?? '';
    element.dispatchEvent(new Event('input', { bubbles: true }));
    element.dispatchEvent(new Event('change', { bubbles: true }));
  }

  function restoreFields(fields, selectIndexes) {
    for (const id of FIELD_IDS) {
      if (!Object.prototype.hasOwnProperty.call(fields || {}, id)) continue;
      const element = byId(id);
      const selectedIndex = Number(selectIndexes?.[id]);
      if (String(element?.tagName || '').toUpperCase() === 'SELECT') {
        element.value = fields[id] ?? '';
        if (Number.isInteger(selectedIndex) && selectedIndex >= 0 && selectedIndex < Number(element.options?.length || 0)) {
          element.selectedIndex = selectedIndex;
        }
        element.dispatchEvent(new Event('input', { bubbles: true }));
        element.dispatchEvent(new Event('change', { bubbles: true }));
      } else {
        setFieldValue(element, fields[id]);
      }
    }
  }

  function restoreLayout(layout) {
    if (typeof state === 'undefined' || !plainObject(layout)) return;
    state.layout = state.layout || {};
    for (const key of Object.keys(state.layout)) delete state.layout[key];
    Object.assign(state.layout, clone(layout));
  }

  function restoreImages(images, names) {
    if (typeof state === 'undefined') return;
    state.frontImage = images?.front || null;
    state.backImage = images?.back || null;
    for (const side of ['front', 'back']) {
      const image = side === 'front' ? state.frontImage : state.backImage;
      const box = byId(`${side}UploadBox`);
      const name = byId(`${side}Name`);
      box?.classList?.toggle('has-file', Boolean(image));
      if (name) name.textContent = image
        ? String(names?.[side] || (side === 'front' ? '앞표지 이미지' : '뒤표지 이미지'))
        : (side === 'front' ? '앞표지 이미지' : '뒤표지 이미지');
    }
  }

  function normalizeActive(snapshot) {
    if (typeof state === 'undefined') return;
    const requested = String(snapshot?.active || 'frontImage');
    state.active = state.layout?.[requested]
      ? requested
      : (state.layout?.frontImage ? 'frontImage' : Object.keys(state.layout || {})[0] || 'frontImage');
    try {
      if (window.CoverTextZones?.findItem?.(state.active)) window.CoverTextZones.select?.(state.active);
    } catch (_) {}
  }

  function redrawAfterRestore() {
    try { window.CoverTextZones?.save?.(); } catch (_) {}
    try { window.syncControls?.(); } catch (_) {}
    try { window.updateCalculation?.(); } catch (_) {}
    try { window.requestRender?.(); } catch (_) {}
    try { window.CoverTextCanvasControls?.install?.(); } catch (_) {}
    try {
      byId('guideOnBtn')?.classList?.toggle('active', typeof state !== 'undefined' && state.showGuides !== false);
      byId('guideOffBtn')?.classList?.toggle('active', typeof state !== 'undefined' && state.showGuides === false);
    } catch (_) {}
  }

  function applyRawSnapshot(snapshot) {
    if (!snapshot || typeof snapshot !== 'object') throw new Error('복원할 편집 상태가 올바르지 않습니다.');
    restoreFields(snapshot.fields || {}, snapshot.selectIndexes || {});
    restoreLayout(snapshot.layout || {});
    if (snapshot.extended) window.CoverProjectStateBridge?.restore?.(clone(snapshot.extended));
    restoreImages(snapshot.images || {}, snapshot.imageNames || {});
    normalizeActive(snapshot);
    redrawAfterRestore();
  }

  function applySnapshotTransaction(target, fallback) {
    applying = true;
    clearTimeout(pendingTimer);
    pendingTimer = 0;
    pendingLabel = '';
    try {
      applyRawSnapshot(target);
      const applied = captureSnapshot();
      if (applied.signature !== target.signature) {
        throw new Error('편집 상태가 완전히 복원되지 않았습니다.');
      }
      document.dispatchEvent(new CustomEvent('cover-history-restored', { detail: { signature: target.signature } }));
      try { window.CoverRecoveryCheckpoints?.queueSave?.({ force: true }); } catch (_) {}
      return true;
    } catch (error) {
      try { if (fallback) applyRawSnapshot(fallback); } catch (_) {}
      status(error?.message || '편집 상태를 복원하지 못했습니다.', 'err');
      return false;
    } finally {
      applying = false;
    }
  }

  function undo() {
    flushPending();
    if (!past.length || !present) return false;
    const current = present;
    const target = past[past.length - 1];
    if (!applySnapshotTransaction(target.snapshot, current.snapshot)) return false;
    past.pop();
    future.push(current);
    present = target;
    updateButtons();
    dispatchHistoryChange('undo');
    status(`실행 취소: ${current.label}`, 'info');
    return true;
  }

  function redo() {
    flushPending();
    if (!future.length || !present) return false;
    const current = present;
    const target = future[future.length - 1];
    if (!applySnapshotTransaction(target.snapshot, current.snapshot)) return false;
    future.pop();
    past.push(current);
    trimPast();
    present = target;
    updateButtons();
    dispatchHistoryChange('redo');
    status(`다시 실행: ${target.label}`, 'info');
    return true;
  }

  function reset(label = '현재 상태') {
    clearTimeout(pendingTimer);
    pendingTimer = 0;
    pendingLabel = '';
    past.length = 0;
    future.length = 0;
    present = makeEntry(label);
    updateButtons();
    dispatchHistoryChange('reset');
    return true;
  }

  function installStyles() {
    if (byId('coverEditHistoryStyles')) return;
    const style = document.createElement('style');
    style.id = 'coverEditHistoryStyles';
    style.textContent = `
      .cover-history-controls{display:inline-flex;align-items:center;gap:3px;padding:2px;border:1px solid #dbe5ee;border-radius:8px;background:#f8fafc}
      .cover-history-btn{display:inline-flex;align-items:center;justify-content:center;gap:4px;height:27px;border:0;border-radius:6px;background:#fff;color:#334155;padding:0 7px;font-size:9px;font-weight:900;cursor:pointer}
      .cover-history-btn:hover:not(:disabled){background:#ecfeff;color:#0e7490}
      .cover-history-btn:disabled{opacity:.38;cursor:not-allowed}
      .cover-history-icon{font-size:15px;line-height:1}.cover-history-count{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap}
      @media(max-width:720px){.cover-history-label{display:none}.cover-history-btn{width:30px;padding:0}}
    `;
    document.head.appendChild(style);
  }

  function ensureControls() {
    let controls = byId('coverHistoryControls');
    const actions = document.querySelector('.preview-actions');
    if (controls || !actions) return controls;
    controls = document.createElement('span');
    controls.id = 'coverHistoryControls';
    controls.className = 'cover-history-controls';
    controls.innerHTML = `
      <button type="button" id="coverUndoBtn" class="cover-history-btn" aria-label="실행 취소" aria-keyshortcuts="Control+Z Meta+Z"><span class="cover-history-icon" aria-hidden="true">↶</span><span class="cover-history-label">취소</span></button>
      <button type="button" id="coverRedoBtn" class="cover-history-btn" aria-label="다시 실행" aria-keyshortcuts="Control+Y Meta+Shift+Z"><span class="cover-history-icon" aria-hidden="true">↷</span><span class="cover-history-label">다시</span></button>
      <span id="coverHistoryCount" class="cover-history-count" aria-live="polite"></span>`;
    actions.insertBefore(controls, actions.firstChild);
    byId('coverUndoBtn')?.addEventListener('click', undo);
    byId('coverRedoBtn')?.addEventListener('click', redo);
    updateButtons();
    return controls;
  }

  function editableTarget(event) {
    const target = event.target;
    if (!target || target.closest?.('#coverRecoveryDialog, #coverFinalOutputDialog')) return false;
    return Boolean(target.closest?.('.settings, #coverTextContextToolbar, #coverSpineOrientationPanel'));
  }

  function eventLabel(event) {
    const target = event.target;
    if (!target) return '편집';
    const row = target.closest?.('.cover-text-row');
    if (row) {
      if (target.matches?.('textarea, input[type="text"]')) return '표지 글자 내용 변경';
      if (target.matches?.('input[type="number"], input[type="range"]')) return '표지 글자 크기·위치 변경';
      if (target.matches?.('input[type="color"]')) return '표지 글자 색상 변경';
      return '표지 글자 설정 변경';
    }
    return FIELD_LABELS[target.id] || '표지 설정 변경';
  }

  function clickLabel(target) {
    if (!target) return '';
    const button = target.closest?.('button');
    if (!button || button.closest?.('#coverHistoryControls, #coverRecoveryDialog, #coverFinalOutputDialog')) return '';
    if (CLICK_LABELS[button.id]) return CLICK_LABELS[button.id];
    if (button.matches('[data-preset]')) return '글자 배치 프리셋 적용';
    if (button.matches('[data-text-scale]')) return '글자 크기 조절';
    if (button.matches('[data-align-axis]')) return '글자 정렬';
    if (button.matches('[data-spine-direction]')) return '책등 글자 방향 변경';
    if (button.closest('.cover-text-row')) return '표지 글자 레이어 변경';
    return '';
  }

  function handleKeydown(event) {
    if (!(event.ctrlKey || event.metaKey) || event.altKey) return;
    const key = String(event.key || '').toLowerCase();
    const undoKey = key === 'z' && !event.shiftKey;
    const redoKey = (key === 'z' && event.shiftKey) || key === 'y';
    if (!undoKey && !redoKey) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    event.stopPropagation();
    if (undoKey) undo();
    else redo();
  }

  function bindEvents() {
    document.addEventListener('input', (event) => {
      if (!applying && editableTarget(event)) scheduleCommit(eventLabel(event), INPUT_COMMIT_DELAY_MS);
    }, true);
    document.addEventListener('change', (event) => {
      if (applying || !editableTarget(event) || event.target?.type === 'file') return;
      scheduleCommit(eventLabel(event), 80);
    }, true);
    document.addEventListener('click', (event) => {
      if (applying) return;
      const label = clickLabel(event.target);
      if (label) scheduleCommit(label, 0);
    }, true);
    document.addEventListener('cover-editor-change-committed', (event) => {
      if (applying) return;
      const label = String(event.detail?.label || '미리보기 배치 변경');
      scheduleCommit(label, event.detail?.coalesce ? COALESCED_COMMIT_DELAY_MS : 0);
    });
    document.addEventListener('cover-image-effects-change', () => scheduleCommit('이미지 효과 변경', INPUT_COMMIT_DELAY_MS));
    document.addEventListener('cover-recovery-restored', () => setTimeout(() => reset('복구한 상태'), 0));
    document.addEventListener('cover-template-applied', () => setTimeout(() => commit('표지 템플릿 적용'), 0));
    document.addEventListener('keydown', handleKeydown, true);
    window.addEventListener('pointerup', (event) => {
      const target = event.target;
      if (target === byId('previewCanvas') || target?.closest?.('[data-cover-text-handle], .canvas-wrap')) {
        scheduleCommit('미리보기에서 배치 변경', 35);
      }
    }, true);
    window.addEventListener('wheel', (event) => {
      if (event.target === byId('previewCanvas')) scheduleCommit('미리보기에서 크기 조절', COALESCED_COMMIT_DELAY_MS);
    }, { capture: true, passive: true });
    window.addEventListener('keyup', (event) => {
      if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(event.key)) return;
      const tag = String(event.target?.tagName || '').toUpperCase();
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes(tag) || event.target?.isContentEditable) return;
      scheduleCommit('선택 요소 미세 이동', COALESCED_COMMIT_DELAY_MS);
    }, true);
  }

  function observeImageChanges() {
    if (imageObserver || typeof MutationObserver !== 'function') return Boolean(imageObserver);
    const targets = ['frontName', 'backName', 'frontUploadBox', 'backUploadBox'].map(byId).filter(Boolean);
    if (!targets.length) return false;
    imageObserver = new MutationObserver(() => {
      if (!applying) scheduleCommit('표지 이미지 변경', 0);
    });
    for (const target of targets) {
      imageObserver.observe(target, {
        childList: true,
        characterData: true,
        subtree: true,
        attributes: true,
        attributeFilter: ['class'],
      });
    }
    return true;
  }

  function wrapImageInput() {
    if (wrappedImageInput || typeof window.handleImageInput !== 'function') return false;
    const original = window.handleImageInput;
    window.handleImageInput = async function coverHistoryImageInput(...args) {
      const before = present?.signature;
      const result = await Reflect.apply(original, this, args);
      if (!applying && captureSnapshot().signature !== before) commit('표지 이미지 변경');
      return result;
    };
    wrappedImageInput = true;
    return true;
  }

  function install() {
    if (typeof state === 'undefined' || !document.querySelector('.preview-actions')) return false;
    installStyles();
    ensureControls();
    wrapImageInput();
    observeImageChanges();
    if (!installed) {
      installed = true;
      bindEvents();
      reset('초기 상태');
    }
    return true;
  }

  window.CoverEditHistory = {
    captureSnapshot,
    stableStringify,
    imageToken,
    makeEntry,
    commit,
    scheduleCommit,
    flushPending,
    undo,
    redo,
    reset,
    applySnapshotTransaction,
    install,
    get applying() { return applying; },
    get canUndo() { return Boolean(past.length); },
    get canRedo() { return Boolean(future.length); },
    get pastCount() { return past.length; },
    get futureCount() { return future.length; },
    get current() { return present; },
    get maxHistory() { return MAX_HISTORY; },
    stage: 'bounded-transaction-safe-undo-redo',
  };

  for (const delay of INSTALL_DELAYS) setTimeout(install, delay);
})();