// Print Checker: booklet mode only needs total pages and an imposition-style layout preview.
(function(){
  'use strict';
  if(window.__printCheckerBookletLayoutOnlyV2)return;
  window.__printCheckerBookletLayoutOnlyV2=true;

  const $=id=>document.getElementById(id);
  const HIDDEN_CLASS='pc-booklet-only-hidden';
  let drawSerial=0;
  let useLastPageAsBackCover=false;

  function checker(){
    try{
      if(typeof PrintChecker!=='undefined')return PrintChecker;
    }catch(_){}
    return window.PrintChecker||null;
  }

  function currentProduct(){return checker()?.getState?.()?.product||'';}
  function isBooklet(){return currentProduct()==='booklet';}

  function installStyles(){
    if($('printCheckerBookletLayoutOnlyStyles'))return;
    const style=document.createElement('style');
    style.id='printCheckerBookletLayoutOnlyStyles';
    style.textContent=`
      .${HIDDEN_CLASS}{display:none!important}
      html[data-print-checker-booklet-layout-only="1"] #specForm{grid-template-columns:1fr}
      html[data-print-checker-booklet-layout-only="1"] #specForm .spec-field{grid-column:1/-1}
      html[data-print-checker-booklet-layout-only="1"] #bookletPages{font-size:18px;font-weight:900;text-align:center}
      .pc-booklet-cover-option{display:flex;align-items:center;gap:9px;margin-top:12px;padding:11px 12px;border:1px solid #dbe5ef;border-radius:10px;background:#f8fafc;color:#334155;font-size:13px;font-weight:800;cursor:pointer}
      .pc-booklet-cover-option input{width:17px;height:17px;margin:0;accent-color:#0f4c81}
      .pc-booklet-cover-hint{display:block;margin-top:6px;color:#64748b;font-size:11px;font-weight:600;line-height:1.45}
    `;
    document.head.appendChild(style);
  }

  function suppress(node,hidden){node?.classList.toggle(HIDDEN_CLASS,Boolean(hidden));}

  function setMode(enabled){
    document.documentElement.dataset.printCheckerBookletLayoutOnly=enabled?'1':'0';
    suppress($('uploadZone')?.closest('.sb-section'),enabled);
    suppress($('adjPanel'),enabled);
    suppress(document.querySelector('.action-row'),enabled);
    suppress($('reportSection'),enabled);
    suppress($('impositionGuide'),enabled);
    suppress($('canvasFileInfo'),enabled);
    suppress(document.querySelector('.canvas-tips'),enabled);
    suppress($('printCheckerLiveSummary'),enabled);

    const section=$('specSection');
    const title=section?.querySelector('.sb-title');
    if(title)title.textContent=enabled?'총 페이지 입력':'사양 입력';
  }

  function ensureBackCoverOption(field){
    if(!field)return null;
    let wrap=$('bookletUseLastPageAsBackCoverWrap');
    if(!wrap){
      wrap=document.createElement('div');
      wrap.id='bookletUseLastPageAsBackCoverWrap';
      wrap.innerHTML=`
        <label class="pc-booklet-cover-option" for="bookletUseLastPageAsBackCover">
          <input id="bookletUseLastPageAsBackCover" type="checkbox">
          <span>끝 페이지를 뒤표지로 사용</span>
        </label>
        <small class="pc-booklet-cover-hint">체크하면 홀수·비4배수 페이지에서도 마지막 페이지가 바깥 뒤표지 위치에 오도록 빈 페이지를 앞쪽에 자동 배치합니다.</small>
      `;
      field.appendChild(wrap);
    }
    const input=$('bookletUseLastPageAsBackCover');
    if(input){
      input.checked=useLastPageAsBackCover;
      input.dataset.bookletCoverBound='1';
    }
    return input;
  }

  function simplifyBookletForm(){
    if(!isBooklet())return false;
    const form=$('specForm');
    const pages=$('bookletPages');
    if(!form||!pages)return false;

    const keep=pages.closest('.spec-field');
    Array.from(form.children).forEach(child=>{
      if(child!==keep)child.remove();
    });

    pages.min='1';
    pages.step='1';
    pages.placeholder='8';
    if(!String(pages.value||'').trim())pages.value='8';

    const label=keep?.querySelector('.spec-label');
    if(label){
      label.innerHTML='총 페이지 수<small class="spec-hint">홀수 페이지도 자동으로 빈 페이지를 계산해 배치합니다.</small>';
    }
    ensureBackCoverOption(keep);

    const card=document.querySelector('[data-product="booklet"] .pc-desc');
    if(card)card.textContent='총 페이지 배치 미리보기';
    setMode(true);
    return true;
  }

  function canvasWidth(canvas){
    const parent=canvas?.parentElement;
    return parent?Math.max(Math.floor(parent.clientWidth)-36,300):640;
  }

  function buildLayoutPlan(count,forceBackCover=useLastPageAsBackCover){
    const core=checker();
    const sourcePages=Math.max(0,parseInt(count,10)||0);
    if(!core?.computeImposition)return {sourcePages,pages:0,sheets:0,blank:0,result:[],slotPages:[],useLastPageAsBackCover:Boolean(forceBackCover)};
    const imp=core.computeImposition(sourcePages);
    const slotPages=Array.from({length:imp.pages},()=>null);
    const useBackCover=Boolean(forceBackCover)&&sourcePages>1;

    if(useBackCover){
      for(let page=1;page<sourcePages;page+=1)slotPages[page-1]=page;
      if(imp.pages>0)slotPages[imp.pages-1]=sourcePages;
    }else{
      for(let page=1;page<=sourcePages;page+=1)slotPages[page-1]=page;
    }

    const mapPair=pair=>pair.map(slot=>slotPages[slot-1]??null);
    const result=imp.result.map(sheet=>({
      sheet:sheet.sheet,
      front:mapPair(sheet.front),
      back:mapPair(sheet.back)
    }));
    return {...imp,sourcePages,slotPages,result,useLastPageAsBackCover:useBackCover};
  }

  function drawPage(ctx,x,y,w,h,pageNumber,sourcePages,markBackCover){
    const blank=pageNumber===null||pageNumber===undefined;
    ctx.fillStyle=blank?'#f1f5f9':'#ffffff';
    ctx.strokeStyle=markBackCover?'#0f4c81':'#cbd5e1';
    ctx.lineWidth=markBackCover?2:1;
    ctx.fillRect(x,y,w,h);
    ctx.strokeRect(x,y,w,h);
    ctx.fillStyle=blank?'#94a3b8':'#334155';
    ctx.textAlign='center';
    ctx.font='900 13px Pretendard, sans-serif';
    if(blank){
      ctx.fillText('빈 페이지',x+w/2,y+h/2+4);
      return;
    }
    ctx.fillText(`P${pageNumber}`,x+w/2,y+h/2+(markBackCover?-2:4));
    if(markBackCover&&pageNumber===sourcePages){
      ctx.fillStyle='#0f4c81';
      ctx.font='800 9px Pretendard, sans-serif';
      ctx.fillText('뒤표지',x+w/2,y+h/2+13);
    }
  }

  function drawRow(ctx,side,sheetNumber,pages,pad,labelW,y,pageW,pageH,gap,sourcePages,markBackCover){
    const left=pad+labelW;
    ctx.fillStyle='#64748b';
    ctx.textAlign='right';
    ctx.font='800 9px Pretendard, sans-serif';
    ctx.fillText(`시트 ${sheetNumber}`,pad+labelW-6,y+pageH/2-1);
    ctx.fillText(side,pad+labelW-6,y+pageH/2+13);
    drawPage(ctx,left,y,pageW,pageH,pages[0],sourcePages,markBackCover&&pages[0]===sourcePages);
    drawPage(ctx,left+pageW+gap,y,pageW,pageH,pages[1],sourcePages,markBackCover&&pages[1]===sourcePages);
  }

  function drawBookletLayout(){
    if(!isBooklet())return false;
    const canvas=$('previewCanvas');
    const pagesInput=$('bookletPages');
    if(!canvas||!pagesInput||!checker()?.computeImposition)return false;

    const ctx=canvas.getContext('2d');
    const sourcePages=Math.max(0,parseInt(pagesInput.value,10)||0);
    const width=canvasWidth(canvas);
    canvas.width=width;

    if(sourcePages<1){
      canvas.height=220;
      ctx.fillStyle='#f8fafc';ctx.fillRect(0,0,width,canvas.height);
      ctx.fillStyle='#94a3b8';ctx.textAlign='center';ctx.font='700 14px Pretendard, sans-serif';
      ctx.fillText('총 페이지 수를 입력하면 페이지 배치가 표시됩니다',width/2,112);
      return true;
    }

    const imp=buildLayoutPlan(sourcePages,useLastPageAsBackCover);
    const rowH=76;
    const rowGap=8;
    const headerH=68;
    const pad=14;
    const labelW=62;
    const pageGap=8;
    const spreadW=width-labelW-pad*2;
    const pageW=Math.max(70,(spreadW-pageGap)/2);
    const pageH=rowH-12;
    canvas.height=headerH+imp.sheets*2*(rowH+rowGap)+12;

    ctx.fillStyle='#f8fafc';ctx.fillRect(0,0,canvas.width,canvas.height);
    ctx.fillStyle='#0f4c81';ctx.textAlign='left';ctx.font='900 14px Pretendard, sans-serif';
    const padded=imp.blank?` · 자동 배치 ${imp.pages}p`:'';
    ctx.fillText(`페이지 배치 · 입력 ${sourcePages}p${padded} · ${imp.sheets}장`,pad,23);
    ctx.fillStyle='#64748b';ctx.font='700 10px Pretendard, sans-serif';
    const coverText=imp.useLastPageAsBackCover
      ?`P${sourcePages}을 뒤표지로 배치${imp.blank?` · 빈 페이지 ${imp.blank}p 자동 삽입`:''}`
      :`끝 페이지는 본문 순서 유지${imp.blank?` · 뒤쪽에 빈 페이지 ${imp.blank}p 자동 추가`:''}`;
    ctx.fillText(coverText,pad,41);
    ctx.fillText('앞·뒤 한 면에 2페이지씩 배치된 모양만 표시합니다.',pad,56);

    imp.result.forEach((sheet,index)=>{
      const frontY=headerH+index*2*(rowH+rowGap);
      const backY=headerH+(index*2+1)*(rowH+rowGap);
      drawRow(ctx,'앞면',sheet.sheet,sheet.front,pad,labelW,frontY,pageW,pageH,pageGap,sourcePages,imp.useLastPageAsBackCover);
      drawRow(ctx,'뒷면',sheet.sheet,sheet.back,pad,labelW,backY,pageW,pageH,pageGap,sourcePages,imp.useLastPageAsBackCover);
    });
    return true;
  }

  function scheduleDraw(){
    const serial=++drawSerial;
    const run=()=>{if(serial===drawSerial&&isBooklet())drawBookletLayout();};
    if(window.requestAnimationFrame)requestAnimationFrame(run);else setTimeout(run,0);
  }

  function apply(){
    const booklet=isBooklet();
    if(!booklet){setMode(false);return true;}
    if(!simplifyBookletForm())return false;
    scheduleDraw();
    document.documentElement.dataset.printCheckerBookletLayout='ready';
    return true;
  }

  function retryApply(tries=30){
    if(apply()||tries<=0)return;
    setTimeout(()=>retryApply(tries-1),20);
  }

  function bind(){
    document.addEventListener('click',event=>{
      if(!event.target.closest?.('.product-card'))return;
      setTimeout(()=>retryApply(20),0);
    });
    $('specForm')?.addEventListener('input',event=>{
      if(!isBooklet())return;
      if(event.target?.id==='bookletUseLastPageAsBackCover')useLastPageAsBackCover=Boolean(event.target.checked);
      setTimeout(()=>{simplifyBookletForm();scheduleDraw();},0);
    });
    $('specForm')?.addEventListener('change',event=>{
      if(!isBooklet())return;
      if(event.target?.id==='bookletUseLastPageAsBackCover')useLastPageAsBackCover=Boolean(event.target.checked);
      setTimeout(()=>{simplifyBookletForm();scheduleDraw();},0);
    });
    window.addEventListener('resize',()=>{if(isBooklet())scheduleDraw();});
  }

  function boot(){
    installStyles();
    bind();
    setTimeout(()=>retryApply(40),0);
  }

  window.PrintCheckerBookletLayoutOnly=Object.freeze({
    apply,
    simplifyBookletForm,
    drawBookletLayout,
    buildLayoutPlan,
    currentProduct,
    isBooklet,
    stage:'print-checker-booklet-layout-only-v2'
  });

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});
  else boot();
})();
