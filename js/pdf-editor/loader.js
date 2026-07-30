// PDF editor module loader.
// Keep the stable July 20 runtime, with selected July 24 core upgrades.
(function () {
  if (window.__pdfEditorModuleLoaderV16) return;
  window.__pdfEditorModuleLoaderV16 = true;

  function installPreviewToolbarLayoutFix() {
    if (!document.getElementById('pdfEditorPreviewToolbarWidthFix')) {
      const style = document.createElement('style');
      style.id = 'pdfEditorPreviewToolbarWidthFix';
      style.textContent = `
        .preview-info {
          min-width: 0 !important;
          overflow: hidden !important;
        }
        #previewInfo {
          flex: 1 1 auto !important;
          min-width: 0 !important;
          overflow: hidden !important;
          text-overflow: ellipsis !important;
          white-space: nowrap !important;
        }
        #previewPages {
          flex: 0 1 auto !important;
          min-width: 0 !important;
          max-width: 220px !important;
          overflow: hidden !important;
          text-overflow: ellipsis !important;
          white-space: nowrap !important;
        }
        .preview-zoom {
          min-width: 0 !important;
          max-width: 100% !important;
          flex: 0 0 auto !important;
          overflow: hidden !important;
        }
        #perRowSelect {
          width: 86px !important;
          min-width: 86px !important;
          max-width: 86px !important;
          flex: 0 0 86px !important;
          padding: 2px 22px 2px 7px !important;
        }
        .preview-zoom > * {
          flex-shrink: 0;
        }
      `;
      document.head.appendChild(style);
    }

    const select = document.getElementById('perRowSelect');
    if (select && !select.getAttribute('aria-label')) {
      select.setAttribute('aria-label', '미리보기 한 줄당 페이지 수');
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', installPreviewToolbarLayoutFix, { once: true });
  } else {
    installPreviewToolbarLayoutFix();
  }

  const MODULES = [
    '/js/pdf-editor/font-render-fix.js?v=20260618-1',
    '/js/pdf-editor/upload-fix.js?v=20260724-5',
    '/js/pdf-editor/live-preview.js?v=20260724-4',
    '/js/pdf-editor/layout-export.js?v=20260724-5',
    '/js/pdf-editor/page-count-hint.js?v=20260724-2',
    '/js/pdf-editor/nup-helper.js?v=20260724-2',
    '/js/pdf-editor/preview-row-default.js?v=20260602-1',
    '/js/pdf-editor/divider-helper.js?v=20260724-2-safe1'
  ];

  function loadScript(src) {
    const clean = src.split('?')[0];
    if ([...document.scripts].some((script) => script.src && script.src.includes(clean))) return;
    const script = document.createElement('script');
    script.src = src;
    script.async = false;
    document.head.appendChild(script);
  }

  MODULES.forEach(loadScript);
})();
