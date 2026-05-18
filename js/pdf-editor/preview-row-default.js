// PDF editor preview row default helper.
// Keeps the preview toolbar compact and sets the default pages-per-row to 6.
(function () {
  if (window.__pdfEditorPreviewRowDefaultV1) return;
  window.__pdfEditorPreviewRowDefaultV1 = true;

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
    if (!select || select.dataset.defaultSixApplied === '1') return;
    select.value = '6';
    select.dataset.defaultSixApplied = '1';
    select.dispatchEvent(new Event('change', { bubbles: true }));
  }

  function boot() {
    applyToolbarStyle();
    setDefaultPerRow();
  }

  document.addEventListener('DOMContentLoaded', boot);
  setTimeout(boot, 300);
  setInterval(applyToolbarStyle, 1500);
})();
