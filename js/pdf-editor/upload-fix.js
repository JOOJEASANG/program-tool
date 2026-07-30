// PDF editor upload/render stability patch without eval or unbounded polling.
(function () {
  'use strict';
  if (window.__pdfEditorUploadFixV6) return;
  window.__pdfEditorUploadFixV6 = true;

  const RENDER_HEAVY_PAGE_LIMIT = 25;
  const RENDER_HUGE_PAGE_LIMIT = 80;
  const EXTREME_PAGE_LIMIT = 300;
  const RENDER_HEAVY_BYTE_LIMIT = 30 * 1024 * 1024;
  const RENDER_HUGE_BYTE_LIMIT = 80 * 1024 * 1024;
  const OPTIMIZED_PAGE_LIMIT = 120;
  const OPTIMIZED_BYTE_LIMIT = 160 * 1024 * 1024;
  const EXTREME_PREVIEW_OUTPUT_LIMIT = 24;
  let installed = false;

  function editorReady() {
    try {
      return (
        typeof handleFile === 'function' &&
        typeof triggerPreview === 'function' &&
        typeof renderThumbs === 'function' &&
        typeof makeId === 'function' &&
        Array.isArray(parsedPages) &&
        Array.isArray(uploadedFiles)
      );
    } catch (_) {
      return false;
    }
  }

  function clearNupSessionState() {
    try {
      localStorage.removeItem('programToolPdfFileNupOverridesV1');
      localStorage.removeItem('programToolPdfPageNupOverridesV1');
      localStorage.removeItem('programToolPdfSelectedPageOrdinalV1');
    } catch (_) {}
  }

  function aggregateStats(extraPages = 0, extraBytes = 0) {
    let pages = Number(extraPages || 0);
    let bytes = Number(extraBytes || 0);
    try { pages += parsedPages.length; } catch (_) {}
    try { bytes += uploadedFiles.reduce((sum, file) => sum + Number(file?.size || 0), 0); } catch (_) {}
    return { pages, bytes };
  }

  function setFastMode(enabled, reason, extreme) {
    window.__pdfEditorFastMode = !!enabled;
    window.__pdfEditorExtremeMode = !!extreme;
    window.__pdfEditorFastModeReason = reason || '';
    const hint = document.getElementById('livePreviewHint');
    if (hint) {
      hint.textContent = extreme ? '초대용량 목록 모드' : (enabled ? '대용량 문서 · 수동 미리보기' : '실시간 미리보기 ON');
      hint.style.color = enabled ? '#b45309' : '#64748b';
    }
  }

  function fastModeMessage(total, fileSize, extreme) {
    const mb = fileSize ? Math.round(fileSize / 1024 / 1024) : 0;
    const suffix = (total || mb)
      ? ` (${total ? `${total}페이지` : ''}${total && mb ? ', ' : ''}${mb ? `${mb}MB` : ''})`
      : '';
    if (extreme) {
      return '초대용량 PDF라 실제 페이지 렌더링을 줄이고 번호 목록을 사용합니다. 편집 정보와 최종 저장은 원본 PDF 기준으로 처리합니다.' + suffix;
    }
    return '대용량 PDF라 자동 미리보기를 줄였습니다. 페이지 편집과 최종 저장은 원본 품질로 처리됩니다.' + suffix;
  }

  function syncAggregateMode() {
    const { pages, bytes } = aggregateStats();
    const extreme = pages >= EXTREME_PAGE_LIMIT;
    const optimized = extreme || pages > OPTIMIZED_PAGE_LIMIT || bytes > OPTIMIZED_BYTE_LIMIT;
    setFastMode(optimized, optimized ? fastModeMessage(pages, bytes, extreme) : '', extreme);
    return { pages, bytes, extreme, optimized };
  }

  function showFastModePlaceholder(total, fileSize) {
    const scroll = document.getElementById('previewScroll');
    if (!scroll) return;
    const extreme = !!window.__pdfEditorExtremeMode;
    const msg = fastModeMessage(total || parsedPages.length, fileSize || 0, extreme);
    scroll.innerHTML = '<div class="empty-state"><div class="icon">' + (extreme ? '🧊' : '⚡') + '</div><p><b>'
      + (extreme ? '초대용량 목록 모드' : '대용량 최적화 모드')
      + '</b><br><span style="font-size:12px;color:#92400e;line-height:1.6;display:inline-block;margin-top:6px;max-width:460px;">'
      + msg + '<br>'
      + (extreme ? `레이아웃 미리보기는 앞 ${EXTREME_PREVIEW_OUTPUT_LIMIT}개 출력면까지 표시합니다.` : '필요할 때 미리보기 버튼으로 실제 내용을 확인하세요.')
      + '</span></p></div>';
    const info = document.getElementById('previewInfo');
    const pagesElement = document.getElementById('previewPages');
    if (info) info.textContent = extreme
      ? '초대용량 목록 편집 · 저장은 원본 PDF 기준 처리'
      : '대용량 최적화 · 페이지 순서·숨김·회전 편집 가능';
    if (pagesElement) pagesElement.textContent = total ? `총 ${total}페이지` : '';
  }

  function drawPlaceholder(context, width, height, pageNumber, total, rotation) {
    context.fillStyle = '#ffffff';
    context.fillRect(0, 0, width, height);
    context.strokeStyle = '#cbd5e1';
    context.lineWidth = Math.max(1, Math.min(width, height) * 0.02);
    context.strokeRect(2, 2, Math.max(1, width - 4), Math.max(1, height - 4));
    context.fillStyle = '#0f172a';
    context.font = `bold ${Math.max(12, Math.round(Math.min(width, height) * 0.2))}px sans-serif`;
    context.textAlign = 'center';
    context.textBaseline = 'middle';
    context.fillText(String(pageNumber || ''), width / 2, height * 0.43);
    context.fillStyle = '#64748b';
    context.font = `${Math.max(8, Math.round(Math.min(width, height) * 0.075))}px sans-serif`;
    context.fillText('PDF page', width / 2, height * 0.58);
    if (total) context.fillText(`/ ${total}`, width / 2, height * 0.69);
    if (rotation) {
      context.fillStyle = '#b45309';
      context.font = `bold ${Math.max(8, Math.round(Math.min(width, height) * 0.075))}px sans-serif`;
      context.fillText(`${rotation}°`, width / 2, height * 0.82);
    }
  }

  function makePagePlaceholder(pageNumber, total, rotation) {
    const normalized = ((Number(rotation || 0) % 360) + 360) % 360;
    const sideways = normalized === 90 || normalized === 270;
    const canvas = document.createElement('canvas');
    canvas.width = sideways ? 136 : 96;
    canvas.height = sideways ? 96 : 136;
    drawPlaceholder(canvas.getContext('2d', { alpha: false }), canvas.width, canvas.height, pageNumber, total, normalized);
    canvas.dataset.pageRotation = String(normalized);
    canvas.dataset.lightweightPage = '1';
    return canvas;
  }

  function makeLightweightPdfPage(pageNumber, total) {
    return {
      __lightweightPdfPage: true,
      getViewport({ scale = 1, rotation = 0 } = {}) {
        const normalized = ((Number(rotation || 0) % 360) + 360) % 360;
        const sideways = normalized === 90 || normalized === 270;
        return {
          width: (sideways ? 136 : 96) * scale,
          height: (sideways ? 96 : 136) * scale,
          rotation: normalized,
        };
      },
      render({ canvasContext, viewport }) {
        drawPlaceholder(
          canvasContext,
          canvasContext.canvas.width,
          canvasContext.canvas.height,
          pageNumber,
          total,
          viewport?.rotation || 0,
        );
        return { promise: Promise.resolve() };
      },
    };
  }

  async function safePdfGetDocument(buffer, heavyMode) {
    const options = {
      data: buffer,
      disableAutoFetch: !!heavyMode,
      disableStream: false,
      disableFontFace: !!heavyMode,
    };
    try {
      return await pdfjsLib.getDocument({ ...options, disableWorker: true }).promise;
    } catch (firstError) {
      console.warn('[pdf-upload] workerless load failed; retrying with worker', firstError);
      return pdfjsLib.getDocument(options).promise;
    }
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
      console.warn('[pdf-upload] page render failed; using placeholder', error);
      return makePagePlaceholder('', 0, rotation);
    }
    canvas.dataset.pageRotation = String(((Number(rotation || 0) % 360) + 360) % 360);
    return canvas;
  }

  function capturePaperState() {
    const value = (id) => document.getElementById(id)?.value;
    let currentLandscape = false;
    try { currentLandscape = !!landscape; } catch (_) {}
    return {
      paperSize: value('paperSize'), customW: value('customW'), customH: value('customH'),
      customDisplay: document.getElementById('customSizeRow')?.style.display || '',
      landscape: currentLandscape,
    };
  }

  function restorePaperState(state) {
    if (!state) return;
    ['paperSize', 'customW', 'customH'].forEach((id) => {
      const element = document.getElementById(id);
      if (element && state[id] != null) element.value = state[id];
    });
    const row = document.getElementById('customSizeRow');
    if (row) row.style.display = state.customDisplay;
    try { landscape = !!state.landscape; } catch (_) {}
    document.getElementById('orientLand')?.classList.toggle('active', !!state.landscape);
    document.getElementById('orientPort')?.classList.toggle('active', !state.landscape);
    try { if (typeof updateNupBadges === 'function') updateNupBadges(); } catch (_) {}
  }

  function applyDetectedPaperSize(pdfPage) {
    if (!pdfPage || !document.getElementById('autoDetectSize')?.checked) return;
    try {
      const viewport = pdfPage.getViewport({ scale: 1 });
      const widthMm = Math.round(viewport.width * 25.4 / 72);
      const heightMm = Math.round(viewport.height * 25.4 / 72);
      const detected = typeof detectPaperSizeMm === 'function'
        ? detectPaperSizeMm(widthMm, heightMm)
        : { name: 'custom' };
      const paper = document.getElementById('paperSize');
      const customRow = document.getElementById('customSizeRow');
      if (paper) paper.value = detected.name;
      if (customRow) customRow.style.display = detected.name === 'custom' ? 'grid' : 'none';
      if (detected.name === 'custom') {
        if (document.getElementById('customW')) document.getElementById('customW').value = String(Math.min(widthMm, heightMm));
        if (document.getElementById('customH')) document.getElementById('customH').value = String(Math.max(widthMm, heightMm));
      }
      const isLandscape = viewport.width > viewport.height;
      try { landscape = isLandscape; } catch (_) {}
      document.getElementById('orientLand')?.classList.toggle('active', isLandscape);
      document.getElementById('orientPort')?.classList.toggle('active', !isLandscape);
      try { if (typeof updateNupBadges === 'function') updateNupBadges(); } catch (_) {}
    } catch (error) {
      console.warn('[pdf-upload] paper auto-detection failed', error);
    }
  }

  async function buildExtremeLayoutPreview() {
    const active = parsedPages.filter((page) => !page.excluded);
    if (!active.length) return;
    let arranged = active;
    try {
      if (document.getElementById('bookletCheck')?.checked && typeof bookletReorderPreview === 'function') arranged = bookletReorderPreview(active, nup);
    } catch (_) {}
    const output = [];
    const groups = groupByNup(arranged);
    for (const group of groups) {
      const { cols, rows } = getLayout(group.n);
      const perPage = Math.max(1, cols * rows);
      for (let pageIndex = 0; pageIndex < Math.ceil(group.pages.length / perPage); pageIndex += 1) {
        if (output.length >= EXTREME_PREVIEW_OUTPUT_LIMIT) break;
        const canvas = buildOutputPage(group.pages, pageIndex, cols, rows, 96 / 25.4, false, output.length);
        try { applyDocEdits(canvas, output.length, Math.min(EXTREME_PREVIEW_OUTPUT_LIMIT, Math.ceil(arranged.length / perPage)), 96 / 25.4); } catch (_) {}
        output.push(canvas);
        await new Promise((resolve) => setTimeout(resolve, 0));
      }
      if (output.length >= EXTREME_PREVIEW_OUTPUT_LIMIT) break;
    }
    let shown = output;
    if (window.PdfPrintMarks?.enabled?.()) shown = output.map((canvas) => window.PdfPrintMarks.addMarksToCanvas(canvas, 96 / 25.4));
    previewCanvases = shown;
    displayPreview(shown, true);
    document.getElementById('previewPages').textContent = `앞 ${shown.length}개 출력면`;
    document.getElementById('previewInfo').textContent = `초대용량 레이아웃 미리보기 · 전체 저장은 원본 ${active.length}페이지 기준`;
    showStatus(`레이아웃 미리보기 완료 (앞 ${shown.length}개 출력면)`, 'success');
    setTimeout(hideStatus, 2200);
  }

  function installFastPreviewGuard() {
    if (window.__pdfEditorFastPreviewGuardInstalledV7 || typeof triggerPreview !== 'function') return;
    window.__pdfEditorFastPreviewGuardInstalledV7 = true;
    const originalTriggerPreview = triggerPreview;
    let previewInFlight = null;
    let rerenderQueued = false;
    let queuedManual = false;
    let queuedContext = null;
    let queuedArgs = [];

    async function runPreviewOnce(context, args, manual) {
      if (window.__pdfEditorFastMode && !manual) {
        const stats = aggregateStats();
        showFastModePlaceholder(stats.pages, stats.bytes);
        document.getElementById('previewBtn').disabled = false;
        document.getElementById('downloadBtn').disabled = parsedPages.length === 0;
        return;
      }
      if (window.__pdfEditorExtremeMode && manual) {
        return buildExtremeLayoutPreview();
      }
      return originalTriggerPreview.apply(context, args);
    }

    const guarded = function guardedTriggerPreview(...args) {
      const manual = !!window.__pdfEditorManualPreviewRequest;
      window.__pdfEditorManualPreviewRequest = false;

      if (previewInFlight) {
        rerenderQueued = true;
        queuedManual = queuedManual || manual;
        queuedContext = this;
        queuedArgs = args;
        return previewInFlight;
      }

      const initialContext = this;
      const initialArgs = args;
      previewInFlight = (async () => {
        let nextManual = manual;
        let nextContext = initialContext;
        let nextArgs = initialArgs;
        let result;
        do {
          rerenderQueued = false;
          result = await runPreviewOnce(nextContext, nextArgs, nextManual);
          if (rerenderQueued) {
            nextManual = queuedManual;
            nextContext = queuedContext;
            nextArgs = queuedArgs;
            queuedManual = false;
            queuedContext = null;
            queuedArgs = [];
          }
        } while (rerenderQueued);
        return result;
      })().finally(() => {
        previewInFlight = null;
        window.__pdfEditorManualPreviewRequest = false;
      });
      return previewInFlight;
    };

    window.__pdfEditorPreviewQueueV7 = {
      getInFlight: () => previewInFlight,
      hasQueuedRerender: () => rerenderQueued,
    };
    triggerPreview = guarded;
    window.triggerPreview = guarded;
    document.addEventListener('click', (event) => {
      if (event.target?.closest('#previewBtn')) window.__pdfEditorManualPreviewRequest = true;
    }, true);
  }

  async function patchedHandleFile(file) {
    const isPdf = !!file && ((file.type || '').includes('pdf') || /\.pdf$/i.test(file.name || ''));
    if (!isPdf) {
      showStatus('PDF 파일만 업로드할 수 있습니다.', 'error');
      return;
    }

    const isNew = _uploadMode === 'new';
    const isBreak = _uploadMode === 'break';
    const previous = {
      parsedPages: [...parsedPages],
      uploadedFiles: [...uploadedFiles],
      previewCanvases: [...previewCanvases],
      fileNupMap: { ...fileNupMap },
      uploadMode: _uploadMode,
      paper: capturePaperState(),
      fast: !!window.__pdfEditorFastMode,
      extreme: !!window.__pdfEditorExtremeMode,
      reason: window.__pdfEditorFastModeReason || '',
    };

    if (isNew) {
      clearNupSessionState();
      setFastMode(false, '', false);
      parsedPages = [];
      uploadedFiles = [];
      previewCanvases = [];
      fileNupMap = {};
      document.getElementById('previewBtn').disabled = true;
      document.getElementById('downloadBtn').disabled = true;
      document.getElementById('previewScroll').innerHTML = '<div class="empty-state"><div class="icon">⏳</div><p>페이지 정보 분석 중...</p></div>';
    }

    const fileIndex = uploadedFiles.length;
    const pageStartIndex = parsedPages.length;
    uploadedFiles.push(file);
    const shortName = file.name.length > 28 ? `${file.name.slice(0, 26)}…` : file.name;
    showStatus(`"${file.name}" 로딩 중...`);
    let pdfDocument = null;

    try {
      const buffer = await file.arrayBuffer();
      const likelyHeavyBySize = file.size >= RENDER_HEAVY_BYTE_LIMIT;
      pdfDocument = await safePdfGetDocument(buffer, likelyHeavyBySize);
      const total = pdfDocument.numPages || 0;
      if (!total) throw new Error('PDF 페이지를 찾을 수 없습니다.');

      let firstPage = null;
      if (isNew && document.getElementById('autoDetectSize')?.checked) {
        firstPage = await pdfDocument.getPage(1);
        applyDetectedPaperSize(firstPage);
      }

      const projectedPages = pageStartIndex + total;
      const extremeMode = total >= EXTREME_PAGE_LIMIT || projectedPages >= EXTREME_PAGE_LIMIT;
      const heavyMode = total >= RENDER_HEAVY_PAGE_LIMIT || file.size >= RENDER_HEAVY_BYTE_LIMIT || projectedPages > OPTIMIZED_PAGE_LIMIT;
      const hugeMode = total >= RENDER_HUGE_PAGE_LIMIT || file.size >= RENDER_HUGE_BYTE_LIMIT || projectedPages > OPTIMIZED_PAGE_LIMIT;

      if (extremeMode) {
        showStatus(`"${shortName}" 초대용량 페이지 목록 등록 중... (0 / ${total})`);
        for (let pageNumber = 1; pageNumber <= total; pageNumber += 1) {
          const groupBreak = !isNew && isBreak && pageNumber === 1;
          const lightweightPage = makeLightweightPdfPage(pageNumber, total);
          parsedPages.push({
            id: makeId(),
            pdfPage: lightweightPage,
            thumbCanvas: makePagePlaceholder(pageNumber, total, 0),
            excluded: false,
            nupOverride: null,
            nupDisabled: false,
            sourceFile: shortName,
            groupBreak,
            rotation: 0,
            pageType: 'pdf',
            file_index: fileIndex,
            page_index: pageNumber - 1,
            lightweight: true,
          });
          if (pageNumber % 50 === 0) {
            showStatus(`"${shortName}" 초대용량 페이지 목록 등록 중... (${pageNumber} / ${total})`);
            await new Promise((resolve) => setTimeout(resolve, 0));
          }
        }
        try { await pdfDocument.destroy?.(); } catch (_) {}
        pdfDocument = null;
      } else {
        const thumbScale = hugeMode ? 0.28 : (heavyMode ? 0.42 : 0.75);
        const batchYield = hugeMode ? 1 : (heavyMode ? 2 : 6);
        for (let pageNumber = 1; pageNumber <= total; pageNumber += 1) {
          showStatus(`"${shortName}" 렌더링 중... (${pageNumber} / ${total})${heavyMode ? ' · 최적화' : ''}`);
          const pdfPage = pageNumber === 1 && firstPage ? firstPage : await pdfDocument.getPage(pageNumber);
          const thumbCanvas = await safeRenderPdfPage(pdfPage, thumbScale, 0, heavyMode);
          const groupBreak = !isNew && isBreak && pageNumber === 1;
          parsedPages.push({
            id: makeId(), pdfPage, thumbCanvas,
            excluded: false, nupOverride: null, nupDisabled: false,
            sourceFile: shortName, groupBreak, rotation: 0, pageType: 'pdf',
            file_index: fileIndex, page_index: pageNumber - 1,
          });
          if (pageNumber % batchYield === 0) await new Promise((resolve) => setTimeout(resolve, heavyMode ? 12 : 0));
        }
      }

      renderThumbs();
      document.getElementById('previewBtn').disabled = false;
      document.getElementById('downloadBtn').disabled = false;

      if (isNew) {
        document.querySelectorAll('.mode-btn').forEach((button) => button.classList.remove('active', 'break-active'));
        document.querySelector('.mode-btn[data-mode="cont"]')?.classList.add('active');
        _uploadMode = 'cont';
      }

      const mode = syncAggregateMode();
      if (mode.optimized) {
        showFastModePlaceholder(mode.pages, mode.bytes);
        showStatus(`"${shortName}" ${total}페이지 로드 완료 · ${mode.extreme ? '초대용량 목록 모드' : '대용량 최적화'}`, 'success');
        setTimeout(hideStatus, mode.extreme ? 5000 : 3500);
        return;
      }

      showStatus(`"${shortName}" ${total}페이지 로드 완료`, 'success');
      setTimeout(() => {
        try {
          window.PdfPreviewController?.invalidate?.();
          window.__pdfEditorManualPreviewRequest = true;
          if (window.PdfPreviewController) window.PdfPreviewController.request(0, true);
          else triggerPreview();
        } catch (previewError) {
          console.warn('[pdf-upload] preview after upload failed', previewError);
        } finally {
          hideStatus();
        }
      }, 250);
    } catch (error) {
      console.error(error);
      try { await pdfDocument?.destroy?.(); } catch (_) {}
      parsedPages = previous.parsedPages;
      uploadedFiles = previous.uploadedFiles;
      previewCanvases = previous.previewCanvases;
      fileNupMap = previous.fileNupMap;
      _uploadMode = previous.uploadMode;
      restorePaperState(previous.paper);
      setFastMode(previous.fast, previous.reason, previous.extreme);
      if (parsedPages.length) {
        renderThumbs();
        if (previewCanvases.length && typeof displayPreview === 'function') displayPreview(previewCanvases, false);
      } else {
        document.getElementById('previewScroll').innerHTML = '<div class="empty-state"><div class="icon">❌</div><p>PDF 로딩 실패<br><span style="font-size:11px;color:#991b1b;"></span></p></div>';
        const detail = document.querySelector('#previewScroll .empty-state span');
        if (detail) detail.textContent = error.message || String(error);
      }
      document.getElementById('previewBtn').disabled = parsedPages.length === 0;
      document.getElementById('downloadBtn').disabled = parsedPages.length === 0;
      showStatus(`파일 로딩 실패: ${error.message || error}`, 'error');
    }
  }

  function install() {
    if (installed) return true;
    if (!editorReady()) return false;
    installFastPreviewGuard();
    handleFile = patchedHandleFile;
    window.handleFile = patchedHandleFile;
    installed = true;
    return true;
  }

  function boot(attempt) {
    if (!install() && attempt < 12) setTimeout(() => boot(attempt + 1), 150 + attempt * 60);
  }

  window.PdfUploadOptimization = {
    makePagePlaceholder,
    makeLightweightPdfPage,
    aggregateStats,
    syncAggregateMode,
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => boot(0), { once: true });
  else boot(0);
})();