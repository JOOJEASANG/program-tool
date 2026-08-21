// Refocus the public home on a small set of professional editing tools.
(function(){
  'use strict';
  if(window.__homeProfessionalSuiteV1)return;
  window.__homeProfessionalSuiteV1=true;
  const path=location.pathname.replace(/\/+$/,'')||'/';
  if(path!=='/'&&path!=='/index.html')return;

  const SUITE={
    label:'편집 스튜디오',
    accent:'#1769e0',
    title:'필요한 편집 도구만',
    badge:'DESIGN · IMAGE · DOCUMENT · PDF',
    heroTitle:'쉽게 만들고 <span>전문적으로 완성하세요</span>',
    lead:'복잡한 기능은 줄이고, 결과물의 완성도는 높였습니다.',
    copy:'디자인·이미지·문서·PDF 작업을 한곳에서.<br><strong>처음 사용하는 사람도 인쇄와 실무에 바로 쓸 수 있는 결과물을 만들 수 있도록 구성합니다.</strong>',
    visual:['✦','가볍게 편집하고 정확하게 출력','좋은 기본값, 자동 정렬, 인쇄 기준을 프로그램이 대신 챙깁니다.'],
    programs:[
      {
        name:'디자인 편집기',icon:'✦',accent:'#5969dc',bg:'#edf1ff',
        desc:'책표지 제작을 시작으로 포스터·전단·2단·3단 리플렛을 하나의 가벼운 편집기로 통합합니다.',
        url:'perfect-binding-cover/',tags:['책표지','포스터·전단','리플렛']
      },
      {
        name:'이미지 편집기',icon:'◐',accent:'#b65f8c',bg:'#fff0f6',
        desc:'자르기, 크기 조절, 배경 제거와 기본 보정을 복잡한 메뉴 없이 빠르게 처리하는 이미지 작업 공간입니다.',
        tags:['자르기','배경 제거','이미지 보정'],coming:true
      },
      {
        name:'문서 편집기',icon:'▤',accent:'#2878b8',bg:'#edf7ff',
        desc:'한글 문서처럼 글·표·이미지를 편집하고 기관·학교·업무 문서를 정돈된 형식으로 완성합니다.',
        tags:['문서 작성','표·이미지','PDF 출력'],coming:true
      },
      {
        name:'PDF 편집기',icon:'PDF',accent:'#f08b32',bg:'#fff3e7',
        desc:'페이지 편집, N-up, 소책자, 간지, 워터마크와 페이지 번호 등 실제 출력 준비를 한 번에 처리합니다.',
        url:'pdf-editor/',tags:['페이지 편집','N-up','소책자']
      },
      {
        name:'PDF 유틸리티',icon:'✓',accent:'#18a47a',bg:'#eafaf3',
        desc:'PDF 검사·병합·배경 제거·용량 줄이기·복구와 인쇄 전 점검을 빠르게 처리합니다.',
        url:'pdf-preflight/',tags:['PDF 검사','복구·정리','인쇄 점검']
      }
    ]
  };

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
    const chips=['DESIGN','DOCUMENT','PDF'];
    hero.querySelectorAll('.hero-float').forEach((node,index)=>{if(chips[index])node.textContent=chips[index]});
    const process=hero.querySelector('.hero-process');
    if(process)process.innerHTML='<span>작업 선택</span><b>→</b><span>간편 편집</span><b>→</b><span>전문 결과</span>';
    const meterHead=hero.querySelector('.hero-meter-head');
    if(meterHead)meterHead.innerHTML='<span>작업 환경</span><span>READY</span>';
  }

  function applyProfessionalSuite(){
    if(typeof CATEGORIES==='undefined'||typeof buildNav!=='function'||typeof switchCategory!=='function')return false;
    installStyles();
    document.body.dataset.homeSuite='professional';
    Object.keys(CATEGORIES).forEach(key=>delete CATEGORIES[key]);
    CATEGORIES.studio={...SUITE,programs:SUITE.programs.map(program=>({...program,tags:[...program.tags]}))};
    const nav=document.getElementById('studioNav');
    if(nav)nav.replaceChildren();
    try{active='studio'}catch(_){}
    buildNav();
    switchCategory('studio',false);
    const kicker=document.getElementById('sectionKicker');
    if(kicker)kicker.textContent='CORE EDITING TOOLS';
    const count=document.getElementById('count');
    if(count)count.textContent='5개의 핵심 편집 도구';
    updateHeroExtras();
    document.documentElement.dataset.professionalHome='1';
    return true;
  }

  let applying=false;
  function safeApply(){
    if(applying)return;
    applying=true;
    try{applyProfessionalSuite()}finally{applying=false}
  }

  window.HomeProfessionalSuite={apply:safeApply,stage:'professional-five-tool-home'};
  window.addEventListener('program-catalog-applied',()=>queueMicrotask(safeApply));
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',safeApply,{once:true});
  else safeApply();
  setTimeout(safeApply,350);
  setTimeout(safeApply,1200);
})();
