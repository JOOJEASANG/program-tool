// Refocus the public home on subscription-alternative work tools.
(function(){
  'use strict';
  if(window.__homeProfessionalSuiteV2)return;
  window.__homeProfessionalSuiteV2=true;
  const path=location.pathname.replace(/\/+$/,'')||'/';
  if(path!=='/'&&path!=='/index.html')return;

  const DOC_ID='professional_program_suite';
  const DEFAULT_PROGRAMS=[
    {
      id:'pdf-utility',name:'PDF 올인원',icon:'PDF',accent:'#f08b32',bg:'#fff3e7',
      desc:'Acrobat 없이 PDF 합치기·페이지 추출/나누기·압축·검수·보안·이미지 변환을 한곳에서 처리합니다.',
      url:'pdf-preflight/',tags:['합치기·나누기','압축·보안','PDF↔이미지'],status:'active',visible:true
    },
    {
      id:'pdf-editor',name:'인쇄·출력 도구',icon:'PRINT',accent:'#18a47a',bg:'#eafaf3',
      desc:'N-up, 소책자, 간지, 워터마크, 페이지 번호와 용지 설정 등 인쇄용 PDF 작업을 전문 프로그램 없이 준비합니다.',
      url:'pdf-editor/',tags:['N-up','소책자','인쇄 설정'],status:'active',visible:true
    },
    {
      id:'image-editor',name:'이미지 작업 도구',icon:'◐',accent:'#b65f8c',bg:'#fff0f6',
      desc:'포토샵을 열지 않고 자르기·리사이즈·단색 배경 제거·기본 보정처럼 자주 필요한 이미지 작업만 빠르게 처리합니다.',
      url:'image-editor/',tags:['배경 제거','리사이즈','이미지 보정'],status:'active',visible:true
    },
    {
      id:'design-editor',name:'디자인 제작',icon:'✦',accent:'#5969dc',bg:'#edf1ff',
      desc:'포스터·전단·책표지·2단/3단 리플렛처럼 실제 인쇄물을 규격과 접지 가이드에 맞춰 바로 제작합니다.',
      url:'design-editor/',tags:['포스터·전단','책표지','리플렛'],status:'active',visible:true
    },
    {
      id:'conversion-ocr',name:'OCR · 문서 변환',icon:'OCR',accent:'#2878b8',bg:'#edf7ff',
      desc:'스캔 PDF의 문자 인식과 PDF↔Office 변환처럼 별도 유료 프로그램이 필요한 작업을 한곳에 모을 예정입니다.',
      url:'',tags:['스캔 OCR','PDF→Word','Office→PDF'],status:'coming',visible:true
    }
  ];

  const SUITE={
    label:'실무 도구',
    accent:'#1769e0',
    title:'설치 없이 필요한 작업만',
    badge:'PDF · PRINT · IMAGE · OCR',
    heroTitle:'구독 프로그램 없이 <span>필요한 작업만 바로</span>',
    lead:'파일을 올리고, 필요한 기능을 고르고, 결과만 저장하세요.',
    copy:'비싼 프로그램 전체 기능이 필요한 것은 아닙니다.<br><strong>PDF·인쇄·이미지·디자인에서 실제로 자주 쓰는 기능을 설치 없이 바로 사용할 수 있게 구성합니다.</strong>',
    visual:['PDF','프로그램 없이 바로 해결','합치기·압축·출력·변환처럼 꼭 필요한 작업을 빠르고 단순하게 제공합니다.']
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
    // Keep former cover-only catalog entries safely routed into the unified design editor.
    if(raw==='perfect-binding-cover/'||raw==='/perfect-binding-cover/') return base.url;
    return base.url;
  }

  function normalizeManagedPrograms(raw){
    const source=Array.isArray(raw?.programs)?raw.programs:[];
    if(!source.length)return null;
    const managedById=new Map(source.map(item=>[String(item?.id||''),item]));
    return DEFAULT_PROGRAMS.map(base=>{
      const item=managedById.get(base.id);
      return {
        ...base,
        url:managedProgramUrl(item,base),
        visible:item?item.visible!==false:base.visible,
        tags:[...base.tags]
      };
    });
  }

  function displayPrograms(){
    return activePrograms
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
    const chips=['PDF','PRINT','IMAGE'];
    hero.querySelectorAll('.hero-float').forEach((node,index)=>{if(chips[index])node.textContent=chips[index]});
    const process=hero.querySelector('.hero-process');
    if(process)process.innerHTML='<span>파일 선택</span><b>→</b><span>필요한 작업</span><b>→</b><span>결과 저장</span>';
    const meterHead=hero.querySelector('.hero-meter-head');
    if(meterHead)meterHead.innerHTML='<span>설치 없이 바로</span><span>READY</span>';
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
    if(kicker)kicker.textContent='NO-SUBSCRIPTION WORK TOOLS';
    const count=document.getElementById('count');
    if(count){
      const shown=displayPrograms();
      const ready=shown.filter(program=>!program.coming).length;
      const coming=shown.length-ready;
      count.textContent=`바로 사용 ${ready}개${coming?` · 준비 중 ${coming}개`:''}`;
    }
    updateHeroExtras();
    document.documentElement.dataset.professionalHome='1';
    document.documentElement.dataset.productFocus='subscription-alternative-stage1';
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
    stage:'subscription-alternative-home-stage1'
  };
  window.addEventListener('program-catalog-applied',()=>queueMicrotask(safeApply));
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>{safeApply();loadManagedPrograms();},{once:true});
  else{safeApply();loadManagedPrograms();}
  [350,1200,2200].forEach(delay=>setTimeout(()=>{safeApply();loadManagedPrograms();},delay));
})();
