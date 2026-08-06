// Transactional PDF import that preserves the existing bounded large-document path.
(function () {
  'use strict';
  if (window.__pdfImportTransactionSafetyV1) return;
  window.__pdfImportTransactionSafetyV1 = true;
  if (!location.pathname.includes('pdf-editor')) return;

  const RENDER_HEAVY_PAGE_LIMIT = 25;
  const RENDER_HUGE_PAGE_LIMIT = 80;
  const EXTREME_PAGE_LIMIT = 300;
  const RENDER_HEAVY_BYTE_LIMIT = 30 * 1024 * 1024;
  const RENDER_HUGE_BYTE_LIMIT = 80 * 1024 * 1024;
  const OPTIMIZED_PAGE_LIMIT = 120;
  const INSTALL_DELAYS = [0, 120, 300, 650, 1100, 1800, 2800];

  let installed = false;
  let importQueue = Promise.resolve();

  const byId = (id) => document.getElementById(id);
  const isPdfFile = (file) => Boolean(
    file && (((file.type || '').includes('pdf')) || /\.pdf$/i.test(file.name || '')),
  );
  const shortFileName = (name) => {
    const text = String(name || 'PDF 파일');
    return text.length > 28 ? `${text.slice(0, 26)}…` : text;
  };

  function optimizationApi() {
    return window.PdfUploadOptimization || null;
  }

  function setSafeStatus(message, type = 'info', retry) {
    const bar = byId('statusBar');
    if (!bar) return;
    bar.style.display = 'flex';
    bar.className = `status-bar${type === 'error' ? ' error' : type === 'success' ? ' success' : ''}`;
    bar.replaceChildren();
    if (type === 'info') {
      const spinner = document.createElement('div');
      spinner.className = 'spinner';
      bar.appendChild(spinner);
    }
    const text = document.createElement('span');
    text.textContent = `${type === 'error' ? '❌ ' : type === 'success' ? '✅ ' : ''}${message}`;
    bar.appendChild(text);
    if (typeof retry === 'function') {
      const button = document.createElement('button');
      button.type = 'button';
      button.textContent = '다시 시도';
      button.style.cssText = 'margin-left:auto;border:1px solid currentColor;border-radius:6px;background:#fff;padding:4px 8px;font:inherit;font-weight:800;cursor:pointer';
      button.addEventListener('click', retry, { once: true });
      bar.appendChild(button);
    }
  }

  function setBusy(value) {
    const zone = byId('uploadZone');
    const input = byId('fileInput');
    if (zone) {
      zone.setAttribute('aria-busy', value ? 'true' : 'false');
      zone.dataset.importBusy = value ? '1' : '0';
    }
    if (input) input.disabled = Boolean(value);
  }

  function captureUiState() {
    const previewScroll = byId('previewScroll');
    return {
      previewDisabled: byId('previewBtn')?.disabled,
      downloadDisabled: byId('downloadBtn')?.disabled,
      previewNodes: previewScroll ? [...previewScroll.childNodes] : [],
      paperSize: byId('paperSize')?.value,
      customSizeDisplay: byId('customSizeRow')?.style.display,
      customW: byId('customW')?.value,
      customH: byId('customH')?.value,
      orientLandClass: byId('orientLand')?.className,
      orientPortClass: byId('orientPort')?.className,
      modeButtons: [...document.querySelectorAll('.mode-btn')].map((button) => ({
        button,
        className: button.className,
      })),
    };
  }

  function restoreUiState(snapshot) {
    if (!snapshot) return;
    if (byId('previewBtn')) byId('previewBtn').disabled = Boolean(snapshot.previewDisabled);
    if (byId('downloadBtn')) byId('downloadBtn').disabled = Boolean(snapshot.downloadDisabled);
    const previewScroll = byId('previewScroll');
    if (previewScroll) previewScroll.replaceChildren(...(snapshot.previewNodes || []));
    if (byId('paperSize') && snapshot.paperSize !== undefined) byId('paperSize').value = snapshot.paperSize;
    if (byId('customSizeRow')) byId('customSizeRow').style.display = snapshot.customSizeDisplay || '';
    if (byId('customW') && snapshot.customW !== undefined) byId('customW').value = snapshot.customW;
    if (byId('customH') && snapshot.customH !== undefined) byId('customH').value = snapshot.customH;
    if (byId('orientLand') && snapshot.orientLandClass !== undefined) byId('orientLand').className = snapshot.orientLandClass;
    if (byId('orientPort') && snapshot.orientPortClass !== undefined) byId('orientPort').className = snapshot.orientPortClass;
    for (const item of snapshot.modeButtons || []) item.button.className = item.className;
  }

  function captureEditorState() {
    return {
      parsedPages,
      uploadedFiles,
      previewCanvases,
      fileNupMap,
      nextId: _nextId,
      landscape,
      uploadMode: _uploadMode,
      fastMode: Boolean(window.__pdfEditorFastMode),
      extremeMode: Boolean(window.__pdfEditorExtremeMode),
      fastReason: String(window.__pdfEditorFastModeReason || ''),
      ui: captureUiState(),
    };
  }

  function restoreEditorState(snapshot) {
    parsedPages = snapshot.parsedPages;
    uploadedFiles = snapshot.uploadedFiles;
    previewCanvases = snapshot.previewCanvases;
    fileNupMap = snapshot.fileNupMap;
    _nextId = snapshot.nextId;
    landscape = snapshot.landscape;
    _uploadMode = snapshot.uploadMode;
    window.__pdfEditorFastMode = snapshot.fastMode;
    window.__pdfEditorExtremeMode = snapshot.extremeMode;
    window.__pdfEditorFastModeReason = snapshot.fastReason;
    try { renderThumbs(); } catch (_) {}
    restoreUiState(snapshot.ui);
  }

  function clearNupSessionState() {
    try {
      localStorage.removeItem('programToolPdfFileNupOverridesV1');
      localStorage.removeItem('programToolPdfPageNupOverridesV1');
      localStorage.removeItem('programToolPdfSelectedPageOrdinalV1');
    } catch (_) {}
  }

  function detectFirstPageSettings(pdfPage) {
    if (!byId('autoDetectSize')?.checked || !pdfPage) return null;
    const viewport = pdfPage.getViewport({ scale: 1 });
    const widthMm = Math.round(viewport.width * 25.4 / 72);
    const heightMm = Math.round(viewport.height * 25.4 / 72);
    const detected = detectPaperSizeMm(widthMm, heightMm);
    return {
      name: detected.name,
      widthMm,
      heightMm,
      landscape: viewport.width > viewport.height,
    };
  }

  function applyDetectedSettings(detected) {
    if (!detected) return;
    if (byId('paperSize')) byId('paperSize').value = detected.name;
    if (byId('customSizeRow')) byId('customSizeRow').style.display = detected.name === 'custom' ? 'grid' : 'none';
    if (detected.name === 'custom') {
      if (byId('customW')) byId('customW').value = Math.min(detected.widthMm, detected.heightMm);
      if (byId('customH')) byId('customH').value = Math.max(detected.widthMm, detected.heightMm);
    }
    landscape = detected.landscape;
    byId('orientLand')?.classList.toggle('active', detected.landscape);
    byId('orientPort')?.classList.toggle('active', !detected.landscape);
    try { updateNupBadges?.(); } catch (_) {}
  }

  function chooseImportPlan(total, fileSize, requestedMode) {
    const currentPages = requestedMode === 'new' ? 0 : parsedPages.length;
    const projectedPages = currentPages + total;
    const extreme = total >= EXTREME_PAGE_LIMIT || projectedPages >= EXTREME_PAGE_LIMIT;
    const heavy = total >= RENDER_HEAVY_PAGE_LIMIT
      || fileSize >= RENDER_HEAVY_BYTE_LIMIT
      || projectedPages > OPTIMIZED_PAGE_LIMIT;
    const huge = total >= RENDER_HUGE_PAGE_LIMIT
      || fileSize >= RENDER_HUGE_BYTE_LIMIT
      || projectedPages > OPTIMIZED_PAGE_LIMIT;
    return {
      total,
      fileSize,
      projectedPages,
      extreme,
      heavy,
      huge,
      thumbScale: huge ? 0.28 : (heavy ? 0.42 : 0.75),
      batchYield: huge ? 1 : (heavy ? 2 : 6),
    };
  }

  async function safePdfGetDocument(buffer, heavyMode) {
    const options = {
      data: buffer,
      disableAutoFetch: Boolean(heavyMode),
      disableStream: false,
      disableFontFace: Boolean(heavyMode),
    };
    try {
      return await pdfjsLib.getDocument({ ...options, disableWorker: true }).promise;
    } catch (firstError) {
      console.warn('[pdf-import-transaction] workerless load failed; retrying with worker', firstError);
      return pdfjsLib.getDocument(options).promise;
    }
  }

  function fallbackPlaceholder(pageNumber, total, rotation = 0) {
    const canvas = document.createElement('canvas');
    canvas.width = 96;
    canvas.height = 136;
    canvas.dataset.lightweightPage = '1';
    canvas.dataset.pageNumber = String(pageNumber);
    canvas.dataset.totalPages = String(total);
    canvas.dataset.pageRotation = String(rotation);
    return canvas;
  }

  function makePagePlaceholder(pageNumber, total, rotation = 0) {
    return optimizationApi()?.makePagePlaceholder?.(pageNumber, total, rotation)
      || fallbackPlaceholder(pageNumber, total, rotation);
  }

  function makeLightweightPdfPage(pageNumber, total) {
    const optimized = optimizationApi()?.makeLightweightPdfPage?.(pageNumber, total);
    if (optimized) return optimized;
    return {
      __lightweightPdfPage: true,
      getViewport({ scale = 1, rotation = 0 } = {}) {
        const sideways = rotation === 90 || rotation === 270;
        return { width: (sideways ? 136 : 96) * scale, height: (sideways ? 96 : 136) * scale, rotation };
      },
      render({ canvasContext }) {
        const replacement = fallbackPlaceholder(pageNumber, total, 0);
        canvasContext.canvas.width = replacement.width;
        canvasContext.canvas.height = replacement.height;
        return { promise: Promise.resolve() };
      },
    };
  }

  async function safeRenderPdfPage(pdfPage, scale, rotation, heavyMode) {
    const viewport = pdfPage.getViewport({ scale, rotation });
    const canvas = document.createElement('canvas');
    const maxSide = heavyMode ? 900 : 1400;
    let width = Math.max(1, Math.floor(viewport.width));
    let height = Math.max(1, Math.floor(viewport.height));
    const ratio = Math.min(1, maxSide / Math.max(width, height));
    width = Math.max(1, Math.floor(width * ratio));
    height = Math.max(1, Math.floor(height * ratio));
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext('2d', { alpha: false });
    const renderViewport = ratio < 1
      ? pdfPage.getViewport({ scale: scale * ratio, rotation })
      : viewport;
    try {
      await pdfPage.render({ canvasContext: context, viewport: renderViewport, intent: 'display' }).promise;
    } catch (error) {
      console.warn('[pdf-import-transaction] page preview failed; using placeholder', error);
      return makePagePlaceholder('', 0, rotation);
    }
    canvas.dataset.pageRotation = String(((Number(rotation || 0) % 360) + 360) % 360);
    return canvas;
  }

  function releaseStagedPages(pages) {
    for (const page of pages || []) {
      const canvas = page?.thumbCanvas;
      if (canvas) {
        canvas.width = 1;
        canvas.height = 1;
      }
      try { page?.pdfPage?.cleanup?.(); } catch (_) {}
    }
  }

  async function stagePdfFile(file, requestedMode) {
    const stagedPages = [];
    const shortName = shortFileName(file.name);
    let pdfDocument = null;
    let failedPage = 0;
    try {
      const buffer = await file.arrayBuffer();
      const likelyHeavyBySize = Number(file.size || 0) >= RENDER_HEAVY_BYTE_LIMIT;
      pdfDocument = await safePdfGetDocument(buffer, likelyHeavyBySize);
      const total = Number(pdfDocument.numPages || 0);
      if (!Number.isInteger(total) || total < 1) throw new Error('페이지가 없는 PDF입니다.');
      const plan = chooseImportPlan(total, Number(file.size || 0), requestedMode);
      let firstPage = null;
      let detected = null;

      if (requestedMode === 'new' && byId('autoDetectSize')?.checked) {
        failedPage = 1;
        firstPage = await pdfDocument.getPage(1);
        detected = detectFirstPageSettings(firstPage);
      }

      if (plan.extreme) {
        for (let pageNumber = 1; pageNumber <= total; pageNumber += 1) {
          failedPage = pageNumber;
          if (pageNumber === 1 && firstPage) {
            firstPage.getViewport({ scale: 1 });
            try { firstPage.cleanup?.(); } catch (_) {}
            firstPage = null;
          } else {
            const checkedPage = await pdfDocument.getPage(pageNumber);
            checkedPage.getViewport({ scale: 1 });
            try { checkedPage.cleanup?.(); } catch (_) {}
          }
          stagedPages.push({
            id: null,
            pdfPage: makeLightweightPdfPage(pageNumber, total),
            thumbCanvas: makePagePlaceholder(pageNumber, total, 0),
            excluded: false,
            nupOverride: null,
            nupDisabled: false,
            sourceFile: shortName,
            groupBreak: false,
            rotation: 0,
            pageType: 'pdf',
            file_index: null,
            page_index: pageNumber - 1,
            lightweight: true,
          });
          if (pageNumber % 50 === 0 || pageNumber === total) {
            setSafeStatus(`“${shortName}” 초대용량 페이지 검사 중 · ${pageNumber} / ${total}`);
            await new Promise((resolve) => setTimeout(resolve, 0));
          }
        }
        try { await pdfDocument.destroy?.(); } catch (_) {}
        pdfDocument = null;
      } else {
        for (let pageNumber = 1; pageNumber <= total; pageNumber += 1) {
          failedPage = pageNumber;
          setSafeStatus(`“${shortName}” 임시 검사 중 · ${pageNumber} / ${total}${plan.heavy ? ' · 최적화' : ''}`);
          const pdfPage = pageNumber === 1 && firstPage
            ? firstPage
            : await pdfDocument.getPage(pageNumber);
          firstPage = null;
          const thumbCanvas = await safeRenderPdfPage(pdfPage, plan.thumbScale, 0, plan.heavy);
          stagedPages.push({
            id: null,
            pdfPage,
            thumbCanvas,
            excluded: false,
            nupOverride: null,
            nupDisabled: false,
            sourceFile: shortName,
            groupBreak: false,
            rotation: 0,
            pageType: 'pdf',
            file_index: null,
            page_index: pageNumber - 1,
          });
          if (pageNumber % plan.batchYield === 0) {
            await new Promise((resolve) => setTimeout(resolve, plan.heavy ? 12 : 0));
          }
        }
      }

      return {
        file,
        shortName,
        total,
        pages: stagedPages,
        detected,
        requestedMode,
        pdfDocument,
        plan,
      };
    } catch (error) {
      releaseStagedPages(stagedPages);
      try { await pdfDocument?.destroy?.(); } catch (_) {}
      const wrapped = new Error(error?.message || 'PDF를 읽지 못했습니다.');
      wrapped.cause = error;
      wrapped.fileName = String(file?.name || 'PDF 파일');
      wrapped.pageNumber = failedPage;
      throw wrapped;
    }
  }

  function commitStagedFile(stage) {
    const before = captureEditorState();
    const isNew = stage.requestedMode === 'new';
    const isBreak = stage.requestedMode === 'break';
    try {
      const fileIndex = isNew ? 0 : uploadedFiles.length;
      const committedPages = stage.pages.map((page, index) => ({
        ...page,
        id: makeId(),
        file_index: fileIndex,
        groupBreak: !isNew && isBreak && index === 0,
      }));

      parsedPages = isNew ? committedPages : [...parsedPages, ...committedPages];
      uploadedFiles = isNew ? [stage.file] : [...uploadedFiles, stage.file];
      if (isNew) {
        clearNupSessionState();
        previewCanvases = [];
        fileNupMap = {};
        applyDetectedSettings(stage.detected);
      }

      renderThumbs();
      if (byId('previewBtn')) byId('previewBtn').disabled = false;
      if (byId('downloadBtn')) byId('downloadBtn').disabled = false;

      if (isNew) {
        document.querySelectorAll('.mode-btn').forEach((button) => button.classList.remove('active', 'break-active'));
        document.querySelector('.mode-btn[data-mode="cont"]')?.classList.add('active');
        _uploadMode = 'cont';
      }
      const aggregateMode = optimizationApi()?.syncAggregateMode?.() || null;
      return { fileIndex, committedPages, before, aggregateMode };
    } catch (error) {
      restoreEditorState(before);
      throw error;
    }
  }

  async function transactionalHandleFile(file, requestedMode = _uploadMode) {
    if (!isPdfFile(file)) {
      setSafeStatus('PDF 파일만 업로드할 수 있습니다.', 'error');
      return false;
    }

    setBusy(true);
    const hadExistingWork = parsedPages.length > 0 || uploadedFiles.length > 0;
    let stage = null;
    let committed = false;
    try {
      stage = await stagePdfFile(file, requestedMode);
      const result = commitStagedFile(stage);
      committed = true;
      const modeText = result.aggregateMode?.extreme
        ? ' · 초대용량 목록 모드'
        : result.aggregateMode?.optimized ? ' · 대용량 최적화' : '';
      setSafeStatus(`“${stage.shortName}” ${stage.total}페이지를 안전하게 추가했습니다${modeText}.`, 'success');
      setTimeout(() => { try { hideStatus(); } catch (_) {} }, result.aggregateMode?.extreme ? 5000 : 2500);
      try {
        await triggerPreview();
      } catch (previewError) {
        console.warn('PDF preview refresh failed after committed import', previewError);
        setSafeStatus('파일은 정상 추가됐지만 미리보기를 다시 만들어야 합니다.', 'error');
      }
      try {
        document.dispatchEvent(new CustomEvent('pdf-import-committed', {
          detail: {
            fileName: file.name,
            pageCount: stage.total,
            mode: requestedMode,
            optimized: Boolean(stage.plan?.heavy),
            extreme: Boolean(stage.plan?.extreme),
          },
        }));
      } catch (_) {}
      return true;
    } catch (error) {
      if (stage && !committed) {
        releaseStagedPages(stage.pages);
        try { await stage.pdfDocument?.destroy?.(); } catch (_) {}
      }
      console.error(error);
      const pageText = error.pageNumber ? ` · ${error.pageNumber}페이지에서 중단` : '';
      const retained = hadExistingWork ? ' · 기존 작업은 그대로 유지됩니다.' : '';
      setSafeStatus(
        `“${shortFileName(error.fileName || file.name)}” 불러오기 실패${pageText}${retained} ${error.message}`,
        'error',
        () => window.handleFile(file),
      );
      try {
        document.dispatchEvent(new CustomEvent('pdf-import-failed', {
          detail: { fileName: file.name, pageNumber: error.pageNumber || 0, retained: hadExistingWork },
        }));
      } catch (_) {}
      return false;
    } finally {
      setBusy(false);
    }
  }

  function install() {
    const current = window.handleFile;
    if (typeof current !== 'function') return false;
    if (current.__pdfImportTransactionSafetyV1) {
      installed = true;
      return true;
    }
    const wrapped = function transactionalImportQueue(file) {
      const requestedMode = _uploadMode;
      importQueue = importQueue
        .catch(() => false)
        .then(() => transactionalHandleFile(file, requestedMode));
      return importQueue;
    };
    wrapped.__pdfImportTransactionSafetyV1 = true;
    wrapped.__pdfImportTransactionSafetyDelegate = current;
    window.handleFile = wrapped;
    installed = true;
    return true;
  }

  window.PdfImportTransactionSafety = {
    isPdfFile,
    chooseImportPlan,
    safePdfGetDocument,
    safeRenderPdfPage,
    stagePdfFile,
    commitStagedFile,
    transactionalHandleFile,
    captureEditorState,
    restoreEditorState,
    install,
    get installed() { return installed; },
    stage: 'bounded-stage-atomic-commit-node-preserving-rollback',
  };

  for (const delay of INSTALL_DELAYS) setTimeout(install, delay);
})();
