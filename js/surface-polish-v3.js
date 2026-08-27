(function(){
  'use strict';
  if(window.__programStudioPhase6)return;
  window.__programStudioPhase6=true;

  const surface=document.documentElement.dataset.programSurface||'';
  const STYLE_ID='programStudioPhase6Styles';

  function onReady(fn){
    if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',fn,{once:true});
    else fn();
  }

  function installStyles(){
    if(document.getElementById(STYLE_ID))return;
    const style=document.createElement('style');
    style.id=STYLE_ID;
    style.textContent=`
      html[data-program-surface="auth"].ps-ui-v2 .ps-auth-flow{margin-top:22px;display:grid;gap:8px;max-width:360px}
      html[data-program-surface="auth"].ps-ui-v2 .ps-auth-flow-item{display:grid;grid-template-columns:28px minmax(0,1fr);gap:9px;align-items:start;color:rgba(255,255,255,.82);font-size:11px;line-height:1.5}
      html[data-program-surface="auth"].ps-ui-v2 .ps-auth-flow-num{width:28px;height:28px;border-radius:9px;display:grid;place-items:center;background:rgba(255,255,255,.13);border:1px solid rgba(255,255,255,.16);font-weight:900;color:#fff}
      html[data-program-surface="auth"].ps-ui-v2 .field.ps-password-field{position:relative}
      html[data-program-surface="auth"].ps-ui-v2 .field.ps-password-field input{padding-right:72px}
      html[data-program-surface="auth"].ps-ui-v2 .ps-password-toggle{position:absolute;right:7px;bottom:7px;min-height:32px;border:0;border-radius:8px;background:#eef3f8;color:#516176;padding:0 9px;font-size:10px;font-weight:850;cursor:pointer}
      html[data-program-surface="auth"].ps-ui-v2 .tabs{position:relative}
      html[data-program-surface="auth"].ps-ui-v2 .tab[aria-selected="true"]{color:#0b2a55}

      html[data-program-surface="approval"].ps-ui-v2 body{background:radial-gradient(circle at 15% 0%,#dff3ff 0,transparent 30%),linear-gradient(180deg,#f4f9ff,#fff)}
      html[data-program-surface="approval"].ps-ui-v2 .card{border-radius:26px;padding:38px;box-shadow:0 24px 70px rgba(18,57,109,.14)}
      html[data-program-surface="approval"].ps-ui-v2 .status{border:1px solid #e0e8f0;background:#f7f9fc}
      html[data-program-surface="approval"].ps-ui-v2 .card[data-account-state="pending"] .icon{background:#fff7ed}
      html[data-program-surface="approval"].ps-ui-v2 .card[data-account-state="suspended"] .icon{background:#fef2f2}
      html[data-program-surface="approval"].ps-ui-v2 .card[data-account-state="error"] .status{border-color:#fecaca;background:#fef2f2;color:#b42318}
      html[data-program-surface="approval"].ps-ui-v2 .ps-approval-note{margin:14px 0 0;color:#7a8798;font-size:11px;line-height:1.6}
      html[data-program-surface="approval"].ps-ui-v2 .btn{min-height:42px}

      html[data-program-surface="legal"].ps-ui-v2 body{background:linear-gradient(180deg,#f7f9fc,#eef3f8)}
      html[data-program-surface="legal"].ps-ui-v2 .top{position:sticky;top:0;z-index:20;box-shadow:0 5px 20px rgba(15,39,72,.04)}
      html[data-program-surface="legal"].ps-ui-v2 .topin{align-items:center;gap:12px}
      html[data-program-surface="legal"].ps-ui-v2 .ps-legal-actions{margin-left:auto;display:flex;gap:7px;align-items:center}
      html[data-program-surface="legal"].ps-ui-v2 .ps-legal-print{min-height:34px;border:1px solid #d8e1eb;border-radius:9px;background:#fff;color:#44546a;padding:0 10px;font-size:11px;font-weight:850;cursor:pointer}
      html[data-program-surface="legal"].ps-ui-v2 main{max-width:1120px;display:grid;grid-template-columns:220px minmax(0,1fr);gap:18px;align-items:start}
      html[data-program-surface="legal"].ps-ui-v2 .paper{min-width:0;border-radius:20px;padding:42px 46px;box-shadow:0 14px 42px rgba(15,39,72,.06)}
      html[data-program-surface="legal"].ps-ui-v2 .paper h1{font-size:32px;letter-spacing:-.7px}
      html[data-program-surface="legal"].ps-ui-v2 .paper h2{scroll-margin-top:92px}
      html[data-program-surface="legal"].ps-ui-v2 .ps-legal-toc{position:sticky;top:88px;border:1px solid #dfe7f0;border-radius:16px;background:#fff;padding:14px;box-shadow:0 8px 24px rgba(15,39,72,.04)}
      html[data-program-surface="legal"].ps-ui-v2 .ps-legal-toc strong{display:block;margin:2px 4px 9px;font-size:11px;color:#233a55}
      html[data-program-surface="legal"].ps-ui-v2 .ps-legal-toc a{display:block;border-radius:9px;padding:8px 9px;color:#617086;text-decoration:none;font-size:10.5px;line-height:1.35}
      html[data-program-surface="legal"].ps-ui-v2 .ps-legal-toc a:hover,html[data-program-surface="legal"].ps-ui-v2 .ps-legal-toc a:focus-visible{background:#f0f5ff;color:#12396d}
      html[data-program-surface="legal"].ps-ui-v2 .ps-skip-link{position:fixed;left:12px;top:10px;z-index:1000;transform:translateY(-160%);border-radius:9px;background:#0b2a55;color:#fff;padding:9px 12px;font-size:11px;font-weight:850;text-decoration:none}
      html[data-program-surface="legal"].ps-ui-v2 .ps-skip-link:focus{transform:none}

      @media(max-width:760px){
        html[data-program-surface="auth"].ps-ui-v2 body{align-items:flex-start;padding:18px 14px 28px}
        html[data-program-surface="auth"].ps-ui-v2 .wrap{display:block;max-width:500px}
        html[data-program-surface="auth"].ps-ui-v2 .brand{text-align:center;margin-bottom:18px}
        html[data-program-surface="auth"].ps-ui-v2 .brand>a{align-items:center!important}
        html[data-program-surface="auth"].ps-ui-v2 .brand-icon{width:52px;height:52px;margin-bottom:10px}
        html[data-program-surface="auth"].ps-ui-v2 .brand h1{font-size:26px}
        html[data-program-surface="auth"].ps-ui-v2 .brand p{margin-inline:auto;font-size:12px}
        html[data-program-surface="auth"].ps-ui-v2 .ps-auth-flow{display:none}
        html[data-program-surface="auth"].ps-ui-v2 .card{padding:24px 18px;border-radius:20px}
        html[data-program-surface="auth"].ps-ui-v2 .back-link{margin-top:16px!important}
        html[data-program-surface="approval"].ps-ui-v2 .card{width:min(520px,calc(100% - 24px));padding:28px 20px}
        html[data-program-surface="legal"].ps-ui-v2 main{display:block;margin-top:18px;padding-inline:12px}
        html[data-program-surface="legal"].ps-ui-v2 .ps-legal-toc{position:static;display:flex;overflow-x:auto;gap:6px;margin-bottom:12px;padding:8px;scrollbar-width:thin}
        html[data-program-surface="legal"].ps-ui-v2 .ps-legal-toc strong{display:none}
        html[data-program-surface="legal"].ps-ui-v2 .ps-legal-toc a{flex:0 0 auto;border:1px solid #e2e8f0;padding:7px 9px;background:#fff}
        html[data-program-surface="legal"].ps-ui-v2 .paper{padding:28px 20px;border-radius:16px}
        html[data-program-surface="legal"].ps-ui-v2 .paper h1{font-size:27px}
        html[data-program-surface="legal"].ps-ui-v2 .top{padding:13px 12px}
        html[data-program-surface="legal"].ps-ui-v2 .ps-legal-print{display:none}
      }
      @media(max-width:400px){
        html[data-program-surface="auth"].ps-ui-v2 .card{padding-inline:15px}
        html[data-program-surface="approval"].ps-ui-v2 .actions{display:grid;grid-template-columns:1fr}
        html[data-program-surface="approval"].ps-ui-v2 .btn{width:100%}
        html[data-program-surface="legal"].ps-ui-v2 .paper{padding-inline:17px}
      }
      @media print{
        html[data-program-surface="legal"].ps-ui-v2 .top,html[data-program-surface="legal"].ps-ui-v2 .ps-legal-toc,html[data-program-surface="legal"].ps-ui-v2 .ps-skip-link,html[data-program-surface="legal"].ps-ui-v2 footer{display:none!important}
        html[data-program-surface="legal"].ps-ui-v2 body{background:#fff}
        html[data-program-surface="legal"].ps-ui-v2 main{display:block;max-width:none;margin:0;padding:0}
        html[data-program-surface="legal"].ps-ui-v2 .paper{border:0;box-shadow:none;padding:0}
      }
    `;
    document.head.appendChild(style);
  }

  function enhanceAuth(){
    const brand=document.querySelector('.brand');
    if(brand&&!brand.querySelector('.ps-auth-flow')){
      const flow=document.createElement('div');
      flow.className='ps-auth-flow';
      flow.setAttribute('aria-label','서비스 이용 순서');
      flow.innerHTML='<div class="ps-auth-flow-item"><span class="ps-auth-flow-num">1</span><span><strong>로그인</strong><br>Google 또는 이메일 계정으로 안전하게 시작합니다.</span></div><div class="ps-auth-flow-item"><span class="ps-auth-flow-num">2</span><span><strong>승인 확인</strong><br>승인이 필요한 계정은 현재 상태를 안내받습니다.</span></div><div class="ps-auth-flow-item"><span class="ps-auth-flow-num">3</span><span><strong>작업 시작</strong><br>PDF·디자인·문서·이미지 도구를 한곳에서 실행합니다.</span></div>';
      brand.appendChild(flow);
    }

    const tabs=document.querySelector('.tabs');
    if(tabs){
      tabs.setAttribute('role','tablist');
      const syncTabs=()=>{
        tabs.querySelectorAll('.tab').forEach(tab=>{
          const active=tab.classList.contains('active');
          tab.setAttribute('role','tab');
          tab.setAttribute('aria-selected',String(active));
          tab.tabIndex=active?0:-1;
        });
      };
      syncTabs();
      new MutationObserver(syncTabs).observe(tabs,{subtree:true,attributes:true,attributeFilter:['class']});
    }

    document.querySelectorAll('.field input[type="password"]').forEach(input=>{
      const field=input.closest('.field');
      if(!field||field.querySelector('.ps-password-toggle'))return;
      field.classList.add('ps-password-field');
      const button=document.createElement('button');
      button.type='button';
      button.className='ps-password-toggle';
      button.textContent='보기';
      button.setAttribute('aria-label','비밀번호 표시');
      button.addEventListener('click',()=>{
        const showing=input.type==='text';
        input.type=showing?'password':'text';
        button.textContent=showing?'보기':'숨기기';
        button.setAttribute('aria-label',showing?'비밀번호 표시':'비밀번호 숨기기');
      });
      field.appendChild(button);
    });
  }

  function enhanceApproval(){
    const card=document.querySelector('main.card,.card');
    const title=document.getElementById('title');
    const status=document.getElementById('statusBox');
    if(!card||!status)return;
    status.setAttribute('role','status');
    status.setAttribute('aria-live','polite');
    if(!card.querySelector('.ps-approval-note')){
      const note=document.createElement('p');
      note.className='ps-approval-note';
      note.textContent='승인이 완료되면 상태 확인 후 자동으로 프로그램 홈으로 이동합니다.';
      card.querySelector('.actions')?.insertAdjacentElement('afterend',note);
    }
    const sync=()=>{
      const text=`${title?.textContent||''} ${status.textContent||''}`;
      const state=/중지/.test(text)?'suspended':/실패|오류/.test(text)?'error':'pending';
      card.dataset.accountState=state;
    };
    sync();
    new MutationObserver(sync).observe(card,{subtree:true,childList:true,characterData:true});
  }

  function enhanceLegal(){
    const article=document.querySelector('main .paper');
    const main=document.querySelector('main');
    if(!article||!main||document.querySelector('.ps-legal-toc'))return;
    const heading=article.querySelector('h1');
    if(heading){
      heading.id=heading.id||'legalDocumentTitle';
      article.setAttribute('role','document');
      article.setAttribute('aria-labelledby',heading.id);
    }

    const skip=document.createElement('a');
    skip.className='ps-skip-link';
    skip.href='#legalDocumentTitle';
    skip.textContent='본문으로 바로가기';
    document.body.insertBefore(skip,document.body.firstChild);

    const headings=[...article.querySelectorAll('h2')];
    if(headings.length){
      const nav=document.createElement('nav');
      nav.className='ps-legal-toc';
      nav.setAttribute('aria-label','문서 목차');
      const strong=document.createElement('strong');
      strong.textContent='이 문서에서';
      nav.appendChild(strong);
      headings.forEach((h,index)=>{
        h.id=h.id||`legal-section-${index+1}`;
        const a=document.createElement('a');
        a.href=`#${h.id}`;
        a.textContent=h.textContent.trim();
        nav.appendChild(a);
      });
      main.insertBefore(nav,article);
    }

    const topin=document.querySelector('.topin');
    if(topin&&!topin.querySelector('.ps-legal-actions')){
      const home=topin.querySelector('a[href*="index"]');
      const actions=document.createElement('div');
      actions.className='ps-legal-actions';
      const print=document.createElement('button');
      print.type='button';
      print.className='ps-legal-print';
      print.textContent='인쇄 · PDF 저장';
      print.addEventListener('click',()=>window.print());
      if(home)actions.appendChild(home);
      actions.appendChild(print);
      topin.appendChild(actions);
    }
  }

  onReady(()=>{
    installStyles();
    if(surface==='auth')enhanceAuth();
    else if(surface==='approval')enhanceApproval();
    else if(surface==='legal')enhanceLegal();
  });

  window.ProgramStudioPhase6={surface,enhanceAuth,enhanceApproval,enhanceLegal,stage:'auth-approval-legal-mobile-accessibility-v3'};
})();
