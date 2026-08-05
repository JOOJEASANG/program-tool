// Scope thumbnail context-menu bulk actions to one discontinuously added source file.
(function () {
  'use strict';
  if (window.__pdfFileContextScopeV1) return;
  window.__pdfFileContextScopeV1 = true;

  const MAX_INSTALL_ATTEMPTS = 40;
  const breakFileIndices = new Set();
  let installAttempts = 0;
  let pageCollectionRef = null;
  let breakObserver = null;

  function editorReady() {
    try {
      return Boolean(
        typeof parsedPages !== 'undefined'
        && Array.isArray(parsedPages)
        && typeof renderPdfPage === 'function'
        && typeof renderThumbs === 'function'
        && typeof schedulePreview === 'function'
        && typeof window._openThumbCtxMenu === 'function'
        && document.getElementById('thumbCtxMenu')
        && document.getElementById('thumbArea')
      );
    } catch (_) {
      return false;
    }
  }

  function normalizedFileIndex(page) {
    const value = Number(page?.file_index);
    return Number.isInteger(value) && value >= 0 ? value : null;
  }

  function syncBreakFileIndices() {
    if (typeof parsedPages === 'undefined' || !Array.isArray(parsedPages)) return;
    if (pageCollectionRef !== parsedPages) {
      pageCollectionRef = parsedPages;
      breakFileIndices.clear();
    }
    parsedPages.forEach((page) => {
      const fileIndex = normalizedFileIndex(page);
      if (fileIndex !== null && page?.groupBreak === true) breakFileIndices.add(fileIndex);
    });
  }

  function installBreakObserver() {
    if (breakObserver) return;
    const thumbArea = document.getElementById('thumbArea');
    if (!thumbArea) return;
    breakObserver = new MutationObserver(syncBreakFileIndices);
    breakObserver.observe(thumbArea, { childList: true, subtree: true });
    syncBreakFileIndices();
  }

  function pdfPages(pages) {
    return pages.filter((page) => page?.pageType === 'pdf' && page?.pdfPage);
  }

  function resolveScopeFor(page, pages, knownBreakFiles) {
    const allPages = Array.isArray(pages) ? pages : [];
    const fileIndex = normalizedFileIndex(page);
    const breaks = knownBreakFiles instanceof Set ? knownBreakFiles : new Set();
    const filePages = fileIndex === null
      ? []
      : pdfPages(allPages.filter((candidate) => normalizedFileIndex(candidate) === fileIndex));
    const discontinuous = fileIndex !== null && (
      breaks.has(fileIndex)
      || allPages.some((candidate) => (
        normalizedFileIndex(candidate) === fileIndex && candidate?.groupBreak === true
      ))
    );

    if (!discontinuous || filePages.length === 0) {
      return {
        mode: 'document',
        fileIndex: null,
        label: '전체 문서',
        pages: pdfPages(allPages),
      };
    }

    return {
      mode: 'file',
      fileIndex,
      label: String(filePages[0]?.sourceFile || `파일 ${fileIndex + 1}`),
      pages: filePages,
    };
  }

  function currentScope(page) {
    syncBreakFileIndices();
    return resolveScopeFor(page, parsedPages, breakFileIndices);
  }

  function closeMenu(menu) {
    menu?.classList.remove('open');
  }

  async function rotateScope(scope, degrees) {
    if (!scope || scope.mode !== 'file' || !scope.pages.length) return false;
    const targets = [...scope.pages];
    if (typeof showStatus === 'function') {
      showStatus(`"${scope.label}" ${targets.length}페이지 회전 중...`);
    }

    try {
      for (const page of targets) {
        page.rotation = ((page.rotation || 0) + degrees + 360) % 360;
        page.thumbCanvas = await renderPdfPage(page.pdfPage, 0.9, page.rotation);
        page.hiCanvas = null;
      }
      renderThumbs();
      schedulePreview(300);
      return true;
    } finally {
      if (typeof hideStatus === 'function') hideStatus();
    }
  }

  function scopedItem(icon, label, scope, degrees, menu) {
    const element = document.createElement('div');
    element.className = 'ctx-item all-rotate file-scoped-rotate';
    const iconElement = document.createElement('span');
    iconElement.className = 'ctx-icon';
    iconElement.textContent = icon;
    element.append(iconElement, document.createTextNode(label));
    element.addEventListener('click', (event) => {
      event.preventDefault();
      event.stopPropagation();
      closeMenu(menu);
      rotateScope(scope, degrees).catch((error) => {
        console.error('[pdf-file-context] file rotation failed', error);
        if (typeof showStatus === 'function') {
          showStatus(`파일 회전 실패: ${error?.message || error}`, 'error');
        }
      });
    });
    return element;
  }

  function rewriteBulkRotationItems(scope) {
    if (!scope || scope.mode !== 'file') return false;
    const menu = document.getElementById('thumbCtxMenu');
    if (!menu) return false;

    menu.querySelector('.ctx-file-scope-note')?.remove();
    const note = document.createElement('div');
    note.className = 'ctx-file-scope-note';
    note.textContent = `비연속 추가 파일 · ${scope.label} · ${scope.pages.length}p`;
    note.style.cssText = 'padding:7px 10px 6px;font-size:9px;font-weight:850;color:#6d28d9;background:#f5f3ff;border-bottom:1px solid #ddd6fe;max-width:260px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;';
    menu.prepend(note);

    const existing = [...menu.querySelectorAll('.ctx-item.all-rotate')];
    const definitions = [
      ['↻', '이 파일 전체 시계방향 90° 회전', 90],
      ['↺', '이 파일 전체 시계반대방향 90° 회전', -90],
      ['⇅', '이 파일 전체 180° 회전', 180],
    ];

    definitions.forEach(([icon, label, degrees], index) => {
      const oldItem = existing[index];
      if (!oldItem) return;
      oldItem.replaceWith(scopedItem(icon, label, scope, degrees, menu));
    });
    return true;
  }

  function install() {
    if (!editorReady()) {
      if (installAttempts < MAX_INSTALL_ATTEMPTS) {
        installAttempts += 1;
        setTimeout(install, 100 + installAttempts * 25);
      }
      return false;
    }

    installBreakObserver();
    const original = window._openThumbCtxMenu;
    if (original.__pdfFileContextScopeV1) return true;

    function fileScopedContextMenu(event, page, index) {
      const result = original.call(this, event, page, index);
      rewriteBulkRotationItems(currentScope(page));
      return result;
    }
    fileScopedContextMenu.__pdfFileContextScopeV1 = true;
    fileScopedContextMenu.original = original;
    window._openThumbCtxMenu = fileScopedContextMenu;
    return true;
  }

  window.PdfFileContextScope = {
    resolveScopeFor,
    rotateScope,
    rewriteBulkRotationItems,
    currentScope,
    syncBreakFileIndices,
    stage: 'discontinuous-file-context-actions',
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', install, { once: true });
  } else {
    install();
  }
})();
