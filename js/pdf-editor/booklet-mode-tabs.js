/* PDF layout modes: visible general N-up vs center-joined saddle-stitch booklet.
 * The existing #bookletCheck remains the only state used by preview/export,
 * PDF backend, undo/session, classic booklet imposition and page ordering.
 * This is a UI controller, not a second layout engine.
 */
(() => {
  'use strict';
  if (window.PdfLayoutBookletTabs) return;
  const $=id=>document.getElementById(id);
  const root=document.documentElement;
  let initialized=false;
  let savedGeneralNup=null;

  function isBooklet(){return !!$('bookletCheck')?.checked;}

  function paperCenter(){
    try {
      if(typeof getSettings!=='function')return null;
      const sheet=getSettings();
      if(!(sheet.pw>0&&sheet.ph>0))return null;
      return {width:sheet.pw,height:sheet.ph,fold:sheet.pw/2};
    }catch(_){return null;}
  }
  function alignGuide(){
    root.classList.toggle('pdf-booklet-guide-on',isBooklet()&&!!$('pdfBookletFoldGuide')?.checked);
  }
  function sync(){
    if(!$('pdfLayoutModeTabs')||!$('bookletCheck'))return false;
    const booklet=isBooklet();
    root.classList.add('pdf-booklet-dual-mode');
    root.classList.toggle('pdf-booklet-workflow-active',booklet);
    for(const [id,active] of [['pdfNormalModeBtn',!booklet],['pdfBookletModeBtn',booklet]]){
      const btn=$(id);
      if(!btn)continue;
      btn.classList.toggle('active',active);
      btn.setAttribute('aria-pressed',String(active));
    }
    const desc=$('pdfLayoutModeDescription');
    if(desc){
      desc.textContent=booklet
        ? '소책자·중철 전용: 한 면에 좌·우 2쪽을 배치하고 용지 중앙 접지선에 두 페이지를 0mm 간격으로 맞춥니다. 4의 배수 자동 보충 및 중철 순서로 출력합니다.'
        : '일반 N-up 배치: 1·2·4·6·8·9장 선택, 페이지 순서·슬라이드 간격을 자유롭게 지정합니다. 중철 접지·페이지 재정렬은 적용하지 않습니다.';
    }
    const notice=$('pdfBookletGapNote');
    if(notice)notice.hidden=!booklet;
    const lock=$('pdfBookletCenterLock');
    if(lock){
      const span=lock.querySelector('span');
      const paper=paperCenter();
      if(span)span.textContent=paper&&booklet
        ? '용지 '+Number(paper.width.toFixed(1))+'×'+Number(paper.height.toFixed(1))+
          'mm · 중앙 '+Number(paper.fold.toFixed(1))+'mm · 좌우 페이지 간격 0mm'
        : '용지 가운데 접지선 기준 · 좌우 페이지 간격 0mm';
    }
    if(booklet){
      // Native booklet controller also forces spine-center and physical 2-up.
      if($('bookletSpineGather'))$('bookletSpineGather').checked=true;
    }
    alignGuide();
    return true;
  }

  function choose(booklet){
    const check=$('bookletCheck');
    if(!check)return;
    if(check.checked===booklet){sync();return;}
    const selected=document.querySelector('.nup-btn.active[data-nup]');
    if(booklet){
      savedGeneralNup=Number(selected?.dataset?.nup)||2;
      // The legacy reliability guard rejects booklet for normal-only N-up
      // 1/9. Move to the supported fixed 2-up BEFORE raising bookletCheck.
      // Save the original general N-up so it can be restored on exit.
      if(![2,4,6,8].includes(savedGeneralNup)){
        document.querySelector('.nup-btn[data-nup="2"]')?.click();
      }
    }
    // Trigger the native change event so its imposition, sheet preview,
    // physical-fold and saved PDF settings all use the SAME flag.
    check.checked=booklet;
    check.dispatchEvent(new Event('change',{bubbles:true}));
    if(!booklet&&savedGeneralNup!==null){
      const old=Number(savedGeneralNup);
      const active=Number(document.querySelector('.nup-btn.active[data-nup]')?.dataset?.nup);
      if(active!==old)document.querySelector('.nup-btn[data-nup="'+old+'"]')?.click();
      savedGeneralNup=null;
    }
    sync();
  }

  function showSheetPreview(){
    if(!isBooklet())return;
    if(typeof parsedPages!=='undefined' && !parsedPages.some(page=>!page?.excluded)){
      if(typeof showStatus==='function')
        showStatus('PDF 페이지를 업로드한 다음 소책자 앞·뒷면을 확인하세요.','info');
      return;
    }
    if(typeof window.BookletSheetPreview?.open==='function'){
      window.BookletSheetPreview.open();
      return;
    }
    const button=$('bookletSheetPreviewButton');
    if(button)button.click();
  }

  function install(){
    if(initialized)return true;
    const normal=$('pdfNormalModeBtn'),booklet=$('pdfBookletModeBtn');
    if(!normal||!booklet||!$('bookletCheck'))return false;
    initialized=true;
    normal.addEventListener('click',()=>choose(false));
    booklet.addEventListener('click',()=>choose(true));
    $('bookletCheck').addEventListener('change',sync);
    $('pdfBookletFoldGuide')?.addEventListener('change',alignGuide);
    $('pdfBookletLandscapeBtn')?.addEventListener('click',()=>{
      if(!isBooklet())choose(true);
      const target=$('orientLand');
      if(target&&!target.classList.contains('active'))target.click();
      sync();
    });
    $('pdfBookletSheetPreviewOpenBtn')?.addEventListener('click',showSheetPreview);
    // Old reset intentionally clears all pages. New workflow also resets the
    // operation mode to normal, without changing the user's paper preset.
    $('resetBtn')?.addEventListener('click',()=>{
      if(isBooklet())choose(false);
      else sync();
    });
    for(const id of ['paperSize','customW','customH','orientLand','orientPort']){
      const node=$(id);
      if(!node)continue;
      node.addEventListener('change',sync);
      if(id==='orientLand'||id==='orientPort')node.addEventListener('click',sync);
    }
    // Restored editing sessions set the legacy checkbox directly. The preview
    // is rebuilt after session restore, so resync the visible mode on its change.
    const preview=$('previewScroll');
    if(preview){
      new MutationObserver(()=>{
        if(root.classList.contains('pdf-booklet-workflow-active')!==isBooklet())sync();
      }).observe(preview,{childList:true});
    }
    window.addEventListener('pageshow',sync);
    sync();
    return true;
  }

  window.PdfLayoutBookletTabs={sync,choose,isBooklet,paperCenter,showSheetPreview};
  if(document.readyState==='loading'){
    document.addEventListener('DOMContentLoaded',install,{once:true});
  }else if(!install()){
    window.addEventListener('load',install,{once:true});
  }
})();