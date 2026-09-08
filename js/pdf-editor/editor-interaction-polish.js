// Final PDF editor interaction bridge: asymmetric margins + N-up adjustments,
// number-only sidebar navigation, and predictable resize-handle scaling.
(function(){
  'use strict';
  if(window.__pdfEditorInteractionPolishV1)return;
  window.__pdfEditorInteractionPolishV1=true;

  const smokeHost=document.documentElement.dataset.pdfEditorInteractionPolishHost==='1';
  if(!location.pathname.includes('pdf-editor')&&!smokeHost)return;

  const INSTALL_DELAYS=[0,120,300,650,1200,2200,3800,5600];
  const byId=id=>document.getElementById(id);
  const clamp=(value,min,max)=>Math.max(min,Math.min(max,value));
  const FALLBACK_MARGIN_MM=10*(25.4/72);
  const FALLBACK_GAP_MM=6*(25.4/72);
  let scaleDrag=null;
  let eventsInstalled=false;
  let sidebarObserver=null;
  let sidebarFrame=0;
  let integratedBuildOutputPage=null;
  let integratedBuildAllPages=null;

  function pages(){
    try{return Array.isArray(parsedPages)?parsedPages:[];}catch(_){return[];}
  }

  function pageById(id){
    return pages().find(page=>String(page.id)===String(id))||null;
  }

  function pageValues(page){
    try{
      return window.PdfNupPageAdjust?.valuesForPage?.(page)||{
        scale:Number(page?.nupScale)||1,
        offsetX:Number(page?.nupOffsetX)||0,
        offsetY:Number(page?.nupOffsetY)||0,
      };
    }catch(_){return{scale:1,offsetX:0,offsetY:0};}
  }

  function setPageScale(page,scale){
    const safe=clamp(Number(scale)||1,.5,3);
    try{
      if(typeof window.PdfNupPageAdjust?.setValues==='function'){
        window.PdfNupPageAdjust.setValues(page,{scale:safe});
      }else if(page){
        page.nupScale=safe;
      }
    }catch(_){if(page)page.nupScale=safe;}
    return safe;
  }

  function syncScaleUi(page,scale,direction){
    const percent=Math.round(scale*100);
    const number=byId('pdfNupAdjustScale');
    const range=byId('pdfNupAdjustScaleRange');
    if(number)number.value=String(percent);
    if(range)range.value=String(percent);
    const state=byId('pdfNupAdjustState');
    if(state)state.value='보정 적용';
    const badge=byId('pdfNupAdjustBadge');
    if(badge)badge.textContent='보정됨';
    const hint=scaleDrag?.hit?.querySelector?.('.pdf-nup-direct-edit-hint');
    if(hint)hint.textContent=`${direction==='grow'?'확대':direction==='shrink'?'축소':'크기 조절'} ${percent}%`;
    if(scaleDrag?.hit)scaleDrag.hit.dataset.scaleDirection=direction||'steady';
  }

  function startStableScale(event){
    if(event.button!==0)return;
    const handle=event.target?.closest?.('.pdf-nup-adjust-handle');
    if(!handle)return;
    const hit=handle.closest('.pdf-nup-adjust-hit');
    const page=pageById(hit?.dataset?.pageId);
    if(!hit||!page)return;
    const rect=hit.getBoundingClientRect();
    const centerX=rect.left+rect.width/2;
    const centerY=rect.top+rect.height/2;
    const startDistance=Math.max(24,Math.hypot(event.clientX-centerX,event.clientY-centerY));
    scaleDrag={
      pointerId:event.pointerId,
      page,
      hit,
      centerX,
      centerY,
      startDistance,
      startScale:pageValues(page).scale,
      lastScale:pageValues(page).scale,
    };
  }

  function moveStableScale(event){
    const state=scaleDrag;
    if(!state||event.pointerId!==state.pointerId)return;
    const distance=Math.max(1,Math.hypot(event.clientX-state.centerX,event.clientY-state.centerY));
    const ratio=distance/state.startDistance;
    let next=state.startScale*ratio;
    if(Math.abs(distance-state.startDistance)<2)next=state.startScale;
    next=setPageScale(state.page,next);
    const direction=next>state.startScale+.003?'grow':next<state.startScale-.003?'shrink':'steady';
    state.lastScale=next;
    syncScaleUi(state.page,next,direction);
  }

  function endStableScale(event){
    if(!scaleDrag||event.pointerId!==scaleDrag.pointerId)return;
    const state=scaleDrag;
    syncScaleUi(state.page,state.lastScale,state.lastScale>state.startScale+.003?'grow':state.lastScale<state.startScale-.003?'shrink':'steady');
    if(state.hit)delete state.hit.dataset.scaleDirection;
    scaleDrag=null;
  }

  function rawMargins(outputIndex){
    const layout=window.PdfEditorLayoutExport;
    try{
      if(typeof layout?.layoutMargins==='function'){
        const margins=layout.layoutMargins(outputIndex);
        if(margins&&['left','right','top','bottom'].every(key=>Number.isFinite(Number(margins[key])))){
          return{
            left:Number(margins.left),right:Number(margins.right),
            top:Number(margins.top),bottom:Number(margins.bottom),
          };
        }
      }
    }catch(_){}

    let settings={};
    try{settings=typeof getSettings==='function'?(getSettings()||{}):{};}catch(_){}
    let left=Number(settings.ml??settings.mh??10);
    let right=Number(settings.mr??settings.mh??10);
    const top=Number(settings.mt??settings.mv??10);
    const bottom=Number(settings.mb??settings.mv??10);
    let facing=false;
    try{facing=!!facingPages;}catch(_){facing=!!byId('facingPages')?.checked;}
    if(facing&&Number(outputIndex)%2===1)[left,right]=[right,left];
    return{left,right,top,bottom};
  }

  function renderGeometry(cols,rows,outputIndex){
    let settings={};
    try{settings=typeof getSettings==='function'?(getSettings()||{}):{};}catch(_){}
    const pw=Number(settings.pw)>0?Number(settings.pw):210;
    const ph=Number(settings.ph)>0?Number(settings.ph):297;
    let gap=Number.isFinite(Number(settings.gp))?Number(settings.gp):5;
    let margins=rawMargins(outputIndex);
    let usableW=pw-margins.left-margins.right-gap*(cols-1);
    let usableH=ph-margins.top-margins.bottom-gap*(rows-1);
    if(usableW<=1||usableH<=1){
      margins={left:FALLBACK_MARGIN_MM,right:FALLBACK_MARGIN_MM,top:FALLBACK_MARGIN_MM,bottom:FALLBACK_MARGIN_MM};
      gap=FALLBACK_GAP_MM;
      usableW=pw-margins.left-margins.right-gap*(cols-1);
      usableH=ph-margins.top-margins.bottom-gap*(rows-1);
    }
    return{pw,ph,gap,margins,cellW:usableW/cols,cellH:usableH/rows};
  }

  function isAdjusted(page){
    const value=pageValues(page);
    return Math.abs(value.scale-1)>.0001||Math.abs(value.offsetX)>.0001||Math.abs(value.offsetY)>.0001;
  }

  function buildIntegratedOutputPage(groupPages,pageIdx,cols,rows,mm2px,useHi,outputPageIndex){
    const ppm=Number(mm2px)>0?Number(mm2px):(96/25.4);
    const outputIndex=Number.isInteger(Number(outputPageIndex))?Number(outputPageIndex):Number(pageIdx)||0;
    const geometry=renderGeometry(Math.max(1,Number(cols)||1),Math.max(1,Number(rows)||1),outputIndex);
    const output=document.createElement('canvas');
    output.width=Math.max(1,Math.round(geometry.pw*ppm));
    output.height=Math.max(1,Math.round(geometry.ph*ppm));
    output.dataset.marginLeftMm=String(geometry.margins.left);
    output.dataset.marginRightMm=String(geometry.margins.right);
    output.dataset.marginTopMm=String(geometry.margins.top);
    output.dataset.marginBottomMm=String(geometry.margins.bottom);
    output.dataset.gapMm=String(geometry.gap);
    try{
      const layout=window.PdfEditorLayoutExport;
      output.dataset.pageNumberAutoReserve=String(!!layout?.pageNumberAutoReserveEnabled?.()&&!!layout?.pageNumberApplies?.(outputIndex));
    }catch(_){output.dataset.pageNumberAutoReserve='false';}
    const ctx=output.getContext('2d',{alpha:false});
    ctx.fillStyle='#fff';
    ctx.fillRect(0,0,output.width,output.height);
    const perPage=Math.max(1,Number(cols||1)*Number(rows||1));
    for(let slot=0;slot<perPage;slot+=1){
      const sourceIndex=(Number(pageIdx)||0)*perPage+slot;
      if(sourceIndex>=groupPages.length)break;
      let column,row;
      let rowMajor=true;
      try{rowMajor=typeof orderLR==='undefined'?true:!!orderLR;}catch(_){}
      if(rowMajor){column=slot%cols;row=Math.floor(slot/cols);}
      else{column=Math.floor(slot/rows);row=slot%rows;}
      const cellX=(geometry.margins.left+column*(geometry.cellW+geometry.gap))*ppm;
      const cellY=(geometry.margins.top+row*(geometry.cellH+geometry.gap))*ppm;
      const cellW=geometry.cellW*ppm;
      const cellH=geometry.cellH*ppm;
      const page=groupPages[sourceIndex];
      let src=null;
      try{src=typeof getPageSrc==='function'?getPageSrc(page,ppm,useHi):page?.thumbCanvas;}catch(_){src=page?.thumbCanvas;}
      if(!src)continue;
      const value=pageValues(page);
      if(!isAdjusted(page)){
        drawPageInCell(ctx,src,cellX,cellY,cellW,cellH);
        continue;
      }
      const drawW=cellW*value.scale;
      const drawH=cellH*value.scale;
      const drawX=cellX+(cellW-drawW)/2+value.offsetX*ppm;
      const drawY=cellY+(cellH-drawH)/2+value.offsetY*ppm;
      ctx.save();
      ctx.beginPath();
      ctx.rect(cellX,cellY,cellW,cellH);
      ctx.clip();
      try{drawPageInCell(ctx,src,drawX,drawY,drawW,drawH);}
      finally{ctx.restore();}
    }
    return output;
  }

  async function buildIntegratedAllPages(mm2px,useHi,overridePages){
    let active=[];
    try{active=overridePages||parsedPages.filter(page=>!page.excluded);}catch(_){active=overridePages||[];}
    const output=[];
    if(typeof groupByNup!=='function'||typeof getLayout!=='function')return output;
    for(const group of groupByNup(active)){
      const layout=getLayout(group.n)||{};
      const cols=Math.max(1,Number(layout.cols)||1);
      const rows=Math.max(1,Number(layout.rows)||1);
      const perPage=cols*rows;
      for(let pageIndex=0;pageIndex<Math.ceil(group.pages.length/perPage);pageIndex+=1){
        const canvas=buildIntegratedOutputPage(group.pages,pageIndex,cols,rows,mm2px,useHi,output.length);
        output.push(canvas);
        await new Promise(resolve=>setTimeout(resolve,0));
      }
    }
    output.forEach((canvas,index)=>{
      try{if(typeof applyDocEdits==='function')applyDocEdits(canvas,index,output.length,mm2px);}catch(error){console.warn('[pdf-polish] document overlay failed',index,error);}
    });
    return output;
  }

  function installIntegratedBuilder(){
    if(typeof window.drawPageInCell!=='function'&&typeof drawPageInCell!=='function')return false;
    if(typeof window.PdfEditorLayoutExport?.layoutMargins!=='function')return false;
    if(typeof window.groupByNup!=='function'&&typeof groupByNup!=='function')return false;

    if(!integratedBuildOutputPage){
      integratedBuildOutputPage=buildIntegratedOutputPage;
      integratedBuildOutputPage.__pdfNupPageAdjustWrappedV1=true;
      integratedBuildOutputPage.__pdfMarginNupIntegratedV1=true;
    }
    if(!integratedBuildAllPages){
      integratedBuildAllPages=buildIntegratedAllPages;
      integratedBuildAllPages.__pdfMarginNupIntegratedV1=true;
    }
    if(window.buildOutputPage!==integratedBuildOutputPage){
      window.buildOutputPage=integratedBuildOutputPage;
      try{buildOutputPage=integratedBuildOutputPage;}catch(_){}
    }
    if(window.buildAllPages!==integratedBuildAllPages){
      window.buildAllPages=integratedBuildAllPages;
      try{buildAllPages=integratedBuildAllPages;}catch(_){}
    }
    document.documentElement.dataset.pdfMarginNupIntegrated='1';
    return true;
  }

  function installStyles(){
    if(byId('pdfPageNumberOnlySidebarStylesV1'))return;
    const style=document.createElement('style');
    style.id='pdfPageNumberOnlySidebarStylesV1';
    style.textContent=`
      body[data-program-kind="pdf-editor"] #thumbArea{display:grid!important;grid-template-columns:repeat(auto-fill,minmax(42px,1fr))!important;gap:5px!important;align-items:start!important}
      body[data-program-kind="pdf-editor"] #thumbArea>.thumb-file-sep{grid-column:1/-1!important;margin:5px 0 1px!important}
      body[data-program-kind="pdf-editor"] #thumbArea>.thumb-item{width:auto!important;min-width:0!important;margin:0!important;padding:0!important;display:block!important}
      body[data-program-kind="pdf-editor"] #thumbArea .thumb-wrap{width:100%!important;height:34px!important;min-height:34px!important;aspect-ratio:auto!important;display:flex!important;align-items:center!important;justify-content:center!important;padding:0!important;border:1px solid #cbd5e1!important;border-radius:7px!important;background:#fff!important;box-shadow:none!important;overflow:hidden!important;cursor:pointer!important}
      body[data-program-kind="pdf-editor"] #thumbArea .thumb-wrap>*:not(.thumb-num){display:none!important}
      body[data-program-kind="pdf-editor"] #thumbArea .thumb-num{position:static!important;inset:auto!important;width:auto!important;height:auto!important;min-width:0!important;margin:0!important;padding:0!important;border:0!important;background:transparent!important;color:#334155!important;font-size:10px!important;font-weight:900!important;line-height:1!important;transform:none!important}
      body[data-program-kind="pdf-editor"] #thumbArea .thumb-wrap.excluded{opacity:.42!important;text-decoration:line-through!important;background:#f1f5f9!important}
      body[data-program-kind="pdf-editor"] #thumbArea .thumb-wrap[data-sidebar-current="true"],body[data-program-kind="pdf-editor"] #thumbArea .thumb-item[data-file-nav-current="true"] .thumb-wrap{border-color:#2563eb!important;background:#eff6ff!important;box-shadow:0 0 0 2px rgba(37,99,235,.13)!important}
      body[data-program-kind="pdf-editor"] .thumb-hint{font-size:9px!important;color:#64748b!important}
    `;
    document.head.appendChild(style);
  }

  function simplifySidebar(){
    installStyles();
    const area=byId('thumbArea');
    if(!area)return false;
    const total=pages().length;
    if(area.dataset.numberOnlyNavigation!=='true')area.dataset.numberOnlyNavigation='true';
    area.querySelectorAll('.thumb-item').forEach((item,index)=>{
      const pageNumber=String(index+1);
      item.draggable=false;
      if(item.getAttribute('draggable')!=='false')item.setAttribute('draggable','false');
      if(item.dataset.pageNumber!==pageNumber)item.dataset.pageNumber=pageNumber;
      const wrap=item.querySelector('.thumb-wrap');
      if(!wrap)return;
      const num=wrap.querySelector('.thumb-num');
      if(num&&num.textContent!==pageNumber)num.textContent=pageNumber;
      if(wrap.getAttribute('role')!=='button')wrap.setAttribute('role','button');
      const aria=`${pageNumber}페이지 미리보기 화면으로 이동`;
      if(wrap.getAttribute('aria-label')!==aria)wrap.setAttribute('aria-label',aria);
      const title=`${pageNumber}페이지 · 클릭하면 오른쪽 미리보기 화면으로 이동`;
      if(wrap.title!==title)wrap.title=title;
    });
    const hint=document.querySelector('.thumb-hint');
    const hintText='페이지 번호 클릭 = 오른쪽 미리보기 화면으로 이동 · 편집은 미리보기 화면에서 합니다.';
    if(hint&&hint.textContent!==hintText)hint.textContent=hintText;
    const title=byId('thumbSection')?.querySelector('.sec-title');
    const titleText=total?`페이지 목록 · ${total}p`:'페이지 목록';
    if(title&&title.textContent!==titleText)title.textContent=titleText;
    if(document.body?.getAttribute('data-pdf-sidebar-page-mode')!=='number-only')document.body?.setAttribute('data-pdf-sidebar-page-mode','number-only');
    return true;
  }

  function queueSidebar(){
    if(sidebarFrame)return;
    sidebarFrame=requestAnimationFrame(()=>{sidebarFrame=0;simplifySidebar();});
  }

  function blockSidebarEditing(event){
    const area=byId('thumbArea');
    if(!area||!event.target?.closest?.('#thumbArea .thumb-item'))return;
    if(event.type==='contextmenu'||event.type==='dragstart'){
      event.preventDefault();
      event.stopImmediatePropagation();
      event.stopPropagation();
    }
  }

  function installSidebarObserver(){
    const area=byId('thumbArea');
    if(!area||typeof MutationObserver!=='function')return false;
    if(sidebarObserver)return true;
    sidebarObserver=new MutationObserver(queueSidebar);
    // renderThumbs() replaces top-level children. Observe only those replacements;
    // observing the subtree made our own page-number text updates feed back forever.
    sidebarObserver.observe(area,{childList:true});
    return true;
  }

  function installEvents(){
    if(eventsInstalled)return;
    eventsInstalled=true;
    document.addEventListener('pointerdown',startStableScale,true);
    document.addEventListener('pointermove',moveStableScale,true);
    document.addEventListener('pointerup',endStableScale,true);
    document.addEventListener('pointercancel',endStableScale,true);
    document.addEventListener('contextmenu',blockSidebarEditing,true);
    document.addEventListener('dragstart',blockSidebarEditing,true);
    document.addEventListener('pdf-import-committed',()=>{queueSidebar();installIntegratedBuilder();});
    ['input','change'].forEach(type=>document.addEventListener(type,event=>{
      if(['marginLeft','marginRight','marginTop','marginBottom','facingPages'].includes(event.target?.id||'')){
        installIntegratedBuilder();
      }
    },true));
  }

  function install(){
    installEvents();
    installStyles();
    installSidebarObserver();
    simplifySidebar();
    installIntegratedBuilder();
  }

  window.PdfEditorInteractionPolish={
    rawMargins,
    renderGeometry,
    buildOutputPage:buildIntegratedOutputPage,
    buildAllPages:buildIntegratedAllPages,
    simplifySidebar,
    installIntegratedBuilder,
    stage:'margin-nup-number-sidebar-radial-scale-v1',
  };

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install,{once:true});
  else install();
  for(const delay of INSTALL_DELAYS)setTimeout(install,delay);
})();