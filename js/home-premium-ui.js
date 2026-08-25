// Premium visual layer for the Program Studio home page.
(function(){
  'use strict';
  if(window.__programStudioHomePremiumV1)return;
  window.__programStudioHomePremiumV1=true;

  const path=location.pathname.replace(/\/+$/,'')||'/';
  if(path!=='/'&&path!=='/index.html')return;

  const STYLE_ID='programStudioHomePremiumStyles';
  const OVERVIEW_ID='homePremiumOverview';

  function installStyles(){
    if(document.getElementById(STYLE_ID))return;
    const style=document.createElement('style');
    style.id=STYLE_ID;
    style.textContent=`
      :root{--home-premium-shell:1360px;--home-premium-navy:#071a38;--home-premium-blue:#1769e0;--home-premium-cyan:#18a7bd;--home-premium-ink:#0f172a;--home-premium-muted:#64748b;--home-premium-line:#dfe7f0}
      body[data-home-premium="1"]{background:radial-gradient(circle at 8% 22%,rgba(23,105,224,.055),transparent 24%),radial-gradient(circle at 92% 56%,rgba(24,167,189,.055),transparent 27%),#f7f9fc!important;color:var(--home-premium-ink)}
      body[data-home-premium="1"] main{padding-top:82px!important;overflow:hidden}
      body[data-home-premium="1"] .nav{height:82px!important;background:rgba(255,255,255,.88)!important;border-bottom:1px solid rgba(218,228,239,.88)!important;box-shadow:0 8px 32px rgba(15,23,42,.045)!important;backdrop-filter:blur(24px) saturate(145%)!important}
      body[data-home-premium="1"] .nav:before{content:"";position:absolute;left:0;right:0;top:0;height:2px;background:linear-gradient(90deg,transparent,#1769e0 32%,#18b6b9 68%,transparent);opacity:.62}
      body[data-home-premium="1"] .nav-shell{max-width:var(--home-premium-shell)!important;padding:0 30px!important}
      body[data-home-premium="1"] .nav-logo{gap:13px!important}
      body[data-home-premium="1"] .brand-copy{transform:translateY(1px)}
      body[data-home-premium="1"] .brand-name{font-size:20px!important;letter-spacing:-.45px!important;color:#09264e!important}
      body[data-home-premium="1"] .brand-platform{color:#7a8aa0!important;letter-spacing:1.8px!important}
      body[data-home-premium="1"] .nav-btn{min-height:42px!important;display:inline-flex;align-items:center;justify-content:center;padding:0 16px!important;border-radius:13px!important;border-color:#d8e2ed!important;background:rgba(255,255,255,.86)!important;color:#32465b!important;box-shadow:0 4px 14px rgba(15,23,42,.035)!important;transition:transform .18s ease,box-shadow .18s ease,border-color .18s ease!important}
      body[data-home-premium="1"] .nav-btn:hover{transform:translateY(-1px);border-color:#b9cada!important;box-shadow:0 9px 22px rgba(15,23,42,.08)!important}
      body[data-home-premium="1"] .nav-btn.primary{border:0!important;color:#fff!important;background:linear-gradient(135deg,#09264e 0%,#1769e0 62%,#18a7bd 118%)!important;box-shadow:0 11px 24px rgba(23,105,224,.22)!important}
      body[data-home-premium="1"] .user{min-height:42px!important;border-radius:13px!important;background:rgba(248,250,252,.94)!important;border:1px solid #d9e3ed!important;box-shadow:0 5px 14px rgba(15,23,42,.045)!important}
      body[data-home-premium="1"] .dropdown{border:1px solid #dce5ee!important;border-radius:18px!important;box-shadow:0 28px 70px rgba(15,23,42,.2)!important}

      body[data-home-premium="1"] .hero{min-height:620px!important;position:relative!important;border-bottom:1px solid rgba(255,255,255,.12)!important;box-shadow:inset 0 -1px 0 rgba(255,255,255,.08)!important}
      body[data-home-premium="1"] .hero:before{background-image:linear-gradient(rgba(255,255,255,.09) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,.09) 1px,transparent 1px)!important;background-size:72px 72px!important;opacity:.24!important;mask-image:linear-gradient(90deg,rgba(0,0,0,.82),rgba(0,0,0,.12) 84%,transparent)!important}
      body[data-home-premium="1"] .hero:after{width:720px!important;height:720px!important;right:-260px!important;bottom:-465px!important;border-color:rgba(255,255,255,.13)!important;box-shadow:0 0 0 92px rgba(255,255,255,.028),0 0 0 184px rgba(255,255,255,.018),0 0 0 276px rgba(255,255,255,.012)!important}
      body[data-home-premium="1"] .hero-shell{max-width:var(--home-premium-shell)!important;padding:92px 30px 92px!important}
      body[data-home-premium="1"] .hero-inner{grid-template-columns:minmax(0,1.08fr) minmax(390px,.92fr)!important;gap:84px!important}
      body[data-home-premium="1"] .hero-copy-panel{max-width:760px!important}
      body[data-home-premium="1"] .hero .badge{min-height:34px!important;padding:0 13px!important;border-radius:999px!important;font-size:10px!important;font-weight:900!important;letter-spacing:.08em!important;background:rgba(255,255,255,.105)!important;border:1px solid rgba(255,255,255,.2)!important;box-shadow:inset 0 1px 0 rgba(255,255,255,.1),0 10px 28px rgba(0,0,0,.10)!important}
      body[data-home-premium="1"] .hero h1{max-width:780px!important;margin-bottom:23px!important;font-size:clamp(52px,5.8vw,82px)!important;line-height:.96!important;letter-spacing:-4.6px!important;font-weight:950!important}
      body[data-home-premium="1"] .hero h1 span{margin-top:7px!important}
      body[data-home-premium="1"] .hero-lead{max-width:680px;font-size:clamp(21px,2.2vw,30px)!important;letter-spacing:-.8px!important;font-weight:820!important}
      body[data-home-premium="1"] .hero-copy{max-width:680px!important;margin-top:14px!important;font-size:15px!important;line-height:1.85!important;color:rgba(255,255,255,.70)!important}
      body[data-home-premium="1"] .hero-actions{margin-top:33px!important;gap:11px!important}
      body[data-home-premium="1"] .hero-action{min-height:52px!important;padding:0 23px!important;border-radius:15px!important;font-size:13px!important;letter-spacing:-.1px!important}
      body[data-home-premium="1"] .hero-action.main{box-shadow:0 18px 42px rgba(0,0,0,.22)!important}
      body[data-home-premium="1"] .hero-action.secondary{border-color:rgba(255,255,255,.22)!important;background:rgba(255,255,255,.085)!important}
      body[data-home-premium="1"] .hero-highlights{margin-top:28px!important;gap:10px 20px!important;font-size:11px!important;color:rgba(255,255,255,.72)!important}
      body[data-home-premium="1"] .hero-highlight:before{width:20px!important;height:20px!important}

      body[data-home-premium="1"] .hero-visual{min-height:390px!important}
      body[data-home-premium="1"] .visual-card{width:min(100%,420px)!important;min-height:330px!important;border-radius:30px!important;border:1px solid rgba(255,255,255,.58)!important;background:linear-gradient(150deg,rgba(255,255,255,.99),rgba(240,247,253,.94))!important;box-shadow:0 42px 95px rgba(0,15,42,.39),inset 0 1px 0 rgba(255,255,255,.95)!important;transform:rotateY(-4deg) rotateX(2deg) translateZ(0)!important}
      body[data-home-premium="1"] .visual-card:before{content:"";position:absolute;width:190px;height:190px;right:-65px;bottom:-75px;border-radius:50%;background:radial-gradient(circle,rgba(23,105,224,.13),rgba(24,167,189,.03) 62%,transparent 72%);pointer-events:none}
      body[data-home-premium="1"] .visual-card:hover{transform:rotateY(-1deg) rotateX(0deg) translateY(-7px)!important}
      body[data-home-premium="1"] .hero-window-bar{height:48px!important;padding:0 19px!important;background:rgba(255,255,255,.78)!important}
      body[data-home-premium="1"] .hero-card-body{padding:27px 27px 24px!important}
      body[data-home-premium="1"] .hero-card-head{grid-template-columns:62px 1fr!important;gap:16px!important}
      body[data-home-premium="1"] .visual-icon{width:62px!important;height:62px!important;border-radius:19px!important;background:linear-gradient(145deg,#eef5ff,#e7fbfb)!important;box-shadow:0 12px 30px rgba(16,76,125,.13)!important}
      body[data-home-premium="1"] .visual-title{font-size:20px!important;color:#102a46!important}
      body[data-home-premium="1"] .visual-text{font-size:12px!important;color:#66798d!important}
      body[data-home-premium="1"] .hero-process{margin-top:25px!important;padding:14px!important;border-radius:16px!important;border-color:#dfe9f2!important;background:linear-gradient(135deg,#f7faff,#f2f8fb)!important}
      body[data-home-premium="1"] .hero-process span{font-size:9px!important;color:#466078!important}
      body[data-home-premium="1"] .hero-meter{margin-top:19px!important}
      body[data-home-premium="1"] .hero-meter-track{height:8px!important;background:#e8eef4!important}
      body[data-home-premium="1"] .hero-float{padding:10px 13px!important;border-radius:13px!important;border-color:rgba(255,255,255,.28)!important;background:rgba(255,255,255,.115)!important;box-shadow:0 18px 38px rgba(0,0,0,.18)!important;font-size:9px!important}

      body[data-home-premium="1"] .hpw{max-width:var(--home-premium-shell)!important;margin:-36px auto 0!important;padding:0 30px!important;position:relative!important;z-index:8!important}
      body[data-home-premium="1"] .hpw-box{padding:19px 20px!important;border-radius:24px!important;border:1px solid rgba(211,224,237,.95)!important;background:rgba(255,255,255,.94)!important;box-shadow:0 24px 60px rgba(15,23,42,.10)!important;backdrop-filter:blur(18px)!important}
      body[data-home-premium="1"] .hpw-head{margin-bottom:14px!important}
      body[data-home-premium="1"] .hpw-mark{width:40px!important;height:40px!important;border-radius:12px!important;background:linear-gradient(145deg,#e9fbf8,#e8f2ff)!important;box-shadow:inset 0 0 0 1px #d8ebe9!important}
      body[data-home-premium="1"] .hpw-title{font-size:14px!important;color:#102e50!important}
      body[data-home-premium="1"] .hpw-sub{font-size:10px!important;color:#74869a!important}
      body[data-home-premium="1"] .hpw-steps{gap:10px!important}
      body[data-home-premium="1"] .hpw-step{min-height:66px!important;padding:11px 13px!important;border-radius:14px!important;border-color:#e0e8f0!important;background:linear-gradient(145deg,#fbfdff,#f7fafc)!important;box-shadow:inset 0 1px 0 #fff!important}
      body[data-home-premium="1"] .hpw-step:hover{border-color:#8bcbd1!important;background:#f6fdfd!important;box-shadow:0 10px 26px rgba(15,23,42,.07)!important}
      body[data-home-premium="1"] .hpw-num{width:28px!important;height:28px!important;border-radius:9px!important;background:linear-gradient(135deg,#0b2a55,#1769e0)!important}
      body[data-home-premium="1"] .hpw-step strong{font-size:10.5px!important;color:#263d55!important}
      body[data-home-premium="1"] .hpw-step small{font-size:8.5px!important;color:#77889a!important}
      body[data-home-premium="1"] .hpw-note{margin-top:12px!important;padding-top:11px!important}

      .home-premium-overview{max-width:var(--home-premium-shell);margin:28px auto 0;padding:0 30px;display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px}
      .home-premium-overview-card{position:relative;overflow:hidden;min-height:112px;padding:19px 20px;border:1px solid #e0e8f1;border-radius:20px;background:rgba(255,255,255,.84);box-shadow:0 10px 34px rgba(15,23,42,.045);backdrop-filter:blur(12px)}
      .home-premium-overview-card:after{content:"";position:absolute;right:-25px;bottom:-35px;width:105px;height:105px;border-radius:50%;background:radial-gradient(circle,var(--overview-glow),transparent 69%);opacity:.62}
      .home-premium-overview-icon{width:34px;height:34px;display:grid;place-items:center;margin-bottom:12px;border-radius:10px;background:var(--overview-bg);color:var(--overview-color);font-size:15px;font-weight:950;box-shadow:inset 0 0 0 1px rgba(15,23,42,.04)}
      .home-premium-overview-card strong{position:relative;z-index:1;display:block;color:#17324f;font-size:13px;font-weight:950;letter-spacing:-.2px}
      .home-premium-overview-card span{position:relative;z-index:1;display:block;margin-top:5px;color:#7a8b9e;font-size:10px;line-height:1.5}

      body[data-home-premium="1"] .programs{max-width:var(--home-premium-shell)!important;padding:76px 30px 108px!important}
      body[data-home-premium="1"] .programs-head{margin-bottom:28px!important;padding-bottom:22px;border-bottom:1px solid #e5ebf2}
      body[data-home-premium="1"] .section-kicker{margin-bottom:11px!important;font-size:10px!important;letter-spacing:2.3px!important;color:#26718e!important}
      body[data-home-premium="1"] .programs h2{font-size:clamp(31px,3.6vw,43px)!important;letter-spacing:-1.7px!important;color:#0d2947!important}
      body[data-home-premium="1"] .count{padding:8px 11px;border:1px solid #e0e8ef;border-radius:999px;background:rgba(255,255,255,.84);color:#6e8195!important;font-size:10px!important;font-weight:850;box-shadow:0 5px 14px rgba(15,23,42,.03)}
      body[data-home-premium="1"][data-home-suite="professional"] .grid,body[data-home-premium="1"] .grid{grid-template-columns:repeat(4,minmax(0,1fr))!important;gap:15px!important}
      body[data-home-premium="1"] .card{min-height:292px!important;padding:22px!important;border:1px solid #dfe7f0!important;border-radius:24px!important;background:linear-gradient(152deg,rgba(255,255,255,.98),rgba(249,251,253,.96))!important;box-shadow:0 12px 34px rgba(15,23,42,.055)!important;transition:transform .22s ease,box-shadow .22s ease,border-color .22s ease!important;isolation:isolate}
      body[data-home-premium="1"] .card:before{left:21px!important;top:0!important;bottom:auto!important;width:54px!important;height:4px!important;border-radius:0 0 999px 999px!important;background:linear-gradient(90deg,var(--card-accent),color-mix(in srgb,var(--card-accent) 45%,#fff))!important}
      body[data-home-premium="1"] .card:after{content:"";position:absolute;z-index:-1;right:-42px;top:-45px;width:145px;height:145px;border-radius:50%;background:radial-gradient(circle,color-mix(in srgb,var(--card-accent) 16%,transparent),transparent 69%);opacity:.72;transition:transform .28s ease,opacity .28s ease}
      body[data-home-premium="1"] .card:not(.coming):hover{transform:translateY(-7px)!important;border-color:color-mix(in srgb,var(--card-accent) 37%,#dfe7f0)!important;box-shadow:0 25px 60px rgba(15,23,42,.11)!important}
      body[data-home-premium="1"] .card:not(.coming):hover:after{transform:scale(1.22);opacity:1}
      body[data-home-premium="1"] .program-main{gap:14px!important;margin-bottom:17px!important}
      body[data-home-premium="1"] .icon{width:60px!important;height:60px!important;border-radius:18px!important;background:linear-gradient(145deg,var(--program-icon-bg,#eef4ff),#fff)!important;box-shadow:inset 0 0 0 1px rgba(15,23,42,.045),0 8px 20px rgba(15,23,42,.055)!important;font-size:18px!important;letter-spacing:-.7px}
      body[data-home-premium="1"] .name{font-size:17px!important;letter-spacing:-.5px!important;color:#132f4d!important}
      body[data-home-premium="1"] .program-type{margin-top:6px!important;font-size:9px!important;letter-spacing:.04em!important;color:#91a0b0!important}
      body[data-home-premium="1"] .desc{font-size:12.5px!important;line-height:1.72!important;color:#687b8e!important}
      body[data-home-premium="1"] .tags{gap:5px!important;margin-top:14px!important}
      body[data-home-premium="1"] .tag{padding:5px 7px!important;border:1px solid #e5ebf1;border-radius:8px!important;background:#f7f9fb!important;color:#66798c!important;font-size:9px!important;font-weight:820!important}
      body[data-home-premium="1"] .program-action{margin-top:18px!important;padding-top:15px;border-top:1px solid #edf1f5}
      body[data-home-premium="1"] .status{position:relative;padding:6px 9px 6px 21px!important;border:1px solid #d8eee8;border-radius:999px!important;background:#f1fbf7!important;color:#168168!important;font-size:9px!important}
      body[data-home-premium="1"] .status:before{content:"";position:absolute;left:9px;top:50%;width:6px;height:6px;transform:translateY(-50%);border-radius:50%;background:#2db68b;box-shadow:0 0 0 3px rgba(45,182,139,.11)}
      body[data-home-premium="1"] .cta{font-size:10.5px!important;color:#385b7a!important;transition:transform .18s ease,color .18s ease}
      body[data-home-premium="1"] .card:not(.coming):hover .cta{transform:translateX(3px);color:var(--card-accent)!important}
      body[data-home-premium="1"] .card.coming{opacity:.67!important;filter:saturate(.62)!important;background:linear-gradient(152deg,#fafbfd,#f5f7fa)!important}
      body[data-home-premium="1"] .card.coming .status{border-color:#e3e7ec!important;background:#f5f6f8!important;color:#8a96a5!important;padding-left:9px!important}
      body[data-home-premium="1"] .card.coming .status:before{display:none}

      body[data-home-premium="1"] .approval{max-width:var(--home-premium-shell);margin:32px auto 0;padding:0 30px!important;background:transparent!important;text-align:left!important}
      body[data-home-premium="1"] .approval-card{position:relative;overflow:hidden;max-width:none!important;min-height:118px;display:flex;flex-direction:column;justify-content:center;padding:25px 28px 25px 88px!important;border:1px solid #dbe6f1!important;border-radius:22px!important;background:linear-gradient(135deg,#fff,#f5f9ff)!important;box-shadow:0 15px 40px rgba(15,23,42,.06)!important}
      body[data-home-premium="1"] .approval-card:before{content:"✓";position:absolute;left:28px;top:50%;width:42px;height:42px;display:grid;place-items:center;transform:translateY(-50%);border-radius:13px;background:linear-gradient(135deg,#0b2a55,#1769e0);color:#fff;font-size:17px;font-weight:950;box-shadow:0 11px 22px rgba(23,105,224,.2)}
      body[data-home-premium="1"] .approval-card:after{content:"ADMIN APPROVAL";position:absolute;right:24px;top:20px;color:#a0adba;font-size:8px;font-weight:950;letter-spacing:.15em}
      body[data-home-premium="1"] .approval-card h2{font-size:17px;color:#17324f;letter-spacing:-.3px}
      body[data-home-premium="1"] .approval-card p{margin-top:7px;color:#708296;font-size:11px}

      body[data-home-premium="1"] footer{position:relative;overflow:hidden;padding:36px 30px!important;background:linear-gradient(135deg,#06162c,#092447 58%,#0d3655)!important;border-top:1px solid rgba(255,255,255,.07)!important}
      body[data-home-premium="1"] footer:after{content:"";position:absolute;right:-120px;bottom:-180px;width:430px;height:430px;border-radius:50%;border:1px solid rgba(255,255,255,.05);box-shadow:0 0 0 65px rgba(255,255,255,.018),0 0 0 130px rgba(255,255,255,.012)}
      body[data-home-premium="1"] .footer-inner{position:relative;z-index:1;max-width:var(--home-premium-shell)!important}
      body[data-home-premium="1"] .footer-brand{font-size:14px!important;letter-spacing:-.2px}
      body[data-home-premium="1"] .footer-link{color:rgba(255,255,255,.65)!important}
      body[data-home-premium="1"] .footer-link:hover{color:#fff!important}

      body[data-home-premium="1"] #loading{background:radial-gradient(circle at 50% 42%,#f7fbff,#fff 58%)!important}
      body[data-home-premium="1"] .spin{width:42px!important;height:42px!important;border-width:3px!important;border-color:#dfe8f1!important;border-top-color:#1769e0!important;box-shadow:0 6px 18px rgba(23,105,224,.08)}

      @media(max-width:1180px){
        body[data-home-premium="1"] .hero-inner{grid-template-columns:minmax(0,1fr) 360px!important;gap:48px!important}
        body[data-home-premium="1"][data-home-suite="professional"] .grid,body[data-home-premium="1"] .grid{grid-template-columns:repeat(2,minmax(0,1fr))!important}
      }
      @media(max-width:760px){
        body[data-home-premium="1"] main,body[data-home-premium="1"][data-home-suite="professional"] main{padding-top:76px!important}
        body[data-home-premium="1"] .nav,body[data-home-premium="1"][data-home-suite="professional"] .nav{height:76px!important}
        body[data-home-premium="1"] .nav-shell{height:76px!important;padding:0 5%!important}
        body[data-home-premium="1"] .hero{min-height:auto!important}
        body[data-home-premium="1"] .hero-shell{padding:58px 5% 62px!important}
        body[data-home-premium="1"] .hero-inner{grid-template-columns:1fr!important;gap:42px!important}
        body[data-home-premium="1"] .hero h1{font-size:clamp(43px,12vw,59px)!important;letter-spacing:-3.2px!important}
        body[data-home-premium="1"] .hero-visual{min-height:310px!important}
        body[data-home-premium="1"] .visual-card{width:min(92vw,420px)!important;transform:none!important}
        body[data-home-premium="1"] .hpw{margin:-24px auto 0!important;padding:0 5%!important}
        body[data-home-premium="1"] .hpw-box{padding:16px!important;border-radius:20px!important}
        .home-premium-overview{padding:0 5%;grid-template-columns:1fr;margin-top:20px}
        .home-premium-overview-card{min-height:98px;padding:16px 17px;display:grid;grid-template-columns:36px 1fr;grid-template-rows:auto auto;column-gap:12px;align-items:center}
        .home-premium-overview-icon{grid-row:1/3;margin:0}
        .home-premium-overview-card span{margin-top:2px}
        body[data-home-premium="1"] .programs{padding:62px 5% 86px!important}
        body[data-home-premium="1"] .programs-head{display:block!important}
        body[data-home-premium="1"] .count{display:inline-flex;margin-top:12px}
        body[data-home-premium="1"][data-home-suite="professional"] .grid,body[data-home-premium="1"] .grid{grid-template-columns:1fr!important}
        body[data-home-premium="1"] .card{min-height:260px!important}
        body[data-home-premium="1"] .approval{padding:0 5%!important}
        body[data-home-premium="1"] .approval-card{padding:70px 20px 22px!important}
        body[data-home-premium="1"] .approval-card:before{left:20px;top:18px;transform:none}
        body[data-home-premium="1"] .approval-card:after{right:18px;top:28px}
        body[data-home-premium="1"] footer{padding:32px 5%!important}
      }
      @media(max-width:480px){
        body[data-home-premium="1"] .brand-mark,body[data-home-premium="1"] .brand-mark svg{width:42px!important;height:42px!important}
        body[data-home-premium="1"] .brand-name{font-size:17px!important}
        body[data-home-premium="1"] .brand-platform{display:none!important}
        body[data-home-premium="1"] #startBtn{display:none!important}
        body[data-home-premium="1"] .hero-shell{padding-top:50px!important}
        body[data-home-premium="1"] .hero h1{font-size:42px!important}
        body[data-home-premium="1"] .hero-actions{grid-template-columns:1fr!important}
        body[data-home-premium="1"] .hero-highlights{grid-template-columns:1fr!important}
        body[data-home-premium="1"] .hero-visual{min-height:285px!important}
        body[data-home-premium="1"] .visual-card{min-height:292px!important;border-radius:24px!important}
      }
      @media(prefers-reduced-motion:reduce){body[data-home-premium="1"] .card,body[data-home-premium="1"] .nav-btn,body[data-home-premium="1"] .cta{transition:none!important}}
    `;
    document.head.appendChild(style);
  }

  function addOverview(){
    let overview=document.getElementById(OVERVIEW_ID);
    if(!overview){
      overview=document.createElement('section');
      overview.id=OVERVIEW_ID;
      overview.className='home-premium-overview';
      overview.setAttribute('aria-label','Program Studio 핵심 특징');
      overview.innerHTML=`
        <article class="home-premium-overview-card" style="--overview-bg:#edf4ff;--overview-color:#1769e0;--overview-glow:rgba(23,105,224,.20)"><div class="home-premium-overview-icon">✓</div><strong>관리자 승인 기반</strong><span>승인된 사용자만 실제 프로그램에 접근하도록 운영합니다.</span></article>
        <article class="home-premium-overview-card" style="--overview-bg:#eafaf7;--overview-color:#15836f;--overview-glow:rgba(24,167,189,.20)"><div class="home-premium-overview-icon">↗</div><strong>브라우저에서 바로 실행</strong><span>별도 설치 없이 필요한 실무 도구를 바로 사용할 수 있습니다.</span></article>
        <article class="home-premium-overview-card" style="--overview-bg:#fff4e8;--overview-color:#d77728;--overview-glow:rgba(240,139,50,.20)"><div class="home-premium-overview-icon">P</div><strong>출력 실무 중심</strong><span>디자인부터 PDF 편집·검사까지 실제 작업 흐름에 맞췄습니다.</span></article>`;
    }
    const workflow=document.getElementById('homePrintWorkflow');
    const programs=document.getElementById('programs');
    if(workflow&&workflow.nextElementSibling!==overview)workflow.insertAdjacentElement('afterend',overview);
    else if(!workflow&&programs&&overview.nextElementSibling!==programs)programs.insertAdjacentElement('beforebegin',overview);
  }

  function decorateCards(){
    const cards=[...document.querySelectorAll('#programGrid .card')];
    cards.forEach((card,index)=>{
      card.dataset.homeCard=String(index+1).padStart(2,'0');
      const icon=card.querySelector('.icon');
      if(icon){
        const raw=icon.getAttribute('style')||'';
        const match=raw.match(/background\s*:\s*([^;]+)/i);
        if(match)card.style.setProperty('--program-icon-bg',match[1].trim());
      }
    });
    const available=cards.filter(card=>!card.classList.contains('coming')).length;
    const total=cards.length;
    const meter=document.querySelector('.hero-meter-head');
    if(meter&&document.body.dataset.homeSuite==='professional'){
      meter.innerHTML=`<span>사용 가능한 실무 도구</span><span>${available}/${total||available}</span>`;
    }
  }

  function refineHero(){
    const hero=document.getElementById('hero');
    if(!hero)return;
    hero.setAttribute('aria-label','Program Studio 주요 업무 도구');
    const status=hero.querySelector('.hero-window-status');
    if(status)status.textContent='WORKSPACE READY';
  }

  function refineFooter(){
    const footer=document.querySelector('footer');
    if(!footer||footer.dataset.premiumFooter==='1')return;
    footer.dataset.premiumFooter='1';
    const brand=footer.querySelector('.footer-brand');
    if(brand&&!brand.querySelector('small')){
      const small=document.createElement('small');
      small.style.cssText='display:block;margin-top:5px;color:rgba(255,255,255,.45);font-size:8px;font-weight:800;letter-spacing:.12em';
      small.textContent='SMART WORK PLATFORM';
      brand.appendChild(small);
    }
  }

  function apply(){
    document.body.dataset.homePremium='1';
    installStyles();
    addOverview();
    decorateCards();
    refineHero();
    refineFooter();
  }

  function observe(){
    const grid=document.getElementById('programGrid');
    if(grid&&!grid.__homePremiumObserved){
      grid.__homePremiumObserved=true;
      new MutationObserver(()=>decorateCards()).observe(grid,{childList:true});
    }
    const body=document.body;
    if(body&&!body.__homePremiumObserved){
      body.__homePremiumObserved=true;
      new MutationObserver(()=>{
        if(document.getElementById('homePrintWorkflow'))addOverview();
      }).observe(body,{childList:true,subtree:false});
    }
  }

  function boot(){
    apply();
    observe();
    [250,650,1200,2200,3800].forEach(delay=>setTimeout(()=>{apply();observe();},delay));
  }

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});
  else boot();

  window.HomePremiumUI={apply,stage:'home-premium-ui-v1'};
})();
