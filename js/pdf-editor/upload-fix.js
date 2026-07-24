// PDF editor upload/render stability patch without eval or unbounded polling.
(function () {
  'use strict';
  if (window.__pdfEditorUploadFixV5) return;
  window.__pdfEditorUploadFixV5 = true;

  const LARGE_PAGE_LIMIT = 25;
  const HUGE_PAGE_LIMIT = 80;
  const EXTREME_PAGE_LIMIT = 300;
  const LARGE_BYTE_LIMIT = 30 * 1024 * 1024;
  const HUGE_BYTE_LIMIT = 80 * 1024 * 1024;
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
      return '초대용량 PDF라 실제 페이지 렌더링을 생략하고 번호 목록만 등록했습니다. 편집 정보와 최종 저장은 원본 PDF 기준으로 처리합니다.' + suffix;
    }
    return '대용량 PDF라 자동 미리보기를 줄였습니다. 페이지 편집과 최종 저장은 원본 품질로 처리됩니다.' + suffix;
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
      + (extreme ? '레이아웃 미리보기 또는 PDF 저장을 사용하세요.' : '필요할 때 미리보기 버튼으로 실제 내용을 확인하세요.')
      + '</span></p></div>';
    const info = document.getElementById('previewInfo');
    const pages = document.getElementById('previewPages');
    if (info) info.textContent = extreme
      ? '초대용량 목록 편집 · 저장은 원본 PDF 기준 처리'
      : '대용량 최적화 · 페이지 순서·숨김·회전 편집 가능';
    if (pages) pages.textContent = total ? `총 ${total}페이지` : '';
  }

  function makePagePlaceholder(pageNumber, total, rotation) {
    const canvas = document.createElement('canvas');
    canvas.width = 96;
    canvas.height = 136;
    const context = canvas.getContext('2d', { alpha: false });
    context.fillStyle = '#ffffff';
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.strokeStyle = '#cbd5e1';
    context.lineWidth = 2;
    context.strokeRect(2, 2, canvas.width - 4, canvas.height - 4);
    context.fillStyle = '#0f172a';
    context.font = 'bold 20px sans-serif';
    context.textAlign = 'center';
    context.fillText(String(pageNumber), canvas.width / 2, 58);
    context.fillStyle = '#64748b';
    context.font = '10px sans-serif';
    context.fillText('PDF page', canvas.width / 2, 78);
    if (total) context.fillText(`/ ${total}`, canvas.width / 2, 94);
    if (rotation) {
      context.fillStyle = '#b45309';
      context.font = 'bold 10px sans-serif';
      context.fillText(`${rotation}°`, canvas.width / 2, 112);
    }
    return canvas;
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
    return canvas;
  }

  function installFastPreviewGuard() {
    if (window.__pdfEditorFastPreviewGuardInstalledV5 || typeof triggerPreview !== 'function') return;
    window.__pdfEditorFastPreviewGuardInstalledV5 = true;
    const originalTriggerPreview = triggerPreview;
    const guarded = async function guardedTriggerPreview() {
      if (window.__pdfEditorFastMode && (window.__pdfEditorExtremeMode || !window.__pdfEditorManualPreviewRequest)) {
        showFastModePlaceholder(parsedPages.length, 0);
        document.getElementById('previewBtn').disabled = false;
        document.getElementById('downloadBtn').disabled = parsedPages.length === 0;
        window.__pdfEditorManualPreviewRequest = false;
        return;
      }
      try {
        return await originalTriggerPreview.apply(this, arguments);
      } finally {
        window.__pdfEditorManualPreviewRequest = false;
      }
    };
    triggerPreview = guarded;
    window.triggerPreview = guarded;
    document.addEventListener('click', (event) => {
      if (event.target && event.target.closest && event.target.closest('#previewBtn')) {
        window.__pdfEditorManualPreviewRequest = true;
      }
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
    uploadedFiles.push(file);
    const shortName = file.name.length > 28 ? `${file.name.slice(0, 26)}…` : file.name;
    showStatus(`"${file.name}" 로딩 중...`);

    try {
      const buffer = await file.arrayBuffer();
      const likelyHeavyBySize = file.size >= LARGE_BYTE_LIMIT;
      const pdfDocument = await safePdfGetDocument(buffer, likelyHeavyBySize);
      const total = pdfDocument.numPages || 0;
      if (!total) throw new Error('PDF 페이지를 찾을 수 없습니다.');

      const extremeMode = total >= EXTREME_PAGE_LIMIT;
      const heavyMode = total >= LARGE_PAGE_LIMIT || file.size >= LARGE_BYTE_LIMIT || window.__pdfEditorFastMode || extremeMode;
      const hugeMode = total >= HUGE_PAGE_LIMIT || file.size >= HUGE_BYTE_LIMIT;
      if (heavyMode) setFastMode(true, fastModeMessage(total, file.size, extremeMode), extremeMode);

      if (extremeMode) {
        showStatus(`"${shortName}" 초대용량 페이지 목록 등록 중... (0 / ${total})`);
        for (let pageNumber = 1; pageNumber <= total; pageNumber += 1) {
          const groupBreak = !isNew && isBreak && pageNumber === 1;
          parsedPages.push({
            id: makeId(),
            pdfPage: null,
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
      } else {
        const thumbScale = hugeMode ? 0.28 : (heavyMode ? 0.42 : 0.75);
        const batchYield = hugeMode ? 1 : (heavyMode ? 2 : 6);
        for (let pageNumber = 1; pageNumber <= total; pageNumber += 1) {
          showStatus(`"${shortName}" 렌더링 중... (${pageNumber} / ${total})${heavyMode ? ' · 최적화' : ''}`);
          const pdfPage = await pdfDocument.getPage(pageNumber);
          const thumbCanvas = await safeRenderPdfPage(pdfPage, thumbScale, 0, heavyMode);
          const groupBreak = !isNew && isBreak && pageNumber === 1;
          parsedPages.push({
            id: makeId(),
            pdfPage,
            thumbCanvas,
            excluded: false,
            nupOverride: null,
            nupDisabled: false,
            sourceFile: shortName,
            groupBreak,
            rotation: 0,
            pageType: 'pdf',
            file_index: fileIndex,
            page_index: pageNumber - 1,
          });
          if (pageNumber % batchYield === 0) {
            await new Promise((resolve) => setTimeout(resolve, heavyMode ? 12 : 0));
          }
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

      if (heavyMode) {
        showFastModePlaceholder(total, file.size);
        showStatus(`"${shortName}" ${total}페이지 로드 완료 · ${extremeMode ? '초대용량 목록 모드' : '대용량 최적화'}`, 'success');
        setTimeout(hideStatus, extremeMode ? 5000 : 3500);
        return;
      }

      showStatus(`"${shortName}" ${total}페이지 로드 완료`, 'success');
      setTimeout(() => {
        try {
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
      uploadedFiles.splice(fileIndex, 1);
      document.getElementById('previewBtn').disabled = parsedPages.length === 0;
      document.getElementById('downloadBtn').disabled = parsedPages.length === 0;
      document.getElementById('previewScroll').innerHTML = '<div class="empty-state"><div class="icon">❌</div><p>PDF 로딩 실패<br><span style="font-size:11px;color:#991b1b;"></span></p></div>';
      const detail = document.querySelector('#previewScroll .empty-state span');
      if (detail) detail.textContent = error.message || String(error);
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

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => boot(0), { once: true });
  else boot(0);
})();
