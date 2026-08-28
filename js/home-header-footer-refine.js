(function(){
  if(window.__homeHeaderFooterRefineV1)return;
  window.__homeHeaderFooterRefineV1=true;

  let currentBusinessName='';
  let scheduled=false;

  function injectStyles(){
    if(document.getElementById('homeHeaderFooterRefineStyles'))return;
    const style=document.createElement('style');
    style.id='homeHeaderFooterRefineStyles';
    style.textContent=`
      .greeting{display:none!important}
      .user{
        gap:7px!important;
        padding:4px 9px 4px 4px!important;
        border-radius:12px!important;
        border-color:#dce4ee!important;
        background:#f8fafc!important;
        box-shadow:0 1px 2px rgba(15,23,42,.04)!important;
        transition:border-color .16s ease,background .16s ease,box-shadow .16s ease!important;
      }
      .user:hover,.user.open{
        border-color:#c7d3e1!important;
        background:#fff!important;
        box-shadow:0 7px 18px rgba(15,23,42,.08)!important;
      }
      .avatar{
        width:28px!important;
        height:28px!important;
        border-radius:8px!important;
        font-size:10px!important;
        font-weight:900!important;
        box-shadow:none!important;
        flex:0 0 28px!important;
      }
      .user-name{
        max-width:88px!important;
        font-size:11px!important;
        font-weight:850!important;
        color:#344054!important;
      }
      .dropdown{
        top:calc(100% + 8px)!important;
        width:220px!important;
        padding:7px!important;
        border-radius:14px!important;
        box-shadow:0 18px 45px rgba(15,23,42,.16)!important;
      }
      .account-simple{gap:9px!important;padding:10px!important}
      .account-mini{
        width:30px!important;
        height:30px!important;
        border-radius:9px!important;
        font-size:11px!important;
        flex:0 0 30px!important;
      }

      /* Home is intentionally result-focused: keep one hero and one program list. */
      #homeDashboardV2,#homePrintWorkflow,#homePremiumOverview,.home-premium-overview{display:none!important}
      body[data-home-clean-simple="1"] .programs{padding-top:58px!important}
      body[data-home-clean-simple="1"] .programs-head{margin-bottom:22px!important}
      body[data-home-clean-simple="1"] .section-kicker{display:none!important}
      body[data-home-clean-simple="1"] .count{display:none!important}
      body[data-home-clean-simple="1"] .grid{grid-template-columns:repeat(4,minmax(0,1fr))!important;gap:14px!important}
      body[data-home-clean-simple="1"] .card{min-height:196px!important;padding:20px!important;border-radius:18px!important;box-shadow:0 7px 22px rgba(15,39,72,.055)!important}
      body[data-home-clean-simple="1"] .card:before{top:20px!important;bottom:20px!important;width:3px!important}
      body[data-home-clean-simple="1"] .program-main{margin-bottom:11px!important;gap:12px!important}
      body[data-home-clean-simple="1"] .icon{width:48px!important;height:48px!important;border-radius:14px!important}
      body[data-home-clean-simple="1"] .name{font-size:16px!important}
      body[data-home-clean-simple="1"] .program-type{display:none!important}
      body[data-home-clean-simple="1"] .desc{display:-webkit-box!important;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;min-height:42px;font-size:12px!important;line-height:1.65!important;color:#69788a!important}
      body[data-home-clean-simple="1"] .tags,body[data-home-clean-simple="1"] .status{display:none!important}
      body[data-home-clean-simple="1"] .program-action{margin-top:15px!important;padding-top:12px;border-top:1px solid #edf1f5}
      body[data-home-clean-simple="1"] .cta{margin-left:auto!important;font-size:11px!important}

      /* Restore the cleaner console-style hero without reintroducing the old premium card stacks. */
      body[data-home-clean-simple="1"] .hero-highlights{display:none!important}
      body[data-home-clean-simple="1"] .hero-visual{position:relative!important;min-height:390px!important;isolation:isolate;perspective:none!important}
      body[data-home-clean-simple="1"] .hero-visual:before{content:"";position:absolute;z-index:-2;width:min(91%,430px);height:305px;border-radius:32px;border:1px solid rgba(125,238,229,.14);background:linear-gradient(145deg,rgba(255,255,255,.045),rgba(62,218,210,.025));transform:translate(26px,23px) rotate(4deg);box-shadow:0 30px 85px rgba(0,12,31,.24)}
      body[data-home-clean-simple="1"] .hero-visual:after{content:"";position:absolute;z-index:-3;width:330px;height:330px;right:1%;top:2%;border-radius:50%;background:radial-gradient(circle,rgba(48,218,205,.16) 0%,rgba(31,139,181,.06) 42%,transparent 72%)}
      body[data-home-clean-simple="1"] .visual-card{position:relative!important;z-index:2!important;width:min(100%,440px)!important;min-height:344px!important;overflow:hidden!important;border-radius:27px!important;border:1px solid rgba(151,230,231,.21)!important;background:radial-gradient(circle at 88% 8%,rgba(39,206,197,.12),transparent 34%),linear-gradient(145deg,rgba(7,27,47,.98),rgba(8,37,61,.98) 54%,rgba(7,48,69,.97))!important;color:#fff!important;box-shadow:0 38px 90px rgba(0,13,34,.38),inset 0 1px 0 rgba(255,255,255,.08)!important;transform:none!important;transition:transform .28s ease,box-shadow .28s ease,border-color .28s ease!important}
      body[data-home-clean-simple="1"] .visual-card:hover{transform:translateY(-5px)!important;border-color:rgba(151,230,231,.34)!important;box-shadow:0 46px 102px rgba(0,13,34,.44),inset 0 1px 0 rgba(255,255,255,.10)!important}
      body[data-home-clean-simple="1"] .visual-card:before{content:""!important;position:absolute!important;inset:0 0 auto!important;width:auto!important;height:1px!important;background:linear-gradient(90deg,transparent,rgba(113,244,232,.68),transparent)!important;pointer-events:none!important}
      body[data-home-clean-simple="1"] .hero-window-bar{position:relative!important;z-index:2!important;height:54px!important;display:flex!important;align-items:center!important;padding:0 20px!important;border-bottom:1px solid rgba(172,211,229,.10)!important;background:rgba(4,20,36,.38)!important}
      .home-console-brand{display:flex;align-items:center;gap:9px;color:#dbeaf3;font-size:9px;font-weight:950;letter-spacing:.13em;white-space:nowrap}
      .home-console-mark{width:23px;height:23px;display:grid;place-items:center;border-radius:8px;background:linear-gradient(135deg,#1b6edb,#27c9bb);box-shadow:0 7px 18px rgba(27,110,219,.23);color:#fff;font-size:10px;font-weight:950}
      body[data-home-clean-simple="1"] .hero-window-status{margin-left:auto!important;color:#9bded5!important;font-size:8px!important;font-weight:900!important;letter-spacing:.12em!important}
      body[data-home-clean-simple="1"] .hero-window-status:before{width:6px!important;height:6px!important;background:#43d5a4!important;box-shadow:0 0 0 4px rgba(67,213,164,.11)!important}
      body[data-home-clean-simple="1"] .hero-card-body{position:relative!important;z-index:2!important;padding:25px 25px 22px!important}
      body[data-home-clean-simple="1"] .hero-card-head{grid-template-columns:58px 1fr!important;gap:15px!important;align-items:center!important}
      body[data-home-clean-simple="1"] .visual-icon{width:58px!important;height:58px!important;margin:0!important;border-radius:18px!important;background:linear-gradient(145deg,rgba(26,106,196,.34),rgba(34,203,190,.17))!important;border:1px solid rgba(137,226,223,.18)!important;box-shadow:inset 0 1px 0 rgba(255,255,255,.09),0 12px 28px rgba(0,0,0,.17)!important;color:#e8ffff!important;font-size:14px!important;font-weight:950!important}
      body[data-home-clean-simple="1"] .visual-title{margin:0 0 6px!important;color:#f5fbff!important;font-size:20px!important;font-weight:950!important;letter-spacing:-.65px!important}
      body[data-home-clean-simple="1"] .visual-text{max-width:300px;color:#91aabd!important;font-size:11px!important;line-height:1.62!important}
      body[data-home-clean-simple="1"] .hero-process{display:flex!important;flex-direction:column!important;gap:0!important;margin-top:22px!important;padding:0!important;border:1px solid rgba(157,198,218,.10)!important;border-radius:15px!important;background:rgba(255,255,255,.025)!important;overflow:hidden!important}
      .home-console-row{display:grid;grid-template-columns:28px minmax(0,1fr) auto;align-items:center;gap:10px;min-height:44px;padding:0 13px;border-top:1px solid rgba(157,198,218,.08)}
      .home-console-row:first-child{border-top:0}
      .home-console-num{width:22px;height:22px;display:grid;place-items:center;border-radius:7px;background:rgba(31,110,183,.22);color:#9fd7ff;font-size:8px;font-weight:950}
      .home-console-row strong{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:#e7f1f8;font-size:9px;font-weight:950}
      .home-console-row small{color:#6689a1;font-size:7.5px;font-weight:850;letter-spacing:.06em;white-space:nowrap}
      body[data-home-clean-simple="1"] .hero-meter{margin-top:17px!important;padding-top:15px!important;border-top:1px solid rgba(157,198,218,.10)!important}
      body[data-home-clean-simple="1"] .hero-meter-head{margin-bottom:9px!important;color:#7f99ad!important;font-size:8px!important;font-weight:850!important;letter-spacing:.04em!important}
      body[data-home-clean-simple="1"] .hero-meter-head span:last-child{color:#b7d6df!important;font-weight:950!important}
      body[data-home-clean-simple="1"] .hero-meter-track{height:6px!important;border-radius:999px!important;background:rgba(151,188,207,.12)!important}
      body[data-home-clean-simple="1"] .hero-meter-fill{width:100%!important;height:100%!important;border-radius:999px!important;background:linear-gradient(90deg,#2174d3 0%,#27a7cf 52%,#35d0ba 100%)!important;animation:none!important}
      body[data-home-clean-simple="1"] .hero-float{display:none!important}

      .footer-business{display:none!important}
      .footer-business-name{color:rgba(255,255,255,.72);font-size:11px;font-weight:800;white-space:nowrap;padding-left:18px;border-left:1px solid rgba(255,255,255,.18)}

      @media(max-width:1120px){body[data-home-clean-simple="1"] .grid{grid-template-columns:repeat(2,minmax(0,1fr))!important}}
      @media(max-width:760px){
        .user{padding-right:5px!important}.user-name{display:none!important}.footer-business-name{padding-left:0;border-left:0}
        body[data-home-clean-simple="1"] .grid{grid-template-columns:1fr!important}
        body[data-home-clean-simple="1"] .programs{padding-top:42px!important}
        body[data-home-clean-simple="1"] .hero-visual{min-height:345px!important}
        body[data-home-clean-simple="1"] .hero-visual:before{width:min(88vw,390px);height:275px;transform:translate(12px,18px) rotate(3deg)}
        body[data-home-clean-simple="1"] .visual-card{width:min(92vw,410px)!important;min-height:326px!important;border-radius:24px!important}
      }
      @media(max-width:480px){body[data-home-clean-simple="1"] .hero-visual:before,body[data-home-clean-simple="1"] .hero-visual:after{display:none}.home-console-row small{display:none}}
      @media(prefers-reduced-motion:reduce){body[data-home-clean-simple="1"] .visual-card{transition:none!important}}
    `;
    document.head.appendChild(style);
  }

  function removeGreetingBlock(){
    document.getElementById('greeting')?.remove();
  }

  function removeDuplicateHomeBlocks(){
    ['homeDashboardV2','homePrintWorkflow','homePremiumOverview'].forEach(id=>document.getElementById(id)?.remove());
    document.querySelectorAll('.home-premium-overview').forEach(node=>node.remove());
  }

  function simplifyProgramCards(){
    const title=document.getElementById('sectionTitle');
    if(title&&title.textContent!=='필요한 프로그램만 선택하세요')title.textContent='필요한 프로그램만 선택하세요';
    const copyByName={
      '디자인 제작':'배경·로고·글씨를 배치해 필요한 인쇄물을 만듭니다.',
      'PDF 편집 · 인쇄배치':'페이지 편집과 인쇄 배치를 한 번에 처리합니다.',
      'PDF 검사 · 유틸리티':'출력 전 PDF 상태와 기본 유틸리티를 빠르게 확인합니다.',
      '이미지 작업 도구':'자르기·크기 조정·배경 제거 같은 기본 작업을 처리합니다.'
    };
    document.querySelectorAll('#programGrid .card').forEach(card=>{
      const name=(card.querySelector('.name')?.textContent||'').trim();
      const desc=card.querySelector('.desc');
      const next=copyByName[name];
      if(desc&&next&&desc.textContent!==next)desc.textContent=next;
    });
  }

  function decorateHeroConsole(){
    const hero=document.getElementById('hero');
    const card=hero?.querySelector('.visual-card');
    const bar=card?.querySelector('.hero-window-bar');
    const process=card?.querySelector('.hero-process');
    const meter=card?.querySelector('.hero-meter');
    if(!hero||!card||!bar||!process||!meter)return false;

    document.body.dataset.homeCleanSimple='1';
    hero.querySelectorAll('.hero-float').forEach(node=>node.remove());

    if(bar.dataset.cleanConsole!=='1'){
      bar.dataset.cleanConsole='1';
      bar.innerHTML='<div class="home-console-brand"><span class="home-console-mark">P</span><span>PRODUCTION STUDIO</span></div><span class="hero-window-status">READY</span>';
    }
    if(!process.querySelector('.home-console-row')){
      process.innerHTML=''
        +'<div class="home-console-row"><span class="home-console-num">01</span><strong>디자인 제작</strong><small>DESIGN</small></div>'
        +'<div class="home-console-row"><span class="home-console-num">02</span><strong>PDF 편집·인쇄배치</strong><small>LAYOUT</small></div>'
        +'<div class="home-console-row"><span class="home-console-num">03</span><strong>인쇄 전 검사</strong><small>CHECK</small></div>';
    }
    const head=meter.querySelector('.hero-meter-head');
    if(head&&head.dataset.cleanConsole!=='1'){
      head.dataset.cleanConsole='1';
      head.innerHTML='<span>작업 준비</span><span>READY</span>';
    }
    const fill=meter.querySelector('.hero-meter-fill');
    if(fill)fill.style.width='100%';
    return true;
  }

  function findCopyright(footer){
    const direct=[...footer.querySelectorAll('.footer-right > span')];
    return direct.find(el=>(el.textContent||'').includes('©'))
      || [...footer.querySelectorAll('span')].find(el=>(el.textContent||'').includes('©'))
      || null;
  }

  function dedupeBusinessName(footer,label,name){
    const normalized=String(name||'').trim();
    if(!normalized)return;
    footer.querySelectorAll('.footer-business-name').forEach(node=>{if(node!==label)node.remove()});
    footer.querySelectorAll('span,a,button').forEach(node=>{
      if(node===label||node.children.length)return;
      if((node.textContent||'').trim()===normalized)node.remove();
    });
  }

  async function loadBusinessName(){
    const footer=document.querySelector('footer');
    if(!footer)return;
    const copyright=findCopyright(footer);
    if(!copyright)return;

    let label=footer.querySelector('.footer-business-name');
    if(!label){
      label=document.createElement('span');
      label.className='footer-business-name';
      label.hidden=true;
      copyright.insertAdjacentElement('afterend',label);
    }

    try{
      let snap=await db.collection('settings').doc('business').get().catch(()=>null);
      if(!snap||!snap.exists)snap=await db.collection('site_settings').doc('business').get().catch(()=>null);
      const business=snap&&snap.exists?snap.data():{};
      const name=String(business.bizName||'').trim();
      if(!name){label.remove();currentBusinessName='';return;}
      currentBusinessName=name;
      if(label.textContent!==name)label.textContent=name;
      label.hidden=false;
      dedupeBusinessName(footer,label,name);
    }catch(_){
      label.remove();
      currentBusinessName='';
    }
  }

  function keepDetailedBusinessHidden(){
    const footer=document.querySelector('footer');
    if(!footer)return;
    footer.querySelectorAll('.footer-business').forEach(el=>{
      el.hidden=true;
      el.setAttribute('aria-hidden','true');
      el.style.display='none';
    });
    if(currentBusinessName){
      const label=footer.querySelector('.footer-business-name');
      if(label)dedupeBusinessName(footer,label,currentBusinessName);
    }
  }

  function syncHome(){
    document.body.dataset.homeCleanSimple='1';
    removeDuplicateHomeBlocks();
    simplifyProgramCards();
    decorateHeroConsole();
    keepDetailedBusinessHidden();
  }

  function scheduleSync(){
    if(scheduled)return;
    scheduled=true;
    requestAnimationFrame(()=>{
      scheduled=false;
      syncHome();
    });
  }

  function observeHome(){
    if(document.body.__homeCleanObserver)return;
    document.body.__homeCleanObserver=true;
    new MutationObserver(records=>{
      if(records.some(record=>record.addedNodes.length||record.removedNodes.length))scheduleSync();
    }).observe(document.body,{childList:true,subtree:true});
  }

  function boot(){
    injectStyles();
    removeGreetingBlock();
    syncHome();
    observeHome();
    loadBusinessName().then(scheduleSync);
    [120,350,800,1500,2600].forEach(delay=>setTimeout(scheduleSync,delay));
    window.HomeHeaderFooterRefine={sync:syncHome,stage:'home-clean-hierarchy-hero-footer-v2'};
  }

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();