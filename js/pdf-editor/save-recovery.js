// PDF save failure checkpoint, editor lock, and automatic recovery.
(function () {
  'use strict';
  if (window.__pdfSaveRecoveryV1) return;
  window.__pdfSaveRecoveryV1 = true;

  const $ = (id) => document.getElementById(id);
  const LOCK_CLASS = 'pdf-save-editor-locked-v1';
  const MAX_MONITOR_ATTEMPTS = 640;
  let attempts = 0;
  let activeCheckpoint = null;
  let lastCheckpoint = null;
  let monitorSequence = 0;

  function cloneJson(value, fallback) {
    try { return JSON.parse(JSON.stringify(value)); }
    catch (_) { return fallback; }
  }

  function editorReady() {
    try {
      return Array.isArray(parsedPages)
        && Array.isArray(uploadedFiles)
        && typeof collectEditorState === 'function'
        && typeof renderThumbs === 'function'
        && !!window.PdfOperationManager;
    } catch (_) {
      return false;
    }
  }

  function capturePage(page) {
    const snapshot = { ...page };
    snapshot.dividerContent = cloneJson(page?.dividerContent, page?.dividerContent ? { ...page.dividerContent } : null);
    return { page, snapshot };
  }

  function captureControlStates() {
    const controls = [];
    document.querySelectorAll('aside input,aside select,aside textarea').forEach((element) => {
      controls.push({
        element,
        value: element.value,
        checked: 'checked' in element ? !!element.checked : null,
        disabled: !!element.disabled,
        display: element.style.display,
      });
    });
    const classStates = [];
    document.querySelectorAll(
      '.nup-btn,.orient-btn,.pn-pos-btn,.mode-btn,#orderLR,#orderTB,#showBorder,#bookletCheck'
    ).forEach((element) => {
      classStates.push({ element, className: element.className });
    });
    const panelStates = [];
    for (const id of ['customSizeRow', 'wmSettings', 'hfSettings', 'pnSettings', 'cropMarksSettings', 'bookletRow', 'bookletPrintGuideV2']) {
      const element = $(id);
      if (element) panelStates.push({ element, display: element.style.display, className: element.className });
    }
    return { controls, classStates, panelStates };
  }

  function readGlobalState() {
    const state = {};
    try { state.nup = nup; } catch (_) {}
    try { state.orderLR = orderLR; } catch (_) {}
    try { state.landscape = landscape; } catch (_) {}
    try { state.showBorder = showBorder; } catch (_) {}
    try { state.fileNupMap = cloneJson(fileNupMap, { ...fileNupMap }); } catch (_) { state.fileNupMap = {}; }
    try { state.nextId = _nextId; } catch (_) {}
    try { state.uploadMode = _uploadMode; } catch (_) {}

    try { state.wmEnabled = wmEnabled; } catch (_) {}
    try { state.wmText = wmText; } catch (_) {}
    try { state.wmOpacity = wmOpacity; } catch (_) {}
    try { state.wmAngle = wmAngle; } catch (_) {}
    try { state.wmColor = wmColor; } catch (_) {}

    try { state.hfEnabled = hfEnabled; } catch (_) {}
    try { state.hfHL = hfHL; } catch (_) {}
    try { state.hfHC = hfHC; } catch (_) {}
    try { state.hfHR = hfHR; } catch (_) {}
    try { state.hfFL = hfFL; } catch (_) {}
    try { state.hfFC = hfFC; } catch (_) {}
    try { state.hfFR = hfFR; } catch (_) {}
    try { state.hfFontSize = hfFontSize; } catch (_) {}
    try { state.hfColor = hfColor; } catch (_) {}
    try { state.hfApplyTo = hfApplyTo; } catch (_) {}
    try { state.hfMarginMm = hfMarginMm; } catch (_) {}
    try { state.hfSections = cloneJson(hfSections, []); } catch (_) { state.hfSections = []; }
    try { state.hfSectionId = _hfSecId; } catch (_) {}

    try { state.pnEnabled = pnEnabled; } catch (_) {}
    try { state.pnPosition = pnPosition; } catch (_) {}
    try { state.pnFormat = pnFormat; } catch (_) {}
    try { state.pnStart = pnStart; } catch (_) {}
    try { state.pnFontSize = pnFontSize; } catch (_) {}
    try { state.pnColor = pnColor; } catch (_) {}
    try { state.pnExcludeFirst = pnExcludeFirst; } catch (_) {}
    try { state.pnApplyTo = pnApplyTo; } catch (_) {}
    try { state.pnMarginMm = pnMarginMm; } catch (_) {}
    try { state.facingPages = facingPages; } catch (_) {}
    return state;
  }

  function assignGlobalState(state) {
    if (!state) return;
    try { nup = state.nup; } catch (_) {}
    try { orderLR = state.orderLR; } catch (_) {}
    try { landscape = state.landscape; } catch (_) {}
    try { showBorder = state.showBorder; } catch (_) {}
    try { fileNupMap = cloneJson(state.fileNupMap, { ...(state.fileNupMap || {}) }); } catch (_) {}
    try { if (Number.isFinite(Number(state.nextId))) _nextId = Number(state.nextId); } catch (_) {}
    try { if (state.uploadMode) _uploadMode = state.uploadMode; } catch (_) {}

    try { wmEnabled = state.wmEnabled; } catch (_) {}
    try { wmText = state.wmText; } catch (_) {}
    try { wmOpacity = state.wmOpacity; } catch (_) {}
    try { wmAngle = state.wmAngle; } catch (_) {}
    try { wmColor = state.wmColor; } catch (_) {}

    try { hfEnabled = state.hfEnabled; } catch (_) {}
    try { hfHL = state.hfHL; } catch (_) {}
    try { hfHC = state.hfHC; } catch (_) {}
    try { hfHR = state.hfHR; } catch (_) {}
    try { hfFL = state.hfFL; } catch (_) {}
    try { hfFC = state.hfFC; } catch (_) {}
    try { hfFR = state.hfFR; } catch (_) {}
    try { hfFontSize = state.hfFontSize; } catch (_) {}
    try { hfColor = state.hfColor; } catch (_) {}
    try { hfApplyTo = state.hfApplyTo; } catch (_) {}
    try { hfMarginMm = state.hfMarginMm; } catch (_) {}
    try { hfSections = cloneJson(state.hfSections, []); } catch (_) {}
    try { if (Number.isFinite(Number(state.hfSectionId))) _hfSecId = Number(state.hfSectionId); } catch (_) {}

    try { pnEnabled = state.pnEnabled; } catch (_) {}
    try { pnPosition = state.pnPosition; } catch (_) {}
    try { pnFormat = state.pnFormat; } catch (_) {}
    try { pnStart = state.pnStart; } catch (_) {}
    try { pnFontSize = state.pnFontSize; } catch (_) {}
    try { pnColor = state.pnColor; } catch (_) {}
    try { pnExcludeFirst = state.pnExcludeFirst; } catch (_) {}
    try { pnApplyTo = state.pnApplyTo; } catch (_) {}
    try { pnMarginMm = state.pnMarginMm; } catch (_) {}
    try { facingPages = state.facingPages; } catch (_) {}
  }

  function captureCheckpoint() {
    if (!editorReady()) return null;
    let serializedState = {};
    try { serializedState = cloneJson(collectEditorState(), {}); } catch (_) {}
    const checkpoint = {
      createdAt: Date.now(),
      pages: parsedPages.map(capturePage),
      uploadedFiles: [...uploadedFiles],
      previewCanvases: Array.isArray(previewCanvases) ? [...previewCanvases] : [],
      globalState: readGlobalState(),
      serializedState,
      controlState: captureControlStates(),
      lockRecords: [],
      restored: false,
    };
    lastCheckpoint = checkpoint;
    return checkpoint;
  }

  function lockEditor(checkpoint) {
    if (!checkpoint) return;
    const seen = new Set();
    const selectors = [
      'aside button',
      'aside input',
      'aside select',
      'aside textarea',
      '#previewBtn',
      '#resetBtn',
      '#navSessionBtn',
      '#navSessionLoadBtn',
      '#thumbArea button',
      '#thumbArea input',
      '#previewScroll button',
    ];
    document.querySelectorAll(selectors.join(',')).forEach((element) => {
      if (!element || seen.has(element) || element.id === 'downloadBtn' || element.id === 'pdfSaveProgressCancelV3') return;
      seen.add(element);
      checkpoint.lockRecords.push({ element, disabled: !!element.disabled });
      element.disabled = true;
    });
    document.body.classList.add(LOCK_CLASS);
    document.body.setAttribute('aria-busy', 'true');
  }

  function unlockEditor(checkpoint) {
    if (checkpoint?.lockRecords) {
      checkpoint.lockRecords.forEach(({ element, disabled }) => {
        if (element && element.isConnected) element.disabled = disabled;
      });
      checkpoint.lockRecords = [];
    }
    document.body.classList.remove(LOCK_CLASS);
    document.body.removeAttribute('aria-busy');
  }

  function restoreControls(controlState) {
    if (!controlState) return;
    controlState.controls.forEach(({ element, value, checked, disabled, display }) => {
      if (!element || !element.isConnected) return;
      element.value = value;
      if (checked !== null && 'checked' in element) element.checked = checked;
      element.disabled = disabled;
      element.style.display = display;
    });
    controlState.classStates.forEach(({ element, className }) => {
      if (element && element.isConnected) element.className = className;
    });
    controlState.panelStates.forEach(({ element, display, className }) => {
      if (!element || !element.isConnected) return;
      element.style.display = display;
      element.className = className;
    });
  }

  function restorePages(checkpoint) {
    checkpoint.pages.forEach(({ page, snapshot }) => {
      if (!page || !snapshot) return;
      Object.keys(page).forEach((key) => {
        if (!(key in snapshot)) {
          try { delete page[key]; } catch (_) {}
        }
      });
      Object.assign(page, snapshot);
      page.dividerContent = cloneJson(snapshot.dividerContent, snapshot.dividerContent ? { ...snapshot.dividerContent } : null);
    });
    parsedPages = checkpoint.pages.map(({ page }) => page);
    uploadedFiles = [...checkpoint.uploadedFiles];
    previewCanvases = [...checkpoint.previewCanvases];
  }

  function refreshEditorAfterRestore(checkpoint) {
    try { if (typeof renderHfSections === 'function') renderHfSections(); } catch (_) {}
    restoreControls(checkpoint.controlState);
    try { window.PdfEditorLayoutExport?.applyStateMargins?.(checkpoint.serializedState); } catch (_) {}
    try {
      const crop = checkpoint.serializedState?.cropMarks;
      if (crop) {
        if ($('cropMarksEnabled')) $('cropMarksEnabled').checked = !!crop.enabled;
        if ($('printBleedMm') && Number.isFinite(Number(crop.bleed_mm))) $('printBleedMm').value = String(crop.bleed_mm);
        if ($('cropMarkLengthMm') && Number.isFinite(Number(crop.mark_length_mm))) $('cropMarkLengthMm').value = String(crop.mark_length_mm);
        if ($('cropMarkOffsetMm') && Number.isFinite(Number(crop.mark_offset_mm))) $('cropMarkOffsetMm').value = String(crop.mark_offset_mm);
        if ($('cropMarksSettings')) $('cropMarksSettings').style.display = crop.enabled ? 'block' : 'none';
      }
    } catch (_) {}
    try {
      const flip = checkpoint.serializedState?.bookletFlip;
      if (flip && $('bookletFlipSelectV2')) $('bookletFlipSelectV2').value = flip;
    } catch (_) {}

    try { renderThumbs(); } catch (_) {}
    try { if (typeof updateNupBadges === 'function') updateNupBadges(); } catch (_) {}
    try { if (typeof updateBookletPadInfo === 'function') updateBookletPadInfo(); } catch (_) {}
    try { if (window.PdfBookletPrintGuide?.refresh) window.PdfBookletPrintGuide.refresh(); } catch (_) {}
    try {
      if (window.PdfLivePreview?.request) window.PdfLivePreview.request(180, false);
      else if (typeof schedulePreview === 'function') schedulePreview(180);
    } catch (_) {}
  }

  function restoreCheckpoint(checkpoint = activeCheckpoint || lastCheckpoint, force = false) {
    if (!checkpoint || (checkpoint.restored && !force)) return false;
    try {
      restorePages(checkpoint);
      assignGlobalState(checkpoint.globalState);
      refreshEditorAfterRestore(checkpoint);
      checkpoint.restored = true;
      lastCheckpoint = checkpoint;
      return true;
    } catch (error) {
      console.error('[pdf-save-recovery] restore failed', error);
      return false;
    }
  }

  function clearActiveCheckpoint(result) {
    const checkpoint = activeCheckpoint;
    if (!checkpoint) return;
    unlockEditor(checkpoint);
    if (result === 'success' || result === 'canceled') lastCheckpoint = null;
    activeCheckpoint = null;
    monitorSequence += 1;
  }

  function recoveryMessage(message, restored) {
    const base = message || 'PDF 생성에 실패했습니다.';
    return restored
      ? `${base} 편집 상태를 저장 시작 전 상태로 복구했습니다.`
      : `${base} 자동 복구를 완료하지 못했습니다. 현재 화면을 확인하세요.`;
  }

  function finalizeFromWrapper(originalFinish, result, message) {
    const failed = result === 'error';
    const checkpoint = activeCheckpoint;
    let finalMessage = message;
    if (failed && checkpoint) {
      const restored = restoreCheckpoint(checkpoint);
      finalMessage = recoveryMessage(message, restored);
    }
    clearActiveCheckpoint(result);
    return originalFinish(result, finalMessage);
  }

  function monitorFinalState(sequence, attempt = 0) {
    if (sequence !== monitorSequence || !activeCheckpoint) return;
    const manager = window.PdfOperationManager;
    let operation = null;
    try { operation = manager?.active?.(); } catch (_) {}
    if (!operation) {
      const panel = $('pdfSaveProgressPanelV2');
      const failed = !!panel?.classList.contains('error');
      const canceled = !!panel?.classList.contains('canceled');
      const success = !!panel?.classList.contains('success');
      if (failed) {
        const restored = restoreCheckpoint(activeCheckpoint);
        const message = $('pdfSaveProgressMessageV2');
        if (message) message.textContent = recoveryMessage(message.textContent, restored);
      }
      clearActiveCheckpoint(canceled ? 'canceled' : success ? 'success' : failed ? 'error' : 'unknown');
      return;
    }
    if (attempt >= MAX_MONITOR_ATTEMPTS) {
      try { manager?.cancel?.(); } catch (_) {}
      return;
    }
    setTimeout(() => monitorFinalState(sequence, attempt + 1), 500);
  }

  function beginCheckpointIfNeeded() {
    if (activeCheckpoint) return activeCheckpoint;
    const checkpoint = captureCheckpoint();
    if (!checkpoint) return null;
    activeCheckpoint = checkpoint;
    lockEditor(checkpoint);
    monitorSequence += 1;
    const sequence = monitorSequence;
    setTimeout(() => monitorFinalState(sequence, 0), 250);
    return checkpoint;
  }

  function installManagerBridge() {
    const manager = window.PdfOperationManager;
    if (!manager || typeof manager.apiOptions !== 'function' || typeof manager.finishOperation !== 'function') return false;
    if (manager.__saveRecoveryWrappedV1) return true;

    const originalApiOptions = manager.apiOptions.bind(manager);
    const originalFinish = manager.finishOperation.bind(manager);

    manager.apiOptions = function recoveryAwareApiOptions() {
      const options = originalApiOptions();
      if (options) beginCheckpointIfNeeded();
      return options;
    };

    manager.finishOperation = function recoveryAwareFinish(result, message) {
      return finalizeFromWrapper(originalFinish, result, message);
    };

    manager.__saveRecoveryWrappedV1 = true;
    return true;
  }

  function blockMutationWhileSaving(event) {
    if (!activeCheckpoint) return;
    if (event.type === 'drop') {
      event.preventDefault();
      event.stopImmediatePropagation();
      return;
    }
    if (event.type === 'keydown') {
      const key = String(event.key || '').toLowerCase();
      const editingShortcut = key === 'delete'
        || key === 'backspace'
        || ((event.ctrlKey || event.metaKey) && (key === 'z' || key === 'y'));
      if (editingShortcut) {
        event.preventDefault();
        event.stopImmediatePropagation();
      }
    }
  }

  function installStyles() {
    if ($('pdfSaveRecoveryStylesV1')) return;
    const style = document.createElement('style');
    style.id = 'pdfSaveRecoveryStylesV1';
    style.textContent = `
      body.${LOCK_CLASS} #thumbArea{pointer-events:none;opacity:.76}
      body.${LOCK_CLASS} #previewScroll button{pointer-events:none}
      body.${LOCK_CLASS} aside .upload-zone{pointer-events:none}
      body.${LOCK_CLASS} aside::after{content:'PDF 저장 중 · 편집 잠금';position:sticky;bottom:0;display:block;margin:10px 0 0;padding:7px 9px;border:1px solid #bfdbfe;border-radius:8px;background:#eff6ff;color:#1e40af;font-size:9px;font-weight:850;text-align:center}
    `;
    document.head.appendChild(style);
  }

  function boot() {
    installStyles();
    const ready = editorReady();
    const installed = ready && installManagerBridge();
    if ((!ready || !installed) && attempts < 16) {
      attempts += 1;
      setTimeout(boot, 180 + attempts * 60);
    }
  }

  document.addEventListener('drop', blockMutationWhileSaving, true);
  document.addEventListener('keydown', blockMutationWhileSaving, true);

  window.PdfSaveRecovery = {
    capture: captureCheckpoint,
    restoreLast: () => restoreCheckpoint(lastCheckpoint, true),
    active: () => activeCheckpoint,
    last: () => lastCheckpoint,
    stage: 'failure-checkpoint-lock-restore',
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once: true });
  else boot();
})();
