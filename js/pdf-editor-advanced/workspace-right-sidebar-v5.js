const $ = id => document.getElementById(id);

function installStyles() {
  if ($('pdfAdvancedRightSidebarV5Styles')) return;
  const style = document.createElement('style');
  style.id = 'pdfAdvancedRightSidebarV5Styles';
  style.textContent = `
    .advanced-app{grid-template-columns:340px minmax(0,1fr) 300px!important}
    .advanced-page-sidebar{padding:10px 12px 10px!important}
    .advanced-page-sidebar .workspace-toolbar{height:auto!important;flex:0 0 auto!important;display:grid!important;grid-template-columns:1fr!important;align-items:stretch!important;justify-content:stretch!important;gap:8px!important;padding:10px!important;margin:0 0 8px!important;background:#f8fafc!important;border:1px solid #dce3ea!important;border-radius:11px!important;color:#475569!important}
    .advanced-page-sidebar #selectionLabel{font-size:10px!important;line-height:1.45!important;font-weight:850!important;color:#334155!important;white-space:normal!important;word-break:keep-all}
    .advanced-page-sidebar .pair-nav{display:grid!important;grid-template-columns:1fr auto 1fr!important;align-items:center!important;gap:6px!important;margin:0!important}
    .advanced-page-sidebar .pair-nav button{width:100%!important;min-width:0!important;height:31px!important}
    .advanced-page-sidebar .pair-nav span{min-width:68px!important;text-align:center!important;font-size:9px!important}
    .advanced-page-sidebar .toolbar-actions{display:grid!important;grid-template-columns:repeat(4,minmax(0,1fr))!important;gap:5px!important;width:100%!important}
    .advanced-page-sidebar .toolbar-actions button{width:100%!important;min-width:0!important;height:31px!important;padding:0 5px!important}
    .advanced-page-sidebar .toolbar-actions span{display:flex!important;align-items:center!important;justify-content:center!important;min-width:0!important;font-size:9px!important}

    .advanced-page-sidebar .advanced-size-inspector{min-height:0!important;flex:0 0 auto!important;display:grid!important;grid-template-columns:1fr!important;align-items:stretch!important;gap:6px!important;padding:10px!important;margin:0 0 10px!important;background:#fff!important;border:1px solid #dce3ea!important;border-radius:11px!important;color:#334155!important;z-index:auto!important}
    .advanced-page-sidebar .advanced-size-block{display:grid!important;grid-template-columns:72px minmax(0,1fr)!important;align-items:center!important;gap:6px!important;white-space:normal!important}
    .advanced-page-sidebar .advanced-size-block strong{font-size:9px!important;color:#12396d!important}
    .advanced-page-sidebar .advanced-size-block span{font-size:10px!important;line-height:1.35!important;font-weight:850!important;color:#334155!important;text-align:right!important}
    .advanced-page-sidebar .advanced-trim-inputs{display:grid!important;grid-template-columns:72px minmax(0,1fr) 12px minmax(0,1fr) 24px!important;align-items:center!important;gap:4px!important;margin:2px 0 0!important;white-space:normal!important}
    .advanced-page-sidebar .advanced-trim-inputs label{font-size:9px!important;font-weight:900!important;color:#475569!important}
    .advanced-page-sidebar .advanced-trim-inputs input{width:100%!important;min-width:0!important;height:31px!important}
    .advanced-page-sidebar .advanced-trim-inputs .times,.advanced-page-sidebar .advanced-trim-inputs .unit{text-align:center!important}
    .advanced-page-sidebar .advanced-trim-auto{grid-column:1/-1!important;width:100%!important;height:30px!important;margin-top:2px!important}
    .advanced-page-sidebar .advanced-trim-status{min-width:0!important;text-align:left!important;white-space:normal!important;line-height:1.45!important;padding:6px 8px!important;border-radius:7px!important;background:#f8fafc!important}
    .advanced-page-sidebar .page-section{border-top:1px solid #edf1f5!important;padding-top:10px!important}
    .advanced-workspace .busy-overlay{inset:0!important}

    @media(max-width:1180px){.advanced-app{grid-template-columns:310px minmax(0,1fr) 270px!important}.advanced-page-sidebar{padding-inline:9px!important}}
    @media(max-width:980px){.advanced-app{grid-template-columns:300px minmax(0,1fr) 250px!important}.advanced-page-sidebar .advanced-trim-inputs{grid-template-columns:1fr 12px 1fr 24px!important}.advanced-page-sidebar .advanced-trim-inputs label{grid-column:1/-1}.advanced-page-sidebar .advanced-trim-auto{grid-column:1/-1!important}}
    @media(max-width:900px){.advanced-app{grid-template-columns:290px minmax(0,1fr) 230px!important}.advanced-page-sidebar .toolbar-actions{grid-template-columns:repeat(2,minmax(0,1fr))!important}.advanced-page-sidebar .advanced-size-block{grid-template-columns:1fr!important}.advanced-page-sidebar .advanced-size-block span{text-align:left!important}}
    @media(max-width:720px){.advanced-app{grid-template-columns:1fr!important}.advanced-page-sidebar{height:420px!important}.advanced-page-sidebar .toolbar-actions{grid-template-columns:repeat(4,minmax(0,1fr))!important}.advanced-page-sidebar .advanced-size-block{grid-template-columns:72px minmax(0,1fr)!important}.advanced-page-sidebar .advanced-size-block span{text-align:right!important}.advanced-page-sidebar .advanced-trim-inputs{grid-template-columns:72px minmax(0,1fr) 12px minmax(0,1fr) 24px!important}.advanced-page-sidebar .advanced-trim-inputs label{grid-column:auto}}
  `;
  document.head.appendChild(style);
}

function moveCanvasHeaderToRightSidebar() {
  const sidebar = document.querySelector('.advanced-page-sidebar');
  const toolbar = document.querySelector('.workspace-toolbar');
  if (!sidebar || !toolbar) return false;

  if (toolbar.parentElement !== sidebar) sidebar.insertBefore(toolbar, sidebar.firstChild);

  const inspector = $('advancedSizeInspector');
  const pageSection = sidebar.querySelector('.page-section');
  if (inspector) {
    if (inspector.parentElement !== sidebar) sidebar.insertBefore(inspector, pageSection || null);
    if (toolbar.nextElementSibling !== inspector) toolbar.insertAdjacentElement('afterend', inspector);
  }

  sidebar.dataset.canvasHeaderMoved = '1';
  return !!inspector;
}

function install() {
  installStyles();
  if (!moveCanvasHeaderToRightSidebar()) {
    let tries = 0;
    const timer = window.setInterval(() => {
      tries += 1;
      if (moveCanvasHeaderToRightSidebar() || tries >= 80) window.clearInterval(timer);
    }, 50);
  }
  window.addEventListener('pdf-advanced-state-change', () => {
    if (document.querySelector('.workspace-toolbar')?.parentElement !== document.querySelector('.advanced-page-sidebar')) {
      moveCanvasHeaderToRightSidebar();
    }
  });
  document.documentElement.dataset.pdfAdvancedRightSidebar = 'workspace-v5';
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', install, { once: true });
else install();
