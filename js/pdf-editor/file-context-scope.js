// Scope thumbnail context-menu bulk actions to the clicked source file.
(function () {
  'use strict';
  if (window.__pdfFileContextScopeV1) return;
  window.__pdfFileContextScopeV1 = true;

  const MAX_INSTALL_ATTEMPTS = 20;
  let installAttempts = 0;

  function hasFileScope(page) {
    return page && page.file_index !== undefined && page.file_index !== null;
  }

  function sameFile(candidate, page) {
    return hasFileScope(page)
      && candidate
      && candidate.file_index === page.file_index;
  }

  function sourceLabel(page) {
    const raw = String(page?.sourceFile || '').trim();
    return raw || `파일 ${Number(page?.file_index || 0) + 1}`;
  }

  function filePdfPages(page) {
    if (!hasFileScope(page) || typeof parsedPages === 'undefined' || !Array.isArray(parsedPages)) return [];
    return parsedPages.filter(candidate =>
      sameFile(candidate, page)
      && candidate.pageType === 'pdf'
      && candidate.pdfPage
    );
  }

  async function rotateClickedFile(page, degrees) {
    const targets = filePdfPages(page);
    if (!targets.length) return;

    try {
      if (typeof showStatus === 'function') {
        showStatus(`“${sourceLabel(page)}” ${targets.length}페이지 회전 중...`);
      }
      for (const target of targets) {
        target.rotation = ((target.rotation || 0) + degrees + 360) % 360;
        target.thumbCanvas = await renderPdfPage(target.pdfPage, 0.9, target.rotation);
        target.hiCanvas = null;
      }
      if (typeof renderThumbs === 'function') renderThumbs();
      if (typeof schedulePreview === 'function') schedulePreview(120);
      if (typeof showStatus === 'function') {
        showStatus(`“${sourceLabel(page)}” 파일에만 회전을 적용했습니다.`, 'success');
        if (typeof hideStatus === 'function') setTimeout(hideStatus, 1400);
      }
    } catch (error) {
      console.error('[pdf-file-context] file rotation failed', error);
      if (typeof showStatus === 'function') {
        showStatus('해당 파일 회전 중 오류가 발생했습니다.', 'error');
      }
    }
  }

  function degreesFromItem(item, index) {
    const text = String(item?.textContent || '');
    if (text.includes('반대')) return -90;
    if (text.includes('180')) return 180;
    return index === 1 ? -90 : index === 2 ? 180 : 90;
  }

  function repositionMenu(menu) {
    if (!menu) return;
    const rect = menu.getBoundingClientRect();
    if (rect.right > window.innerWidth - 6) {
      menu.style.left = `${Math.max(6, window.innerWidth - rect.width - 6)}px`;
    }
    if (rect.bottom > window.innerHeight - 6) {
      menu.style.top = `${Math.max(6, window.innerHeight - rect.height - 6)}px`;
    }
  }

  function rewriteBulkRotationItems(page) {
    const menu = document.getElementById('thumbCtxMenu');
    if (!menu) return;
    const items = [...menu.querySelectorAll('.ctx-item.all-rotate')];
    if (!items.length) return;

    if (!hasFileScope(page)) {
      items.forEach(item => item.remove());
      menu.querySelectorAll('.ctx-sep').forEach(separator => {
        const previous = separator.previousElementSibling;
        const next = separator.nextElementSibling;
        if (!previous || !next || previous.classList.contains('ctx-sep') || next.classList.contains('ctx-sep')) {
          separator.remove();
        }
      });
      repositionMenu(menu);
      return;
    }

    items.forEach((oldItem, index) => {
      const degrees = degreesFromItem(oldItem, index);
      const replacement = oldItem.cloneNode(true);
      replacement.dataset.fileScopedRotation = 'true';
      const icon = replacement.querySelector('.ctx-icon')?.textContent || (degrees === -90 ? '↺' : degrees === 180 ? '⇅' : '↻');
      const label = degrees === -90
        ? '이 파일 전체 시계반대방향 90° 회전'
        : degrees === 180
          ? '이 파일 전체 180° 회전'
          : '이 파일 전체 시계방향 90° 회전';
      replacement.innerHTML = `<span class="ctx-icon">${icon}</span>${label}`;
      replacement.addEventListener('click', event => {
        event.preventDefault();
        event.stopPropagation();
        menu.classList.remove('open');
        rotateClickedFile(page, degrees);
      });
      oldItem.replaceWith(replacement);
    });
    repositionMenu(menu);
  }

  function install() {
    const original = window._openThumbCtxMenu;
    if (typeof original !== 'function') {
      if (installAttempts < MAX_INSTALL_ATTEMPTS) {
        installAttempts += 1;
        setTimeout(install, 120 + installAttempts * 40);
      }
      return false;
    }
    if (original.__fileContextScopePatchedV1) return true;

    const wrapped = function openFileScopedContextMenu(event, page, index) {
      const result = original.call(this, event, page, index);
      setTimeout(() => rewriteBulkRotationItems(page), 0);
      return result;
    };
    wrapped.__fileContextScopePatchedV1 = true;
    window._openThumbCtxMenu = wrapped;
    return true;
  }

  window.PdfFileContextScope = {
    filePages: filePdfPages,
    rotateFile: rotateClickedFile,
    stage: 'clicked-file-only',
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', install, { once: true });
  else install();
})();
