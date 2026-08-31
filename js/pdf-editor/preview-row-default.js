// PDF editor preview row default helper.
// Keeps the preview toolbar compact and protects late booklet-session state.
(function () {
  if (window.__pdfEditorPreviewRowDefaultV3) return;
  window.__pdfEditorPreviewRowDefaultV3 = true;

  const BOOKLET_FLIP_STORAGE_KEY = 'programToolPdfBookletFlipV2';
  let fastInsertObserver = null;

  function applyToolbarStyle() {
    const toolbar = document.querySelector('.preview-zoom');
    if (toolbar) {
      toolbar.style.whiteSpace = 'nowrap';
      toolbar.style.flexWrap = 'nowrap';
      toolbar.style.alignItems = 'center';
      toolbar.style.minWidth = 'max-content';
    }

    const label = toolbar && [...toolbar.querySelectorAll('span')]
      .find((el) => (el.textContent || '').trim() === '줄당');
    if (label) {
      label.style.whiteSpace = 'nowrap';
      label.style.display = 'inline-flex';
      label.style.alignItems = 'center';
      label.style.flexShrink = '0';
    }

    const select = document.getElementById('perRowSelect');
    if (select) {
      select.style.flexShrink = '0';
      select.style.minWidth = '54px';
    }
  }

  function setDefaultPerRow() {
    const select = document.getElementById('perRowSelect');
    if (!select || select.dataset.defaultRowApplied === '1') return;
    select.value = '2';
    select.dataset.defaultRowApplied = '1';
    select.dispatchEvent(new Event('change', { bubbles: true }));
  }

  function ensureFastInsertStyles() {
    if (document.getElementById('pdfFastInsertActionsStylesV1')) return;
    const style = document.createElement('style');
    style.id = 'pdfFastInsertActionsStylesV1';
    style.textContent = `
      #previewScroll .pdf-fast-insert-actions{display:flex;flex-wrap:wrap;align-items:center;justify-content:center;gap:6px;margin:12px auto 0;padding:10px 12px;max-width:470px;border:1px solid #dbe4ee;border-radius:10px;background:#fff;box-shadow:0 3px 12px rgba(15,23,42,.05)}
      #previewScroll .pdf-fast-insert-actions .prev-ins-btn{position:static!important;opacity:1!important;visibility:visible!important;pointer-events:auto!important;transform:none!important;min-height:32px;padding:6px 11px;border:1px solid #bfdbfe;border-radius:8px;background:#eff6ff;color:#1d4ed8;font-family:inherit;font-size:10px;font-weight:900;cursor:pointer}
      #previewScroll .pdf-fast-insert-actions .prev-ins-btn.divider{border-color:#ddd6fe;background:#f5f3ff;color:#6d28d9}
      #previewScroll .pdf-fast-insert-actions .prev-ins-btn:hover{filter:brightness(.98);box-shadow:0 2px 7px rgba(15,23,42,.08)}
      #previewScroll .pdf-fast-insert-note{flex:1 0 100%;margin-top:1px;color:#64748b;font-size:9px;font-weight:700;line-height:1.45;text-align:center}
    `;
    document.head.appendChild(style);
  }

  function refreshFastPreviewPageCount() {
    let count = 0;
    try { count = Array.isArray(parsedPages) ? parsedPages.length : 0; } catch (_) {}
    const pages = document.getElementById('previewPages');
    if (pages) pages.textContent = count ? `총 ${count}페이지` : '';
    try { window.PdfBookletPrintGuide?.updateGuide?.(); } catch (_) {}
  }

  function appendFastBlankPage() {
    try {
      if (!Array.isArray(parsedPages) || typeof makeBlankPage !== 'function') return;
      parsedPages.splice(parsedPages.length, 0, makeBlankPage());
      if (typeof renderThumbs === 'function') renderThumbs();
      window.PdfUploadOptimization?.syncAggregateMode?.();
      refreshFastPreviewPageCount();
      if (typeof showStatus === 'function') {
        showStatus('문서 끝에 빈 페이지를 추가했습니다.', 'success');
        if (typeof hideStatus === 'function') setTimeout(hideStatus, 1600);
      }
    } catch (error) {
      console.warn('[pdf-preview] fast-mode blank insertion failed', error);
    }
  }

  function openFastDividerInsert() {
    try {
      if (!Array.isArray(parsedPages) || typeof window.openDividerInsert !== 'function') return;
      window.openDividerInsert(parsedPages.length);
    } catch (error) {
      console.warn('[pdf-preview] fast-mode divider insertion failed', error);
    }
  }

  function ensureFastInsertActions() {
    const scroll = document.getElementById('previewScroll');
    if (!scroll || !window.__pdfEditorFastMode) return false;
    if (!scroll.querySelector('.empty-state')) return false;
    if (scroll.querySelector('#pdfFastInsertActionsV1')) return true;

    ensureFastInsertStyles();
    const actions = document.createElement('div');
    actions.id = 'pdfFastInsertActionsV1';
    actions.className = 'prev-ins-btns pdf-fast-insert-actions';
    actions.setAttribute('aria-label', '대용량 문서 페이지 삽입');

    const blank = document.createElement('button');
    blank.type = 'button';
    blank.className = 'prev-ins-btn';
    blank.textContent = '+ 빈 페이지';
    blank.addEventListener('click', (event) => {
      event.preventDefault();
      event.stopPropagation();
      appendFastBlankPage();
    });

    const divider = document.createElement('button');
    divider.type = 'button';
    divider.className = 'prev-ins-btn divider';
    divider.textContent = '+ 간지';
    divider.addEventListener('click', (event) => {
      event.preventDefault();
      event.stopPropagation();
      openFastDividerInsert();
    });

    const note = document.createElement('div');
    note.className = 'pdf-fast-insert-note';
    note.textContent = '대용량 최적화 모드에서도 삽입 기능을 유지합니다. 새 항목은 문서 끝에 추가됩니다.';
    actions.append(blank, divider, note);
    scroll.querySelector('.empty-state')?.appendChild(actions);
    return true;
  }

  function installFastInsertActions() {
    const scroll = document.getElementById('previewScroll');
    if (!scroll) return false;
    if (!fastInsertObserver) {
      fastInsertObserver = new MutationObserver(() => ensureFastInsertActions());
      fastInsertObserver.observe(scroll, { childList: true, subtree: true });
    }
    ensureFastInsertActions();
    return true;
  }

  function readStoredBookletFlip() {
    try {
      return localStorage.getItem(BOOKLET_FLIP_STORAGE_KEY);
    } catch (_) {
      return null;
    }
  }

  function restoreStoredBookletFlip(value) {
    try {
      if (value === null) localStorage.removeItem(BOOKLET_FLIP_STORAGE_KEY);
      else localStorage.setItem(BOOKLET_FLIP_STORAGE_KEY, value);
    } catch (_) {}
  }

  function installBookletSessionResultGuard(attempt = 0) {
    if (window.__pdfBookletSessionResultGuardV1) return true;
    if (typeof loadEditorSession !== 'function' || !loadEditorSession.__bookletGuideStateV2) {
      if (attempt < 12) setTimeout(() => installBookletSessionResultGuard(attempt + 1), 140 + attempt * 50);
      return false;
    }

    const currentLoad = loadEditorSession;
    const guardedLoad = async function guardedBookletSessionLoad() {
      const select = document.getElementById('bookletFlipSelectV2');
      const previousValue = select?.value || '';
      const previousUserSelected = select?.dataset.userSelected;
      const previousStoredValue = readStoredBookletFlip();
      const modal = document.getElementById('sessionListModal');
      const modalWasOpen = Boolean(modal && getComputedStyle(modal).display !== 'none');

      const result = await currentLoad.apply(this, arguments);
      const modalStillOpen = Boolean(modal && getComputedStyle(modal).display !== 'none');
      const statusText = document.getElementById('statusBar')?.textContent || '';
      const sessionApplied = !(modalWasOpen && modalStillOpen) && statusText.includes('불러오기 완료!');

      if (!sessionApplied) {
        if (select && previousValue) select.value = previousValue;
        if (select) {
          if (previousUserSelected === undefined) delete select.dataset.userSelected;
          else select.dataset.userSelected = previousUserSelected;
        }
        restoreStoredBookletFlip(previousStoredValue);
        window.PdfBookletPrintGuide?.updateGuide?.();
      }
      return result;
    };

    guardedLoad.__bookletGuideStateV2 = true;
    guardedLoad.__bookletSessionResultGuardV1 = true;
    loadEditorSession = guardedLoad;
    window.loadEditorSession = guardedLoad;
    window.__pdfBookletSessionResultGuardV1 = true;
    return true;
  }

  function boot(attempt = 0) {
    applyToolbarStyle();
    setDefaultPerRow();
    installBookletSessionResultGuard(0);
    installFastInsertActions();
    if ((!document.querySelector('.preview-zoom') || !document.getElementById('perRowSelect') || !document.getElementById('previewScroll')) && attempt < 8) {
      setTimeout(() => boot(attempt + 1), 140 + attempt * 60);
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => boot(0), { once: true });
  } else {
    boot(0);
  }
})();
