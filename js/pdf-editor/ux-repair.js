// Repair PDF editor sidebar controls, live preview recovery, and floating output dock.
(function () {
  'use strict';
  if (window.__pdfEditorUxRepairV1) return;
  window.__pdfEditorUxRepairV1 = true;

  const MODERATE_PAGE_LIMIT = 120;
  const MODERATE_BYTE_LIMIT = 160 * 1024 * 1024;
  const byId = (id) => document.getElementById(id);
  let previewTimer = null;
  let previewRunning = false;
  let lastPreviewSignature = '';
  let retryCount = 0;

  function editorReady() {
    try {
      return Array.isArray(parsedPages) && Array.isArray(uploadedFiles);
    } catch (_) {
      return false;
    }
  }

  function totalSourceBytes() {
    if (!editorReady()) return 0;
    return uploadedFiles.reduce((sum, file) => sum + Number(file && file.size || 0), 0);
  }

  function activePageCount() {
    if (!editorReady()) return 0;
    return parsedPages.filter((page) => page && !page.excluded).length;
  }

  function shouldKeepOptimizedMode() {
    if (!window.__pdfEditorFastMode) return false;
    if (window.__pdfEditorExtremeMode) return true;
    return parsedPages.length > MODERATE_PAGE_LIMIT || totalSourceBytes() > MODERATE_BYTE_LIMIT;
  }

  function normalizeModerateDocumentMode() {
    if (!editorReady() || !window.__pdfEditorFastMode || shouldKeepOptimizedMode()) return false;
    window.__pdfEditorFastMode = false;
    window.__pdfEditorFastModeReason = '';
    return true;
  }

  function replaceModeTerms(root) {
    if (!root) return;
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    let node;
    while ((node = walker.nextNode())) {
      const value = node.nodeValue || '';
      const next = value
        .replaceAll('빠른 편집 모드', '대용량 최적화 모드')
        .replaceAll('빠른모드', '최적화 모드');
      if (next !== value) node.nodeValue = next;
    }
  }

  function updateModeUi() {
    const optimized = !!window.__pdfEditorFastMode;
    const extreme = !!window.__pdfEditorExtremeMode;
    const hint = byId('livePreviewHint');
    if (hint) {
      if (extreme) {
        hint.textContent = '초대용량 목록 모드';
        hint.style.color = '#b45309';
        hint.title = '페이지가 매우 많은 PDF는 브라우저 멈춤을 막기 위해 페이지 목록만 먼저 표시합니다.';
      } else if (optimized) {
        hint.textContent = '대용량 최적화 · 미리보기 수동';
        hint.style.color = '#b45309';
        hint.title = '페이지 수나 파일 크기가 매우 클 때 자동 미리보기를 줄여 브라우저 멈춤을 방지합니다. 미리보기 새로고침 버튼으로 확인할 수 있습니다.';
      } else {
        hint.textContent = '실시간 미리보기 ON';
        hint.style.color = '#64748b';
        hint.title = '업로드와 주요 편집 설정 변경 후 미리보기가 자동 갱신됩니다.';
      }
    }
    [byId('statusBar'), byId('previewInfo'), byId('previewScroll')].forEach(replaceModeTerms);
  }

  function cleanupLegacyFileRows() {
    document.querySelectorAll('.file-nup-row-v5,#fileNupOverridePanel').forEach((element) => element.remove());
  }

  function installStyles() {
    if (byId('pdfEditorUxRepairStyles')) return;
    const style = document.createElement('style');
    style.id = 'pdfEditorUxRepairStyles';
    style.textContent = `
      .file-nup-row-v5,#fileNupOverridePanel{display:none!important}
      aside{padding-bottom:230px!important}
      .pdf-output-dock.pdf-output-floating{
        position:fixed!important;left:12px!important;bottom:12px!important;width:336px!important;
        z-index:490!important;padding:10px 12px 12px!important;border:1px solid rgba(148,163,184,.38)!important;
        border-radius:16px!important;background:rgba(255,255,255,.96)!important;
        box-shadow:0 18px 48px rgba(15,23,42,.22)!important;
        backdrop-filter:blur(16px)!important;-webkit-backdrop-filter:blur(16px)!important;
        overflow:hidden!important;
      }
      .pdf-output-dock.pdf-output-floating:before{
        content:"";position:absolute;left:0;right:0;top:0;height:3px;
        background:linear-gradient(90deg,#12396d,#2563eb,#1d9bb2);
      }
      .pdf-output-dock.pdf-output-floating .sec-head{padding:4px 1px 8px!important;pointer-events:none!important}
      .pdf-output-dock.pdf-output-floating .sec-title{font-size:11px!important;color:#0f172a!important;letter-spacing:.02em!important}
      .pdf-dock-state{margin-left:auto;font-size:9px;font-weight:900;color:#2563eb;background:#eff6ff;border:1px solid #bfdbfe;border-radius:999px;padding:3px 7px}
      .pdf-output-dock.pdf-output-floating .sec-body{display:grid!important;grid-template-columns:1fr 1fr;gap:8px!important;padding:0!important}
      .pdf-output-dock.pdf-output-floating .sec-body>div[style*="height"]{display:none!important}
      .pdf-output-dock.pdf-output-floating .btn{min-height:40px!important;border-radius:10px!important;padding:9px 10px!important;font-size:12px!important;box-shadow:none!important}
      .pdf-output-dock.pdf-output-floating #resetBtn{grid-column:1/-1!important;min-height:34px!important;background:#f8fafc!important;color:#64748b!important;border:1px solid #e2e8f0!important}
      @media(max-width:900px){
        aside{padding-bottom:230px!important}
        .pdf-output-dock.pdf-output-floating{left:10px!important;right:10px!important;bottom:10px!important;width:auto!important;border-right:1px solid rgba(148,163,184,.38)!important}
      }
    `;
    document.head.appendChild(style);
  }

  function installFloatingDock() {
    const previewButton = byId('previewBtn');
    const section = previewButton && previewButton.closest('.sec');
    if (!section) return;
    section.classList.add('pdf-output-dock', 'pdf-output-floating');
    const title = section.querySelector('.sec-title');
    if (title) title.textContent = '작업 메뉴';
    const head = section.querySelector('.sec-head');
    if (head && !head.querySelector('.pdf-dock-state')) {
      const state = document.createElement('span');
      state.className = 'pdf-dock-state';
      state.textContent = '화면 고정';
      head.appendChild(state);
    }
  }

  function previewSignature() {
    if (!editorReady()) return '';
    let fileMap = '';
    try { fileMap = JSON.stringify(fileNupMap || {}); } catch (_) {}
    const activeNup = document.querySelector('.nup-btn.active');
    return [
      parsedPages.length,
      activePageCount(),
      activeNup ? activeNup.dataset.nup : '',
      fileMap,
      byId('paperSize') ? byId('paperSize').value : '',
      byId('marginH') ? byId('marginH').value : '',
      byId('marginV') ? byId('marginV').value : '',
      byId('gap') ? byId('gap').value : '',
      byId('showBorder') ? String(byId('showBorder').checked) : '',
      byId('bookletCheck') ? String(byId('bookletCheck').checked) : ''
    ].join('|');
  }

  function previewIsVisible() {
    return !!document.querySelector('#previewScroll .page-preview');
  }

  async function refreshPreview(force) {
    if (!editorReady() || !parsedPages.length || previewRunning) return;
    const restored = normalizeModerateDocumentMode();
    updateModeUi();
    if (shouldKeepOptimizedMode() || window.__pdfEditorExtremeMode) return;

    const signature = previewSignature();
    if (!force && signature === lastPreviewSignature && previewIsVisible()) return;

    const previewButton = byId('previewBtn');
    const statusText = (byId('statusBar') && byId('statusBar').textContent) || '';
    if (previewButton && previewButton.disabled && statusText.includes('미리보기 생성 중')) {
      if (retryCount < 6) {
        retryCount += 1;
        schedulePreview(350, force);
      }
      return;
    }

    retryCount = 0;
    previewRunning = true;
    try {
      window.__pdfEditorManualPreviewRequest = true;
      if (typeof triggerPreview === 'function') {
        await triggerPreview();
        lastPreviewSignature = signature;
      } else if (previewButton && !previewButton.disabled) {
        previewButton.click();
        lastPreviewSignature = signature;
      }
    } catch (error) {
      console.warn('[pdf-editor-ux] live preview recovery failed', error);
    } finally {
      previewRunning = false;
      updateModeUi();
    }

    if (restored && byId('previewInfo') && !previewIsVisible()) {
      byId('previewInfo').textContent = '대용량 최적화를 해제하고 실시간 미리보기를 준비하고 있습니다.';
    }
  }

  function schedulePreview(delay, force) {
    clearTimeout(previewTimer);
    previewTimer = setTimeout(() => refreshPreview(!!force), delay == null ? 500 : delay);
  }

  function stabilizeRenderThumbs() {
    try {
      if (typeof renderThumbs !== 'function') return false;
      if (renderThumbs.__pdfEditorUxRepairPatchedV1) {
        renderThumbs.__nupRowsPatchedV6 = true;
        renderThumbs.__multiFileInteractionPatchedV2 = true;
        return true;
      }
      const original = renderThumbs;
      const wrapped = function repairedRenderThumbs() {
        const result = original.apply(this, arguments);
        setTimeout(() => {
          cleanupLegacyFileRows();
          normalizeModerateDocumentMode();
          updateModeUi();
          schedulePreview(450, false);
        }, 0);
        return result;
      };
      wrapped.__pdfEditorUxRepairPatchedV1 = true;
      wrapped.__nupRowsPatchedV6 = true;
      wrapped.__multiFileInteractionPatchedV2 = true;
      renderThumbs = wrapped;
      return true;
    } catch (error) {
      console.warn('[pdf-editor-ux] renderThumbs patch failed', error);
      return false;
    }
  }

  function installObservers() {
    if (window.__pdfEditorUxObserversV1) return;
    window.__pdfEditorUxObserversV1 = true;

    const area = byId('thumbArea');
    if (area) {
      const thumbObserver = new MutationObserver(() => {
        cleanupLegacyFileRows();
        normalizeModerateDocumentMode();
        updateModeUi();
        schedulePreview(500, false);
      });
      thumbObserver.observe(area, { childList: true, subtree: true });
    }

    const uiObserver = new MutationObserver(() => updateModeUi());
    [byId('statusBar'), byId('previewScroll')].filter(Boolean).forEach((element) => {
      uiObserver.observe(element, { childList: true, subtree: true, characterData: true });
    });

    document.addEventListener('change', (event) => {
      const target = event.target;
      if (!target) return;
      if (target.matches('input[type="file"]')) schedulePreview(900, true);
      else if (target.matches('select,input[type="number"],input[type="checkbox"]')) schedulePreview(420, true);
    }, true);

    document.addEventListener('input', (event) => {
      const target = event.target;
      if (target && target.matches('#marginH,#marginV,#gap,#customW,#customH')) schedulePreview(520, true);
    }, true);
  }

  function boot() {
    installStyles();
    installFloatingDock();
    cleanupLegacyFileRows();
    stabilizeRenderThumbs();
    installObservers();
    normalizeModerateDocumentMode();
    updateModeUi();
  }

  window.PdfEditorUxRepair = {
    refreshPreview: () => schedulePreview(0, true),
    explanation: '대용량 최적화 모드는 매우 큰 PDF에서 자동 미리보기를 줄여 브라우저 멈춤을 방지하는 보호 기능입니다.'
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once: true });
  else boot();
  setTimeout(boot, 350);
  setTimeout(boot, 1200);
})();
