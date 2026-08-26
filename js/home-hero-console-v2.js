// Refined hero workspace console for the Program Studio home page.
(function(){
  'use strict';
  if(window.__homeHeroConsoleV2)return;
  window.__homeHeroConsoleV2=true;

  const path=location.pathname.replace(/\/+$/,'')||'/';
  if(path!=='/'&&path!=='/index.html')return;

  const STYLE_ID='homeHeroConsoleV2Styles';

  function installStyles(){
    if(document.getElementById(STYLE_ID))return;
    const style=document.createElement('style');
    style.id=STYLE_ID;
    style.textContent=`
      body[data-home-hero-console="v2"] .hero-visual{
        position:relative!important;
        min-height:400px!important;
        isolation:isolate;
        perspective:none!important;
      }
      body[data-home-hero-console="v2"] .hero-visual:before{
        content:"";
        position:absolute;
        z-index:-2;
        width:min(90%,430px);
        height:300px;
        border-radius:32px;
        border:1px solid rgba(125,238,229,.16);
        background:linear-gradient(145deg,rgba(255,255,255,.045),rgba(62,218,210,.025));
        transform:translate(28px,24px) rotate(5deg);
        box-shadow:0 30px 85px rgba(0,12,31,.24);
      }
      body[data-home-hero-console="v2"] .hero-visual:after{
        content:"";
        position:absolute;
        z-index:-3;
        width:330px;
        height:330px;
        right:1%;
        top:2%;
        border-radius:50%;
        background:radial-gradient(circle,rgba(48,218,205,.17) 0%,rgba(31,139,181,.07) 42%,transparent 72%);
        filter:blur(3px);
      }
      body[data-home-hero-console="v2"] .visual-card{
        position:relative!important;
        z-index:2!important;
        width:min(100%,440px)!important;
        min-height:350px!important;
        overflow:hidden!important;
        border-radius:27px!important;
        border:1px solid rgba(151,230,231,.22)!important;
        background:
          radial-gradient(circle at 88% 8%,rgba(39,206,197,.12),transparent 34%),
          linear-gradient(145deg,rgba(7,27,47,.98),rgba(8,37,61,.98) 54%,rgba(7,48,69,.97))!important;
        color:#fff!important;
        box-shadow:0 38px 90px rgba(0,13,34,.38),inset 0 1px 0 rgba(255,255,255,.08)!important;
        transform:none!important;
        backdrop-filter:blur(22px)!important;
        transition:transform .3s ease,box-shadow .3s ease,border-color .3s ease!important;
      }
      body[data-home-hero-console="v2"] .visual-card:hover{
        transform:translateY(-6px)!important;
        border-color:rgba(151,230,231,.36)!important;
        box-shadow:0 46px 105px rgba(0,13,34,.46),inset 0 1px 0 rgba(255,255,255,.11)!important;
      }
      body[data-home-hero-console="v2"] .visual-card:before{
        content:""!important;
        position:absolute!important;
        inset:0 0 auto!important;
        width:auto!important;
        height:1px!important;
        border-radius:0!important;
        background:linear-gradient(90deg,transparent,rgba(113,244,232,.72),transparent)!important;
        pointer-events:none!important;
      }
      body[data-home-hero-console="v2"] .visual-card:after{
        content:"";
        position:absolute;
        right:-70px;
        bottom:-100px;
        width:230px;
        height:230px;
        border-radius:50%;
        background:radial-gradient(circle,rgba(32,190,190,.11),transparent 69%);
        pointer-events:none;
      }
      body[data-home-hero-console="v2"] .hero-window-bar{
        position:relative!important;
        z-index:2!important;
        height:54px!important;
        display:flex!important;
        align-items:center!important;
        padding:0 20px!important;
        border-bottom:1px solid rgba(172,211,229,.10)!important;
        background:rgba(4,20,36,.38)!important;
      }
      .hero-console-brand{display:flex;align-items:center;gap:9px;color:#dbeaf3;font-size:9px;font-weight:950;letter-spacing:.14em;white-space:nowrap}
      .hero-console-brand-mark{width:22px;height:22px;display:grid;place-items:center;border-radius:8px;background:linear-gradient(135deg,#1b6edb,#27c9bb);box-shadow:0 7px 18px rgba(27,110,219,.23);color:#fff;font-size:10px;font-weight:950}
      body[data-home-hero-console="v2"] .hero-window-status{
        margin-left:auto!important;
        color:#9bded5!important;
        font-size:8px!important;
        font-weight:900!important;
        letter-spacing:.12em!important;
      }
      body[data-home-hero-console="v2"] .hero-window-status:before{
        width:6px!important;height:6px!important;background:#43d5a4!important;box-shadow:0 0 0 4px rgba(67,213,164,.11)!important;
      }
      body[data-home-hero-console="v2"] .hero-card-body{position:relative!important;z-index:2!important;padding:25px 25px 21px!important}
      body[data-home-hero-console="v2"] .hero-card-head{grid-template-columns:58px 1fr!important;gap:15px!important;align-items:center!important}
      body[data-home-hero-console="v2"] .visual-icon{
        width:58px!important;height:58px!important;margin:0!important;border-radius:18px!important;
        background:linear-gradient(145deg,rgba(26,106,196,.34),rgba(34,203,190,.17))!important;
        border:1px solid rgba(137,226,223,.18)!important;
        box-shadow:inset 0 1px 0 rgba(255,255,255,.09),0 12px 28px rgba(0,0,0,.17)!important;
        color:#e8ffff!important;font-size:15px!important;font-weight:950!important;letter-spacing:-.04em!important;
      }
      body[data-home-hero-console="v2"] .visual-title{margin:0 0 6px!important;color:#f5fbff!important;font-size:20px!important;font-weight:950!important;letter-spacing:-.65px!important}
      body[data-home-hero-console="v2"] .visual-text{max-width:300px;color:#91aabd!important;font-size:11px!important;line-height:1.62!important}
      body[data-home-hero-console="v2"] .hero-process{
        display:grid!important;
        grid-template-columns:repeat(3,minmax(0,1fr))!important;
        gap:8px!important;
        margin-top:23px!important;
        padding:0!important;
        border:0!important;
        border-radius:0!important;
        background:transparent!important;
      }
      .hero-console-stage{
        position:relative;
        min-width:0;
        padding:12px 10px 11px;
        border:1px solid rgba(157,198,218,.11);
        border-radius:14px;
        background:linear-gradient(145deg,rgba(255,255,255,.055),rgba(255,255,255,.025));
        box-shadow:inset 0 1px 0 rgba(255,255,255,.025);
      }
      .hero-console-stage:after{content:"";position:absolute;left:10px;right:10px;bottom:0;height:2px;border-radius:999px;background:linear-gradient(90deg,#2379d8,#30cabb);opacity:.72}
      .hero-console-stage-top{display:flex;align-items:center;justify-content:space-between;gap:6px;margin-bottom:9px}
      .hero-console-stage-num{width:20px;height:20px;display:grid;place-items:center;border-radius:7px;background:rgba(31,110,183,.22);color:#9fd7ff;font-size:8px;font-weight:950}
      .hero-console-stage-dot{width:6px;height:6px;border-radius:50%;background:#45d6a6;box-shadow:0 0 0 4px rgba(69,214,166,.08)}
      .hero-console-stage strong{display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:#e7f1f8;font-size:9px;font-weight:950;letter-spacing:-.15px}
      .hero-console-stage small{display:block;margin-top:4px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:#6f8ba1;font-size:7.5px;font-weight:800;letter-spacing:.05em}
      body[data-home-hero-console="v2"] .hero-meter{margin-top:18px!important;padding-top:16px!important;border-top:1px solid rgba(157,198,218,.10)!important}
      body[data-home-hero-console="v2"] .hero-meter-head{display:flex!important;align-items:center!important;justify-content:space-between!important;margin-bottom:9px!important;color:#7f99ad!important;font-size:8px!important;font-weight:850!important;letter-spacing:.04em!important}
      body[data-home-hero-console="v2"] .hero-meter-head span:last-child{color:#b7d6df!important;font-weight:950!important}
      body[data-home-hero-console="v2"] .hero-meter-track{position:relative!important;height:6px!important;overflow:visible!important;border-radius:999px!important;background:rgba(151,188,207,.12)!important}
      body[data-home-hero-console="v2"] .hero-meter-fill{width:100%!important;height:100%!important;border-radius:999px!important;background:linear-gradient(90deg,#2174d3 0%,#27a7cf 52%,#35d0ba 100%)!important;box-shadow:0 0 18px rgba(53,208,186,.15)!important;animation:none!important}
      body[data-home-hero-console="v2"] .hero-meter-fill:after{content:"";position:absolute;right:-2px;top:50%;width:10px;height:10px;border-radius:50%;background:#5de0c8;box-shadow:0 0 0 5px rgba(93,224,200,.10);transform:translateY(-50%)}
      .hero-console-footer{display:flex;align-items:center;justify-content:space-between;gap:12px;margin-top:15px;color:#66859b;font-size:7.5px;font-weight:900;letter-spacing:.09em}
      .hero-console-footer strong{display:inline-flex;align-items:center;gap:6px;color:#8dc9c3;font-size:7.5px;letter-spacing:.08em}
      .hero-console-footer strong:before{content:"";width:5px;height:5px;border-radius:50%;background:#43d5a4}
      body[data-home-hero-console="v2"] .hero-float{display:none!important}

      @media(max-width:1050px){
        body[data-home-hero-console="v2"] .visual-card{width:min(100%,400px)!important}
        body[data-home-hero-console="v2"] .hero-visual:before{width:min(88%,390px)}
      }
      @media(max-width:760px){
        body[data-home-hero-console="v2"] .hero-visual{min-height:355px!important}
        body[data-home-hero-console="v2"] .hero-visual:before{width:min(88vw,390px);height:275px;transform:translate(12px,18px) rotate(3deg)}
        body[data-home-hero-console="v2"] .visual-card{width:min(92vw,410px)!important;min-height:330px!important;border-radius:24px!important}
        body[data-home-hero-console="v2"] .hero-card-body{padding:22px 20px 19px!important}
        body[data-home-hero-console="v2"] .hero-process{gap:6px!important}
        .hero-console-stage{padding:10px 8px 9px}
      }
      @media(max-width:480px){
        body[data-home-hero-console="v2"] .hero-visual{min-height:325px!important}
        body[data-home-hero-console="v2"] .hero-visual:before,body[data-home-hero-console="v2"] .hero-visual:after{display:none}
        body[data-home-hero-console="v2"] .visual-card{width:100%!important;min-height:318px!important}
        body[data-home-hero-console="v2"] .hero-window-bar{height:49px!important;padding:0 16px!important}
        body[data-home-hero-console="v2"] .hero-card-head{grid-template-columns:52px 1fr!important}
        body[data-home-hero-console="v2"] .visual-icon{width:52px!important;height:52px!important;border-radius:16px!important}
        body[data-home-hero-console="v2"] .visual-title{font-size:18px!important}
        .hero-console-stage small{display:none}
      }
      @media(prefers-reduced-motion:reduce){body[data-home-hero-console="v2"] .visual-card{transition:none!important}}
    `;
    document.head.appendChild(style);
  }

  function stageMarkup(number,title,sub){
    return `<div class="hero-console-stage"><div class="hero-console-stage-top"><span class="hero-console-stage-num">${number}</span><span class="hero-console-stage-dot" aria-hidden="true"></span></div><strong>${title}</strong><small>${sub}</small></div>`;
  }

  function decorateConsole(){
    const hero=document.getElementById('hero');
    const visual=hero&&hero.querySelector('.hero-visual');
    const card=visual&&visual.querySelector('.visual-card');
    if(!hero||!visual||!card)return false;

    document.body.dataset.homeHeroConsole='v2';
    visual.querySelectorAll('.hero-float').forEach(node=>node.remove());

    const bar=card.querySelector('.hero-window-bar');
    if(bar&&bar.dataset.consoleV2!=='1'){
      bar.dataset.consoleV2='1';
      bar.innerHTML='<div class="hero-console-brand"><span class="hero-console-brand-mark">P</span><span>PRODUCTION CONSOLE</span></div><span class="hero-window-status">SYSTEM READY</span>';
    }

    const process=card.querySelector('.hero-process');
    if(process&&!process.querySelector('.hero-console-stage')){
      process.innerHTML=stageMarkup('01','디자인 제작','DESIGN')+stageMarkup('02','편집·인쇄배치','LAYOUT')+stageMarkup('03','인쇄 전 검사','PREFLIGHT');
    }

    const meter=card.querySelector('.hero-meter');
    if(meter){
      const head=meter.querySelector('.hero-meter-head');
      const fill=meter.querySelector('.hero-meter-fill');
      if(head)head.innerHTML='<span>WORKFLOW STATUS</span><span>READY</span>';
      if(fill)fill.style.width='100%';
      if(!meter.querySelector('.hero-console-footer')){
        const footer=document.createElement('div');
        footer.className='hero-console-footer';
        footer.innerHTML='<span>PRINT WORKSPACE</span><strong>ALL SYSTEMS READY</strong>';
        meter.appendChild(footer);
      }
    }

    card.dataset.consoleV2='1';
    return true;
  }

  let scheduled=false;
  function scheduleDecorate(){
    if(scheduled)return;
    scheduled=true;
    requestAnimationFrame(()=>{
      scheduled=false;
      decorateConsole();
    });
  }

  function observe(){
    const hero=document.getElementById('hero');
    if(!hero||hero.__heroConsoleV2Observed)return;
    hero.__heroConsoleV2Observed=true;
    new MutationObserver(scheduleDecorate).observe(hero,{childList:true,subtree:true});
  }

  function boot(){
    installStyles();
    decorateConsole();
    observe();
    [180,450,900,1500,2400,3800].forEach(delay=>setTimeout(()=>{decorateConsole();observe();},delay));
  }

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});
  else boot();

  window.HomeHeroConsoleV2={apply:decorateConsole,stage:'home-hero-console-v2'};
})();