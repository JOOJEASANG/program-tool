// Three-pane workspace composition for the PDF editor.
(function(){
  'use strict';
  if(window.__pdfEditorWorkspaceLayoutV1)return;
  window.__pdfEditorWorkspaceLayoutV1=true;

  const path=(location.pathname||'/').replace(/\/+$/,'')||'/';
  if(path!=='/pdf-editor'&&path!=='/pdf-editor/index.html'&&!path.endsWith('/pdf-editor/index.html'))return;

  const byId=id=>document.getElementById(id);
  function sectionByKey(key){return document.querySelector(`.sec-head[data-sec="${key}"]`)?.closest('.sec')||null;}
  function outputSection(){return byId('downloadBtn')?.closest('.sec')||null;}

  function installStyles(){
    if(byId('pdfWorkspaceLayoutStyles'))return;
    const style=document.createElement('style');
    style.id='pdfWorkspaceLayoutStyles';
    style.textContent=`
      body[data-pdf-workspace="three-pane"] .app{grid-template-columns:320px minmax(0,1fr) 302px!important;background:#e9eef2!important}
      body[data-pdf-workspace="three-pane"] .app>aside:first-of-type{width:auto!important;min-width:0;border-right:1px solid #dbe4ec!important;border-left:0!important}
      body[data-pdf-workspace="three-pane"] .app>main{grid-column:2;min-width:0}
      .pdf-output-rail{grid-column:3;grid-row:1;min-width:0;height:100%;overflow-y:auto;padding:12px!important;background:#f7f9fb!important;border-left:1px solid #dbe4ec!important;border-right:0!important;position:relative!important;top:auto!important;scrollbar-gutter:stable}
      .pdf-output-rail-head{margin:1px 1px 10px;padding:10px 10px 9px;border:1px solid #d9e3ec;border-radius:11px;background:linear-gradient(180deg,#fff,#f7fafc)}
      .pdf-output-rail-head strong{display:block;color:#17324f;font-size:12px;font-weight:950;letter-spacing:-.1px}
      .pdf-output-rail-head span{display:block;margin-top:4px;color:#748194;font-size:8.8px;line-height:1.5}
      .pdf-output-rail .sec{margin-bottom:8px!important;border:1px solid #dde5ed!important;border-radius:11px!important;background:#fff!important;overflow:hidden!important;box-shadow:0 1px 2px rgba(15,23,42,.025)!important}
      .pdf-output-rail .sec-head{padding:10px 11px!important;background:#fff!important}
      .pdf-output-rail .sec-body{padding:0 11px 11px!important}
      .pdf-output-rail [data-workspace-output="save"]{border-color:#b8d8ce!important}
      .pdf-output-rail [data-workspace-output="save"]>.sec-head{background:#f5fbf8!important}
      .pdf-output-rail [data-workspace-output="save"] .sec-title{color:#12624f!important}
      @media(max-width:1260px){body[data-pdf-workspace="three-pane"] .app{grid-template-columns:296px minmax(0,1fr) 282px!important}}
      @media(max-width:980px){
        body[data-pdf-workspace="three-pane"]{overflow:auto!important}
        body[data-pdf-workspace="three-pane"] .app{grid-template-columns:1fr!important;height:auto!important;min-height:100vh!important}
        body[data-pdf-workspace="three-pane"] .app>aside:first-of-type,body[data-pdf-workspace="three-pane"] .app>main,.pdf-output-rail{grid-column:1!important;grid-row:auto!important;width:100%!important;height:auto!important;position:relative!important;overflow:visible!important}
        .pdf-output-rail{border-left:0!important;border-top:1px solid #dbe4ec!important}
      }
    `;
    document.head.appendChild(style);
  }

  function ensureRail(){
    const app=document.querySelector('.app');
    const main=app?.querySelector('main');
    const left=app?.querySelector('aside');
    if(!app||!main||!left)return null;
    installStyles();
    let rail=byId('pdfOutputRail');
    if(!rail){
      rail=document.createElement('aside');
      rail.id='pdfOutputRail';
      rail.className='pdf-output-rail';
      rail.setAttribute('aria-label','출력 설정');
      rail.innerHTML='<div class="pdf-output-rail-head"><strong>출력 설정</strong><span>용지와 여백을 정하고 필요한 꾸미기만 선택한 뒤 PDF를 저장하세요.</span></div>';
      app.appendChild(rail);
    }
    const paper=sectionByKey('paper'),edit=sectionByKey('edit'),output=outputSection();
    if(paper&&paper.parentElement!==rail)rail.appendChild(paper);
    if(edit&&edit.parentElement!==rail)rail.appendChild(edit);
    if(output){output.dataset.workspaceOutput='save';if(output.parentElement!==rail)rail.appendChild(output);}
    document.body.dataset.pdfWorkspace='three-pane';
    document.documentElement.dataset.pdfWorkspaceLayout='1';
    return rail;
  }

  let frame=0;
  function sync(){ensureRail();}
  function queueSync(){if(frame)return;frame=requestAnimationFrame(()=>{frame=0;sync();});}
  function boot(){
    sync();
    if(typeof MutationObserver==='function')new MutationObserver(records=>{
      if(records.some(record=>[...record.addedNodes].some(node=>node?.nodeType===1)))queueSync();
    }).observe(document.body,{childList:true,subtree:true});
    [80,220,600,1200].forEach(delay=>setTimeout(queueSync,delay));
  }

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
  window.PdfEditorWorkspaceLayout={sync,stage:'three-pane-output-settings-v1'};
})();