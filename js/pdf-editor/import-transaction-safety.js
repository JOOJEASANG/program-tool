// Transactional PDF import: stage every page first, then commit once.
(function () {
  'use strict';
  if (window.__pdfImportTransactionSafetyV1) return;
  window.__pdfImportTransactionSafetyV1 = true;
  if (!location.pathname.includes('pdf-editor')) return;

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
    const modeButtons = [...document.querySelectorAll('.mode-btn')].map((button) => ({
      button,
      className: button.className,
    }));
    return {
      previewDisabled: byId('previewBtn')?.disabled,
      downloadDisabled: byId('downloadBtn')?.disabled,
      previewHtml: byId('previewScroll')?.innerHTML || '',
      paperSize: byId('paperSize')?.value,
      customSizeDisplay: byId('customSizeRow')?.style.display,
      customW: byId('customW')?.value,
      customH: byId('customH')?.value,
      orientLandClass: byId('orientLand')?.className,
      orientPortClass: byId('orientPort')?.className,
      modeButtons,
    };
  }

  function restoreUiState(snapshot) {
    if (!snapshot) return;
    if (byId('previewBtn')) byId('previewBtn').disabled = Boolean(snapshot.previewDisabled);
    if (byId('downloadBtn')) byId('downloadBtn').disabled = Boolean(snapshot.downloadDisabled);
    if (byId('previewScroll')) byId('previewScroll').innerHTML = snapshot.previewHtml;
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
    restoreUiState(snapshot.ui);
    try { renderThumbs(); } catch (_) {}
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
  }

  function releaseStagedPages(pages) {
    for (const page of pages || []) {
      const canvas = page?.thumbCanvas;
      if (canvas) {
        canvas.width = 1;
        canvas.height = 1;
      }
    }
  }

  async function stagePdfFile(file, requestedMode) {
    const stagedPages = [];
    const shortName = shortFileName(file.name);
    let pdfDocument = null;
    let failedPage = 0;
    const startId = _nextId;
    try {
      const buffer = await file.arrayBuffer();
      pdfDocument = await pdfjsLib.getDocument({ data: buffer }).promise;
      const total = Number(pdfDocument.numPages || 0);
      if (!Number.isInteger(total) || total < 1) throw new Error('페이지가 없는 PDF입니다.');
      let detected = null;
      for (let pageNumber = 1; pageNumber <= total; pageNumber += 1) {
        failedPage = pageNumber;
        setSafeStatus(`“${shortName}” 임시 검사 중 · ${pageNumber} / ${total}`);
        const pdfPage = await pdfDocument.getPage(pageNumber);
        const thumbCanvas = await renderPdfPage(pdfPage, 0.9, 0);
        if (pageNumber === 1 && requestedMode === 'new') detected = detectFirstPageSettings(pdfPage);
        stagedPages.push({
          id: makeId(),
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
        await new Promise((resolve) => setTimeout(resolve, 0));
      }
      return { file, shortName, total, pages: stagedPages, detected, requestedMode, startId, pdfDocument };
    } catch (error) {
      _nextId = startId;
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
        file_index: fileIndex,
        groupBreak: !isNew && isBreak && index === 0,
      }));

      parsedPages = isNew ? committedPages : [...parsedPages, ...committedPages];
      uploadedFiles = isNew ? [stage.file] : [...uploadedFiles, stage.file];
      if (isNew) {
        previewCanvases = [];
        fileNupMap = {};
        applyDetectedSettings(stage.detected);
      }

      renderThumbs();
      if (byId('previewBtn')) byId('previewBtn').disabled = false;
      if (byId('downloadBtn')) byId('downloadBtn').disabled = true;

      if (isNew) {
        document.querySelectorAll('.mode-btn').forEach((button) => button.classList.remove('active', 'break-active'));
        document.querySelector('.mode-btn[data-mode="cont"]')?.classList.add('active');
        _uploadMode = 'cont';
      }
      return { fileIndex, committedPages, before };
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
    try {
      const stage = await stagePdfFile(file, requestedMode);
      commitStagedFile(stage);
      setSafeStatus(`“${stage.shortName}” ${stage.total}페이지를 안전하게 추가했습니다.`, 'success');
      setTimeout(() => { try { hideStatus(); } catch (_) {} }, 2500);
      try {
        await triggerPreview();
      } catch (previewError) {
        console.warn('PDF preview refresh failed after committed import', previewError);
        setSafeStatus('파일은 정상 추가됐지만 미리보기를 다시 만들어야 합니다.', 'error');
      }
      try {
        document.dispatchEvent(new CustomEvent('pdf-import-committed', {
          detail: { fileName: file.name, pageCount: stage.total, mode: requestedMode },
        }));
      } catch (_) {}
      return true;
    } catch (error) {
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
    stagePdfFile,
    commitStagedFile,
    transactionalHandleFile,
    captureEditorState,
    restoreEditorState,
    install,
    get installed() { return installed; },
    stage: 'stage-all-pages-atomic-commit-rollback',
  };

  for (const delay of INSTALL_DELAYS) setTimeout(install, delay);
})();
