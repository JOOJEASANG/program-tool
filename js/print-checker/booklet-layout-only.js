// Print Checker: booklet mode only needs total pages and an imposition-style layout preview.
(function(){
  'use strict';
  if(window.__printCheckerBookletLayoutOnlyV1)return;
  window.__printCheckerBookletLayoutOnlyV1=true;

  const $=id=>document.getElementById(id);
  const HIDDEN_CLASS='pc-booklet-only-hidden';
  let drawSerial=0;

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
      label.innerHTML='총 페이지 수<small class="spec-hint">총 페이지만 입력하면 페이지 배치가 바로 표시됩니다.</small>';
    }

    const card=document.querySelector('[data-product="booklet"] .pc-desc');
    if(card)card.textContent='총 페이지 배치 미리보기';
    setMode(true);
    return true;
  }

  function canvasWidth(canvas){
    const parent=canvas?.parentElement;
    return parent?Math.max(Math.floor(parent.clientWidth)-36,300):640;
  }

  function drawPage(ctx,x,y,w,h,pageNumber,sourcePages){
    const blank=pageNumber>sourcePages;
    ctx.fillStyle=blank?'#f1f5f9':'#ffffff';
    ctx.strokeStyle='#cbd5e1';
    ctx.lineWidth=1;
    ctx.fillRect(x,y,w,h);
    ctx.strokeRect(x,y,w,h);
    ctx.fillStyle=blank?'#94a3b8':'#334155';
    ctx.textAlign='center';
    ctx.font='900 13px Pretendard, sans-serif';
    ctx.fillText(blank?'빈 페이지':`P${pageNumber}`,x+w/2,y+h/2+4);
  }

  function drawRow(ctx,side,sheetNumber,pages,pad,labelW,y,pageW,pageH,gap,sourcePages){
    const left=pad+labelW;
    ctx.fillStyle='#64748b';
    ctx.textAlign='right';
    ctx.font='800 9px Pretendard, sans-serif';
    ctx.fillText(`시트 ${sheetNumber}`,pad+labelW-6,y+pageH/2-1);
    ctx.fillText(side,pad+labelW-6,y+pageH/2+13);
    drawPage(ctx,left,y,pageW,pageH,pages[0],sourcePages);
    drawPage(ctx,left+pageW+gap,y,pageW,pageH,pages[1],sourcePages);
  }

  function drawBookletLayout(){
    if(!isBooklet())return false;
    const canvas=$('previewCanvas');
    const pagesInput=$('bookletPages');
    const core=checker();
    if(!canvas||!pagesInput||!core?.computeImposition)return false;

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

    const imp=core.computeImposition(sourcePages);
    const rowH=76;
    const rowGap=8;
    const headerH=58;
    const pad=14;
    const labelW=62;
    const pageGap=8;
    const spreadW=width-labelW-pad*2;
    const pageW=Math.max(70,(spreadW-pageGap)/2);
    const pageH=rowH-12;
    canvas.height=headerH+imp.sheets*2*(rowH+rowGap)+12;

    ctx.fillStyle='#f8fafc';ctx.fillRect(0,0,canvas.width,canvas.height);
    ctx.fillStyle='#0f4c81';ctx.textAlign='left';ctx.font='900 14px Pretendard, sans-serif';
    const padded=imp.blank?` · 배치 ${imp.pages}p`:'';
    ctx.fillText(`페이지 배치 · 입력 ${sourcePages}p${padded} · ${imp.sheets}장`,pad,24);
    ctx.fillStyle='#64748b';ctx.font='700 10px Pretendard, sans-serif';
    ctx.fillText('앞·뒤 한 면에 2페이지씩 배치된 모양만 표시합니다.',pad,42);

    imp.result.forEach((sheet,index)=>{
      const frontY=headerH+index*2*(rowH+rowGap);
      const backY=headerH+(index*2+1)*(rowH+rowGap);
      drawRow(ctx,'앞면',sheet.sheet,sheet.front,pad,labelW,frontY,pageW,pageH,pageGap,sourcePages);
      drawRow(ctx,'뒷면',sheet.sheet,sheet.back,pad,labelW,backY,pageW,pageH,pageGap,sourcePages);
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
    $('specForm')?.addEventListener('input',()=>{
      if(!isBooklet())return;
      setTimeout(()=>{simplifyBookletForm();scheduleDraw();},0);
    });
    $('specForm')?.addEventListener('change',()=>{
      if(!isBooklet())return;
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
    currentProduct,
    isBooklet,
    stage:'print-checker-booklet-layout-only-v1'
  });

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});
  else boot();
})();
