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

    /* 원본 파일 외곽 가이드는 캔버스에서 숨기고 재단 가이드만 유지한다. */
    #advancedActualGuide,
    .advanced-size-guide.actual{
      display:none!important;
    }

    /* 캔버스 안 라벨은 제거하고 의미/수치는 아래 상태바에 분리 표시한다. */
    .advanced-size-guide-label{
      display:none!important;
    }
    .advanced-canvas-statusbar .advanced-guide-status{
      position:relative!important;
      padding-left:24px!important;
      gap:5px!important;
    }
    .advanced-canvas-statusbar .advanced-guide-status::before{
      content:"";
      position:absolute;
      left:0;
      top:50%;
      width:17px;
      border-top:2px solid currentColor;
      transform:translateY(-50%);
    }
    .advanced-canvas-statusbar .advanced-guide-status.actual{
      color:#2563eb!important;
    }
    .advanced-canvas-statusbar .advanced-guide-status.trim{
      color:#dc2626!important;
    }
    .advanced-canvas-statusbar .advanced-guide-status.actual strong,
    .advanced-canvas-statusbar .advanced-guide-status.trim strong{
      color:currentColor!important;
    }
    .advanced-canvas-statusbar .advanced-guide-status span{
      color:#334155!important;
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

function decorateStatusBar() {
  const bar = $('advancedCanvasStatusBar');
  if (!bar) return false;
  const blocks = [...bar.querySelectorAll('.advanced-size-block')];
  const actual = blocks[0];
  const trim = blocks[1];
  if (!actual || !trim) return false;

  actual.classList.add('advanced-guide-status', 'actual');
  trim.classList.add('advanced-guide-status', 'trim');
  const actualTitle = actual.querySelector('strong');
  const trimTitle = trim.querySelector('strong');
  if (actualTitle) actualTitle.textContent = '원본파일';
  if (trimTitle) trimTitle.textContent = '재단사이즈';
  bar.dataset.guideLegend = 'statusbar-v1';
  return true;
}

function install() {
  installStyles();
  if (decorateStatusBar()) return;
  let tries = 0;
  const timer = window.setInterval(() => {
    tries += 1;
    if (decorateStatusBar() || tries >= 80) window.clearInterval(timer);
  }, 50);
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', install, { once: true });
else install();
