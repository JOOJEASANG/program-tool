// Keeps the advanced fixed toolbar aligned with image-style direct page editing.
(function(){
  'use strict';
  if(window.__pdfDirectPageEditQuickbarV1)return;
  const root=document.documentElement;
  const advanced=root.dataset.pdfEditorProfile==='advanced'||new URLSearchParams(String(location.search||'')).get('profile')==='advanced';
  if(!advanced)return;
  window.__pdfDirectPageEditQuickbarV1=true;

  const byId=id=>document.getElementById(id);
  const A5_SIZE={width:148,height:210};
  let directRedoAvailable=false;
  let manualZoom=false;
  let autoFitClick=false;
  let resizeTimer=0;
  let previewObserver=null;

  function precisionHistory(){return window.PdfPrecisionEditTools?.history||{};}
  function directUndoCount(){return Math.max(0,Number(root.dataset.pdfDirectUndoCount||0)||0);}
  function eraseActive(){return root.dataset.pdfDirectEraseActive==='true';}
  function pages(){
    if(Array.isArray(window.parsedPages))return window.parsedPages;
    try{return typeof parsedPages!=='undefined'&&Array.isArray(parsedPages)?parsedPages:[];}catch(_){return[];}
  }
  function activePages(){return pages().filter(page=>!page?.excluded);}

  function installStyles(){
    if(byId('pdfDirectQuickbarPolishStylesV2'))return;
    const style=document.createElement('style');
    style.id='pdfDirectQuickbarPolishStylesV2';
    style.textContent=`
      html[data-pdf-editor-profile="advanced"] #previewScroll .preview-row{gap:14px!important}
      #pdfAdvancedQuickBarV1 .advanced-size-group{display:flex;align-items:center;gap:4px;flex:0 0 auto}
      #pdfAdvancedQuickBarV1 .advanced-size-label{font-size:9px;font-weight:900;color:#475569;white-space:nowrap;margin:0!important}
      #pdfAdvancedQuickBarV1 #pdfAdvancedSizeSelectV2{width:auto;min-width:122px;height:26px;border:1px solid #cbd5e1;border-radius:6px;background:#fff;color:#334155;padding:0 22px 0 7px;font:inherit;font-size:10px;font-weight:850;cursor:pointer}
      #pdfAdvancedQuickBarV1 #pdfAdvancedCustomSizeV2{display:flex;align-items:center;gap:3px}
      #pdfAdvancedQuickBarV1 #pdfAdvancedCustomSizeV2[hidden]{display:none!important}
      #pdfAdvancedQuickBarV1 #pdfAdvancedCustomSizeV2 input{width:58px;height:26px;border:1px solid #cbd5e1;border-radius:6px;background:#fff;color:#334155;padding:0 5px;font:inherit;font-size:9px;font-weight:800;text-align:center}
      #pdfAdvancedQuickBarV1 #pdfAdvancedCustomSizeV2 span{font-size:9px;font-weight:800;color:#64748b}
      html[data-pdf-editor-profile="advanced"] #previewScroll .empty-state[data-pdf-advanced-intro="1"]{margin:auto;padding:42px 20px}
      html[data-pdf-editor-profile="advanced"] #previewScroll .empty-state[data-pdf-advanced-intro="1"] p{font-size:13px;line-height:1.65}
      @media(max-width:1100px){
        #pdfAdvancedQuickBarV1 #pdfAdvancedSizeSelectV2{min-width:106px}
        #pdfAdvancedQuickBarV1 .advanced-size-label{display:none}
      }
    `;
    document.head.appendChild(style);
  }

  function isA5Custom(){
    const w=Number(byId('customW')?.value||0),h=Number(byId('customH')?.value||0);
    const nw=Math.min(w,h),nh=Math.max(w,h);
    return Math.abs(nw-A5_SIZE.width)<.6&&Math.abs(nh-A5_SIZE.height)<.6;
  }

  function currentAdvancedSize(){
    const paper=byId('paperSize');
    if(!paper)return'a4';
    if(paper.value==='custom'&&isA5Custom())return'a5';
    return paper.value||'a4';
  }

  function emit(node,type){
    if(!node)return;
    node.dispatchEvent(new Event(type,{bubbles:true}));
  }

  function syncSizeControl(){
    const select=byId('pdfAdvancedSizeSelectV2');
    if(!select)return;
    const value=currentAdvancedSize();
    if(select.value!==value&&select.querySelector(`option[value="${value}"]`))select.value=value;
    const custom=byId('pdfAdvancedCustomSizeV2');
    const show=value==='custom';
    if(custom)custom.hidden=!show;
    if(show){
      const w=byId('pdfAdvancedCustomWV2'),h=byId('pdfAdvancedCustomHV2');
      const sourceW=byId('customW'),sourceH=byId('customH');
      if(w&&sourceW&&document.activeElement!==w)w.value=sourceW.value||'210';
      if(h&&sourceH&&document.activeElement!==h)h.value=sourceH.value||'297';
    }
  }

  function scheduleAutoFit(delays=[120,360,760]){
    for(const delay of delays)setTimeout(()=>fitPreviewToWorkspace(true),delay);
  }

  function applyAdvancedSize(value){
    const paper=byId('paperSize');
    if(!paper)return;
    if(value==='a5'&&!paper.querySelector('option[value="a5"]')){
      paper.value='custom';
      const w=byId('customW'),h=byId('customH');
      if(w)w.value=String(A5_SIZE.width);
      if(h)h.value=String(A5_SIZE.height);
      emit(w,'input');emit(h,'input');
      emit(paper,'change');
    }else{
      paper.value=value;
      emit(paper,'change');
    }
    manualZoom=false;
    syncSizeControl();
    scheduleAutoFit([180,560,980]);
    root.dataset.pdfAdvancedSizeControl='applied';
  }

  function applyCustomDimension(axis,value){
    const source=byId(axis==='w'?'customW':'customH');
    if(!source)return;
    const clean=Math.max(50,Math.min(1200,Number(value)||0));
    if(!clean)return;
    source.value=String(clean);
    emit(source,'input');
    emit(source,'change');
    manualZoom=false;
    scheduleAutoFit([300,760]);
  }

  function ensureSizeControl(){
    const bar=byId('pdfAdvancedQuickBarV1');
    if(!bar)return false;
    let group=byId('pdfAdvancedSizeGroupV2');
    if(!group){
      group=document.createElement('div');
      group.id='pdfAdvancedSizeGroupV2';
      group.className='advanced-size-group';
      group.innerHTML=`
        <label class="advanced-size-label" for="pdfAdvancedSizeSelectV2">사이즈</label>
        <select id="pdfAdvancedSizeSelectV2" aria-label="출력 사이즈 선택">
          <option value="a4">A4 · 210×297</option>
          <option value="a5">A5 · 148×210</option>
          <option value="a3">A3 · 297×420</option>
          <option value="b4">B4 · 250×354</option>
          <option value="b5">B5 · 176×250</option>
          <option value="letter">Letter · 216×279</option>
          <option value="custom">직접 입력</option>
        </select>
        <span id="pdfAdvancedCustomSizeV2" hidden>
          <input id="pdfAdvancedCustomWV2" type="number" min="50" max="1200" step="1" aria-label="사용자 너비 mm">
          <span>×</span>
          <input id="pdfAdvancedCustomHV2" type="number" min="50" max="1200" step="1" aria-label="사용자 높이 mm">
          <span>mm</span>
        </span>`;
      const lock=bar.querySelector('.advanced-workspace-lock');
      if(lock)bar.insertBefore(group,lock);else bar.appendChild(group);
      byId('pdfAdvancedSizeSelectV2')?.addEventListener('change',event=>applyAdvancedSize(event.target.value));
      byId('pdfAdvancedCustomWV2')?.addEventListener('input',event=>applyCustomDimension('w',event.target.value));
      byId('pdfAdvancedCustomHV2')?.addEventListener('input',event=>applyCustomDimension('h',event.target.value));
      ['pdfAdvancedCustomWV2','pdfAdvancedCustomHV2'].forEach(id=>byId(id)?.addEventListener('change',()=>scheduleAutoFit([160,460])));
    }
    syncSizeControl();
    root.dataset.pdfAdvancedSizeControl='ready';
    return true;
  }

  function introText(node){return String(node?.textContent||'').replace(/\s+/g,' ').trim();}

  function syncPreviewIntro(){
    const scroll=byId('previewScroll');
    if(!scroll)return;
    const hasPreview=Boolean(scroll.querySelector('.page-preview'));
    const hasPages=activePages().length>0;
    const empty=scroll.querySelector('.empty-state');
    if(!hasPages&&empty&&!/활성 페이지가 없습니다|미리보기 생성 실패/.test(introText(empty))){
      empty.dataset.pdfAdvancedIntro='1';
      const desired='<div class="icon">📝</div><p><b>PDF 고급 편집</b><br>왼쪽에서 PDF 파일을 불러와 주세요.</p>';
      if(empty.innerHTML!==desired)empty.innerHTML=desired;
    }
    scroll.querySelectorAll('.empty-state,[data-pdf-advanced-intro]').forEach(node=>{
      const text=introText(node);
      const isIntro=node.dataset?.pdfAdvancedIntro==='1'||(/PDF 고급 편집/.test(text)&&/왼쪽에서 PDF 파일/.test(text));
      if(!isIntro)return;
      const hide=hasPreview||hasPages;
      if(node.hidden!==hide)node.hidden=hide;
      node.setAttribute('aria-hidden',hide?'true':'false');
    });
    root.dataset.pdfAdvancedPreviewIntro=hasPreview?'hidden-after-layout':'waiting';
  }

  function installPreviewObserver(){
    const scroll=byId('previewScroll');
    if(!scroll||previewObserver?.__target===scroll)return;
    previewObserver?.disconnect?.();
    previewObserver=new MutationObserver(()=>requestAnimationFrame(syncPreviewIntro));
    previewObserver.__target=scroll;
    previewObserver.observe(scroll,{childList:true,subtree:true});
  }

  function installAutoFitOverride(){
    let current=null;
    try{current=typeof computeAutoZoom==='function'?computeAutoZoom:window.computeAutoZoom;}catch(_){current=window.computeAutoZoom;}
    if(typeof current!=='function'||current.__pdfAdvancedWorkspaceFitV2)return;
    const original=current;
    const wrapped=function advancedWorkspaceAutoZoom(perRow,canvas){
      const scroll=byId('previewScroll');
      if(!scroll||!canvas?.width||!canvas?.height)return original.apply(this,arguments);
      const count=Math.max(1,Number(perRow)||1);
      const availableWidth=Math.max(80,scroll.clientWidth-24);
      const availableHeight=Math.max(80,scroll.clientHeight-24);
      const pairGap=14;
      const pageSlotWidth=(availableWidth-pairGap*Math.max(0,count-1))/count;
      if(pageSlotWidth<=0)return original.apply(this,arguments);
      const baseHeight=280;
      const baseWidth=baseHeight*(canvas.width/canvas.height);
      const widthZoom=pageSlotWidth/baseWidth;
      const heightZoom=availableHeight/baseHeight;
      const fit=Math.min(widthZoom,heightZoom)*.985;
      return Number.isFinite(fit)&&fit>0?Math.max(.35,fit):original.apply(this,arguments);
    };
    wrapped.__pdfAdvancedWorkspaceFitV2=true;
    wrapped.__pdfAdvancedWorkspaceFitOriginal=original;
    window.computeAutoZoom=wrapped;
    try{computeAutoZoom=wrapped;}catch(_){}
    root.dataset.pdfAdvancedAutoFit='screen-v2';
  }

  function fitPreviewToWorkspace(force=false){
    if(!force&&manualZoom)return false;
    let canvases=[];
    try{canvases=Array.isArray(previewCanvases)?previewCanvases:[];}catch(_){canvases=[];}
    if(!canvases.length||!byId('previewScroll')?.querySelector('.page-preview'))return false;
    const reset=byId('zoomResetBtn');
    if(reset){
      autoFitClick=true;
      try{reset.click();}finally{autoFitClick=false;}
      syncPreviewIntro();
      root.dataset.pdfAdvancedAutoFitLast='reset';
      return true;
    }
    try{
      if(typeof displayPreview==='function'){
        displayPreview(canvases,true);
        syncPreviewIntro();
        root.dataset.pdfAdvancedAutoFitLast='display';
        return true;
      }
    }catch(_){}
    return false;
  }

  function sync(){
    installStyles();
    installAutoFitOverride();
    ensureSizeControl();
    installPreviewObserver();
    syncPreviewIntro();

    const erase=byId('pdfAdvancedCropV1');
    if(erase){
      erase.textContent=eraseActive()?'지우기 종료':'🧽 지우기';
      erase.title='지저분한 부분을 사각형으로 드래그해 지우기';
      erase.dataset.active=String(eraseActive());
    }
    const history=precisionHistory();
    const undo=byId('pdfAdvancedUndoV1');
    const redo=byId('pdfAdvancedRedoV1');
    if(undo)undo.disabled=directUndoCount()===0&&!Number(history.undoCount||0);
    if(redo)redo.disabled=!directRedoAvailable&&!Number(history.redoCount||0);
    root.dataset.pdfDirectQuickbar='2';
  }

  document.addEventListener('click',event=>{
    const zoom=event.target?.closest?.('#zoomInBtn,#zoomOutBtn,#zoomResetBtn');
    if(zoom&&!autoFitClick)manualZoom=true;

    const erase=event.target?.closest?.('#pdfAdvancedCropV1');
    if(erase){
      event.preventDefault();event.stopImmediatePropagation();event.stopPropagation();
      byId('pdfDragCropAutoFitV1')?.click();
      setTimeout(sync,0);
      return;
    }
    if(event.target?.closest?.('#pdfAdvancedUndoV1')){
      const before=directUndoCount();
      setTimeout(()=>{if(before>directUndoCount())directRedoAvailable=true;sync();},0);
      return;
    }
    if(event.target?.closest?.('#pdfAdvancedRedoV1')){
      setTimeout(()=>{directRedoAvailable=false;sync();},0);
      return;
    }
    if(event.target?.closest?.('#pdfDragCropAutoFitV1'))setTimeout(sync,0);
  },true);

  document.addEventListener('change',event=>{
    if(event.target?.id==='paperSize'||event.target?.id==='customW'||event.target?.id==='customH')setTimeout(syncSizeControl,0);
  },true);

  document.addEventListener('pdf-drag-erase-applied',()=>{directRedoAvailable=false;setTimeout(sync,0);});
  document.addEventListener('pdf-import-committed',()=>{
    directRedoAvailable=false;
    manualZoom=false;
    setTimeout(sync,0);
    scheduleAutoFit([100,260,520,900]);
  });

  window.addEventListener('resize',()=>{
    clearTimeout(resizeTimer);
    resizeTimer=setTimeout(()=>{
      sync();
      if(!manualZoom)fitPreviewToWorkspace(true);
    },140);
  },{passive:true});

  new MutationObserver(()=>requestAnimationFrame(sync)).observe(document.body,{childList:true,subtree:true});
  sync();
  setTimeout(()=>fitPreviewToWorkspace(false),320);
  setInterval(sync,1200);

  window.PdfDirectPageEditQuickbar={
    sync,
    fitPreview:fitPreviewToWorkspace,
    syncSize:syncSizeControl,
    stage:'direct-edit-quickbar-v2'
  };
})();
