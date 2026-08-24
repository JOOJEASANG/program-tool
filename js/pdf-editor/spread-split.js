// PDF editor spread split stage 1.
// Turns one landscape spread page into two logical pages without rasterizing the source PDF.
(function(){
  'use strict';
  if(window.__pdfEditorSpreadSplitV1)return;
  window.__pdfEditorSpreadSplitV1=true;

  const PANEL_ID='pdfSpreadSplitPanel';
  const STYLE_ID='pdfSpreadSplitStyles';
  let originalPages=null;
  let splitActive=false;
  let apiPatched=false;
  let sourcePatched=false;
  let thumbsPatched=false;
  let attempts=0;

  const $=id=>document.getElementById(id);

  function getPages(){
    try{return Array.isArray(parsedPages)?parsedPages:null;}catch(_){return null;}
  }

  function isPdfPage(page){return page?.pageType==='pdf'&&page?.pdfPage;}

  function setStatus(message,type='info'){
    const node=$('pdfSpreadSplitStatus');
    if(!node)return;
    node.textContent=message||'';
    node.dataset.type=type;
  }

  function cropCanvas(source,side){
    if(!source||!source.width||!source.height)return source;
    if(source.dataset?.spreadSplitSide===side)return source;
    const half=Math.max(1,Math.floor(source.width/2));
    const sx=side==='right'?source.width-half:0;
    const canvas=document.createElement('canvas');
    canvas.width=half;
    canvas.height=source.height;
    const ctx=canvas.getContext('2d');
    ctx.fillStyle='#fff';
    ctx.fillRect(0,0,canvas.width,canvas.height);
    ctx.drawImage(source,sx,0,half,source.height,0,0,half,source.height);
    canvas.dataset.spreadSplitSide=side;
    return canvas;
  }

  function normalizeSplitThumb(page){
    if(!page?.splitSide||!page.thumbCanvas)return;
    const rotation=Number(page.rotation||0);
    const already=page.thumbCanvas.dataset?.spreadSplitSide===page.splitSide;
    if(already&&page._spreadRenderedRotation===rotation)return;
    page.thumbCanvas=cropCanvas(page.thumbCanvas,page.splitSide);
    page._spreadRenderedRotation=rotation;
    page.hiCanvas=null;
  }

  function patchGetPageSrc(){
    if(sourcePatched)return true;
    try{
      if(typeof getPageSrc!=='function')return false;
      const original=getPageSrc;
      getPageSrc=function spreadAwarePageSource(page){
        const source=original.apply(this,arguments);
        if(!page?.splitSide)return source;
        return cropCanvas(source,page.splitSide);
      };
      sourcePatched=true;
      return true;
    }catch(_){return false;}
  }

  function patchRenderThumbs(){
    if(thumbsPatched)return true;
    try{
      if(typeof renderThumbs!=='function')return false;
      const original=renderThumbs;
      renderThumbs=function spreadAwareThumbs(){
        const pages=getPages()||[];
        pages.forEach(normalizeSplitThumb);
        const result=original.apply(this,arguments);
        requestAnimationFrame(decorateThumbs);
        syncUi();
        return result;
      };
      thumbsPatched=true;
      return true;
    }catch(_){return false;}
  }

  function patchApiProcessPdf(){
    if(apiPatched)return true;
    try{
      if(typeof apiProcessPdf!=='function')return false;
      const original=apiProcessPdf;
      const patched=async function spreadAwareApiProcessPdf(files,settings,options){
        const pages=getPages()||[];
        if(settings&&Array.isArray(settings.pages)&&settings.pages.length===pages.length){
          settings={...settings,pages:settings.pages.map((entry,index)=>({
            ...entry,
            split_side:pages[index]?.splitSide||null,
          }))};
        }
        return original.call(this,files,settings,options);
      };
      apiProcessPdf=patched;
      window.apiProcessPdf=patched;
      apiPatched=true;
      return true;
    }catch(_){return false;}
  }

  function installStyles(){
    if($(STYLE_ID))return;
    const style=document.createElement('style');
    style.id=STYLE_ID;
    style.textContent=`
      .spread-split-panel{margin-top:9px;border:1px solid #dce6ef;border-radius:10px;background:#f8fbfd;padding:10px}
      .spread-split-head{display:flex;align-items:center;justify-content:space-between;gap:8px;margin-bottom:5px}.spread-split-title{font-size:11px;font-weight:900;color:#24364b}.spread-split-badge{font-size:8px;font-weight:900;color:#1769e0;background:#eaf3ff;border-radius:999px;padding:3px 6px}
      .spread-split-note{font-size:9px;line-height:1.45;color:#667085;margin-bottom:8px}.spread-split-grid{display:grid;grid-template-columns:1fr 1fr;gap:6px}.spread-split-field label{font-size:9px;margin-bottom:3px}.spread-split-field select{font-size:10px;padding:6px 7px}
      .spread-split-checks{display:grid;grid-template-columns:1fr 1fr;gap:5px;margin-top:7px}.spread-split-check{display:flex;align-items:center;gap:5px;font-size:9px;font-weight:750;color:#475569;cursor:pointer}.spread-split-check input{width:auto}
      .spread-split-actions{display:grid;grid-template-columns:1fr auto;gap:6px;margin-top:8px}.spread-split-btn{border:0;border-radius:8px;padding:7px 8px;font-family:inherit;font-size:10px;font-weight:900;cursor:pointer}.spread-split-btn.primary{background:#12396d;color:#fff}.spread-split-btn.soft{border:1px solid #cbd5e1;background:#fff;color:#475569}.spread-split-btn:disabled{opacity:.45;cursor:not-allowed}
      .spread-split-status{min-height:14px;margin-top:6px;font-size:9px;font-weight:750;line-height:1.45;color:#64748b}.spread-split-status[data-type="ok"]{color:#166534}.spread-split-status[data-type="warn"]{color:#9a3412}.spread-half-tag{position:absolute;right:5px;top:5px;z-index:3;border-radius:999px;padding:2px 5px;background:#12396ddd;color:#fff;font-size:8px;font-weight:900;pointer-events:none}
      @media(max-width:900px){.spread-split-grid,.spread-split-checks{grid-template-columns:1fr}}
    `;
    document.head.appendChild(style);
  }

  function installPanel(){
    if($(PANEL_ID))return true;
    const body=$('sb-upload');
    if(!body)return false;
    const panel=document.createElement('div');
    panel.id=PANEL_ID;
    panel.className='spread-split-panel';
    panel.innerHTML=`
      <div class="spread-split-head"><div class="spread-split-title">펼침면 좌우 분할</div><span class="spread-split-badge">인쇄 실무</span></div>
      <div class="spread-split-note">한 PDF 페이지 안에 두 쪽이 붙어 있으면 좌·우를 독립 페이지로 나눕니다. 원본 PDF는 다시 만들지 않아 글자·벡터 품질을 유지합니다.</div>
      <div class="spread-split-grid">
        <div class="spread-split-field"><label for="spreadReadingOrder">읽기 순서</label><select id="spreadReadingOrder"><option value="ltr">왼쪽 → 오른쪽</option><option value="rtl">오른쪽 → 왼쪽</option></select></div>
        <div class="spread-split-field"><label>분할 방식</label><select disabled><option>가로 펼침면 · 좌우 2쪽</option></select></div>
      </div>
      <div class="spread-split-checks">
        <label class="spread-split-check"><input type="checkbox" id="spreadFirstPageSkip">첫 페이지는 분할하지 않음</label>
        <label class="spread-split-check"><input type="checkbox" id="spreadLastPageSkip">마지막 페이지는 분할하지 않음</label>
      </div>
      <div class="spread-split-actions"><button type="button" id="spreadSplitApply" class="spread-split-btn primary">좌우 페이지로 분할</button><button type="button" id="spreadSplitUndo" class="spread-split-btn soft" disabled>분할 취소</button></div>
      <div id="pdfSpreadSplitStatus" class="spread-split-status">PDF를 올린 뒤 펼침면 파일일 때 사용하세요.</div>`;
    body.appendChild(panel);
    $('spreadSplitApply')?.addEventListener('click',applySplit);
    $('spreadSplitUndo')?.addEventListener('click',()=>restoreOriginal(false));
    $('fileInput')?.addEventListener('change',()=>{
      if(splitActive)restoreOriginal(true);
      setTimeout(syncUi,100);
    },true);
    $('resetBtn')?.addEventListener('click',()=>setTimeout(()=>{
      originalPages=null;splitActive=false;syncUi();setStatus('PDF를 올린 뒤 펼침면 파일일 때 사용하세요.');
    },0));
    syncUi();
    return true;
  }

  function cloneHalf(page,side,groupBreak){
    const clone={
      ...page,
      id:typeof makeId==='function'?makeId():`spread-${Date.now()}-${Math.random()}`,
      splitSide:side,
      groupBreak:!!groupBreak,
      hiCanvas:null,
      sourceFile:`${page.sourceFile||'PDF'} · ${side==='left'?'왼쪽':'오른쪽'}`,
    };
    clone.thumbCanvas=cropCanvas(page.thumbCanvas,side);
    clone._spreadRenderedRotation=Number(clone.rotation||0);
    return clone;
  }

  function applySplit(){
    const pages=getPages();
    if(!pages||!pages.length){setStatus('먼저 PDF 파일을 업로드하세요.','warn');return;}
    if(splitActive||pages.some(page=>page?.splitSide)){setStatus('이미 펼침면이 분할되어 있습니다. 먼저 분할 취소를 사용하세요.','warn');return;}
    const pdfIndexes=[];
    pages.forEach((page,index)=>{if(isPdfPage(page))pdfIndexes.push(index);});
    if(!pdfIndexes.length){setStatus('분할할 PDF 페이지가 없습니다.','warn');return;}

    const readingOrder=$('spreadReadingOrder')?.value==='rtl'?'rtl':'ltr';
    const firstPageSkip=!!$('spreadFirstPageSkip')?.checked;
    const lastPageSkip=!!$('spreadLastPageSkip')?.checked;
    const firstIndex=pdfIndexes[0];
    const lastIndex=pdfIndexes[pdfIndexes.length-1];
    const next=[];
    let splitCount=0;
    originalPages=pages.slice();

    pages.forEach((page,index)=>{
      const skip=!isPdfPage(page)||(firstPageSkip&&index===firstIndex)||(lastPageSkip&&index===lastIndex);
      if(skip){next.push(page);return;}
      const sides=readingOrder==='rtl'?['right','left']:['left','right'];
      next.push(cloneHalf(page,sides[0],page.groupBreak));
      next.push(cloneHalf(page,sides[1],false));
      splitCount+=1;
    });

    try{parsedPages=next;}catch(error){originalPages=null;setStatus('페이지 목록을 갱신하지 못했습니다.','warn');console.error(error);return;}
    splitActive=splitCount>0;
    try{renderThumbs();}catch(error){console.warn('Spread split thumb refresh failed',error);}
    try{updateBookletPadInfo?.();}catch(_){}
    try{schedulePreview?.(80);}catch(_){}
    setStatus(`펼침면 ${splitCount}장을 좌우로 나눴습니다. 현재 ${next.filter(isPdfPage).length}쪽입니다. 이제 소책자 배치를 켜면 이 순서가 그대로 사용됩니다.`,'ok');
    syncUi();
  }

  function restoreOriginal(silent){
    if(!originalPages){splitActive=false;syncUi();return;}
    try{parsedPages=originalPages;}catch(error){console.error(error);return;}
    originalPages=null;
    splitActive=false;
    try{renderThumbs();}catch(_){}
    try{updateBookletPadInfo?.();}catch(_){}
    try{schedulePreview?.(80);}catch(_){}
    if(!silent)setStatus('분할 전 상태로 되돌렸습니다. 다시 업로드하지 않고 계속 작업할 수 있습니다.','ok');
    syncUi();
  }

  function decorateThumbs(){
    const pages=getPages()||[];
    const cards=[...document.querySelectorAll('#thumbArea > *')];
    cards.forEach((card,index)=>{
      card.querySelector('.spread-half-tag')?.remove();
      const side=pages[index]?.splitSide;
      if(!side)return;
      const style=getComputedStyle(card);
      if(style.position==='static')card.style.position='relative';
      const tag=document.createElement('span');
      tag.className='spread-half-tag';
      tag.textContent=side==='left'?'L · 왼쪽':'R · 오른쪽';
      card.appendChild(tag);
    });
  }

  function syncUi(){
    const pages=getPages()||[];
    const hasPdf=pages.some(isPdfPage);
    const active=splitActive||pages.some(page=>page?.splitSide);
    splitActive=active;
    const apply=$('spreadSplitApply');
    const undo=$('spreadSplitUndo');
    if(apply)apply.disabled=!hasPdf||active;
    if(undo)undo.disabled=!active||!originalPages;
  }

  function patchCore(){
    patchGetPageSrc();
    patchRenderThumbs();
    patchApiProcessPdf();
    return sourcePatched&&thumbsPatched&&apiPatched;
  }

  function install(){
    attempts+=1;
    installStyles();
    const panelReady=installPanel();
    const coreReady=patchCore();
    if(panelReady&&coreReady){
      window.PdfEditorSpreadSplit={
        apply:applySplit,
        undo:()=>restoreOriginal(false),
        get active(){return splitActive;},
        readingOrder:()=>$('spreadReadingOrder')?.value||'ltr',
        firstPageSkip:()=>!!$('spreadFirstPageSkip')?.checked,
        lastPageSkip:()=>!!$('spreadLastPageSkip')?.checked,
        stage:'pdf-spread-split-stage1',
      };
      syncUi();
      return true;
    }
    if(attempts<80)setTimeout(install,100);
    return false;
  }

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install,{once:true});
  else install();
})();