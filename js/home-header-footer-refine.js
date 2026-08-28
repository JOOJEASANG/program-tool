(function(){
  if(window.__homeHeaderFooterRefineV1)return;
  window.__homeHeaderFooterRefineV1=true;

  let currentBusinessName='',scheduled=false;

  function injectStyles(){
    if(document.getElementById('homeHeaderFooterRefineStyles'))return;
    const style=document.createElement('style');
    style.id='homeHeaderFooterRefineStyles';
    style.textContent=`
      .greeting{display:none!important}
      .user{gap:7px!important;padding:4px 9px 4px 4px!important;border-radius:12px!important;border-color:#dce4ee!important;background:#f8fafc!important;box-shadow:0 1px 2px rgba(15,23,42,.04)!important}
      .user:hover,.user.open{border-color:#c7d3e1!important;background:#fff!important;box-shadow:0 7px 18px rgba(15,23,42,.08)!important}
      .avatar{width:28px!important;height:28px!important;border-radius:8px!important;font-size:10px!important;font-weight:900!important;box-shadow:none!important;flex:0 0 28px!important}
      .user-name{max-width:88px!important;font-size:11px!important;font-weight:850!important;color:#344054!important}.dropdown{top:calc(100% + 8px)!important;width:220px!important;padding:7px!important;border-radius:14px!important}.account-simple{gap:9px!important;padding:10px!important}.account-mini{width:30px!important;height:30px!important;border-radius:9px!important;font-size:11px!important}
      #homeDashboardV2,#homePrintWorkflow,#homePremiumOverview,.home-premium-overview{display:none!important}
      body[data-home-clean-simple="1"] .programs{padding-top:56px!important}body[data-home-clean-simple="1"] .programs-head{margin-bottom:22px!important}body[data-home-clean-simple="1"] .section-kicker,body[data-home-clean-simple="1"] .count{display:none!important}
      body[data-home-clean-simple="1"] .grid{grid-template-columns:repeat(4,minmax(0,1fr))!important;gap:14px!important}body[data-home-clean-simple="1"] .card{min-height:190px!important;padding:19px!important;border-radius:18px!important;box-shadow:0 7px 22px rgba(15,39,72,.05)!important}body[data-home-clean-simple="1"] .program-main{margin-bottom:10px!important;gap:11px!important}body[data-home-clean-simple="1"] .icon{width:46px!important;height:46px!important;border-radius:13px!important}body[data-home-clean-simple="1"] .name{font-size:16px!important}body[data-home-clean-simple="1"] .program-type,body[data-home-clean-simple="1"] .tags,body[data-home-clean-simple="1"] .status{display:none!important}body[data-home-clean-simple="1"] .desc{display:-webkit-box!important;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;min-height:40px;font-size:12px!important;line-height:1.6!important;color:#69788a!important}body[data-home-clean-simple="1"] .program-action{margin-top:13px!important;padding-top:11px;border-top:1px solid #edf1f5}body[data-home-clean-simple="1"] .cta{margin-left:auto!important;font-size:11px!important}
      body[data-home-clean-simple="1"] .hero-highlights,body[data-home-clean-simple="1"] .hero-float{display:none!important}body[data-home-clean-simple="1"] .hero-visual{min-height:360px!important;perspective:none!important}body[data-home-clean-simple="1"] .visual-card{width:min(100%,430px)!important;min-height:320px!important;border-radius:25px!important;border:1px solid rgba(134,218,220,.2)!important;background:linear-gradient(145deg,#071c31,#0a2d49 60%,#0a4158)!important;color:#fff!important;box-shadow:0 32px 76px rgba(0,13,34,.34)!important;transform:none!important}body[data-home-clean-simple="1"] .hero-window-bar{height:50px!important;padding:0 18px!important;border-bottom:1px solid rgba(255,255,255,.08)!important;background:rgba(3,18,32,.34)!important}.home-console-brand{display:flex;align-items:center;gap:8px;color:#dcebf3;font-size:9px;font-weight:950;letter-spacing:.12em}.home-console-mark{width:22px;height:22px;display:grid;place-items:center;border-radius:7px;background:linear-gradient(135deg,#1769e0,#27c9bb);font-size:10px}.hero-window-status{margin-left:auto!important;color:#8fddd4!important;font-size:8px!important}.hero-window-status:before{background:#43d5a4!important}body[data-home-clean-simple="1"] .hero-card-body{padding:23px!important}body[data-home-clean-simple="1"] .hero-card-head{grid-template-columns:54px 1fr!important;gap:14px!important}body[data-home-clean-simple="1"] .visual-icon{width:54px!important;height:54px!important;margin:0!important;border-radius:16px!important;background:rgba(40,148,190,.16)!important;color:#eaffff!important;font-size:13px!important;font-weight:950!important}body[data-home-clean-simple="1"] .visual-title{color:#fff!important;font-size:19px!important}body[data-home-clean-simple="1"] .visual-text{color:#91aabd!important;font-size:10.5px!important;line-height:1.55!important}
      body[data-home-clean-simple="1"] .hero-process{display:flex!important;flex-direction:column!important;gap:0!important;margin-top:19px!important;padding:0!important;border:1px solid rgba(255,255,255,.08)!important;border-radius:13px!important;background:rgba(255,255,255,.025)!important;overflow:hidden!important}.home-console-row{display:grid;grid-template-columns:25px 1fr auto;align-items:center;gap:9px;min-height:39px;padding:0 12px;border-top:1px solid rgba(255,255,255,.06)}.home-console-row:first-child{border-top:0}.home-console-num{width:20px;height:20px;display:grid;place-items:center;border-radius:6px;background:rgba(31,110,183,.22);color:#9fd7ff;font-size:7px;font-weight:950}.home-console-row strong{color:#e7f1f8;font-size:9px}.home-console-row small{color:#688ba2;font-size:7px;font-weight:850}body[data-home-clean-simple="1"] .hero-meter{margin-top:14px!important}body[data-home-clean-simple="1"] .hero-meter-head{font-size:8px!important;color:#809aae!important}body[data-home-clean-simple="1"] .hero-meter-track{height:5px!important;background:rgba(151,188,207,.12)!important}body[data-home-clean-simple="1"] .hero-meter-fill{width:100%!important;background:linear-gradient(90deg,#2174d3,#35d0ba)!important;animation:none!important}
      .footer-business{display:none!important}.footer-business-name{color:rgba(255,255,255,.72);font-size:11px;font-weight:800;white-space:nowrap;padding-left:18px;border-left:1px solid rgba(255,255,255,.18)}
      @media(max-width:1120px){body[data-home-clean-simple="1"] .grid{grid-template-columns:repeat(2,minmax(0,1fr))!important}}@media(max-width:760px){.user-name{display:none!important}.footer-business-name{padding-left:0;border-left:0}body[data-home-clean-simple="1"] .grid{grid-template-columns:1fr!important}body[data-home-clean-simple="1"] .programs{padding-top:40px!important}body[data-home-clean-simple="1"] .hero-visual{min-height:320px!important}body[data-home-clean-simple="1"] .visual-card{width:min(92vw,410px)!important;min-height:305px!important}}@media(max-width:480px){.home-console-row small{display:none}}
    `;
    document.head.appendChild(style);
  }

  function removeGreetingBlock(){document.getElementById('greeting')?.remove()}

  function removeDuplicateHomeBlocks(){
    ['homeDashboardV2','homePrintWorkflow','homePremiumOverview'].forEach(id=>document.getElementById(id)?.remove());
    document.querySelectorAll('.home-premium-overview').forEach(node=>node.remove());
  }

  function simplifyProgramCards(){
    const title=document.getElementById('sectionTitle');if(title&&title.textContent!=='필요한 프로그램만 선택하세요')title.textContent='필요한 프로그램만 선택하세요';
    const map={'디자인 제작':'배경·로고·글씨를 배치해 필요한 인쇄물을 만듭니다.','PDF 편집 · 인쇄배치':'페이지 편집과 인쇄 배치를 한 번에 처리합니다.','PDF 검사 · 유틸리티':'출력 전 PDF 상태와 기본 유틸리티를 빠르게 확인합니다.','이미지 작업 도구':'자르기·크기 조정·배경 제거 같은 기본 작업을 처리합니다.'};
    document.querySelectorAll('#programGrid .card').forEach(card=>{const name=(card.querySelector('.name')?.textContent||'').trim(),desc=card.querySelector('.desc'),next=map[name];if(desc&&next&&desc.textContent!==next)desc.textContent=next});
  }

  function decorateHeroConsole(){
    const hero=document.getElementById('hero'),card=hero?.querySelector('.visual-card'),bar=card?.querySelector('.hero-window-bar'),process=card?.querySelector('.hero-process'),meter=card?.querySelector('.hero-meter');if(!hero||!card||!bar||!process||!meter)return false;
    hero.querySelectorAll('.hero-float').forEach(node=>node.remove());
    if(bar.dataset.cleanConsole!=='1'){bar.dataset.cleanConsole='1';bar.innerHTML='<div class="home-console-brand"><span class="home-console-mark">P</span><span>PRODUCTION STUDIO</span></div><span class="hero-window-status">READY</span>'}
    if(!process.querySelector('.home-console-row'))process.innerHTML='<div class="home-console-row"><span class="home-console-num">01</span><strong>디자인 제작</strong><small>DESIGN</small></div><div class="home-console-row"><span class="home-console-num">02</span><strong>PDF 편집·인쇄배치</strong><small>LAYOUT</small></div><div class="home-console-row"><span class="home-console-num">03</span><strong>인쇄 전 검사</strong><small>CHECK</small></div>';
    const head=meter.querySelector('.hero-meter-head');if(head&&head.dataset.cleanConsole!=='1'){head.dataset.cleanConsole='1';head.innerHTML='<span>작업 준비</span><span>READY</span>'}const fill=meter.querySelector('.hero-meter-fill');if(fill)fill.style.width='100%';return true;
  }

  function findCopyright(footer){return [...footer.querySelectorAll('.footer-right > span')].find(el=>(el.textContent||'').includes('©'))||[...footer.querySelectorAll('span')].find(el=>(el.textContent||'').includes('©'))||null}

  function dedupeBusinessName(footer,label,name){
    const normalized=String(name||'').trim();if(!normalized)return;
    footer.querySelectorAll('.footer-business-name').forEach(node=>{if(node!==label)node.remove()});
    footer.querySelectorAll('span,a,button').forEach(node=>{if(node!==label&&!node.children.length&&(node.textContent||'').trim()===normalized)node.remove()});
  }

  async function loadBusinessName(){
    const footer=document.querySelector('footer'),copyright=footer&&findCopyright(footer);if(!footer||!copyright)return;
    let label=footer.querySelector('.footer-business-name');if(!label){label=document.createElement('span');label.className='footer-business-name';label.hidden=true;copyright.insertAdjacentElement('afterend',label)}
    try{let snap=await db.collection('settings').doc('business').get().catch(()=>null);if(!snap||!snap.exists)snap=await db.collection('site_settings').doc('business').get().catch(()=>null);const name=String((snap&&snap.exists?snap.data():{}).bizName||'').trim();if(!name){label.remove();currentBusinessName='';return}currentBusinessName=name;if(label.textContent!==name)label.textContent=name;label.hidden=false;dedupeBusinessName(footer,label,name)}catch(_){label.remove();currentBusinessName=''}
  }

  function keepDetailedBusinessHidden(){
    const footer=document.querySelector('footer');if(!footer)return;footer.querySelectorAll('.footer-business').forEach(el=>{el.hidden=true;el.setAttribute('aria-hidden','true');el.style.display='none'});if(currentBusinessName){const label=footer.querySelector('.footer-business-name');if(label)dedupeBusinessName(footer,label,currentBusinessName)}
  }

  function syncHome(){document.body.dataset.homeCleanSimple='1';removeDuplicateHomeBlocks();simplifyProgramCards();decorateHeroConsole();keepDetailedBusinessHidden()}
  function scheduleSync(){if(scheduled)return;scheduled=true;requestAnimationFrame(()=>{scheduled=false;syncHome()})}
  function observeHome(){if(document.body.__homeCleanObserver)return;document.body.__homeCleanObserver=true;new MutationObserver(records=>{if(records.some(record=>record.addedNodes.length||record.removedNodes.length))scheduleSync()}).observe(document.body,{childList:true,subtree:true})}

  function boot(){injectStyles();removeGreetingBlock();syncHome();observeHome();loadBusinessName().then(scheduleSync);[120,350,800,1500,2600].forEach(delay=>setTimeout(scheduleSync,delay));window.HomeHeaderFooterRefine={sync:syncHome,stage:'home-clean-hierarchy-hero-footer-v2'}}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();