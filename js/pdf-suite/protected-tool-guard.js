// Prevent protected PDF utility tools from looking frozen when auth is missing or expires inside an embedded engine.
(function(){
  'use strict';
  if(window.__programStudioPdfUtilityProtectedToolGuardV1)return;
  window.__programStudioPdfUtilityProtectedToolGuardV1=true;

  let authStateKnown=Boolean(window.auth?.currentUser);
  let lastProtectedTool=null;

  const $=id=>document.getElementById(id);
  const escapeHtml=value=>String(value??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot',"'":'&#39;'}[ch]));

  function sourceNameForButton(button){
    return button?.dataset.pdfuCoreSource||button?.querySelector('.pdfu-menu-name')?.textContent?.trim()||'';
  }

  function displayNameForButton(button){
    return button?.querySelector('.pdfu-menu-name')?.textContent?.trim()||sourceNameForButton(button)||'PDF 기능';
  }

  function sourceForButton(button){
    const name=sourceNameForButton(button);
    if(!name)return null;
    return [...document.querySelectorAll('#pdfUtilitySourceStore .tool')].find(tool=>tool.querySelector('.tool-name')?.textContent?.trim()===name)||null;
  }

  function isProtectedSource(source){
    return Boolean(source&&String(source.getAttribute('href')||'').includes('pdf-preflight'));
  }

  function setActiveButton(button){
    document.querySelectorAll('[data-pdfu-tool]').forEach(node=>node.classList.toggle('active',node===button));
  }

  function setStageHeader(name,desc,badge='로그인 필요'){
    const title=$('pdfUtilityStageTitle');
    const copy=$('pdfUtilityStageDesc');
    const chip=$('pdfUtilityStageBadge');
    if(title)title.textContent=name||'PDF 기능';
    if(copy)copy.textContent=desc||'이 기능은 로그인 후 사용할 수 있습니다.';
    if(chip){
      chip.textContent=badge;
      chip.style.background=badge==='로그인 확인 중'?'#eff6ff':'#fff7ed';
      chip.style.color=badge==='로그인 확인 중'?'#1d4ed8':'#c2410c';
    }
  }

  function showLoginRequired(button,source){
    const name=displayNameForButton(button)||source?.querySelector('.tool-name')?.textContent?.trim()||'PDF 기능';
    const desc=source?.querySelector('.tool-desc')?.textContent?.trim()||'이 기능은 서버 처리가 필요해 로그인 후 사용할 수 있습니다.';
    lastProtectedTool=sourceNameForButton(button)||source?.querySelector('.tool-name')?.textContent?.trim()||name;
    setActiveButton(button);
    setStageHeader(name,desc,'로그인 필요');
    const stage=$('pdfUtilityStageBody');
    if(stage){
      stage.innerHTML=`<section class="pdfu-stage-card"><div class="pdfu-stage-empty"><div><div class="icon">🔐</div><strong>${escapeHtml(name)}</strong><p>이 기능은 서버 처리가 필요한 기능입니다. 로그인 후 다시 선택하면 오른쪽 작업 화면에서 바로 사용할 수 있습니다.</p><div class="pdfu-plan-note" style="border-color:#fed7aa;background:#fff7ed;color:#9a3412">로그인하지 않은 상태에서 내부 엔진을 열면 로그인 페이지로 전환되어 멈춘 것처럼 보일 수 있어, 이제는 여기서 먼저 안내합니다.</div></div></div></section>`;
    }
    const action=$('pdfUtilityStageAction');
    if(action){action.textContent='로그인 후 사용';action.classList.add('show');action.dataset.pdfuGuardAction='login';}
    document.documentElement.dataset.pdfUtilityProtectedGuard='auth-required';
  }

  function showAuthChecking(button,source){
    const name=displayNameForButton(button);
    const desc=source?.querySelector('.tool-desc')?.textContent?.trim()||'';
    setActiveButton(button);
    setStageHeader(name,desc,'로그인 확인 중');
    const stage=$('pdfUtilityStageBody');
    if(stage)stage.innerHTML=`<section class="pdfu-stage-card"><div class="pdfu-stage-empty"><div><div class="icon">⏳</div><strong>${escapeHtml(name)}</strong><p>로그인 상태를 확인하고 있습니다. 확인이 끝나면 선택한 기능을 바로 엽니다.</p></div></div></section>`;
    document.documentElement.dataset.pdfUtilityProtectedGuard='checking-auth';
  }

  function clearGuardAction(){
    const action=$('pdfUtilityStageAction');
    if(action)delete action.dataset.pdfuGuardAction;
  }

  function openSelectedAfterAuth(name){
    clearGuardAction();
    if(name)window.ProgramStudioPdfSinglePageWorkspace?.selectTool?.(name);
  }

  function handleProtectedClick(event,button,source){
    if(window.auth?.currentUser){authStateKnown=true;clearGuardAction();return false;}
    event.preventDefault();
    event.stopImmediatePropagation();
    const sourceName=sourceNameForButton(button);
    lastProtectedTool=sourceName;
    if(authStateKnown||!window.auth?.onAuthStateChanged){
      showLoginRequired(button,source);
      return true;
    }
    showAuthChecking(button,source);
    let settled=false;
    const finish=user=>{
      if(settled)return;
      settled=true;
      authStateKnown=true;
      refreshProtectedBadges();
      if(user)openSelectedAfterAuth(sourceName);else showLoginRequired(button,source);
    };
    try{
      const unsubscribe=window.auth.onAuthStateChanged(user=>{try{unsubscribe?.();}catch(_){ }finish(user);},()=>finish(null));
      setTimeout(()=>finish(window.auth?.currentUser||null),1200);
    }catch(_){finish(null);}
    return true;
  }

  function refreshProtectedBadges(){
    const signedIn=Boolean(window.auth?.currentUser);
    document.querySelectorAll('[data-pdfu-tool]').forEach(button=>{
      const source=sourceForButton(button);
      if(!isProtectedSource(source))return;
      const badge=button.querySelector('.pdfu-menu-badge');
      if(!badge)return;
      badge.textContent=signedIn?'사용':'로그인';
      badge.style.background=signedIn?'#ecfdf5':'#fff7ed';
      badge.style.color=signedIn?'#047857':'#c2410c';
    });
  }

  function watchEmbeddedPreflight(){
    const bind=frame=>{
      if(!frame||frame.dataset.pdfuGuardBound==='true')return;
      frame.dataset.pdfuGuardBound='true';
      frame.addEventListener('load',()=>{
        try{
          const path=frame.contentWindow?.location?.pathname||'';
          if(/\/login\.html$/.test(path)){
            const button=[...document.querySelectorAll('[data-pdfu-tool]')].find(node=>sourceNameForButton(node)===lastProtectedTool)||null;
            const source=sourceForButton(button);
            showLoginRequired(button,source);
          }else{
            document.documentElement.dataset.pdfUtilityProtectedGuard='ready';
          }
        }catch(_){document.documentElement.dataset.pdfUtilityProtectedGuard='ready';}
      });
    };
    document.querySelectorAll('iframe[data-pdfu-frame="preflight"]').forEach(bind);
    const observer=new MutationObserver(()=>document.querySelectorAll('iframe[data-pdfu-frame="preflight"]').forEach(bind));
    observer.observe(document.body,{subtree:true,childList:true});
  }

  function install(){
    document.addEventListener('click',event=>{
      const action=event.target.closest?.('#pdfUtilityStageAction[data-pdfu-guard-action="login"]');
      if(action){
        event.preventDefault();event.stopImmediatePropagation();
        location.href='/login.html';
        return;
      }
      const button=event.target.closest?.('[data-pdfu-tool]');
      if(!button)return;
      const source=sourceForButton(button);
      if(!isProtectedSource(source)){clearGuardAction();return;}
      handleProtectedClick(event,button,source);
    },true);

    if(window.auth?.onAuthStateChanged){
      window.auth.onAuthStateChanged(user=>{
        authStateKnown=true;
        refreshProtectedBadges();
        if(user&&document.documentElement.dataset.pdfUtilityProtectedGuard==='auth-required'&&lastProtectedTool){
          document.documentElement.dataset.pdfUtilityProtectedGuard='signed-in';
        }
      },()=>{authStateKnown=true;refreshProtectedBadges();});
    }else{
      authStateKnown=true;
    }
    refreshProtectedBadges();
    watchEmbeddedPreflight();
    document.documentElement.dataset.pdfUtilityProtectedToolGuard='ready';
  }

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install,{once:true});else install();

  window.ProgramStudioPdfUtilityProtectedToolGuard=Object.freeze({
    refresh:refreshProtectedBadges,
    get authStateKnown(){return authStateKnown;},
    stage:'pdf-utility-protected-tool-guard-v1'
  });
})();