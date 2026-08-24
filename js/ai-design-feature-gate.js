// Shared administrator-controlled gate for the future AI design generator.
(function(){
  'use strict';
  if(window.__programStudioAiDesignGateV1)return;
  window.__programStudioAiDesignGateV1=true;

  const DOC_ID='professional_program_suite';
  const FEATURE_KEY='aiDesignEnabled';
  const path=location.pathname.replace(/\/+$/,'')||'/';
  const isAdmin=path==='/admin'||path==='/admin.html'||path.endsWith('/admin.html');
  const isDesign=path==='/design-editor'||path==='/design-editor/index.html'||path==='/design-editor/general'||path==='/design-editor/general.html'||path.endsWith('/design-editor/general.html');
  let enabled=false;
  let ready=false;
  let unsubscribe=null;
  let connectTimer=0;
  let installAttempts=0;

  const byId=id=>document.getElementById(id);

  function featureValue(data){
    return data?.featureFlags?.[FEATURE_KEY]===true;
  }

  function applyControls(){
    document.querySelectorAll('[data-ai-design-control]').forEach(node=>{
      node.hidden=!enabled;
      if('disabled' in node)node.disabled=!enabled;
      node.setAttribute('aria-disabled',enabled?'false':'true');
      node.dataset.aiDesignMode=enabled?'on':'off';
    });
  }

  function dispatchState(){
    try{
      window.dispatchEvent(new CustomEvent('programstudio:ai-design-mode',{
        detail:{enabled,ready,source:'admin-feature-flag'}
      }));
    }catch(_){}
  }

  function renderAdminState(message=''){
    if(!isAdmin)return;
    const button=byId('adminAiDesignToggle');
    const badge=byId('adminAiDesignBadge');
    const status=byId('adminAiDesignStatus');
    if(button){
      button.textContent=enabled?'모드 끄기':'모드 켜기';
      button.classList.toggle('on',enabled);
      button.setAttribute('aria-pressed',enabled?'true':'false');
      button.disabled=!ready;
    }
    if(badge){
      badge.textContent=enabled?'ON':'OFF';
      badge.className=`ai-design-admin-badge ${enabled?'on':'off'}`;
    }
    if(status)status.textContent=message||(ready?(enabled?'AI 디자인 생성 기능을 사용할 수 있습니다.':'AI 디자인 생성 기능은 사용자 화면에서 숨겨지고 실행되지 않습니다.'):'설정을 확인하는 중입니다.');
  }

  function setState(nextEnabled,nextReady=true,message=''){
    enabled=nextEnabled===true;
    ready=nextReady===true;
    applyControls();
    renderAdminState(message);
    dispatchState();
  }

  function canRun(){return ready&&enabled;}

  function requireEnabled(){
    if(canRun())return true;
    const error=new Error('AI 디자인 생성은 관리자가 기능을 ON으로 설정한 경우에만 사용할 수 있습니다.');
    error.code='AI_DESIGN_DISABLED';
    throw error;
  }

  function installAdminStyles(){
    if(!isAdmin||byId('adminAiDesignFeatureStyles'))return;
    const style=document.createElement('style');
    style.id='adminAiDesignFeatureStyles';
    style.textContent=`
      .ai-design-admin-card{margin:0 0 14px;padding:14px 15px;border:1px solid #d8e5ef;border-radius:14px;background:#fff;display:flex;align-items:center;gap:12px;box-shadow:0 5px 18px rgba(15,23,42,.045)}
      .ai-design-admin-copy{min-width:0;flex:1}.ai-design-admin-title{display:flex;align-items:center;gap:7px;font-size:12px;font-weight:950;color:#172033}.ai-design-admin-desc{margin-top:4px;font-size:9px;line-height:1.5;color:#667085}.ai-design-admin-status{margin-top:5px;font-size:8px;font-weight:800;color:#64748b}
      .ai-design-admin-badge{display:inline-flex;align-items:center;justify-content:center;min-width:36px;border-radius:999px;padding:4px 7px;font-size:8px;font-weight:950}.ai-design-admin-badge.off{background:#eef2f6;color:#64748b}.ai-design-admin-badge.on{background:#dcfce7;color:#166534}
      .ai-design-admin-toggle{border:1px solid #cbd5e1;border-radius:9px;background:#f8fafc;color:#334155;padding:8px 11px;font-size:9px;font-weight:900;cursor:pointer;white-space:nowrap}.ai-design-admin-toggle.on{border-color:#86c89c;background:#f0fdf4;color:#166534}.ai-design-admin-toggle:disabled{opacity:.5;cursor:not-allowed}
      @media(max-width:700px){.ai-design-admin-card{align-items:flex-start;flex-wrap:wrap}.ai-design-admin-toggle{margin-left:auto}}
    `;
    document.head.appendChild(style);
  }

  function installAdminCard(){
    if(!isAdmin)return true;
    if(byId('adminAiDesignFeatureCard'))return true;
    const panel=byId('adminOperationsPanel');
    if(!panel)return false;
    installAdminStyles();
    const card=document.createElement('section');
    card.id='adminAiDesignFeatureCard';
    card.className='ai-design-admin-card';
    card.innerHTML=`<div class="ai-design-admin-copy"><div class="ai-design-admin-title">AI 디자인 생성 <span id="adminAiDesignBadge" class="ai-design-admin-badge off">OFF</span></div><div class="ai-design-admin-desc">기본값은 OFF입니다. ON일 때만 사용자 디자인 화면에 AI 생성 기능을 노출하고 실행을 허용합니다.</div><div id="adminAiDesignStatus" class="ai-design-admin-status">설정을 확인하는 중입니다.</div></div><button id="adminAiDesignToggle" class="ai-design-admin-toggle" type="button" disabled>모드 켜기</button>`;
    const summary=byId('aopSummary');
    if(summary)panel.insertBefore(card,summary);else panel.appendChild(card);
    byId('adminAiDesignToggle')?.addEventListener('click',toggleAdminMode);
    renderAdminState();
    return true;
  }

  async function toggleAdminMode(){
    if(!isAdmin||!window.db||!ready)return;
    const desired=!enabled;
    const button=byId('adminAiDesignToggle');
    if(button)button.disabled=true;
    renderAdminState(desired?'AI 디자인 ON으로 저장하는 중입니다.':'AI 디자인 OFF로 저장하는 중입니다.');
    try{
      await db.collection('settings').doc(DOC_ID).set({
        featureFlags:{[FEATURE_KEY]:desired},
        updatedAt:new Date().toISOString()
      },{merge:true});
      // onSnapshot normally applies the new value immediately; this keeps the UI deterministic if it is delayed.
      setState(desired,true,desired?'AI 디자인 생성 모드를 ON으로 저장했습니다.':'AI 디자인 생성 모드를 OFF로 저장했습니다.');
    }catch(error){
      console.error('AI design feature flag update failed',error);
      renderAdminState('저장하지 못했습니다. 관리자 권한과 연결 상태를 확인하세요.');
      if(button)button.disabled=false;
    }
  }

  function connect(){
    clearTimeout(connectTimer);
    if(!window.db){
      connectTimer=setTimeout(connect,250);
      return;
    }
    if(unsubscribe)return;
    try{
      unsubscribe=db.collection('settings').doc(DOC_ID).onSnapshot(snapshot=>{
        const data=snapshot.exists?(snapshot.data()||{}):{};
        setState(featureValue(data),true);
      },error=>{
        console.warn('AI design feature flag read failed',error);
        // Fail closed: an unreadable setting must never enable an AI control.
        setState(false,true,'설정을 읽지 못해 안전하게 OFF 상태로 유지합니다.');
      });
    }catch(error){
      console.warn('AI design feature flag subscription failed',error);
      setState(false,true,'설정을 읽지 못해 안전하게 OFF 상태로 유지합니다.');
    }
  }

  function installControlObserver(){
    if(!isDesign||!document.documentElement)return;
    const observer=new MutationObserver(()=>applyControls());
    observer.observe(document.documentElement,{childList:true,subtree:true});
  }

  function install(){
    installAttempts+=1;
    if(isAdmin&&!installAdminCard()&&installAttempts<80)setTimeout(install,100);
    applyControls();
    connect();
  }

  window.ProgramStudioAiDesignGate={
    get enabled(){return enabled;},
    get ready(){return ready;},
    canRun,
    requireEnabled,
    refresh(){if(unsubscribe){unsubscribe();unsubscribe=null;}connect();},
    featureKey:FEATURE_KEY,
    stage:'admin-controlled-ai-design-gate-v1'
  };

  if(isDesign)installControlObserver();
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install,{once:true});else install();
})();