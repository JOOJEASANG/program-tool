(function(){
  'use strict';
  if(window.__programStudioModularAppShellV7)return;
  window.__programStudioModularAppShellV7=true;

  // /apps/* is now a compatibility surface. Design routes are redirected by
  // apps/index.html to Print Checker before this runtime is used. Only the two
  // PDF standalone shells remain active here.
  const APPS=Object.freeze({
    'pdf-layout':Object.freeze({
      title:'PDF 배치',
      category:'PDF · N-UP',
      description:'여러 PDF 페이지를 정리하고 N-up, 용지, 여백과 순서를 설정해 출력용 PDF를 만듭니다.',
      symbol:'PDF',
      workspaceTitle:'PDF 배치 작업실',
      workspaceHint:'원본 페이지를 불러온 뒤 용지·배치·여백을 확인하고 출력용 PDF를 만드세요.',
      target:'/pdf-editor/?embed=1&app=layout',
      legacy:'/pdf-editor/'
    }),
    booklet:Object.freeze({
      title:'소책자 제작',
      category:'PDF · BOOKLET',
      description:'소책자 페이지 순서와 양면 인쇄 흐름을 중심으로 필요한 설정만 제공합니다.',
      symbol:'책',
      workspaceTitle:'소책자 조판 작업실',
      workspaceHint:'페이지 순서와 양면 인쇄 방향을 확인한 뒤 소책자용 PDF를 완성하세요.',
      target:'/pdf-editor/?embed=1&app=booklet',
      legacy:'/pdf-editor/'
    })
  });

  const byId=id=>document.getElementById(id);
  const path=location.pathname.replace(/\/+$/,'');
  const key=(path.split('/').filter(Boolean).pop()||'').toLowerCase();
  const app=APPS[key]||null;
  const frame=byId('appFrame');
  const loading=byId('workspaceLoading');
  const error=byId('workspaceError');
  const engineChip=document.querySelector('.engine-chip');
  let timeoutTimer=0;
  let accessRetryTimer=0;
  let frameReadyTimer=0;
  let started=false;
  let accessGranted=false;
  let frameReady=false;

  function setText(id,value){const node=byId(id);if(node)node.textContent=value;}

  function applyAppChrome(){
    if(!app)return;
    document.documentElement.dataset.appTheme=key;
    document.documentElement.dataset.appKind='pdf';
    setText('appTitle',app.title);
    setText('appCategory',app.category);
    setText('appDescription',app.description);
    setText('appSymbol',app.symbol);
    setText('appWorkspaceTitle',app.workspaceTitle);
    setText('appWorkspaceHint',app.workspaceHint);
    const context=byId('productContext');if(context)context.dataset.appKey=key;
    const quick=byId('appQuickActions');if(quick){quick.replaceChildren();quick.hidden=true;}
  }

  function fail(message){
    clearTimeout(timeoutTimer);clearTimeout(frameReadyTimer);
    if(frame)frame.style.visibility='visible';
    loading?.classList.add('hide');
    if(error){
      error.hidden=false;
      const paragraph=error.querySelector('p');
      if(paragraph&&message)paragraph.textContent=message;
    }
    engineChip?.classList.add('loading');
    setText('engineLabel','연결 확인 필요');
  }

  function ready(){
    if(!accessGranted||!frameReady)return;
    clearTimeout(timeoutTimer);clearTimeout(frameReadyTimer);
    if(error)error.hidden=true;
    if(frame)frame.style.visibility='visible';
    loading?.classList.add('hide');
    engineChip?.classList.remove('loading');
    setText('engineLabel','공통 엔진 연결됨');
    document.documentElement.dataset.modularAppStableReveal='true';
    document.documentElement.dataset.modularAppReady='true';
  }

  function markFrameReady(stage='load'){
    if(frameReady)return;
    frameReady=true;
    clearTimeout(frameReadyTimer);
    document.documentElement.dataset.modularAppEnginePreload='ready';
    document.documentElement.dataset.modularAppFrameReadyStage=stage;
    ready();
  }

  function load(){
    if(!app){fail('지원하지 않는 프로그램 주소입니다.');return;}
    if(started)return;
    started=true;
    frameReady=false;
    document.documentElement.removeAttribute('data-modular-app-ready');
    document.title=`${app.title} · Program Studio`;
    applyAppChrome();
    setText('loadingTitle',`${app.title} 작업실 준비 중`);
    setText('loadingMessage',app.workspaceHint);
    const legacy=byId('legacyLink');if(legacy){legacy.href=app.legacy;legacy.hidden=false;legacy.textContent='PDF 편집기';}
    engineChip?.classList.add('loading');
    setText('engineLabel','공통 엔진 연결 중');
    loading?.classList.remove('hide');
    if(error)error.hidden=true;
    if(frame){frame.style.visibility='hidden';frame.src=app.target;}
    document.documentElement.dataset.modularAppEnginePreload='started';
    clearTimeout(timeoutTimer);
    timeoutTimer=setTimeout(()=>fail('작업 엔진 응답이 늦습니다. 새로고침 후 다시 시도해 주세요.'),18000);
  }

  function grantAccess(){
    if(accessGranted)return;
    accessGranted=true;
    clearTimeout(accessRetryTimer);
    document.documentElement.dataset.modularAppAccess='approved';
    ready();
  }

  function retryAccess(){
    if(accessGranted)return;
    clearTimeout(accessRetryTimer);
    accessRetryTimer=setTimeout(startAfterAccess,50);
  }

  function startAfterAccess(){
    if(accessGranted)return;
    if(document.documentElement.dataset.accessReady==='true'){grantAccess();return;}
    const access=window.ProgramAccessReady;
    if(access&&typeof access.then==='function'){
      const observed=access;
      Promise.resolve(observed).then(result=>{
        if(accessGranted)return;
        if(result||document.documentElement.dataset.accessReady==='true'){grantAccess();return;}
        retryAccess();
      }).catch(retryAccess);
      return;
    }
    retryAccess();
  }

  frame?.addEventListener('load',()=>{
    if(frameReady)return;
    try{
      const doc=frame.contentDocument;
      const html=doc?.documentElement;
      const win=frame.contentWindow;
      if(html?.dataset?.appReady==='true'||win?.PdfEditorCoreRuntime){markFrameReady('load');return;}
    }catch(_){}
    clearTimeout(frameReadyTimer);
    frameReadyTimer=setTimeout(()=>markFrameReady('load-fallback'),220);
  });
  frame?.addEventListener('error',()=>fail('작업 프로그램을 불러오지 못했습니다.'));
  byId('retryBtn')?.addEventListener('click',()=>{started=false;frameReady=false;load();});

  // Engine loading intentionally starts immediately. Access approval owns the
  // final reveal, keeping authentication and iframe loading parallel.
  load();
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',startAfterAccess,{once:true});else startAfterAccess();

  window.ProgramStudioModularAppShell=Object.freeze({
    apps:APPS,
    appKey:key,
    reload:()=>{started=false;frameReady=false;load();},
    stage:'modular-pdf-shell-v7-dead-design-cleanup',
    parallelStage:'modular-app-shell-parallel-engine-preload-v2'
  });
})();
