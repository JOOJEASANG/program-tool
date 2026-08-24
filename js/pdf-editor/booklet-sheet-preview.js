// Program Studio booklet physical sheet preview.
// Groups the editor's existing booklet-imposed output sides into real paper sheets.
(function(){
  'use strict';
  if(window.__pdfBookletSheetPreviewV1)return;
  window.__pdfBookletSheetPreviewV1=true;

  const BUTTON_ID='bookletSheetPreviewButton';
  const PANEL_ID='bookletSheetPreviewPanel';
  const STYLE_ID='bookletSheetPreviewStyles';
  const SUPPORTED_NUP=new Set([2,4,6,8]);
  let panelOpen=false;
  let triggerPatched=false;
  let eventsBound=false;
  let attempts=0;

  const $=id=>document.getElementById(id);

  function getPages(){
    try{return Array.isArray(parsedPages)?parsedPages:[];}catch(_){return [];}
  }

  function getPreviewCanvases(){
    try{return Array.isArray(previewCanvases)?previewCanvases:[];}catch(_){return [];}
  }

  function getNup(){
    const active=document.querySelector('.nup-btn.active[data-nup]');
    const value=Number(active?.dataset?.nup||0);
    if(SUPPORTED_NUP.has(value))return value;
    try{
      const current=Number(nup||0);
      return SUPPORTED_NUP.has(current)?current:0;
    }catch(_){return 0;}
  }

  function isBookletEnabled(){
    return !!$('bookletCheck')?.checked&&SUPPORTED_NUP.has(getNup());
  }

  function splitLabel(page){
    if(page?.splitSide==='left')return ' · 왼쪽 절반';
    if(page?.splitSide==='right')return ' · 오른쪽 절반';
    return '';
  }

  function pageTypeLabel(page){
    if(page?.pageType==='divider')return '구분지';
    return '';
  }

  function buildPlan(){
    const pages=getPages();
    const nupValue=getNup();
    if(!isBookletEnabled()||!pages.length||!nupValue)return null;

    const active=pages.filter(page=>!page?.excluded);
    if(!active.length)return null;
    let imposed;
    try{
      if(typeof bookletReorderPreview!=='function')return null;
      imposed=bookletReorderPreview(active,nupValue);
    }catch(error){
      console.warn('[booklet-sheet-preview] impose plan failed',error);
      return null;
    }
    if(!Array.isArray(imposed)||!imposed.length)return null;

    const logicalNumbers=new Map();
    active.forEach((page,index)=>logicalNumbers.set(page,index+1));
    const sides=[];
    for(let offset=0;offset<imposed.length;offset+=nupValue){
      const slots=imposed.slice(offset,offset+nupValue).map((page,slotIndex)=>{
        const blank=page?.pageType==='blank';
        const logicalNumber=blank?null:(logicalNumbers.get(page)||null);
        const strip=Math.floor(slotIndex/2)+1;
        const position=slotIndex%2===0?'left':'right';
        return {page,blank,logicalNumber,slotIndex,strip,position};
      });
      sides.push({
        index:sides.length,
        face:sides.length%2===0?'front':'back',
        sheetIndex:Math.floor(sides.length/2),
        slots,
      });
    }

    const sheets=[];
    for(let i=0;i<sides.length;i+=2){
      sheets.push({index:sheets.length,front:sides[i]||null,back:sides[i+1]||null});
    }
    const blankCount=sides.reduce((sum,side)=>sum+side.slots.filter(slot=>slot.blank).length,0);
    return {nup:nupValue,active,imposed,sides,sheets,blankCount};
  }

  function slotText(slot,nupValue){
    const position=slot.position==='left'?'왼쪽':'오른쪽';
    const row=nupValue>2?`${slot.strip}줄 `:'';
    if(slot.blank)return `${row}${position} · 빈쪽`;
    const type=pageTypeLabel(slot.page);
    const pageLabel=slot.logicalNumber?`${slot.logicalNumber}쪽`:(type||'페이지');
    return `${row}${position} · ${pageLabel}${type&&slot.logicalNumber?` · ${type}`:''}${splitLabel(slot.page)}`;
  }

  function clonePreviewCanvas(source){
    if(!source||!source.width||!source.height)return null;
    const canvas=document.createElement('canvas');
    const maxWidth=560;
    const scale=Math.min(1,maxWidth/source.width);
    canvas.width=Math.max(1,Math.round(source.width*scale));
    canvas.height=Math.max(1,Math.round(source.height*scale));
    const ctx=canvas.getContext('2d');
    ctx.fillStyle='#fff';
    ctx.fillRect(0,0,canvas.width,canvas.height);
    ctx.drawImage(source,0,0,canvas.width,canvas.height);
    canvas.className='booklet-sheet-canvas';
    return canvas;
  }

  function renderSchematic(side,nupValue){
    const grid=document.createElement('div');
    grid.className='booklet-sheet-schematic';
    grid.style.gridTemplateRows=`repeat(${Math.max(1,nupValue/2)},1fr)`;
    side.slots.forEach(slot=>{
      const cell=document.createElement('div');
      cell.className='booklet-sheet-cell'+(slot.blank?' blank':'');
      cell.innerHTML=slot.blank
        ? '<span class="booklet-sheet-cell-page">빈쪽</span><span class="booklet-sheet-cell-pos">자동 보충</span>'
        : `<span class="booklet-sheet-cell-page">${slot.logicalNumber||'·'}쪽</span><span class="booklet-sheet-cell-pos">${slot.position==='left'?'왼쪽':'오른쪽'}${splitLabel(slot.page)}</span>`;
      grid.appendChild(cell);
    });
    return grid;
  }

  function renderSide(side,plan){
    const wrap=document.createElement('section');
    wrap.className='booklet-sheet-side';
    const face=side.face==='front'?'앞면':'뒷면';
    wrap.innerHTML=`<div class="booklet-sheet-side-head"><strong>${face}</strong><span>출력면 ${side.index+1}</span></div>`;

    const previews=getPreviewCanvases();
    const actual=clonePreviewCanvas(previews[side.index]);
    const viewport=document.createElement('div');
    viewport.className='booklet-sheet-visual';
    if(actual){
      viewport.appendChild(actual);
      const badge=document.createElement('span');
      badge.className='booklet-sheet-actual-badge';
      badge.textContent='실제 출력 미리보기';
      viewport.appendChild(badge);
    }else{
      viewport.appendChild(renderSchematic(side,plan.nup));
    }
    wrap.appendChild(viewport);

    const slots=document.createElement('div');
    slots.className='booklet-sheet-slots';
    side.slots.forEach(slot=>{
      const item=document.createElement('div');
      item.className='booklet-sheet-slot'+(slot.blank?' blank':'');
      item.textContent=slotText(slot,plan.nup);
      slots.appendChild(item);
    });
    wrap.appendChild(slots);
    return wrap;
  }

  function renderPanel(){
    const panel=$(PANEL_ID);
    if(!panel||!panelOpen)return;
    const plan=buildPlan();
    if(!plan){
      panel.innerHTML='<div class="booklet-sheet-empty">소책자 모드를 켜고 PDF 페이지를 준비하면 실제 용지 앞·뒷면 구성이 표시됩니다.</div>';
      return;
    }

    panel.innerHTML='';
    const head=document.createElement('div');
    head.className='booklet-sheet-panel-head';
    head.innerHTML=`
      <div>
        <div class="booklet-sheet-title">실제 용지 앞·뒷면</div>
        <div class="booklet-sheet-summary">논리 ${plan.active.length}쪽 · 실제 종이 ${plan.sheets.length}장 · 출력면 ${plan.sides.length}면 · 빈쪽 ${plan.blankCount}쪽</div>
      </div>
      <button type="button" class="booklet-sheet-close" aria-label="용지 미리보기 닫기">닫기</button>`;
    panel.appendChild(head);

    const notice=document.createElement('div');
    notice.className='booklet-sheet-notice';
    notice.innerHTML='<strong>보는 법</strong> 같은 카드 안의 앞면과 뒷면이 실제 종이 한 장입니다. 프린터의 긴변/짧은변 넘김 설정은 기종과 급지 방향에 따라 달라질 수 있으므로 첫 출력은 1부 샘플 확인을 권장합니다.';
    panel.appendChild(notice);

    const list=document.createElement('div');
    list.className='booklet-sheet-list';
    plan.sheets.forEach(sheet=>{
      const card=document.createElement('article');
      card.className='booklet-sheet-card';
      const cardHead=document.createElement('div');
      cardHead.className='booklet-sheet-card-head';
      cardHead.innerHTML=`<strong>용지 ${sheet.index+1}</strong><span>${plan.nup}면 배치 · 앞/뒤 한 장</span>`;
      card.appendChild(cardHead);
      const pair=document.createElement('div');
      pair.className='booklet-sheet-pair';
      if(sheet.front)pair.appendChild(renderSide(sheet.front,plan));
      if(sheet.back)pair.appendChild(renderSide(sheet.back,plan));
      card.appendChild(pair);
      list.appendChild(card);
    });
    panel.appendChild(list);
    head.querySelector('.booklet-sheet-close')?.addEventListener('click',()=>setOpen(false));
  }

  async function setOpen(open){
    panelOpen=!!open;
    const button=$(BUTTON_ID);
    const panel=$(PANEL_ID);
    if(button)button.setAttribute('aria-expanded',panelOpen?'true':'false');
    if(panel)panel.hidden=!panelOpen;
    if(!panelOpen)return;

    const previews=getPreviewCanvases();
    if(!previews.length&&typeof triggerPreview==='function'){
      try{await triggerPreview();}catch(error){console.warn('[booklet-sheet-preview] preview refresh failed',error);}
    }
    renderPanel();
  }

  function syncVisibility(){
    const button=$(BUTTON_ID);
    const available=isBookletEnabled()&&getPages().some(page=>!page?.excluded);
    if(button)button.hidden=!available;
    if(!available&&panelOpen)setOpen(false);
    else if(available&&panelOpen)renderPanel();
  }

  function installStyles(){
    if($(STYLE_ID))return;
    const style=document.createElement('style');
    style.id=STYLE_ID;
    style.textContent=`
      .booklet-sheet-preview-btn{border:1px solid #b8c8dc;border-radius:7px;background:#fff;color:#12396d;padding:4px 8px;font:800 10px/1.2 inherit;cursor:pointer;white-space:nowrap}.booklet-sheet-preview-btn:hover{background:#eef5ff;border-color:#7ea1ca}.booklet-sheet-preview-btn[aria-expanded="true"]{background:#12396d;color:#fff;border-color:#12396d}
      .booklet-sheet-preview-panel{background:#f8fafc;border:1px solid #cbd5e1;border-radius:11px;padding:10px;max-height:48vh;overflow:auto;flex-shrink:0}.booklet-sheet-panel-head{display:flex;align-items:flex-start;justify-content:space-between;gap:12px;margin-bottom:7px}.booklet-sheet-title{font-size:13px;font-weight:950;color:#18324e}.booklet-sheet-summary{margin-top:2px;font-size:10px;font-weight:750;color:#64748b}.booklet-sheet-close{border:1px solid #cbd5e1;border-radius:6px;background:#fff;color:#475569;padding:4px 8px;font:800 10px inherit;cursor:pointer}
      .booklet-sheet-notice{font-size:9px;line-height:1.5;color:#475569;background:#fff7ed;border:1px solid #fed7aa;border-radius:8px;padding:6px 8px;margin-bottom:8px}.booklet-sheet-list{display:grid;gap:9px}.booklet-sheet-card{border:1px solid #d8e1eb;border-radius:10px;background:#fff;padding:8px}.booklet-sheet-card-head{display:flex;align-items:center;justify-content:space-between;gap:8px;margin-bottom:7px;font-size:10px;color:#64748b}.booklet-sheet-card-head strong{font-size:11px;color:#1f3a55}.booklet-sheet-pair{display:grid;grid-template-columns:1fr 1fr;gap:8px}.booklet-sheet-side{min-width:0;border:1px solid #e2e8f0;border-radius:8px;background:#f8fafc;padding:6px}.booklet-sheet-side-head{display:flex;align-items:center;justify-content:space-between;gap:6px;margin-bottom:5px;font-size:9px;color:#64748b}.booklet-sheet-side-head strong{font-size:10px;color:#0f3b64}.booklet-sheet-visual{position:relative;background:#d9dee6;border-radius:6px;min-height:90px;display:flex;align-items:center;justify-content:center;overflow:hidden;padding:5px}.booklet-sheet-canvas{display:block;max-width:100%;max-height:185px;width:auto;height:auto;box-shadow:0 1px 5px rgba(15,23,42,.18);background:#fff}.booklet-sheet-actual-badge{position:absolute;right:6px;bottom:6px;border-radius:999px;background:#0f766ecc;color:#fff;padding:2px 6px;font-size:8px;font-weight:900}.booklet-sheet-schematic{display:grid;grid-template-columns:1fr 1fr;width:100%;aspect-ratio:1.414/1;gap:2px;background:#b8c2cf;padding:2px}.booklet-sheet-cell{display:flex;flex-direction:column;align-items:center;justify-content:center;background:#fff;min-width:0}.booklet-sheet-cell.blank{background:#f1f5f9;color:#94a3b8}.booklet-sheet-cell-page{font-size:11px;font-weight:950}.booklet-sheet-cell-pos{font-size:7px;margin-top:2px;color:#64748b}.booklet-sheet-slots{display:grid;grid-template-columns:1fr 1fr;gap:3px;margin-top:5px}.booklet-sheet-slot{font-size:8px;font-weight:750;line-height:1.35;color:#334155;background:#fff;border:1px solid #e2e8f0;border-radius:5px;padding:3px 5px}.booklet-sheet-slot.blank{color:#9a3412;background:#fff7ed;border-color:#fed7aa}.booklet-sheet-empty{text-align:center;color:#64748b;font-size:11px;padding:15px}
      @media(max-width:900px){.booklet-sheet-pair{grid-template-columns:1fr}.booklet-sheet-preview-panel{max-height:42vh}.booklet-sheet-preview-btn{display:none!important}}
    `;
    document.head.appendChild(style);
  }

  function installUi(){
    if($(BUTTON_ID)&&$(PANEL_ID))return true;
    const info=document.querySelector('.preview-info');
    const shell=document.querySelector('.preview-shell');
    const scroll=$('previewScroll');
    if(!info||!shell||!scroll)return false;

    if(!$(BUTTON_ID)){
      const button=document.createElement('button');
      button.type='button';
      button.id=BUTTON_ID;
      button.className='booklet-sheet-preview-btn';
      button.textContent='용지 앞·뒷면';
      button.hidden=true;
      button.setAttribute('aria-expanded','false');
      button.setAttribute('aria-controls',PANEL_ID);
      button.addEventListener('click',()=>setOpen(!panelOpen));
      const zoom=info.querySelector('.preview-zoom');
      info.insertBefore(button,zoom||null);
    }

    if(!$(PANEL_ID)){
      const panel=document.createElement('div');
      panel.id=PANEL_ID;
      panel.className='booklet-sheet-preview-panel';
      panel.hidden=true;
      shell.insertBefore(panel,scroll);
    }
    return true;
  }

  function patchTriggerPreview(){
    if(triggerPatched)return true;
    try{
      if(typeof triggerPreview!=='function')return false;
      const original=triggerPreview;
      triggerPreview=async function bookletSheetAwareTriggerPreview(){
        const result=await original.apply(this,arguments);
        syncVisibility();
        if(panelOpen)renderPanel();
        return result;
      };
      window.triggerPreview=triggerPreview;
      triggerPatched=true;
      return true;
    }catch(_){return false;}
  }

  function bindEvents(){
    if(eventsBound)return;
    eventsBound=true;
    $('bookletCheck')?.addEventListener('change',()=>setTimeout(syncVisibility,0));
    document.querySelectorAll('.nup-btn').forEach(button=>button.addEventListener('click',()=>setTimeout(syncVisibility,0)));
    $('resetBtn')?.addEventListener('click',()=>setTimeout(()=>{panelOpen=false;syncVisibility();},0));
    $('fileInput')?.addEventListener('change',()=>setTimeout(syncVisibility,250));
    const thumbs=$('thumbArea');
    if(thumbs){
      new MutationObserver(()=>syncVisibility()).observe(thumbs,{childList:true,subtree:false});
    }
  }

  function install(){
    attempts+=1;
    installStyles();
    const uiReady=installUi();
    const coreReady=patchTriggerPreview();
    if(uiReady){
      bindEvents();
      syncVisibility();
    }
    if((!uiReady||!coreReady)&&attempts<20)setTimeout(install,120);
  }

  window.BookletSheetPreview={
    buildPlan,
    render:renderPanel,
    open:()=>setOpen(true),
    close:()=>setOpen(false),
    get isOpen(){return panelOpen;},
    stage:'physical-booklet-sheet-preview-v1',
  };

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install,{once:true});
  else install();
})();
