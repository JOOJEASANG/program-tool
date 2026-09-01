(function(){
  'use strict';
  if(window.__homeProgramCatalogV1)return;
  window.__homeProgramCatalogV1=true;
  const path=location.pathname.replace(/\/+$/,'')||'/';
  if(path!=='/'&&path!=='/index.html')return;

  const DOC_ID='public_program_catalog';
  const text=v=>String(v==null?'':v);
  const esc=v=>text(v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot',"'":'&#39;'}[c]));
  const breaks=v=>esc(v).replace(/\r?\n/g,'<br>');
  const ICONS={design:'M4 20h4L19 9a2 2 0 0 0 0-3l-1-1a2 2 0 0 0-3 0L4 16v4Zm10-13 4 4M4 21h16',pdf:'M6 3h8l4 4v14H6V3Zm8 0v5h4M9 12h2v2H9v-2Zm4 0h2v2h-2v-2Zm-4 4h2m2 0h2',check:'M6 3h8l4 4v5M14 3v5h4M6 3v18h7m1-4 2 2 4-5',image:'M4 5h16v14H4V5Zm2 11 4-4 3 3 2-2 3 3M9 9h.01'};
  const DIRECT_DESIGN_BASE='/design-editor/general?embed=1';
  const MODULAR_DESIGN=[
    {name:'표지 제작',icon:'COVER',accent:'#5267d9',bg:'#eef1ff',desc:'앞표지·뒤표지·책등과 인쇄 안전영역을 한 작업에서 관리합니다.',url:`${DIRECT_DESIGN_BASE}&mode=cover&preset=cover-a4&app=cover&entry=direct`,tags:['책표지','책등','인쇄 규격']},
    {name:'포스터 · 전단지 제작',icon:'POSTER',accent:'#4f7bd9',bg:'#eef5ff',desc:'같은 단면 편집 도구에서 용지 크기와 방향만 바꿔 포스터와 전단지를 제작합니다.',url:`${DIRECT_DESIGN_BASE}&mode=poster&preset=poster-a4&paper=a4&orientation=portrait&w=210&h=297&app=poster&surface=poster-flyer&entry=direct`,tags:['포스터','전단지','용지 규격']},
    {name:'초대장 제작',icon:'INVITE',accent:'#a0619c',bg:'#fff1fb',desc:'접지 위치와 앞뒤 면을 확인하며 초대장을 제작합니다.',url:`${DIRECT_DESIGN_BASE}&mode=invitation&preset=invitation-a4&paper=a4&orientation=landscape&w=297&h=210&app=invitation&entry=direct`,tags:['초대장','접지','앞뒤면']},
    {name:'안내장 제작',icon:'NOTICE',accent:'#b06a72',bg:'#fff3f3',desc:'행사·교육·업무 안내 문구를 정돈된 정보 구조로 제작합니다.',url:`${DIRECT_DESIGN_BASE}&mode=invitation&preset=invitation-a4&paper=a4&orientation=landscape&w=297&h=210&app=invitation&surface=notice&entry=direct`,tags:['안내장','정보 정렬','인쇄']},
    {name:'리플렛 제작',icon:'LEAFLET',accent:'#7d69c7',bg:'#f5f1ff',desc:'4P~12P 접지 구조와 패널 폭, 앞뒤 면을 함께 관리합니다.',url:`${DIRECT_DESIGN_BASE}&mode=leaflet3&preset=leaflet-3-roll&paper=a4&orientation=landscape&w=297&h=210&fold=leaflet-3-roll&app=leaflet&entry=direct`,tags:['4P~12P','접지선','패널']}
  ];
  const COMBINED_POSTER_FLYER=MODULAR_DESIGN[1];
  const MODULAR_PDF=[
    {name:'PDF 배치',icon:'N-UP',accent:'#168b73',bg:'#eaf9f3',desc:'페이지 순서와 N-up, 용지, 여백을 설정해 출력용 PDF를 만듭니다.',url:'/apps/pdf-layout',tags:['N-up','페이지 배치','출력']},
    {name:'소책자 제작',icon:'BOOK',accent:'#2477a7',bg:'#edf7ff',desc:'소책자 페이지 순서와 양면 인쇄 흐름에 집중한 전용 작업실입니다.',url:'/apps/booklet',tags:['소책자','양면 인쇄','페이지 순서']}
  ];

  function ready(){return window.ProgramCatalogCore&&window.db&&typeof CATEGORIES!=='undefined'&&typeof buildNav==='function'&&typeof switchCategory==='function';}
  function normalizedName(p){return text(p?.name).replace(/[\s·ㆍ・/\\-]+/g,'');}
  function rawUrl(p){return text(p?.url).trim();}
  function normalizedUrl(p){return rawUrl(p).toLowerCase().split(/[?#]/,1)[0].replace(/\/+$/,'');}
  function programApp(p){try{return String(new URL(rawUrl(p),location.origin).searchParams.get('app')||'').toLowerCase();}catch(_){return'';}}
  function isPosterFlyerProgram(p){
    const u=normalizedUrl(p),n=normalizedName(p),app=programApp(p);
    return app==='poster'||app==='flyer'||u.endsWith('/apps/poster')||u.endsWith('/apps/flyer')||[
      '포스터제작','전단지제작','포스터디자인','전단지디자인','포스터전단지제작','포스터전단지디자인'
    ].includes(n);
  }
  function isDesignProgram(p){const u=normalizedUrl(p),n=normalizedName(p),app=programApp(p);return (u.includes('design-editor')&&!app)||n==='디자인제작'||n.includes('디자인편집');}
  function isPdfEditorProgram(p){const u=normalizedUrl(p),n=normalizedName(p);return (u.includes('pdf-editor')&&!u.includes('preflight'))||n.includes('PDF편집')||n.includes('인쇄배치');}
  function expandPrograms(programs){
    const out=[];let designExpanded=false,pdfExpanded=false,posterFlyerExpanded=false;
    const pushProgram=p=>{
      if(isPosterFlyerProgram(p)){
        if(!posterFlyerExpanded){out.push(COMBINED_POSTER_FLYER);posterFlyerExpanded=true;}
        return;
      }
      out.push(p);
    };
    for(const p of programs||[]){
      if(isDesignProgram(p)){
        if(!designExpanded){MODULAR_DESIGN.forEach(pushProgram);designExpanded=true;}
        continue;
      }
      if(isPdfEditorProgram(p)){
        if(!pdfExpanded){MODULAR_PDF.forEach(pushProgram);pdfExpanded=true;}
        continue;
      }
      pushProgram(p);
    }
    return out;
  }
  function samePrograms(a,b){
    return a.length===b.length&&a.every((p,i)=>normalizedName(p)===normalizedName(b[i])&&rawUrl(p)===rawUrl(b[i]));
  }
  function homeCategory(c){return{label:text(c.name),accent:c.accent,title:text(c.sectionTitle||c.name),badge:text(c.badge),heroTitle:`${esc(c.heroTitle||c.name)}${c.heroAccent?` <span>${esc(c.heroAccent)}</span>`:''}`,lead:text(c.lead),copy:breaks(c.copy),visual:[text(c.visualIcon||'🧰'),text(c.visualTitle||c.name),text(c.visualText)],programs:expandPrograms(c.programs).map(p=>({name:esc(p.name),icon:esc(p.icon||'🧰'),accent:p.accent,bg:p.bg,desc:esc(p.desc),url:window.ProgramCatalogCore.safeUrl(p.url),tags:(p.tags||[]).map(esc),coming:p.status&&p.status!=='active'||!window.ProgramCatalogCore.safeUrl(p.url)}))};}

  function iconKey(card){const href=text(card.getAttribute('href')).toLowerCase(),name=text(card.querySelector('.name')?.textContent).replace(/\s+/g,'');if(href.includes('/apps/cover')||href.includes('/apps/poster')||href.includes('/apps/flyer')||href.includes('/apps/invitation')||href.includes('/apps/notice')||href.includes('/apps/leaflet')||href.includes('design-editor')||name.includes('디자인'))return'design';if(href.includes('pdf-preflight')||name.includes('인쇄전검사')||name.includes('검사'))return'check';if(href.includes('/apps/pdf-layout')||href.includes('/apps/booklet')||href.includes('pdf-editor')||name.includes('PDF편집')||name.includes('소책자'))return'pdf';if(href.includes('image-editor')||name.includes('이미지'))return'image';return'';}
  function decorateProgramIcons(){document.querySelectorAll('#programGrid .card').forEach(card=>{const icon=card.querySelector('.icon'),key=iconKey(card);if(!icon||!key)return;icon.setAttribute('aria-hidden','true');icon.innerHTML=`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="${ICONS[key]}"/></svg>`;});}
  function installIcons(){
    if(!document.getElementById('homeProgramIconStyleV1')){const s=document.createElement('style');s.id='homeProgramIconStyleV1';s.textContent='#programGrid .card .icon svg{width:29px;height:29px}';document.head.appendChild(s);}
    decorateProgramIcons();const grid=document.getElementById('programGrid');
    if(grid&&typeof MutationObserver==='function'&&!grid.dataset.iconWatch){grid.dataset.iconWatch='1';new MutationObserver(decorateProgramIcons).observe(grid,{childList:true});}
  }

  function applyFallbackExpansion(){
    if(typeof CATEGORIES==='undefined')return false;
    let changed=false;
    Object.values(CATEGORIES).forEach(category=>{
      if(!category||!Array.isArray(category.programs))return;
      const next=expandPrograms(category.programs);
      if(!samePrograms(next,category.programs)){category.programs=next;changed=true;}
    });
    if(changed&&typeof switchCategory==='function'){
      try{switchCategory(typeof active==='string'?active:Object.keys(CATEGORIES)[0],false);}catch(_){}
    }
    return changed;
  }
  function applyHeroTheme(id){const c=window.__programCatalogById?.[id],hero=document.getElementById('hero');if(c&&hero)hero.style.background=`linear-gradient(145deg,#071a38,#0b2a55 50%,${c.accent})`;}
  function installSwitchTheme(){if(window.__programCatalogSwitchWrapped||typeof switchCategory!=='function')return;const delegate=switchCategory;switchCategory=function(key,scroll){const result=delegate(key,scroll);applyHeroTheme(key);decorateProgramIcons();return result;};window.__programCatalogSwitchWrapped=true;}
  function applyCatalog(raw){
    if(!ready())return false;const catalog=window.ProgramCatalogCore.publicCatalog(raw);if(!catalog.categories.length)return false;
    const next={},byId={};for(const c of catalog.categories){next[c.id]=homeCategory(c);byId[c.id]=c;}
    Object.keys(CATEGORIES).forEach(k=>delete CATEGORIES[k]);Object.assign(CATEGORIES,next);window.__programCatalogById=byId;installSwitchTheme();
    document.getElementById('studioNav')?.replaceChildren();const first=catalog.categories[0].id;active=first;buildNav();switchCategory(first,false);decorateProgramIcons();document.documentElement.dataset.managedProgramCatalog='1';return true;
  }
  async function loadCatalog(){if(!ready())return false;try{const snap=await db.collection('settings').doc(DOC_ID).get();return snap.exists?applyCatalog(snap.data()||{}):false;}catch(error){console.warn('Program catalog fallback',error);return false;}}
  async function install(){installIcons();for(let i=0;i<10;i+=1){if(ready()){applyFallbackExpansion();return loadCatalog();}await new Promise(r=>setTimeout(r,180));}return false;}

  window.HomeProgramCatalog={install,loadCatalog,applyCatalog,expandPrograms,decorateProgramIcons,isPosterFlyerProgram,stage:'admin-managed-home-navigation-and-programs',modularStage:'modular-production-apps-home-catalog-v5-direct-design-entry'};install();
})();
