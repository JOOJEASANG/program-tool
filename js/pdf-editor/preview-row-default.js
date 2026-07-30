// PDF editor preview row default helper.
// Keeps the preview toolbar compact and sets the default pages-per-row to 2.
(function () {
  if (window.__pdfEditorPreviewRowDefaultV2) return;
  window.__pdfEditorPreviewRowDefaultV2 = true;

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

  function boot(attempt = 0) {
    applyToolbarStyle();
    setDefaultPerRow();
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
