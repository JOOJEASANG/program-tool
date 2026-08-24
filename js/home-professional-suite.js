// Refocus the public home on practical print-production work tools.
(function(){
  'use strict';
  if(window.__homeProfessionalSuiteV2)return;
  window.__homeProfessionalSuiteV2=true;
  const path=location.pathname.replace(/\/+$/,'')||'/';
  if(path!=='/'&&path!=='/index.html')return;

  const DOC_ID='professional_program_suite';
  const HOME_PROGRAM_ORDER=['design-editor','pdf-editor','pdf-utility','image-editor'];
  const HOME_PROGRAM_RANK=new Map(HOME_PROGRAM_ORDER.map((id,index)=>[id,index]));
  const DEFAULT_PROGRAMS=[
    {
      id:'design-editor',name:'디자인 제작',icon:'✦',accent:'#5969dc',bg:'#edf1ff',
      desc:'포스터·전단·책표지·2단/3단 리플렛을 실제 인쇄 규격과 접지 가이드에 맞춰 제작합니다.',
      url:'design-editor/',tags:['포스터·전단','책표지','리플렛'],status:'active',visible:true
    },
    {
      id:'pdf-editor',name:'PDF 편집 · 인쇄배치',icon:'PRINT',accent:'#18a47a',bg:'#eafaf3',
      desc:'페이지 정리, N-up, 소책자, 간지, 워터마크와 용지 설정까지 실제 출력용 PDF를 준비합니다.',
      url:'pdf-editor/',tags:['페이지 편집','N-up·소책자','인쇄 전 검사'],status:'active',visible:true
    },
    {
      id:'pdf-utility',name:'PDF 검사 · 유틸리티',icon:'PDF',accent:'#f08b32',bg:'#fff3e7',
      desc:'PDF 합치기·나누기·압축·보안과 함께 DPI, 폰트, 규격, 도련 등 인쇄 전 상태를 검사합니다.',
      url:'pdf-preflight/',tags:['인쇄 파일 검사','합치기·나누기','압축·보안'],status:'active',visible:true
    },
    {
      id:'image-editor',name:'이미지 작업 도구',icon:'◐',accent:'#b65f8c',bg:'#fff0f6',
      desc:'포토샵을 열지 않고 자르기·리사이즈·배경 제거·기본 보정처럼 출력 전에 자주 필요한 이미지 작업을 처리합니다.',
      url:'image-editor/',tags:['배경 제거','리사이즈','이미지 보정'],status:'active',visible:true
    }
  ];

  const SUITE={
    label:'인쇄·출력 실무 도구',
    accent:'#1769e0',
    title:'출력 전 마지막 작업까지',
    badge:'PDF · PRINT · OUTPUT',
    heroTitle:'인쇄·출력 실무에 <span>필요한 도구만 바로</span>',
    lead:'디자인하고, 편집·인쇄배치하고, 마지막으로 검사하세요.',
    copy:'디자인 기능을 많이 모으는 것보다 실제 출력 과정에서 반복되는 일을 줄이는 데 집중합니다.<br><strong>디자인 제작 → PDF 편집·인쇄배치 → 인쇄 전 검사 순서로 자연스럽게 작업할 수 있습니다.</strong>',
    visual:['PRINT','디자인부터 최종 검사까지','제작·페이지 배치·소책자·규격·해상도·도련처럼 실제 출력에 필요한 작업을 한 흐름으로 제공합니다.']
  };

  let activePrograms=DEFAULT_PROGRAMS.map(program=>({...program,tags:[...program.tags]}));
  let applying=false;
  let managedLoadStarted=false;

  function escapeHtml(value){
    return String(value==null?'':value).replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
  }

  function safeUrl(value,fallback=''){
    const raw=String(value==null?'':value).trim();
    if(!raw)return fallback;
    if(/^javascript:/i.test(raw))return fallback;
    if(/^(?:https:\/\/|\/|\.\.\/|\.\/|[a-z0-9_-]+\/)/i.test(raw))return raw;
    return fallback;
  }

  function managedProgramUrl(item,base){
    const raw=String(item?.url||'').trim();
    if(base.id==='design-editor'&&(raw==='perfect-binding-cover/'||raw==='/perfect-binding-cover/'))return base.url;
    return safeUrl(raw,base.url);
  }

  function homeRank(program){
    return HOME_PROGRAM_RANK.has(program?.id)?HOME_PROGRAM_RANK.get(program.id):999;
  }

  function normalizeManagedPrograms(raw){
    const source=Array.isArray(raw?.programs)?raw.programs:[];
    if(!source.length)return null;
    const baseById=new Map(DEFAULT_PROGRAMS.map(base=>[base.id,base]));
    const used=new Set();
    const normalized=[];
    for(const item of source){
      const id=String(item?.id||'');
      const base=baseById.get(id);
      if(!base||used.has(id))continue;
      used.add(id);
      normalized.push({
        ...base,
        name:String(item?.name||'').trim()||base.name,
        desc:String(item?.desc||'').trim()||base.desc,
        url:managedProgramUrl(item,base),
        status:item?.status==='active'?'active':'coming',
        visible:item.visible!==false,
        tags:[...base.tags]
      });
    }
    for(const base of DEFAULT_PROGRAMS){
      if(!used.has(base.id))normalized.push({...base,tags:[...base.tags]});
    }
    return normalized.sort((a,b)=>homeRank(a)-homeRank(b));
  }

  function displayPrograms(){
    return [...activePrograms]
      .sort((a,b)=>homeRank(a)-homeRank(b))
      .filter(program=>program.visible!==false)
      .map(program=>({
        ...program,
        name:escapeHtml(program.name),
        icon:escapeHtml(program.icon),
        desc:escapeHtml(program.desc),
        url:safeUrl(program.url,''),
        coming:program.status!=='active'||!safeUrl(program.url,''),
        tags:program.tags.map(escapeHtml)
      }));
  }

  function installStyles(){
    if(document.getElementById('homeProfessionalSuiteStyles'))return;
    const style=document.createElement('style');
    style.id='homeProfessionalSuiteStyles';
    style.textContent=`
      body[data-home-suite="professional"] .studio-nav{display:none!important}
      body[data-home-suite="professional"] .nav-shell{grid-template-columns:1fr auto!important}
      body[data-home-suite="professional"] .grid{grid-template-columns:repeat(3,minmax(0,1fr));gap:16px}
      body[data-home-suite="professional"] .card{min-height:238px}
      body[data-home-suite="professional"] .icon{font-size:18px;font-weight:950;color:var(--card-accent)}
      body[data-home-suite="professional"] .hero.studio{--hero-a:#06172f;--hero-b:#103a68;--hero-c:#176b87;--hero-glow:rgba(45,224,204,.26);--hero-accent:#8cf3e8;--hero-tint:rgba(118,238,226,.13)}
      body[data-home-suite="professional"] .section-kicker{letter-spacing:1.5px}
      @media(max-width:1080px){body[data-home-suite="professional"] .grid{grid-template-columns:repeat(2,minmax(0,1fr))}}
      @media(max-width:760px){body[data-home-suite="professional"] main{padding-top:76px}body[data-home-suite="professional"] .nav{height:76px}body[data-home-suite="professional"] .nav-shell{height:76px}body[data-home-suite="professional"] .grid{grid-template-columns:1fr}}
    `;
    document.head.appendChild(style);
  }

  function updateHeroExtras(){
    const hero=document.getElementById('hero');
    if(!hero)return;
    const chips=['DESIGN','PRINT','CHECK'];
    hero.querySelectorAll('.hero-float').forEach((node,index)=>{if(chips[index])node.textContent=chips[index]});
    const process=hero.querySelector('.hero-process');
    if(process)process.innerHTML='<span>디자인 제작</span><b>→</b><span>편집·인쇄배치</span><b>→</b><span>인쇄 전 검사</span>';
    const meterHead=hero.querySelector('.hero-meter-head');
    if(meterHead)meterHead.innerHTML='<span>출력 실무 흐름</span><span>READY</span>';
  }

  function applyProfessionalSuite(){
    if(typeof CATEGORIES==='undefined'||typeof buildNav!=='function'||typeof switchCategory!=='function')return false;
    installStyles();
    document.body.dataset.homeSuite='professional';
    Object.keys(CATEGORIES).forEach(key=>delete CATEGORIES[key]);
    CATEGORIES.studio={...SUITE,programs:displayPrograms()};
    const nav=document.getElementById('studioNav');
    if(nav)nav.replaceChildren();
    try{active='studio'}catch(_){}
    buildNav();
    switchCategory('studio',false);
    const kicker=document.getElementById('sectionKicker');
    if(kicker)kicker.textContent='PRINT PRODUCTION WORKFLOW';
    const count=document.getElementById('count');
    if(count){
      const shown=displayPrograms();
      const ready=shown.filter(program=>!program.coming).length;
      const coming=shown.length-ready;
      count.textContent=`바로 사용 ${ready}개${coming?` · 준비 중 ${coming}개`:''}`;
    }
    updateHeroExtras();
    document.documentElement.dataset.professionalHome='1';
    document.documentElement.dataset.productFocus='print-production-workflow';
    return true;
  }

  function safeApply(){
    if(applying)return;
    applying=true;
    try{applyProfessionalSuite()}finally{applying=false}
  }

  async function loadManagedPrograms(){
    if(managedLoadStarted||!window.db)return false;
    managedLoadStarted=true;
    try{
      const snapshot=await db.collection('settings').doc(DOC_ID).get();
      if(!snapshot.exists)return false;
      const normalized=normalizeManagedPrograms(snapshot.data()||{});
      if(!normalized)return false;
      activePrograms=normalized;
      safeApply();
      return true;
    }catch(error){
      console.warn('Professional program suite load failed; defaults remain active.',error);
      return false;
    }
  }

  window.HomeProfessionalSuite={
    apply:safeApply,
    loadManagedPrograms,
    defaults:()=>DEFAULT_PROGRAMS.map(program=>({...program,tags:[...program.tags]})),
    stage:'print-production-home-v3'
  };
  window.addEventListener('program-catalog-applied',()=>queueMicrotask(safeApply));
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>{safeApply();loadManagedPrograms();},{once:true});
  else{safeApply();loadManagedPrograms();}
  [350,1200,2200].forEach(delay=>setTimeout(()=>{safeApply();loadManagedPrograms();},delay));
})();
