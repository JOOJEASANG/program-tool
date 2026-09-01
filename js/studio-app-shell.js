(function(){
  'use strict';
  if(window.__programStudioModularAppShellV1)return;
  window.__programStudioModularAppShellV1=true;

  const APPS=Object.freeze({
    cover:{title:'표지 제작',category:'DESIGN · COVER',description:'앞표지·뒤표지·책등과 인쇄 안전영역을 한 작업에서 관리합니다.',symbol:'표',workspaceTitle:'표지 인쇄 작업실',workspaceHint:'규격과 책등을 먼저 맞춘 뒤 내용과 최종 출력을 진행하세요.',kind:'design',quick:[{label:'규격·책등',target:'designCoverSettingsTools'},{label:'빠른 제작',target:'designSimpleResultTools'},{label:'레이어',target:'designLayerTools'},{label:'최종 출력',target:'designFinalPrintCheckTools',output:true}],target:'/design-editor/general?embed=1&mode=cover&preset=cover-a4&app=cover',legacy:'/design-editor/?mode=cover'},
    poster:{title:'포스터 · 전단지 제작',category:'DESIGN · POSTER / FLYER',description:'같은 단면 편집 도구에서 용지 규격만 바꿔 포스터와 전단지를 제작합니다.',symbol:'포',workspaceTitle:'포스터 · 전단지 작업실',workspaceHint:'용지 규격과 방향을 먼저 정한 뒤 텍스트·이미지·배치를 편집하세요.',kind:'design',quick:[{label:'작업 규격',target:'designEmbeddedModeCard'},{label:'빠른 제작',target:'designSimpleResultTools'},{label:'스타터 디자인',target:'designRecipeTools'},{label:'최종 출력',target:'designFinalPrintCheckTools',output:true}],target:'/design-editor/general?embed=1&mode=poster&preset=poster-a4&paper=a4&orientation=portrait&w=210&h=297&app=poster&surface=poster-flyer',legacy:'/design-editor/?mode=poster'},
    flyer:{title:'포스터 · 전단지 제작',category:'DESIGN · POSTER / FLYER',description:'같은 단면 편집 도구에서 용지 규격만 바꿔 포스터와 전단지를 제작합니다.',symbol:'전',workspaceTitle:'포스터 · 전단지 작업실',workspaceHint:'용지 규격과 방향을 먼저 정한 뒤 텍스트·이미지·배치를 편집하세요.',kind:'design',quick:[{label:'작업 규격',target:'designEmbeddedModeCard'},{label:'빠른 제작',target:'designSimpleResultTools'},{label:'스타터 디자인',target:'designRecipeTools'},{label:'최종 출력',target:'designFinalPrintCheckTools',output:true}],target:'/design-editor/general?embed=1&mode=poster&preset=poster-a4&paper=a4&orientation=portrait&w=210&h=297&app=poster&surface=poster-flyer',legacy:'/design-editor/?mode=poster'},
    invitation:{title:'초대장 제작',category:'DESIGN · INVITATION',description:'접지 위치와 앞뒤 면을 확인하며 초대장을 제작합니다.',symbol:'초',workspaceTitle:'초대장 편집 작업실',workspaceHint:'용지와 접지 구조를 확인한 뒤 초대 정보와 앞뒤 면을 정돈하세요.',kind:'design',quick:[{label:'작업 규격',target:'designEmbeddedModeCard'},{label:'빠른 제작',target:'designSimpleResultTools'},{label:'빠른 구성',target:'designComponentBlocksTools'},{label:'최종 출력',target:'designFinalPrintCheckTools',output:true}],target:'/design-editor/general?embed=1&mode=invitation&preset=invitation-a4&paper=a4&orientation=landscape&w=297&h=210&app=invitation',legacy:'/design-editor/?mode=invitation'},
    notice:{title:'안내장 제작',category:'DESIGN · NOTICE',description:'안내 문구와 정보 구조를 빠르게 정돈하고 인쇄 규격에 맞춰 출력합니다.',symbol:'안',workspaceTitle:'안내장 정보 작업실',workspaceHint:'안내 정보의 순서를 먼저 정리하고 가독성과 인쇄 안전영역을 확인하세요.',kind:'design',quick:[{label:'작업 규격',target:'designEmbeddedModeCard'},{label:'빠른 제작',target:'designSimpleResultTools'},{label:'스타터 구성',target:'designRecipeTools'},{label:'최종 출력',target:'designFinalPrintCheckTools',output:true}],target:'/design-editor/general?embed=1&mode=invitation&preset=invitation-a4&paper=a4&orientation=landscape&w=297&h=210&app=invitation&surface=notice',legacy:'/design-editor/?mode=invitation'},
    leaflet:{title:'리플렛 제작',category:'DESIGN · LEAFLET',description:'4P~12P 접지 구조, 패널 폭, 앞뒤 면과 접지 안전영역을 함께 관리합니다.',symbol:'리',workspaceTitle:'리플렛 접지 작업실',workspaceHint:'접지와 패널 구조를 먼저 확정하고 면별 내용과 배치를 이어서 정리하세요.',kind:'design',quick:[{label:'작업 규격',target:'designEmbeddedModeCard'},{label:'전문 배치',target:'designPhase4SmartLayout'},{label:'빠른 구성',target:'designComponentBlocksTools'},{label:'최종 출력',target:'designFinalPrintCheckTools',output:true}],target:'/design-editor/general?embed=1&mode=leaflet3&preset=leaflet-3-roll&paper=a4&orientation=landscape&w=297&h=210&fold=leaflet-3-roll&app=leaflet',legacy:'/design-editor/?mode=leaflet3'},
    'pdf-layout':{title:'PDF 배치',category:'PDF · N-UP',description:'여러 PDF 페이지를 정리하고 N-up, 용지, 여백과 순서를 설정해 출력용 PDF를 만듭니다.',symbol:'PDF',workspaceTitle:'PDF 배치 작업실',workspaceHint:'원본 페이지를 불러온 뒤 용지·배치·여백을 확인하고 출력용 PDF를 만드세요.',kind:'pdf',quick:[],target:'/pdf-editor/?embed=1&app=layout',legacy:'/pdf-editor/'},
    booklet:{title:'소책자 제작',category:'PDF · BOOKLET',description:'소책자 페이지 순서와 양면 인쇄 흐름을 중심으로 필요한 설정만 제공합니다.',symbol:'책',workspaceTitle:'소책자 조판 작업실',workspaceHint:'페이지 순서와 양면 인쇄 방향을 확인한 뒤 소책자용 PDF를 완성하세요.',kind:'pdf',quick:[],target:'/pdf-editor/?embed=1&app=booklet',legacy:'/pdf-editor/'}
  });

  const byId=id=>document.getElementById(id);
  const path=location.pathname.replace(/\/+$/,'');
  const key=(path.split('/').filter(Boolean).pop()||'').toLowerCase();
  const app=APPS[key]||null;
  const frame=byId('appFrame');
  const loading=byId('workspaceLoading');
  const error=byId('workspaceError');
  const engineChip=document.querySelector('.engine-chip');
  let timer=0;
  let started=false;
  let accessGranted=false;
  let frameReady=false;
  let accessRetryTimer=0;
  let frameProbeTimer=0;
  let expectedFrameUrl='';

  const DESIGN_PRELOADS=[
    '/js/design-editor/presets.js?v=20260821-1',
    '/js/design-editor/app.js?v=20260821-1',
    '/js/design-editor/focused-professional-workspace.js?v=20260901-1'
  ];

  function setText(id,value){const node=byId(id);if(node)node.textContent=value;}
  function setQuickActionsEnabled(enabled){byId('appQuickActions')?.querySelectorAll('button').forEach(button=>{button.disabled=!enabled;});}
  function warmDesignAssets(){
    if(app?.kind!=='design')return;
    DESIGN_PRELOADS.forEach(href=>{
      if(document.head.querySelector(`link[data-design-preload="${href}"]`))return;
      const link=document.createElement('link');link.rel='preload';link.as='script';link.href=href;link.dataset.designPreload=href;document.head.appendChild(link);
    });
    document.documentElement.dataset.modularAppAssetWarmup='started';
  }
  function openQuickAction(action){
    if(!action||!frame)return false;
    try{
      const win=frame.contentWindow,doc=frame.contentDocument;
      if(!win||!doc)return false;
      if(action.target&&win.DesignEditorEssentialWorkspace?.revealTarget?.(action.target,true)){
        document.documentElement.dataset.modularAppQuickAction=action.target;
        try{win.dispatchEvent(new CustomEvent('programstudio:external-workspace-jump',{detail:{target:action.target,contextPane:action.target==='inspector'||action.target==='designLayerTools',app:key}}));}catch(_){}
        return true;
      }
      const node=action.target?doc.getElementById(action.target):null;
      if(node){
        const sidebar=win.DesignEditorSidebarMenuOrder;
        const section=sidebar?.sectionFor?.(node);
        if(section)sidebar?.openSection?.(section,true);
        try{node.scrollIntoView({behavior:'smooth',block:'start'});}catch(_){node.scrollIntoView?.();}
        document.documentElement.dataset.modularAppQuickAction=action.target;
        try{win.dispatchEvent(new CustomEvent('programstudio:external-workspace-jump',{detail:{target:action.target,section,app:key}}));}catch(_){}
        return true;
      }
      if(action.step&&win.DesignEditorWorkspaceNavigation?.select){
        win.DesignEditorWorkspaceNavigation.select(action.step,true);document.documentElement.dataset.modularAppQuickAction=action.step;return true;
      }
    }catch(_){}
    return false;
  }
  function renderQuickActions(){
    const nav=byId('appQuickActions');if(!nav)return;
    nav.replaceChildren();const actions=Array.isArray(app?.quick)?app.quick:[];nav.hidden=!actions.length;
    actions.forEach(action=>{const button=document.createElement('button');button.type='button';button.textContent=action.label;button.disabled=true;if(action.target)button.dataset.target=action.target;if(action.output)button.dataset.output='true';button.addEventListener('click',()=>openQuickAction(action));nav.appendChild(button);});
  }
  function applyAppChrome(){
    if(!app)return;
    document.documentElement.dataset.appTheme=key;document.documentElement.dataset.appKind=app.kind||'design';
    setText('appTitle',app.title);setText('appCategory',app.category);setText('appDescription',app.description);setText('appSymbol',app.symbol||'PS');setText('appWorkspaceTitle',app.workspaceTitle||app.title);setText('appWorkspaceHint',app.workspaceHint||app.description);
    const context=byId('productContext');if(context)context.dataset.appKey=key;renderQuickActions();
  }
  function fail(message){clearTimeout(timer);clearTimeout(frameProbeTimer);if(frame)frame.style.visibility='visible';if(loading)loading.classList.add('hide');if(error){error.hidden=false;const p=error.querySelector('p');if(p&&message)p.textContent=message;}engineChip?.classList.add('loading');setText('engineLabel','연결 확인 필요');setQuickActionsEnabled(false);}
  function prepareFrameForReveal(){
    if(!frame)return;
    if(app?.kind==='design'){
      try{
        const doc=frame.contentDocument;
        if(doc?.documentElement){
          doc.documentElement.dataset.parentAccessApproved='true';
          doc.getElementById('authLoading')?.classList.add('hidden');
        }
      }catch(_){}
    }
    frame.style.visibility='visible';
    document.documentElement.dataset.modularAppStableReveal='true';
  }
  function ready(){
    if(!accessGranted||!frameReady)return;
    clearTimeout(timer);clearTimeout(frameProbeTimer);error&&(error.hidden=true);prepareFrameForReveal();loading?.classList.add('hide');engineChip?.classList.remove('loading');setText('engineLabel','공통 엔진 연결됨');setQuickActionsEnabled(true);document.documentElement.dataset.modularAppReady='true';
  }
  function maybeReady(){if(accessGranted&&frameReady)ready();}
  function markFrameReady(stage='load'){
    if(frameReady)return;
    frameReady=true;clearTimeout(frameProbeTimer);document.documentElement.dataset.modularAppEnginePreload='ready';document.documentElement.dataset.modularAppFrameReadyStage=stage;maybeReady();
  }
  function currentFrameMatchesTarget(){
    if(!frame||!expectedFrameUrl)return false;
    try{
      const actualHref=frame.contentWindow.location.href;
      const candidate=actualHref==='about:blank'?frame.src:actualHref;
      const current=new URL(candidate,location.origin),expected=new URL(expectedFrameUrl);
      return current.origin===expected.origin&&current.pathname===expected.pathname&&current.search===expected.search;
    }catch(_){return false;}
  }
  function designFrameCanReveal(){
    if(app?.kind!=='design'||!currentFrameMatchesTarget())return false;
    try{
      const win=frame.contentWindow,doc=frame.contentDocument;
      if(!win||!doc?.documentElement)return false;
      const baseReady=Boolean(win.DesignEditorApp)&&Boolean(doc.getElementById('editorShell')||doc.getElementById('startScreen'));
      const focusedReady=doc.documentElement.dataset.designFocusedWorkspace==='1';
      const bootStable=!doc.documentElement.classList.contains('app-booting');
      return baseReady&&focusedReady&&bootStable;
    }catch(_){return false;}
  }
  function startFrameProbe(){
    clearTimeout(frameProbeTimer);
    if(app?.kind!=='design')return;
    const deadline=Date.now()+12000;
    const probe=()=>{
      if(frameReady)return;
      if(designFrameCanReveal()){markFrameReady('stable-workspace-probe');return;}
      if(Date.now()<deadline)frameProbeTimer=setTimeout(probe,25);
    };
    frameProbeTimer=setTimeout(probe,0);
  }
  function load(){
    if(!app){fail('지원하지 않는 프로그램 주소입니다.');return;}
    if(started)return;
    started=true;frameReady=false;clearTimeout(frameProbeTimer);document.documentElement.removeAttribute('data-modular-app-ready');document.title=`${app.title} · Program Studio`;applyAppChrome();setText('loadingTitle',`${app.title} 작업실 준비 중`);setText('loadingMessage',app.workspaceHint||'공통 편집 엔진과 전용 기능을 연결하는 중입니다.');
    const legacy=byId('legacyLink');if(legacy){legacy.href=app.legacy;legacy.hidden=false;}
    engineChip?.classList.add('loading');setText('engineLabel','공통 엔진 연결 중');setQuickActionsEnabled(false);loading?.classList.remove('hide');error&&(error.hidden=true);if(frame)frame.style.visibility='hidden';warmDesignAssets();expectedFrameUrl=new URL(app.target,location.origin).href;frame.src=app.target;startFrameProbe();
    document.documentElement.dataset.modularAppEnginePreload='started';
    clearTimeout(timer);timer=setTimeout(()=>fail('작업 엔진 응답이 늦습니다. 새로고침 후 다시 시도해 주세요.'),18000);
  }
  function grantAccess(){
    if(accessGranted)return;
    accessGranted=true;clearTimeout(accessRetryTimer);document.documentElement.dataset.modularAppAccess='approved';maybeReady();
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
      }).catch(()=>retryAccess());
      return;
    }
    retryAccess();
  }

  frame?.addEventListener('load',()=>{
    if(frameReady)return;
    if(app?.kind==='design'){
      if(designFrameCanReveal()){markFrameReady('load-stable-workspace');return;}
      startFrameProbe();
      return;
    }
    try{
      const doc=frame.contentDocument;if(!doc){markFrameReady('load-fallback');return;}
      const html=doc.documentElement,win=frame.contentWindow;
      if(html?.dataset?.appReady==='true'||html?.dataset?.designShellRuntime==='1'||win?.PdfEditorCoreRuntime){markFrameReady('load');return;}
    }catch(_){}
    frameProbeTimer=setTimeout(()=>markFrameReady('load-fallback'),220);
  });
  frame?.addEventListener('error',()=>fail());byId('retryBtn')?.addEventListener('click',()=>{started=false;load();});

  // Start the heavy editor navigation immediately. The access gate remains in
  // control of visibility and interaction, so authentication and engine loading
  // can run in parallel instead of adding their wait times together.
  load();
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',startAfterAccess,{once:true});else startAfterAccess();

  window.ProgramStudioModularAppShell={apps:APPS,appKey:key,reload:()=>{started=false;load();},openQuickAction,stage:'modular-app-shell-product-context-v5-access-race-safe',parallelStage:'modular-app-shell-parallel-engine-preload-v1',fastRevealStage:'modular-design-stable-workspace-reveal-v2'};
})();
