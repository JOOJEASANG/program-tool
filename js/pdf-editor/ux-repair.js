// PDF editor compatibility cleanup for legacy rows and large-document labels.
(function () {
  'use strict';
  if (window.__pdfEditorUxRepairV2) return;
  window.__pdfEditorUxRepairV2 = true;

  const MODERATE_PAGE_LIMIT = 120;
  const MODERATE_BYTE_LIMIT = 160 * 1024 * 1024;
  const byId = (id) => document.getElementById(id);
  let renderPatched = false;
  let attempts = 0;

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
        hint.title = '페이지가 매우 많은 PDF는 브라우저 보호를 위해 목록과 배치 중심으로 표시합니다. 저장 결과는 원본 PDF를 기준으로 처리됩니다.';
      } else if (optimized) {
        hint.textContent = '대용량 문서 · 수동 미리보기';
        hint.style.color = '#b45309';
        hint.title = '대용량 PDF도 미리볼 수 있습니다. 자동 갱신만 중지되며 미리보기 버튼으로 실제 내용을 확인합니다.';
      } else {
        hint.textContent = '실시간 미리보기 ON';
        hint.style.color = '#64748b';
        hint.title = '업로드와 주요 편집 설정 변경 후 미리보기가 자동 갱신됩니다.';
      }
    }
    const previewButton = byId('previewBtn');
    if (previewButton) {
      previewButton.textContent = extreme ? '레이아웃 미리보기' : (optimized ? '대용량 미리보기 생성' : '미리보기');
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
    style.textContent = '.file-nup-row-v5,#fileNupOverridePanel{display:none!important}';
    document.head.appendChild(style);
  }

  function refreshPreview(force) {
    normalizeModerateDocumentMode();
    updateModeUi();
    if (window.PdfPreviewController) {
      window.PdfPreviewController.request(0, !!force);
      return;
    }
    try {
      if (force) window.__pdfEditorManualPreviewRequest = true;
      if (typeof schedulePreview === 'function' && !force) schedulePreview(0);
      else if (typeof triggerPreview === 'function') triggerPreview();
    } catch (_) {}
  }

  function patchRenderThumbs() {
    if (renderPatched) return true;
    try {
      if (typeof renderThumbs !== 'function') return false;
      if (renderThumbs.__pdfEditorUxRepairPatchedV2) {
        renderPatched = true;
        return true;
      }
      const original = renderThumbs;
      const wrapped = function renderThumbsWithCompatibilityCleanup() {
        const result = original.apply(this, arguments);
        setTimeout(() => {
          cleanupLegacyFileRows();
          normalizeModerateDocumentMode();
          updateModeUi();
        }, 0);
        return result;
      };
      wrapped.__pdfEditorUxRepairPatchedV2 = true;
      wrapped.__nupRowsPatchedV6 = true;
      wrapped.__multiFileInteractionPatchedV2 = true;
      renderThumbs = wrapped;
      window.renderThumbs = wrapped;
      renderPatched = true;
      return true;
    } catch (error) {
      console.warn('[pdf-editor-ux] renderThumbs patch failed', error);
      return false;
    }
  }

  function installObservers() {
    if (window.__pdfEditorUxObserversV2) return;
    window.__pdfEditorUxObserversV2 = true;
    const area = byId('thumbArea');
    if (area) {
      new MutationObserver(() => {
        cleanupLegacyFileRows();
        normalizeModerateDocumentMode();
        updateModeUi();
      }).observe(area, { childList: true, subtree: true });
    }
    [byId('statusBar'), byId('previewScroll')].filter(Boolean).forEach((element) => {
      new MutationObserver(updateModeUi).observe(element, { childList: true, subtree: true, characterData: true });
    });
  }

  function boot() {
    if (!editorReady()) {
      if (attempts < 12) {
        attempts += 1;
        setTimeout(boot, 150 + attempts * 60);
      }
      return;
    }
    installStyles();
    cleanupLegacyFileRows();
    patchRenderThumbs();
    installObservers();
    normalizeModerateDocumentMode();
    updateModeUi();
  }

  window.PdfEditorUxRepair = {
    refreshPreview: () => refreshPreview(true),
    updateModeUi,
    explanation: '대용량 최적화 모드는 큰 PDF의 자동 미리보기 횟수를 줄여 브라우저 멈춤을 방지합니다.',
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once: true });
  else boot();
})();
