// PDF editor preview row default helper.
// Keeps the preview toolbar compact and protects late booklet-session state.
(function () {
  if (window.__pdfEditorPreviewRowDefaultV3) return;
  window.__pdfEditorPreviewRowDefaultV3 = true;

  const BOOKLET_FLIP_STORAGE_KEY = 'programToolPdfBookletFlipV2';

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
    if ((!document.querySelector('.preview-zoom') || !document.getElementById('perRowSelect')) && attempt < 8) {
      setTimeout(() => boot(attempt + 1), 140 + attempt * 60);
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => boot(0), { once: true });
  } else {
    boot(0);
  }
})();
