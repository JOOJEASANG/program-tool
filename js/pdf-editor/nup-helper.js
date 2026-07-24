// PDF editor N-UP helper: concise guidance and preview page labels only.
(function () {
  'use strict';
  if (window.__pdfEditorNupHelperV7) return;
  window.__pdfEditorNupHelperV7 = true;

  const byId = (id) => document.getElementById(id);
  window.__pdfEditorFileNupMapV5 = window.__pdfEditorFileNupMapV5 || {};

  function editorReady() {
    try {
      return Array.isArray(parsedPages) && Array.isArray(uploadedFiles);
    } catch (_) {
      return false;
    }
  }

  function cleanupLegacyRows() {
    document.querySelectorAll('.file-nup-row-v5,#fileNupOverridePanel').forEach((element) => element.remove());
  }

  function renderQuickGuide() {
    const nupGrid = document.querySelector('.nup-grid');
    if (!nupGrid) return;
    let guide = byId('nupQuickGuide');
    if (!guide) {
      guide = document.createElement('div');
      guide.id = 'nupQuickGuide';
      guide.style.cssText = 'margin-top:8px;padding:8px 10px;border-radius:9px;background:#eff6ff;border:1px solid #bfdbfe;color:#1e3a8a;font-size:10px;font-weight:800;line-height:1.55;';
      nupGrid.insertAdjacentElement('afterend', guide);
    }
    guide.textContent = 'N-up 안내: 기본 배치는 모든 파일에 적용됩니다. 여러 파일을 올린 경우 파일 구분선의 배치 선택으로 해당 파일만 다르게 설정할 수 있습니다.';
  }

  function renderPreviewPageLabels() {
    document.querySelectorAll('#previewScroll .page-preview').forEach((wrap, index) => {
      let label = wrap.querySelector('.page-label');
      if (!label) {
        label = document.createElement('div');
        label.className = 'page-label';
        label.style.cssText = 'font-size:11px;color:#475569;font-weight:900;text-align:center;padding:5px 2px 7px;background:#fff;border-top:1px solid #e5e7eb;';
        wrap.appendChild(label);
      }
      label.textContent = `${index + 1}p`;
    });
  }

  function patchRenderThumbs() {
    try {
      if (typeof renderThumbs !== 'function') return false;
      if (renderThumbs.__nupRowsPatchedV6 || renderThumbs.__nupHelperPatchedV7) return true;
      const original = renderThumbs;
      const wrapped = function renderThumbsWithoutDuplicateFileRows() {
        const result = original.apply(this, arguments);
        setTimeout(() => {
          cleanupLegacyRows();
          renderQuickGuide();
        }, 0);
        return result;
      };
      wrapped.__nupHelperPatchedV7 = true;
      wrapped.__nupRowsPatchedV6 = true;
      renderThumbs = wrapped;
      return true;
    } catch (error) {
      console.warn('[pdf-nup] renderThumbs patch failed', error);
      return false;
    }
  }

  function patchDisplayPreview() {
    try {
      if (typeof displayPreview !== 'function') return false;
      if (displayPreview.__pageLabelsPatchedV6 || displayPreview.__pageLabelsPatchedV7) return true;
      const original = displayPreview;
      const wrapped = function displayPreviewWithPageLabels() {
        const result = original.apply(this, arguments);
        setTimeout(renderPreviewPageLabels, 0);
        return result;
      };
      wrapped.__pageLabelsPatchedV7 = true;
      wrapped.__pageLabelsPatchedV6 = true;
      displayPreview = wrapped;
      return true;
    } catch (error) {
      console.warn('[pdf-nup] displayPreview patch failed', error);
      return false;
    }
  }

  function installObserver() {
    const area = byId('thumbArea');
    if (!area || area.dataset.nupCleanupObservedV7) return;
    area.dataset.nupCleanupObservedV7 = '1';
    const observer = new MutationObserver(() => cleanupLegacyRows());
    observer.observe(area, { childList: true, subtree: true });
  }

  function boot() {
    if (!editorReady()) return;
    cleanupLegacyRows();
    renderQuickGuide();
    renderPreviewPageLabels();
    patchRenderThumbs();
    patchDisplayPreview();
    installObserver();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once: true });
  else boot();
  setTimeout(boot, 400);
  setTimeout(boot, 1200);
})();
