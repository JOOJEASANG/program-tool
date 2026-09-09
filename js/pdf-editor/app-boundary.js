(function(){
  'use strict';
  if(window.__pdfEditorAppBoundaryV1)return;
  window.__pdfEditorAppBoundaryV1=true;

  const params=new URLSearchParams(location.search);
  const app=params.get('app');
  if(app!=='layout'&&app!=='booklet')return;
  const profile=window.PdfEditorStandaloneApps?.fromLocation?.(location.search)||null;
  document.documentElement.dataset.pdfApp=app;
  if(profile?.key)document.documentElement.dataset.pdfStandaloneProfile=profile.key;

  const byId=id=>document.getElementById(id);
  const text=(selector,value)=>{const node=document.querySelector(selector);if(node)node.textContent=value;};
  const title=profile?.title||(app==='layout'?'PDF 배치':'소책자 제작');
  const subtitle=profile?.subtitle||(app==='layout'?'PDF 업로드 · 페이지 순서 · N-up · 용지 · 여백 · 출력':'PDF 업로드 · 페이지 순서 · 소책자 배치 · 양면 인쇄 준비 · 출력');
  const sectionTitle=profile?.sectionTitle||(app==='layout'?'페이지 배치':'소책자 배치');
  const defaultNup=Number(profile?.defaultNup)||2;
  const bookletEnabled=profile?.booklet??(app==='booklet');
  const showBooklet=profile?.showBooklet??(app==='booklet');
  const showDocumentEdit=profile?.showDocumentEdit??false;
  let layoutObserver=null;
  let layoutCleanupFrame=0;

  function installStyles(){
    if(byId('pdfAppBoundaryStylesV1'))return;
    const style=document.createElement('style');style.id='pdfAppBoundaryStylesV1';style.textContent=`
      html[data-pdf-app] body{background:#eef3f7}
      html[data-pdf-app] body.pdf-app-embedded{padding-top:0!important}
      html[data-pdf-app] body.pdf-app-embedded .top-nav{display:none!important}
      html[data-pdf-app] body.pdf-app-embedded .app{height:100vh!important}
      html[data-pdf-app] aside>h1{font-size:17px;letter-spacing:-.35px;color:#0b2a55}
      html[data-pdf-app] aside>.sub{font-size:10px;line-height:1.6;color:#667085}
      html[data-pdf-app="layout"] aside>.sub{display:none!important}
      html[data-pdf-app] .sec{border-top-color:#e8edf3}
      html[data-pdf-app] .sec-head .sec-title{letter-spacing:.2px;text-transform:none}
      html[data-pdf-app="booklet"] #bookletRow{display:block!important;border:1px solid #d8e7f8;border-radius:9px;background:#f4f9ff;padding:8px 9px;margin-top:7px!important}
      html[data-pdf-app="layout"] #bookletRow{display:none!important}
      html[data-pdf-app="layout"] #thumbArea .thumb-item[data-file-collapsed="true"]{display:none!important}
      html[data-pdf-app="layout"] #thumbSection>#sb-pages[hidden]{display:none!important}
    `;document.head.appendChild(style);
  }

  function compactText(value){return String(value||'').replace(/\s+/g,' ').trim();}

  function removeMatchingCluster(aside,matcher,maxDepth=5){
    if(!aside)return false;
    const start=matcher(aside);
    if(!start)return false;
    let node=start;
    for(let depth=0;node&&node!==aside&&depth<maxDepth;depth+=1,node=node.parentElement){
      const labels=[...node.querySelectorAll('button')].map(button=>compactText(button.textContent));
      if(labels.length&&matcher(node,true,labels)){
        node.remove();
        return true;
      }
    }
    return false;
  }

  function removeLayoutClutter(){
    if(app!=='layout')return;
    const aside=document.querySelector('.app > aside, .app>aside');
    if(!aside)return;
    aside.querySelector(':scope>.sub')?.remove();
    byId('pdfUploadOrderQuickBarV1')?.remove();
    byId('pageSelectionToolbar')?.remove();

    const uploadButtons=[...aside.querySelectorAll('button')];
    const appendButton=uploadButtons.find(button=>compactText(button.textContent).includes('연속 추가'));
    if(appendButton){
      let node=appendButton.parentElement;
      for(let depth=0;node&&node!==aside&&depth<4;depth+=1,node=node.parentElement){
        const labels=[...node.querySelectorAll('button')].map(button=>compactText(button.textContent));
        if(labels.some(label=>label.includes('연속 추가'))&&labels.some(label=>label.includes('새 묶음 추가'))){node.remove();break;}
      }
    }

    const multiButton=[...aside.querySelectorAll('button')].find(button=>compactText(button.textContent)==='다중 선택');
    if(multiButton){
      let node=multiButton.parentElement;
      for(let depth=0;node&&node!==aside&&depth<4;depth+=1,node=node.parentElement){
        const labels=[...node.querySelectorAll('button')].map(button=>compactText(button.textContent));
        if(labels.includes('전체')&&labels.includes('해제')){node.remove();break;}
      }
    }

    const pageNumberInput=[...aside.querySelectorAll('input')].find(input=>compactText(input.placeholder).includes('페이지 번호'));
    if(pageNumberInput){
      let node=pageNumberInput.parentElement;
      for(let depth=0;node&&node!==aside&&depth<5;depth+=1,node=node.parentElement){
        const labels=[...node.querySelectorAll('button')].map(button=>compactText(button.textContent));
        if(labels.includes('이동')&&labels.some(label=>label.includes('취소'))&&labels.some(label=>label.includes('다시'))){node.remove();break;}
      }
    }
  }

  function syncPageSectionState(head,body,collapsed){
    head.classList.toggle('collapsed',collapsed);
    body.classList.toggle('hidden',collapsed);
    body.hidden=collapsed;
    body.style.display=collapsed?'none':'';
    head.setAttribute('aria-expanded',collapsed?'false':'true');
  }

  function bindPageSectionToggle(){
    if(app!=='layout')return;
    const head=document.querySelector('#thumbSection>.sec-head[data-sec="pages"]');
    const body=byId('sb-pages');
    if(!head||!body||head.dataset.layoutCollapseBound==='1')return;
    head.dataset.layoutCollapseBound='1';
    head.setAttribute('role','button');
    head.tabIndex=0;
    const toggle=event=>{
      event.preventDefault();
      event.stopImmediatePropagation();
      const collapsed=!(body.hidden||body.classList.contains('hidden')||body.style.display==='none');
      syncPageSectionState(head,body,collapsed);
    };
    head.addEventListener('click',toggle,true);
    head.addEventListener('keydown',event=>{
      if(event.key!=='Enter'&&event.key!==' ')return;
      toggle(event);
    },true);
    syncPageSectionState(head,body,body.hidden||body.classList.contains('hidden')||body.style.display==='none');
  }

  function scheduleLayoutCleanup(){
    if(app!=='layout'||layoutCleanupFrame)return;
    layoutCleanupFrame=requestAnimationFrame(()=>{
      layoutCleanupFrame=0;
      removeLayoutClutter();
      bindPageSectionToggle();
    });
  }

  function installLayoutObserver(){
    if(app!=='layout'||layoutObserver||typeof MutationObserver!=='function')return;
    const aside=document.querySelector('.app > aside, .app>aside');
    if(!aside)return;
    layoutObserver=new MutationObserver(scheduleLayoutCleanup);
    layoutObserver.observe(aside,{childList:true,subtree:true});
  }

  function focusMode(){
    installStyles();
    if(params.get('embed')==='1')document.body.classList.add('pdf-app-embedded');
    const edit=byId('sb-edit')?.closest('.sec');if(edit)edit.style.display=showDocumentEdit?'':'none';
    text('.nav-title',title);text('aside>h1',title);
    if(app==='layout')document.querySelector('aside>.sub')?.remove();else text('aside>.sub',subtitle);
    const nupTitle=document.querySelector('[data-sec="nup"] .sec-title');if(nupTitle)nupTitle.textContent=sectionTitle;
    const bookletRow=byId('bookletRow');if(bookletRow)bookletRow.hidden=!showBooklet;
    const nup=document.querySelector(`.nup-btn[data-nup="${defaultNup}"]`);
    if(nup&&!nup.classList.contains('active'))nup.click();
    if(app==='layout'){
      const check=byId('bookletCheck');
      if(check&&check.checked){check.checked=false;check.dispatchEvent(new Event('change',{bubbles:true}));}
      scheduleLayoutCleanup();
      installLayoutObserver();
      return true;
    }
    const check=byId('bookletCheck');
    if(check&&check.checked!==bookletEnabled){check.checked=bookletEnabled;check.dispatchEvent(new Event('change',{bubbles:true}));}
    return Boolean(check);
  }
  function boot(){
    let attempts=0;
    const tick=()=>{attempts+=1;const ready=focusMode();if((!ready||attempts<4)&&attempts<30)setTimeout(tick,120);};tick();
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
  window.PdfEditorAppBoundary={app,profile:profile?.key||app,sync:focusMode,stage:'pdf-layout-booklet-boundary-v3'};
})();