// Advanced editor shell: headerless two-pane layout + direct X/Y movement sliders.
(function(){
  'use strict';
  if(window.__pdfAdvancedShellLayoutV1)return;
  window.__pdfAdvancedShellLayoutV1=true;

  const root=document.documentElement;
  const path=String(location.pathname||'').replace(/\/+$/,'');
  let queryAdvanced=false;
  try{queryAdvanced=new URLSearchParams(String(location.search||'')).get('profile')==='advanced';}catch(_){}
  const advanced=root.dataset.pdfEditorProfile==='advanced'||path.endsWith('/pdf-editor-advanced')||queryAdvanced;
  if(!advanced)return;

  const byId=id=>document.getElementById(id);
  const clamp=(value,min,max)=>Math.max(min,Math.min(max,Number(value)||0));
  const INSTALL_DELAYS=[0,80,180,360,700,1200,2200,4000];
  let labelObserver=null;
  let syncFrame=0;

  function installStyles(){
    if(byId('pdfAdvancedShellLayoutStylesV1'))return;
    const style=document.createElement('style');
    style.id='pdfAdvancedShellLayoutStylesV1';
    style.textContent=`
      html[data-pdf-editor-profile="advanced"] body{padding-top:0!important;overflow:hidden!important;background:var(--bg,#f4f6f8)!important}
      html[data-pdf-editor-profile="advanced"] .top-nav{display:none!important}
      html[data-pdf-editor-profile="advanced"] .app{grid-template-columns:360px minmax(0,1fr)!important;height:100vh!important;min-height:100vh!important}
      html[data-pdf-editor-profile="advanced"] .app>aside{height:100vh!important;top:0!important;padding:16px!important;background:var(--panel,#fff)!important;border-right:1px solid var(--line,#e5e7eb)!important}
      html[data-pdf-editor-profile="advanced"] .app>main{height:100vh!important;padding:14px!important;gap:10px!important;min-width:0!important}
      html[data-pdf-editor-profile="advanced"] .preview-shell{min-height:0!important;flex:1 1 auto!important}
      #pdfAdvancedSidebarNavV1{display:flex;align-items:center;gap:5px;flex-wrap:wrap;margin:-2px 0 10px;padding-bottom:10px;border-bottom:1px solid #e5e7eb}
      #pdfAdvancedSidebarNavV1 .nav-back,#pdfAdvancedSidebarNavV1 .nav-history-btn,#pdfAdvancedSidebarNavV1 .nav-logout{width:auto!important;min-height:28px!important;align-items:center;justify-content:center;gap:4px;border:1px solid #d7dee8!important;border-radius:7px!important;background:#fff!important;color:#475569!important;padding:5px 8px!important;font:inherit!important;font-size:9px!important;font-weight:850!important;text-decoration:none!important;box-shadow:none!important}
      #pdfAdvancedSidebarNavV1 .nav-back,#pdfAdvancedSidebarNavV1 .nav-logout{display:inline-flex!important}
      #pdfAdvancedSidebarNavV1 .nav-back:hover,#pdfAdvancedSidebarNavV1 .nav-history-btn:hover,#pdfAdvancedSidebarNavV1 .nav-logout:hover{background:#f1f5f9!important;border-color:#94a3b8!important;color:#0f172a!important}
      #pdfAdvancedSidebarNavV1 .nav-logout{margin-left:auto!important}
      html[data-pdf-editor-profile="advanced"] aside>h1{font-size:16px!important;margin-bottom:3px!important;letter-spacing:-.4px!important}
      html[data-pdf-editor-profile="advanced"] aside>.sub{font-size:11px!important;line-height:1.5!important;margin-bottom:12px!important;color:#6b7280!important}
      .pdf-advanced-move-sliders{margin:8px 0 7px;padding:8px;border:1px solid #e2e8f0;border-radius:9px;background:#f8fafc}
      .pdf-advanced-move-title{display:flex;align-items:center;justify-content:space-between;gap:8px;margin-bottom:6px;font-size:9px;font-weight:900;color:#334155}
      .pdf-advanced-move-title span:last-child{font-size:8px;color:#64748b;font-weight:750}
      .pdf-advanced-move-row{display:grid;grid-template-columns:54px minmax(0,1fr) 56px;gap:6px;align-items:center;margin:5px 0}
      .pdf-advanced-move-row label{margin:0!important;font-size:8.5px!important;font-weight:850!important;color:#475569!important;white-space:nowrap}
      .pdf-advanced-move-row input[type="range"]{width:100%;min-width:0;cursor:ew-resize;accent-color:#2563eb}
      .pdf-advanced-move-row[data-axis="y"] input[type="range"]{cursor:ns-resize}
      .pdf-advanced-move-value{font-size:8.5px;font-weight:900;color:#1d4ed8;text-align:right;white-space:nowrap;font-variant-numeric:tabular-nums}
      .pdf-advanced-move-zero{display:flex;justify-content:flex-end;margin-top:4px}
      .pdf-advanced-move-zero button{border:1px solid #cbd5e1;border-radius:6px;background:#fff;color:#475569;padding:4px 7px;font:inherit;font-size:8px;font-weight:850;cursor:pointer}
      .pdf-advanced-move-zero button:hover{background:#eff6ff;border-color:#93c5fd;color:#1d4ed8}
      @media(max-width:900px){
        html[data-pdf-editor-profile="advanced"] body{overflow:auto!important}
        html[data-pdf-editor-profile="advanced"] .app{height:auto!important;min-height:100vh!important;display:block!important}
        html[data-pdf-editor-profile="advanced"] .app>aside,html[data-pdf-editor-profile="advanced"] .app>main{height:auto!important;min-height:0!important}
        #pdfAdvancedSidebarNavV1 .nav-logout{margin-left:0!important}
      }
    `;
    document.head.appendChild(style);
  }

  function relocateHeaderActions(){
    const aside=document.querySelector('.app>aside');
    if(!aside)return false;
    let tools=byId('pdfAdvancedSidebarNavV1');
    if(!tools){
      tools=document.createElement('div');
      tools.id='pdfAdvancedSidebarNavV1';
      const first=aside.firstElementChild;
      if(first)aside.insertBefore(tools,first);else aside.appendChild(tools);
    }
    const nav=document.querySelector('.top-nav');
    const items=[nav?.querySelector('.nav-back'),byId('navSessionBtn'),byId('navSessionLoadBtn'),byId('navLogout')].filter(Boolean);
    items.forEach(node=>{if(node.parentElement!==tools)tools.appendChild(node);});
    if(nav)nav.setAttribute('aria-hidden','true');
    const title=aside.querySelector(':scope>h1');
    const sub=aside.querySelector(':scope>.sub');
    if(title&&title.textContent!=='PDF 고급 편집')title.textContent='PDF 고급 편집';
    if(sub&&sub.textContent!=='파일 업로드 · 페이지 정렬/삭제 · 위치/크기 · 자르기/회전 · PDF 저장')sub.textContent='파일 업로드 · 페이지 정렬/삭제 · 위치/크기 · 자르기/회전 · PDF 저장';
    root.dataset.pdfAdvancedHeaderlessShell='1';
    return true;
  }

  function selectedPage(){
    const hit=document.querySelector('.pdf-nup-adjust-hit[data-selected="true"]');
    const pageId=String(hit?.dataset?.pageId||'');
    let list=[];
    try{list=Array.isArray(window.parsedPages)?window.parsedPages:(typeof parsedPages!=='undefined'&&Array.isArray(parsedPages)?parsedPages:[]);}catch(_){}
    return pageId?list.find(page=>String(page?.id)===pageId)||null:null;
  }

  function placement(){
    const page=selectedPage();
    if(!page)return{page:null,offsetX:0,offsetY:0};
    const api=window.PdfNupPageAdjust;
    const value=typeof api?.valuesForPage==='function'?api.valuesForPage(page):{offsetX:Number(page.nupOffsetX||0),offsetY:Number(page.nupOffsetY||0)};
    return{page,offsetX:Number(value?.offsetX||0),offsetY:Number(value?.offsetY||0)};
  }

  function beginMoveHistory(){
    const page=placement().page;
    const history=window.PdfPrecisionEditTools?.history;
    if(!page||typeof history?.begin!=='function')return;
    try{history.commit?.();history.begin(page,'페이지 위치 이동','range');}catch(_){}
  }

  function commitMoveHistory(){
    try{window.PdfPrecisionEditTools?.history?.commit?.();}catch(_){}
  }

  function writeSlider(axis,value){
    const slider=byId(axis==='x'?'pdfAdvancedMoveXRangeV1':'pdfAdvancedMoveYRangeV1');
    const output=byId(axis==='x'?'pdfAdvancedMoveXValueV1':'pdfAdvancedMoveYValueV1');
    const clean=clamp(value,-200,200);
    if(slider)slider.value=String(clean);
    if(output)output.textContent=`${clean.toFixed(1)} mm`;
  }

  function syncSliders(){
    syncFrame=0;
    const value=placement();
    writeSlider('x',value.offsetX);
    writeSlider('y',value.offsetY);
    const disabled=!value.page;
    ['pdfAdvancedMoveXRangeV1','pdfAdvancedMoveYRangeV1'].forEach(id=>{const input=byId(id);if(input)input.disabled=disabled;});
    root.dataset.pdfAdvancedMoveSliders=disabled?'waiting':'ready';
  }

  function queueSync(){if(!syncFrame)syncFrame=requestAnimationFrame(syncSliders);}

  function applyRange(axis,raw){
    const value=clamp(raw,-200,200);
    const target=byId(axis==='x'?'pdfNupAdjustX':'pdfNupAdjustY');
    if(!target)return;
    target.value=value.toFixed(1);
    writeSlider(axis,value);
    target.dispatchEvent(new Event('input',{bubbles:true}));
  }

  function bindMoveRange(id,axis){
    const slider=byId(id);
    if(!slider)return;
    slider.addEventListener('pointerdown',beginMoveHistory);
    slider.addEventListener('focusin',beginMoveHistory);
    slider.addEventListener('input',event=>applyRange(axis,event.target.value));
    slider.addEventListener('pointerup',()=>setTimeout(commitMoveHistory,0));
    slider.addEventListener('pointercancel',()=>setTimeout(commitMoveHistory,0));
    slider.addEventListener('change',()=>setTimeout(commitMoveHistory,0));
    slider.addEventListener('focusout',()=>setTimeout(commitMoveHistory,0));
  }

  function ensureMoveSliders(){
    const panel=byId('pdfNupPageAdjustPanelV1');
    if(!panel)return false;
    if(byId('pdfAdvancedMoveSlidersV1')){queueSync();return true;}
    const scale=panel.querySelector('.pdf-nup-adjust-scale');
    if(!scale)return false;
    const box=document.createElement('div');
    box.id='pdfAdvancedMoveSlidersV1';
    box.className='pdf-advanced-move-sliders';
    box.innerHTML=`
      <div class="pdf-advanced-move-title"><span>페이지 위치 이동</span><span>가운데 0 mm</span></div>
      <div class="pdf-advanced-move-row" data-axis="x">
        <label for="pdfAdvancedMoveXRangeV1">← 좌 · 우 →</label>
        <input id="pdfAdvancedMoveXRangeV1" type="range" min="-200" max="200" step="0.5" value="0" aria-label="페이지 좌우 이동">
        <span class="pdf-advanced-move-value" id="pdfAdvancedMoveXValueV1">0.0 mm</span>
      </div>
      <div class="pdf-advanced-move-row" data-axis="y">
        <label for="pdfAdvancedMoveYRangeV1">↑ 상 · 하 ↓</label>
        <input id="pdfAdvancedMoveYRangeV1" type="range" min="-200" max="200" step="0.5" value="0" aria-label="페이지 상하 이동">
        <span class="pdf-advanced-move-value" id="pdfAdvancedMoveYValueV1">0.0 mm</span>
      </div>
      <div class="pdf-advanced-move-zero"><button type="button" id="pdfAdvancedMoveCenterV1">위치만 가운데로</button></div>`;
    scale.insertAdjacentElement('afterend',box);
    bindMoveRange('pdfAdvancedMoveXRangeV1','x');
    bindMoveRange('pdfAdvancedMoveYRangeV1','y');
    byId('pdfAdvancedMoveCenterV1')?.addEventListener('click',()=>{
      beginMoveHistory();
      applyRange('x',0);applyRange('y',0);
      setTimeout(commitMoveHistory,0);queueSync();
    });
    ['pdfNupAdjustX','pdfNupAdjustY'].forEach(id=>{
      const input=byId(id);
      if(input&&!input.dataset.advancedMoveSyncBound){
        input.dataset.advancedMoveSyncBound='1';
        const axis=id==='pdfNupAdjustX'?'x':'y';
        const syncFromInput=()=>{writeSlider(axis,input.value);queueSync();};
        input.addEventListener('input',syncFromInput);
        input.addEventListener('change',syncFromInput);
      }
    });
    const label=byId('pdfNupAdjustSelectedLabel');
    if(label&&!labelObserver&&typeof MutationObserver==='function'){
      labelObserver=new MutationObserver(queueSync);
      labelObserver.observe(label,{childList:true,subtree:true,characterData:true});
    }
    queueSync();
    return true;
  }

  function installEvents(){
    if(root.dataset.pdfAdvancedShellEvents==='1')return;
    root.dataset.pdfAdvancedShellEvents='1';
    document.addEventListener('click',event=>{if(event.target?.closest?.('.pdf-nup-adjust-hit,#thumbArea'))setTimeout(queueSync,0);},true);
    document.addEventListener('pointerup',event=>{if(event.target?.closest?.('.pdf-nup-adjust-hit,.pdf-nup-adjust-handle,.pdf-direct-scale-corner,.pdf-direct-crop-edge'))setTimeout(queueSync,0);},true);
    document.addEventListener('pdf-import-committed',()=>setTimeout(()=>{ensureMoveSliders();queueSync();},0));
  }

  function install(){
    root.dataset.pdfEditorProfile='advanced';
    installStyles();
    relocateHeaderActions();
    ensureMoveSliders();
    installEvents();
  }

  window.PdfAdvancedShellLayout={
    install,
    sync:queueSync,
    stage:'headerless-layout-move-sliders-v1'
  };

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install,{once:true});else install();
  INSTALL_DELAYS.forEach(delay=>setTimeout(install,delay));
})();
