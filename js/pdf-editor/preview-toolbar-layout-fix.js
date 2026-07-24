// Keep the PDF preview toolbar compact and prevent status/controls from overlapping.
(function () {
  'use strict';
  if (window.__pdfPreviewToolbarLayoutFixV2) return;
  window.__pdfPreviewToolbarLayoutFixV2 = true;

  let resizeObserver = null;
  let mutationObserver = null;
  let arranging = false;

  function installStyles() {
    if (document.getElementById('pdfPreviewToolbarLayoutFixStyles')) return;
    const style = document.createElement('style');
    style.id = 'pdfPreviewToolbarLayoutFixStyles';
    style.textContent = `
      .preview-info.pdf-preview-toolbar.pdf-toolbar-final{
        display:grid!important;
        grid-template-columns:minmax(0,1fr) auto!important;
        grid-template-areas:"copy controls"!important;
        align-items:center!important;
        gap:7px 12px!important;
        min-height:0!important;
        height:auto!important;
        padding:8px 10px!important;
        overflow:visible!important;
      }
      .preview-info.pdf-toolbar-final .preview-copy-group{
        grid-area:copy!important;
        display:grid!important;
        grid-template-columns:minmax(120px,1fr) auto auto!important;
        grid-template-areas:"info pages live" "count count count"!important;
        align-items:center!important;
        gap:4px 7px!important;
        min-width:0!important;
        width:100%!important;
        position:static!important;
        overflow:visible!important;
      }
      .preview-info.pdf-toolbar-final #previewInfo{
        grid-area:info!important;
        min-width:120px!important;
        white-space:normal!important;
        overflow:visible!important;
        text-overflow:clip!important;
        line-height:1.35!important;
      }
      .preview-info.pdf-toolbar-final #previewPages{
        grid-area:pages!important;
        white-space:nowrap!important;
      }
      .preview-info.pdf-toolbar-final #livePreviewHint{
        grid-area:live!important;
        position:static!important;
        inset:auto!important;
        transform:none!important;
        margin:0!important;
        white-space:nowrap!important;
        line-height:1.2!important;
        padding:3px 7px!important;
        justify-self:start!important;
      }
      .preview-info.pdf-toolbar-final #pdfPageCountHint{
        grid-area:count!important;
        min-width:0!important;
        position:static!important;
        margin:0!important;
        padding:0!important;
        white-space:normal!important;
        line-height:1.35!important;
      }
      .preview-info.pdf-toolbar-final .preview-zoom{
        grid-area:controls!important;
        display:flex!important;
        align-items:center!important;
        justify-content:flex-end!important;
        flex-wrap:nowrap!important;
        gap:4px!important;
        width:auto!important;
        max-width:100%!important;
        min-width:0!important;
        margin:0!important;
        position:static!important;
        align-self:center!important;
      }
      .preview-info.pdf-toolbar-final #perRowSelect{
        width:96px!important;
        min-width:96px!important;
        max-width:96px!important;
        flex:0 0 96px!important;
        padding:4px 24px 4px 8px!important;
        font-size:11px!important;
      }
      .preview-info.pdf-toolbar-final .zoom-btn{flex:0 0 auto!important}
      .preview-info.pdf-toolbar-final .zoom-label{flex:0 0 40px!important;min-width:40px!important}
      .preview-info.pdf-toolbar-final.pdf-toolbar-compact{
        grid-template-columns:minmax(0,1fr)!important;
        grid-template-areas:"copy" "controls"!important;
      }
      .preview-info.pdf-toolbar-final.pdf-toolbar-compact .preview-copy-group{
        grid-template-columns:minmax(0,1fr) auto!important;
        grid-template-areas:"info pages" "live live" "count count"!important;
      }
      .preview-info.pdf-toolbar-final.pdf-toolbar-compact .preview-zoom{
        justify-self:end!important;
      }
      @media(max-width:560px){
        .preview-info.pdf-toolbar-final{padding:7px 8px!important}
        .preview-info.pdf-toolbar-final #perRowSelect{
          width:88px!important;min-width:88px!important;max-width:88px!important;flex-basis:88px!important;
        }
        .preview-info.pdf-toolbar-final .zoom-btn{padding:3px 7px!important}
      }
    `;
    document.head.appendChild(style);
  }

  function arrangeToolbar() {
    const bar = document.querySelector('.preview-info');
    if (!bar || arranging) return false;
    arranging = true;
    try {
      bar.classList.add('pdf-preview-toolbar', 'pdf-toolbar-final');

      let group = bar.querySelector('.preview-copy-group');
      if (!group) {
        group = document.createElement('div');
        group.className = 'preview-copy-group';
        bar.insertBefore(group, bar.firstChild);
      }

      ['previewInfo', 'previewPages', 'livePreviewHint', 'pdfPageCountHint'].forEach((id) => {
        const element = document.getElementById(id);
        if (element && element.parentElement !== group) group.appendChild(element);
      });

      const zoom = bar.querySelector('.preview-zoom');
      if (zoom && zoom.parentElement !== bar) bar.appendChild(zoom);
      bar.classList.toggle('pdf-toolbar-compact', bar.clientWidth < 760);
      return true;
    } finally {
      arranging = false;
    }
  }

  function installObservers() {
    const bar = document.querySelector('.preview-info');
    if (!bar) return;
    if (!resizeObserver && typeof ResizeObserver === 'function') {
      resizeObserver = new ResizeObserver(arrangeToolbar);
      resizeObserver.observe(bar);
    }
    if (!mutationObserver) {
      mutationObserver = new MutationObserver(arrangeToolbar);
      mutationObserver.observe(bar, { childList: true, subtree: true });
    }
  }

  function install() {
    installStyles();
    if (!arrangeToolbar()) return false;
    installObservers();
    return true;
  }

  function boot(attempt) {
    if (!install() && attempt < 12) setTimeout(() => boot(attempt + 1), 160 + attempt * 60);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => boot(0), { once: true });
  else boot(0);
})();
