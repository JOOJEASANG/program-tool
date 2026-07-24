// Keep the PDF preview toolbar compact, aligned, and free from overlapping elements.
(function () {
  'use strict';
  if (window.__pdfPreviewToolbarLayoutFixV3) return;
  window.__pdfPreviewToolbarLayoutFixV3 = true;

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
        grid-template-areas:"summary controls" "detail detail"!important;
        align-items:center!important;
        column-gap:12px!important;
        row-gap:4px!important;
        min-height:0!important;
        height:auto!important;
        padding:8px 10px!important;
        overflow:visible!important;
      }
      .preview-info.pdf-toolbar-final .preview-copy-group{
        grid-area:summary!important;
        display:flex!important;
        align-items:center!important;
        flex-wrap:wrap!important;
        gap:5px 9px!important;
        min-width:0!important;
        min-height:34px!important;
        width:100%!important;
        position:static!important;
        overflow:visible!important;
      }
      .preview-info.pdf-toolbar-final #previewInfo{
        flex:1 1 150px!important;
        min-width:80px!important;
        margin:0!important;
        white-space:normal!important;
        overflow:visible!important;
        text-overflow:clip!important;
        line-height:1.3!important;
      }
      .preview-info.pdf-toolbar-final #previewInfo:empty{display:none!important}
      .preview-info.pdf-toolbar-final #previewPages,
      .preview-info.pdf-toolbar-final #livePreviewHint{
        display:inline-flex!important;
        align-items:center!important;
        justify-content:center!important;
        flex:0 0 auto!important;
        min-height:26px!important;
        margin:0!important;
        position:static!important;
        inset:auto!important;
        transform:none!important;
        white-space:nowrap!important;
        line-height:1.2!important;
        vertical-align:middle!important;
      }
      .preview-info.pdf-toolbar-final #livePreviewHint{
        padding:3px 8px!important;
      }
      .preview-info.pdf-toolbar-final #pdfPageCountHint{
        grid-area:detail!important;
        min-width:0!important;
        width:100%!important;
        position:static!important;
        margin:0!important;
        padding:0!important;
        white-space:normal!important;
        line-height:1.3!important;
      }
      .preview-info.pdf-toolbar-final #pdfPageCountHint:empty{display:none!important}
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
        min-height:34px!important;
        margin:0!important;
        position:static!important;
        align-self:center!important;
      }
      .preview-info.pdf-toolbar-final #perRowSelect{
        width:92px!important;
        min-width:92px!important;
        max-width:92px!important;
        flex:0 0 92px!important;
        height:30px!important;
        padding:4px 22px 4px 8px!important;
        font-size:11px!important;
      }
      .preview-info.pdf-toolbar-final .zoom-btn{
        flex:0 0 auto!important;
        min-height:30px!important;
      }
      .preview-info.pdf-toolbar-final .zoom-label{
        display:inline-flex!important;
        align-items:center!important;
        justify-content:center!important;
        flex:0 0 42px!important;
        min-width:42px!important;
        min-height:30px!important;
        line-height:1!important;
      }
      .preview-info.pdf-toolbar-final.pdf-toolbar-compact{
        grid-template-columns:minmax(0,1fr)!important;
        grid-template-areas:"summary" "controls" "detail"!important;
      }
      .preview-info.pdf-toolbar-final.pdf-toolbar-compact .preview-zoom{
        justify-self:end!important;
      }
      @media(max-width:560px){
        .preview-info.pdf-toolbar-final{padding:7px 8px!important}
        .preview-info.pdf-toolbar-final #perRowSelect{
          width:86px!important;min-width:86px!important;max-width:86px!important;flex-basis:86px!important;
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

      ['previewInfo', 'previewPages', 'livePreviewHint'].forEach((id) => {
        const element = document.getElementById(id);
        if (element && element.parentElement !== group) group.appendChild(element);
      });

      const countHint = document.getElementById('pdfPageCountHint');
      const zoom = bar.querySelector('.preview-zoom');
      if (zoom && zoom.parentElement !== bar) bar.appendChild(zoom);
      if (countHint && countHint.parentElement !== bar) bar.appendChild(countHint);

      bar.classList.toggle('pdf-toolbar-compact', bar.clientWidth < 520);
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
