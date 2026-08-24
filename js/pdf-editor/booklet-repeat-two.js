// Program Studio booklet repeat-two production mode.
// Reuses the existing 4-up booklet engine by duplicating the same logical book twice.
(function(){
  'use strict';
  if(window.__pdfBookletRepeatTwoV1)return;
  window.__pdfBookletRepeatTwoV1=true;

  const CHECK_ID='bookletRepeatTwo';
  const PANEL_ID='bookletRepeatTwoPanel';
  const STYLE_ID='bookletRepeatTwoStyles';
  const BODY_CLASS='pdf-booklet-repeat-two-active';
  let previewPatchInstalled=false;
  let padPatchInstalled=false;
  let contractPatchVersion=0;

  const $=id=>document.getElementById(id);

  function isEnabled(){
    return !!$(CHECK_ID)?.checked&&!!$('bookletCheck')?.checked;
  }

  function getActiveCount(){
    try{return Array.isArray(parsedPages)?parsedPages.filter(page=>!page?.excluded).length:0;}
    catch(_){return 0;}
  }

  function clonePage(page){
    return page&&typeof page==='object'?{...page}:page;
  }

  function duplicateBookPages(pages){
    const source=Array.isArray(pages)?pages:[];
    return [
      ...source.map(clonePage),
      ...source.map(clonePage),
    ];
  }

  function forceFourUp(){
    const button=document.querySelector('.nup-btn[data-nup="4"]');
    if(button&&!button.classList.contains('active'))button.click();
  }

  function requestPreview(delay=60){
    try{
      if(window.PdfLivePreview?.request)window.PdfLivePreview.request(delay,false);
      else if(typeof schedulePreview==='function')schedulePreview(delay);
      else if(typeof triggerPreview==='function')setTimeout(()=>triggerPreview(),delay);
    }catch(_){}
  }

  function showMessage(message,type='success'){
    try{
      if(typeof showStatus==='function'){
        showStatus(message,type);
        if(typeof hideStatus==='function')setTimeout(hideStatus,1800);
      }
    }catch(_){}
  }

  function updateBodyState(){
    document.body?.classList.toggle(BODY_CLASS,isEnabled());
  }

  function updateHint(){
    const hint=$('bookletRepeatTwoHint');
    if(!hint)return;
    const active=getActiveCount();
    if(!isEnabled()){
      hint.textContent='큰 용지에 같은 소책자를 위·아래 2벌 배치합니다. 출력 용지는 A3 등 필요한 큰 규격을 선택하세요.';
      return;
    }
    const padded=Math.ceil(active/4)*4;
    const blanks=Math.max(0,padded-active);
    hint.textContent=active
      ? `동일 2권 반복 중 · 각 권 ${padded}쪽${blanks?` · 각 권 빈쪽 ${blanks}쪽`:''} · 가운데 재단 후 각각 접기`
      : '동일 2권 반복 중 · PDF를 올리면 두 권의 배치가 함께 표시됩니다.';
  }

  function syncPadInfo(){
    const info=$('bookletPadInfo');
    if(!info||!isEnabled())return;
    const active=getActiveCount();
    if(!active){info.style.display='none';return;}
    const padded=Math.ceil(active/4)*4;
    const blanks=Math.max(0,padded-active);
    info.textContent=blanks
      ? `동일 2권 · 각 권 빈 페이지 ${blanks}장 추가 → 각 ${padded}페이지`
      : `동일 2권 반복 · 각 권 ${padded}페이지`;
    info.style.display='';
  }

  function applyEnabledState(enabled,{announce=true}={}){
    const checkbox=$(CHECK_ID);
    if(checkbox)checkbox.checked=!!enabled;
    if(enabled){
      const booklet=$('bookletCheck');
      if(booklet&&!booklet.checked){
        booklet.checked=true;
        booklet.dispatchEvent(new Event('change',{bubbles:true}));
      }
      forceFourUp();
      if(announce)showMessage('동일 소책자 2권 반복 배치를 켰습니다. 4-up 소책자 모드로 맞췄습니다.');
    }
    updateBodyState();
    updateHint();
    try{if(typeof updateBookletPadInfo==='function')updateBookletPadInfo();}catch(_){}
    syncPadInfo();
    requestPreview(80);
    window.dispatchEvent(new CustomEvent('programstudio:booklet-repeat-two-changed',{detail:{enabled:isEnabled()}}));
  }

  function installStyles(){
    if($(STYLE_ID))return;
    const style=document.createElement('style');
    style.id=STYLE_ID;
    style.textContent=`
      .booklet-repeat-two-panel{margin-top:7px;padding:8px 9px;border:1px solid #cbdcf0;border-radius:9px;background:#f8fbff}
      .booklet-repeat-two-label{display:flex;align-items:flex-start;gap:7px;cursor:pointer;color:#1f3a55}
      .booklet-repeat-two-label input{width:auto!important;margin-top:2px;flex:0 0 auto}
      .booklet-repeat-two-label strong{display:block;font-size:11px;font-weight:900}
      .booklet-repeat-two-label small{display:block;margin-top:2px;font-size:9px;line-height:1.45;color:#64748b;font-weight:650}
      .booklet-repeat-two-badge{display:inline-flex;margin-left:4px;padding:1px 5px;border-radius:999px;background:#dbeafe;color:#1d4ed8;font-size:8px;font-weight:900;vertical-align:1px}
      body.${BODY_CLASS} #${PANEL_ID}{border-color:#60a5fa;background:#eff6ff;box-shadow:0 0 0 2px rgba(37,99,235,.06)}
      body.${BODY_CLASS} #bookletSheetPreviewPanel .booklet-sheet-visual::after{content:'가운데 재단';position:absolute;left:4px;right:4px;top:50%;border-top:1px dashed rgba(220,38,38,.75);color:#b91c1c;font:800 8px/1 Pretendard,sans-serif;text-align:right;padding-top:2px;pointer-events:none;text-shadow:0 1px 0 #fff}
      @media(max-width:900px){.booklet-repeat-two-panel{display:none!important}}
    `;
    document.head.appendChild(style);
  }

  function installUi(){
    if($(PANEL_ID))return true;
    const booklet=$('bookletCheck');
    const label=booklet?.closest('label');
    if(!booklet||!label||!label.parentElement)return false;

    const panel=document.createElement('div');
    panel.id=PANEL_ID;
    panel.className='booklet-repeat-two-panel';
    panel.innerHTML=`
      <label class="booklet-repeat-two-label" for="${CHECK_ID}">
        <input type="checkbox" id="${CHECK_ID}">
        <span>
          <strong>동일 소책자 2권 반복 <span class="booklet-repeat-two-badge">2 COPY</span></strong>
          <small id="bookletRepeatTwoHint">큰 용지에 같은 소책자를 위·아래 2벌 배치합니다. 출력 용지는 A3 등 필요한 큰 규격을 선택하세요.</small>
        </span>
      </label>`;
    label.insertAdjacentElement('afterend',panel);

    $(CHECK_ID)?.addEventListener('change',event=>applyEnabledState(event.target.checked));
    booklet.addEventListener('change',()=>{
      if(!booklet.checked&&$(CHECK_ID)?.checked)applyEnabledState(false,{announce:false});
      else{updateBodyState();updateHint();syncPadInfo();}
    });

    document.addEventListener('click',event=>{
      const button=event.target.closest('.nup-btn[data-nup]');
      if(!button||!isEnabled())return;
      if(String(button.dataset.nup)!=='4'){
        applyEnabledState(false,{announce:false});
        showMessage('다른 배치를 선택해 동일 소책자 2권 반복 모드를 해제했습니다.','success');
      }
    },true);

    $('resetBtn')?.addEventListener('click',()=>setTimeout(()=>applyEnabledState(false,{announce:false}),0));
    updateBodyState();
    updateHint();
    return true;
  }

  function installPreviewPatch(){
    if(previewPatchInstalled)return true;
    const original=window.bookletReorderPreview;
    if(typeof original!=='function')return false;
    if(original.__bookletRepeatTwoPatched){previewPatchInstalled=true;return true;}

    const patched=function repeatedBookletPreview(pages,nupValue){
      if(!isEnabled())return original.apply(this,arguments);
      return original.call(this,duplicateBookPages(pages),4);
    };
    patched.__bookletRepeatTwoPatched=true;
    patched.__originalBookletReorderPreview=original;
    window.bookletReorderPreview=patched;
    try{bookletReorderPreview=patched;}catch(_){}
    previewPatchInstalled=true;
    return true;
  }

  function installPadPatch(){
    if(padPatchInstalled)return true;
    const original=window.updateBookletPadInfo;
    if(typeof original!=='function')return false;
    if(original.__bookletRepeatTwoPatched){padPatchInstalled=true;return true;}

    const patched=function repeatedBookletPadInfo(){
      const result=original.apply(this,arguments);
      syncPadInfo();
      updateHint();
      return result;
    };
    patched.__bookletRepeatTwoPatched=true;
    window.updateBookletPadInfo=patched;
    try{updateBookletPadInfo=patched;}catch(_){}
    padPatchInstalled=true;
    return true;
  }

  function installOutputContract(){
    const current=window.PdfOutputContract||{};
    if(current.enrichSettings?.__bookletRepeatTwoPatched)return true;
    const previous=typeof current.enrichSettings==='function'?current.enrichSettings.bind(current):settings=>settings;
    const patched=function repeatedBookletOutputSettings(settings){
      let next=previous(settings);
      if(!next||typeof next!=='object')next=settings&&typeof settings==='object'?{...settings}:{};
      if(!isEnabled())return next;
      const pages=Array.isArray(next.pages)?next.pages:[];
      return {
        ...next,
        booklet:true,
        nup_default:4,
        pages:duplicateBookPages(pages),
      };
    };
    patched.__bookletRepeatTwoPatched=true;
    patched.__bookletRepeatTwoContractVersion=++contractPatchVersion;
    window.PdfOutputContract={...current,enrichSettings:patched};
    return true;
  }

  function boot(attempt=0){
    installStyles();
    const ui=installUi();
    const preview=installPreviewPatch();
    const pad=installPadPatch();
    installOutputContract();
    if((!ui||!preview||!pad)&&attempt<30)setTimeout(()=>boot(attempt+1),100+attempt*20);
  }

  window.PdfBookletRepeatTwo={
    enabled:isEnabled,
    setEnabled(value){applyEnabledState(!!value);},
    duplicateBookPages,
    stage:'booklet-repeat-two-v1',
  };

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>boot(),{once:true});
  else boot();
})();
