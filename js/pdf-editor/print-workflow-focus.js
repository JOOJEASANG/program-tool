// PDF print workflow focus: keep print layout and PDF preprocessing clearly separated.
(function(){
  'use strict';
  if(window.__pdfPrintWorkflowFocusV1)return;
  window.__pdfPrintWorkflowFocusV1=true;

  const path=location.pathname.replace(/\/+$/,'')||'/';
  if(!(path==='/pdf-editor'||path==='/pdf-editor/index.html'||path.endsWith('/pdf-editor/index.html')||path.endsWith('/tools/pdf-editor.html')))return;

  const STYLE_ID='pdfPrintWorkflowFocusStyles';
  const PANEL_ID='pdfPrintWorkflowFocusPanel';
  const UTILITY_CARD_ID='pdfPrintUtilityRedirectCard';
  const SUPPORTED_BOOKLET_NUP=new Set([2,4,6,8]);
  let mode='normal';
  let observer=null;
  let syncing=false;
  let attempts=0;

  const $=id=>document.getElementById(id);
  const setText=(node,value)=>{if(node&&node.textContent!==value)node.textContent=value;};

  function activeNupButton(){return document.querySelector('.nup-btn.active[data-nup]');}
  function currentNup(){return Number(activeNupButton()?.dataset?.nup||0);}
  function bookletCheck(){return $('bookletCheck');}
  function setChecked(input,checked){
    if(!input||input.checked===checked)return;
    input.checked=checked;
    input.dispatchEvent(new Event('change',{bubbles:true}));
  }
  function clickNup(value){
    const button=document.querySelector(`.nup-btn[data-nup="${value}"]`);
    if(button&&!button.classList.contains('active'))button.click();
    return button;
  }

  function installStyles(){
    if($(STYLE_ID))return;
    const style=document.createElement('style');
    style.id=STYLE_ID;
    style.textContent=`
      .pdf-print-workflow{margin:0 0 13px;padding:12px;border:1px solid #d8e3ee;border-radius:13px;background:linear-gradient(180deg,#fafdff,#f5f9fc)}
      .pdf-print-workflow-title{font-size:11px;font-weight:950;color:#18324e;margin-bottom:3px}.pdf-print-workflow-note{font-size:9.5px;line-height:1.5;color:#667085;margin-bottom:9px}
      .pdf-print-mode-grid{display:grid;grid-template-columns:1fr 1fr;gap:7px}.pdf-print-mode{min-height:54px;border:1.5px solid #cfdbe7;border-radius:10px;background:#fff;padding:8px 9px;text-align:left;cursor:pointer;font-family:inherit;color:#344054;transition:border-color .15s,background .15s,box-shadow .15s,transform .08s}.pdf-print-mode:hover{border-color:#7fa9c8;background:#f8fcff}.pdf-print-mode:active{transform:translateY(1px)}.pdf-print-mode.on{border-color:#1769a0;background:#eef7ff;box-shadow:0 0 0 2px rgba(23,105,160,.08)}.pdf-print-mode strong{display:block;font-size:11px;font-weight:950;color:#18324e;margin-bottom:2px}.pdf-print-mode span{display:block;font-size:8.5px;line-height:1.4;color:#667085}.pdf-print-mode.on strong{color:#0f5f91}
      .pdf-print-booklet-guide{display:none;margin-top:9px;border:1px solid #bfe0d5;border-radius:9px;background:#f0fdf8;padding:8px 9px}.pdf-print-workflow[data-mode="booklet"] .pdf-print-booklet-guide{display:block}.pdf-print-booklet-guide strong{display:block;font-size:10px;color:#116149;margin-bottom:3px}.pdf-print-booklet-guide span{display:block;font-size:8.5px;line-height:1.5;color:#4b6f64}.pdf-print-booklet-pad{margin-top:4px;font-size:8.5px;font-weight:900;color:#0f766e}
      .pdf-print-utility-card{margin:0 0 12px;padding:9px 10px;border:1px solid #e3e8ef;border-radius:10px;background:#fafbfc}.pdf-print-utility-card strong{display:block;font-size:10px;color:#475467;margin-bottom:3px}.pdf-print-utility-card p{font-size:8.5px;line-height:1.45;color:#7a8493;margin:0 0 7px}.pdf-print-utility-link{display:flex;align-items:center;justify-content:center;min-height:34px;border:1px solid #cbd5e1;border-radius:8px;background:#fff;color:#344054;text-decoration:none;font-size:9.5px;font-weight:900}.pdf-print-utility-link:hover{border-color:#8096ad;background:#f8fafc;color:#18324e}
      html[data-pdf-print-mode="booklet"] .nup-btn[data-nup="1"],html[data-pdf-print-mode="booklet"] .nup-btn[data-nup="3"],html[data-pdf-print-mode="booklet"] .nup-btn[data-nup="9"]{display:none!important}
      #bookletRow{display:none!important}
      #pdfSpreadSplitPanel[data-print-workflow-separated="true"]{display:none!important}
      .sec[data-print-section="nup"] .sec-title{letter-spacing:.1px}
      @media(max-width:900px){.pdf-print-mode-grid{grid-template-columns:1fr}.pdf-print-workflow{padding:10px}}
    `;
    document.head.appendChild(style);
  }

  function installWorkflowPanel(){
    if($(PANEL_ID))return true;
    const aside=document.querySelector('.app > aside');
    const uploadSection=$('sb-upload')?.closest('.sec');
    if(!aside||!uploadSection)return false;
    const panel=document.createElement('section');
    panel.id=PANEL_ID;
    panel.className='pdf-print-workflow';
    panel.dataset.mode=mode;
    panel.innerHTML=`
      <div class="pdf-print-workflow-title">작업 방식</div>
      <div class="pdf-print-workflow-note">먼저 결과 형태를 고르면 필요한 인쇄 설정만 보여줍니다.</div>
      <div class="pdf-print-mode-grid" role="group" aria-label="PDF 인쇄 작업 방식">
        <button type="button" class="pdf-print-mode on" data-print-mode="normal"><strong>일반 인쇄 배치</strong><span>1장·2장·여러 면을 용지에 배치</span></button>
        <button type="button" class="pdf-print-mode" data-print-mode="booklet"><strong>소책자</strong><span>접었을 때 페이지 순서가 맞게 자동 배열</span></button>
      </div>
      <div class="pdf-print-booklet-guide"><strong>소책자 자동 배치</strong><span>페이지 순서를 중철용으로 자동 재배열하고, 부족한 쪽은 4의 배수가 되도록 빈쪽을 자동 보충합니다. 미리보기의 ‘용지 앞·뒷면’에서 실제 종이 구성을 확인할 수 있습니다.</span><div id="pdfPrintBookletPad" class="pdf-print-booklet-pad"></div></div>`;
    uploadSection.parentNode.insertBefore(panel,uploadSection);
    panel.querySelectorAll('[data-print-mode]').forEach(button=>button.addEventListener('click',()=>setMode(button.dataset.printMode,true)));
    return true;
  }

  function installUtilityCard(){
    if($(UTILITY_CARD_ID))return true;
    const uploadBody=$('sb-upload');
    if(!uploadBody)return false;
    const card=document.createElement('div');
    card.id=UTILITY_CARD_ID;
    card.className='pdf-print-utility-card';
    card.innerHTML=`<strong>PDF 자체를 가공해야 하나요?</strong><p>펼침면 분할, 페이지 추출·나누기, 병합·정리 같은 작업은 인쇄 배치와 분리했습니다.</p><a class="pdf-print-utility-link" href="/pdf-preflight/">PDF 가공·분할 도구로 이동 →</a>`;
    uploadBody.appendChild(card);
    return true;
  }

  function separateSpreadSplit(){
    const split=$('pdfSpreadSplitPanel');
    if(!split)return false;
    split.dataset.printWorkflowSeparated='true';
    split.hidden=true;
    return true;
  }

  function syncBookletPad(){
    if(mode!=='booklet'){setText($('pdfPrintBookletPad'),'');return;}
    try{updateBookletPadInfo?.();}catch(_){}
    const legacy=$('bookletPadInfo');
    const text=String(legacy?.textContent||'').trim();
    setText($('pdfPrintBookletPad'),text);
  }

  function renameSections(){
    const nupBody=$('sb-nup');
    const nupSection=nupBody?.closest('.sec');
    if(nupSection){
      nupSection.dataset.printSection='nup';
      setText(nupSection.querySelector('.sec-title'),mode==='booklet'?'소책자 배치':'페이지 배치');
      setText(nupBody.querySelector('.field > label'),mode==='booklet'?'한 장에 배치할 소책자 면 수':'한 장에 배치할 페이지 수');
    }
    const edit=$('sb-edit')?.closest('.sec');
    if(edit)setText(edit.querySelector('.sec-title'),'인쇄 표시 · 선택');
  }

  function syncButtons(){
    const panel=$(PANEL_ID);
    if(panel)panel.dataset.mode=mode;
    document.documentElement.dataset.pdfPrintMode=mode;
    document.querySelectorAll('[data-print-mode]').forEach(button=>{
      const on=button.dataset.printMode===mode;
      button.classList.toggle('on',on);
      button.setAttribute('aria-pressed',on?'true':'false');
    });
    document.querySelectorAll('.nup-btn[data-nup]').forEach(button=>{
      const value=Number(button.dataset.nup||0);
      const badge=button.querySelector('.nup-badge');
      if(badge&&!badge.dataset.normalLabel)badge.dataset.normalLabel=badge.textContent||'';
      const desired=mode==='booklet'&&SUPPORTED_BOOKLET_NUP.has(value)
        ?(value===2?'1줄 · 앞뒤':`${value/2}줄 · 앞뒤`)
        :(badge?.dataset.normalLabel||'');
      if(badge&&desired)setText(badge,desired);
    });
    renameSections();
    syncBookletPad();
  }

  function setMode(next,userInitiated=false){
    if(syncing)return;
    const normalized=next==='booklet'?'booklet':'normal';
    syncing=true;
    try{
      mode=normalized;
      if(mode==='booklet'){
        const value=currentNup();
        if(!SUPPORTED_BOOKLET_NUP.has(value))clickNup(2);
        setChecked(bookletCheck(),true);
      }else{
        setChecked(bookletCheck(),false);
      }
      syncButtons();
      if(userInitiated&&mode==='booklet'){
        try{schedulePreview?.(80);}catch(_){}
        setTimeout(syncBookletPad,0);
      }
    }finally{syncing=false;}
  }

  function inferModeFromLegacy(){
    if(bookletCheck()?.checked)mode='booklet';
  }

  function bindLegacySync(){
    const check=bookletCheck();
    if(check&&check.dataset.printWorkflowBound!=='1'){
      check.dataset.printWorkflowBound='1';
      check.addEventListener('change',()=>{
        if(syncing)return;
        mode=check.checked?'booklet':'normal';
        syncButtons();
      });
    }
  }

  function installObserver(){
    if(observer||!document.body)return;
    observer=new MutationObserver(()=>{
      if(syncing)return;
      installWorkflowPanel();
      installUtilityCard();
      separateSpreadSplit();
      bindLegacySync();
      syncButtons();
    });
    observer.observe(document.body,{childList:true,subtree:true});
  }

  function install(){
    attempts+=1;
    installStyles();
    inferModeFromLegacy();
    const panel=installWorkflowPanel();
    const card=installUtilityCard();
    separateSpreadSplit();
    bindLegacySync();
    syncButtons();
    installObserver();
    if(panel&&card&&bookletCheck()){
      window.PdfPrintWorkflowFocus={
        setMode,
        get mode(){return mode;},
        supportedBookletNup:[...SUPPORTED_BOOKLET_NUP],
        stage:'pdf-print-workflow-focus-v1'
      };
      return true;
    }
    if(attempts<80)setTimeout(install,100);
    return false;
  }

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install,{once:true});
  else install();
})();
