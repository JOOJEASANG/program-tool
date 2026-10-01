const $ = id => document.getElementById(id);

function installStyles() {
  if ($('pdfAdvancedPageGridV10Styles')) return;
  const style = document.createElement('style');
  style.id = 'pdfAdvancedPageGridV10Styles';
  style.textContent = `
    .advanced-page-sidebar .page-list{
      grid-template-columns:repeat(2,minmax(0,1fr))!important;
      gap:8px!important;
      align-content:start!important;
    }
    .advanced-page-sidebar .page-item{
      width:auto!important;
      min-width:0!important;
      padding:6px!important;
      gap:5px!important;
      border-radius:10px!important;
    }
    .advanced-page-sidebar .page-item canvas.page-sidebar-thumb{
      display:block!important;
      width:100%!important;
      height:auto!important;
      max-width:100%!important;
      margin:0 auto!important;
      object-fit:contain!important;
      background:#fff!important;
      border:1px solid #e2e8f0!important;
      border-radius:5px!important;
    }
    .advanced-page-sidebar .page-item-info{
      width:100%!important;
      text-align:center!important;
      line-height:1.2!important;
    }
    .advanced-page-sidebar .page-item-info strong{
      font-size:9px!important;
      line-height:1.25!important;
    }
    .advanced-page-sidebar .page-remove{
      right:5px!important;
      top:5px!important;
      width:21px!important;
      height:21px!important;
      font-size:12px!important;
    }
    .advanced-page-sidebar .page-item.selected{
      border-color:#2563eb!important;
      box-shadow:inset 0 0 0 1px #2563eb!important;
    }

    /* 편집 캔버스에는 실제 재단사이즈 가이드만 표시한다. */
    #advancedActualGuide,
    .advanced-size-guide.actual{
      display:none!important;
    }

    @media(max-width:900px){
      .advanced-page-sidebar .page-list{grid-template-columns:repeat(2,minmax(0,1fr))!important}
    }
    @media(max-width:720px){
      .advanced-page-sidebar .page-list{grid-template-columns:repeat(2,minmax(0,1fr))!important}
    }
  `;
  document.head.appendChild(style);
  document.documentElement.dataset.pdfAdvancedPageGrid = 'two-column-v10';
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', installStyles, { once: true });
else installStyles();
