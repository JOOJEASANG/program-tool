(function(){
  'use strict';
  if(window.__programStudioUiV2)return;
  window.__programStudioUiV2=true;

  const path=(location.pathname||'/').replace(/\/+$/,'')||'/';
  const surface=(()=>{
    if(path==='/'||path==='/index.html')return 'home';
    if(path.endsWith('/login')||path.endsWith('/login.html'))return 'auth';
    if(path.endsWith('/admin')||path.endsWith('/admin.html'))return 'admin';
    if(path.endsWith('/approval-waiting')||path.endsWith('/approval-waiting.html'))return 'approval';
    if(['/guide','/guide.html','/terms','/terms.html','/privacy','/privacy.html'].some(item=>path.endsWith(item)))return 'legal';
    if(path.includes('/pdf-editor'))return 'pdf-editor';
    if(path.includes('/pdf-preflight'))return 'pdf-preflight';
    if(path.includes('/design-editor/general'))return 'design-editor';
    if(path.includes('/design-editor'))return 'design-shell';
    if(path.includes('/document-editor'))return 'document-editor';
    if(path.includes('/image-editor'))return 'image-editor';
    return 'general';
  })();

  document.documentElement.classList.add('ps-ui-v2','ps-ui-v3');
  document.documentElement.dataset.programSurface=surface;
  document.documentElement.dataset.programDesignSystem='unified-v3';

  const TOOLS=[
    {name:'PDF 편집기',description:'병합 · 페이지 편집 · N-up · 소책자',icon:'📄',url:'/pdf-editor/'},
    {name:'PDF 검사 · 유틸리티',description:'인쇄 전 검사 · 보안 · 합치기 · 복구',icon:'🔍',url:'/pdf-preflight/'},
    {name:'디자인 편집기',description:'표지 · 포스터 · 전단 · 리플렛',icon:'✦',url:'/design-editor/'},
    {name:'문서 편집기',description:'A4 문서 작성 · 표 · 이미지 · 인쇄',icon:'📝',url:'/document-editor/'},
    {name:'이미지 편집기',description:'이미지 크기 · 배경 · 자르기 · 출력',icon:'🖼️',url:'/image-editor/'}
  ];

  function onReady(fn){
    if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',fn,{once:true});
    else fn();
  }

  function ensureToast(){
    let toast=document.getElementById('psUiToast');
    if(toast)return toast;
    toast=document.createElement('div');
    toast.id='psUiToast';
    toast.className='ps-ui-toast';
    toast.setAttribute('role','status');
    toast.setAttribute('aria-live','polite');
    document.body.appendChild(toast);
    return toast;
  }

  let toastTimer=0;
  function toast(message){
    const node=ensureToast();
    node.textContent=message;
    node.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer=setTimeout(()=>node.classList.remove('show'),1500);
  }

  function sidebarTarget(){
    if(surface==='pdf-editor')return document.querySelector('.app > aside');
    if(['design-editor','document-editor','image-editor'].includes(surface))return document.querySelector('.sidebar');
    return null;
  }

  function sidebarHost(attempt){
    if(surface==='pdf-editor'){
      const compact=document.querySelector('.app > aside > .program-local-actions');
      if(compact)return compact;
      if(attempt>=8)return document.querySelector('.top-nav');
      return null;
    }
    return document.querySelector('.top-nav,.app-header');
  }

  function mountSidebarToggle(attempt=0){
    if(surface==='pdf-editor')return;
    const target=sidebarTarget();
    if(!target){if(attempt<10)setTimeout(()=>mountSidebarToggle(attempt+1),80+attempt*60);return;}
    const host=sidebarHost(attempt);
    if(!host){if(attempt<10)setTimeout(()=>mountSidebarToggle(attempt+1),80+attempt*60);return;}
    if(host.querySelector('.ps-sidebar-toggle'))return;
    const key=`program-studio:sidebar:${surface}`;
    const saved=localStorage.getItem(key)==='collapsed';
    if(saved)document.documentElement.classList.add('ps-sidebar-collapsed');

    const button=document.createElement('button');
    button.type='button';
    button.className='ps-sidebar-toggle';
    button.innerHTML='<span aria-hidden="true">☰</span><span class="ps-toggle-label">작업 패널</span>';
    button.title='왼쪽 작업 패널 접기/펼치기';
    if(host.classList.contains('app-header')){
      button.style.borderColor='#d7e1ec';
      button.style.background='#fff';
      button.style.color='#44546a';
      button.style.boxShadow='0 2px 8px rgba(15,39,72,.06)';
    }

    const sync=()=>{
      const collapsed=document.documentElement.classList.contains('ps-sidebar-collapsed');
      button.setAttribute('aria-expanded',String(!collapsed));
      button.setAttribute('aria-label',collapsed?'작업 패널 펼치기':'작업 패널 접기');
      target.setAttribute('aria-hidden',String(collapsed));
    };
    sync();

    button.addEventListener('click',()=>{
      const collapsed=document.documentElement.classList.toggle('ps-sidebar-collapsed');
      try{localStorage.setItem(key,collapsed?'collapsed':'expanded');}catch(_){}
      sync();
      toast(collapsed?'작업 패널을 접었습니다.':'작업 패널을 펼쳤습니다.');
      window.dispatchEvent(new Event('resize'));
    });

    if(host.classList.contains('program-local-actions')){
      const account=host.querySelector('.program-account-name');
      if(account)host.insertBefore(button,account);else host.appendChild(button);
      return;
    }
    const anchor=host.querySelector('.nav-user,.header-actions');
    if(anchor)host.insertBefore(button,anchor);else host.appendChild(button);
  }

  function loadEnhancement(id,src,ready,message){
    if(document.getElementById(id)||ready())return;
    const script=document.createElement('script');
    script.id=id;
    script.src=src;
    script.async=false;
    script.addEventListener('error',()=>toast(message));
    document.head.appendChild(script);
  }

  function loadEditorToolRail(){
    loadEnhancement('editorToolRailV1Script','/js/editor-tool-rail-v1.js?v=20260828-1',()=>Boolean(window.__programStudioEditorToolRailV1),'편집 도구 아이콘 메뉴를 불러오지 못했습니다.');
  }

  function loadDesignEssentialWorkspace(){
    loadEnhancement('designEditorEssentialWorkspaceScriptV1','/js/design-editor/essential-workspace.js?v=20260831-1',()=>Boolean(window.__designEditorEssentialWorkspaceV1),'디자인 필수 메뉴를 불러오지 못했습니다.');
  }

  function loadDesignCanvasViewportToolbar(){
    loadEnhancement('designEditorCanvasViewportToolbarScriptV1','/js/design-editor/shared/canvas-viewport-toolbar.js?v=20260901-1',()=>Boolean(window.__designEditorCanvasViewportToolbarV1),'캔버스 확대·맞춤 도구를 불러오지 못했습니다.');
  }

  function loadSurfaceEnhancements(){
    if(['auth','approval','legal'].includes(surface)){
      loadEnhancement('programStudioPhase6Script','/js/surface-polish-v3.js?v=20260828-1',()=>Boolean(window.__programStudioPhase6),'화면 접근성 개선 기능을 불러오지 못했습니다.');
    }
    if(surface==='home'){
      loadEnhancement('homeDashboardV2Script','/js/home-dashboard-v2.js?v=20260828-1',()=>Boolean(window.__homeDashboardV2),'홈 빠른 작업 기능을 불러오지 못했습니다.');
      return;
    }
    if(surface==='admin'){
      loadEnhancement('adminWorkflowV2Script','/js/admin-workflow-v2.js?v=20260828-1',()=>Boolean(window.__adminWorkflowV2),'관리자 편의 기능을 불러오지 못했습니다.');
      return;
    }
    if(surface==='pdf-editor'||surface==='pdf-preflight')return;
    if(surface==='design-editor'){
      loadEnhancement('designEditorWorkflowV2Script','/js/design-editor/workflow-v2.js?v=20260828-1',()=>Boolean(window.__designEditorWorkflowV2),'디자인 편집 화면 개선 기능을 불러오지 못했습니다.');
      loadDesignEssentialWorkspace();
      loadDesignCanvasViewportToolbar();
      return;
    }
    if(surface==='document-editor'){
      loadEnhancement('documentEditorWorkflowV2Script','/js/document-editor/workflow-v2.js?v=20260828-1',()=>Boolean(window.__documentEditorWorkflowV2),'문서 편집 화면 개선 기능을 불러오지 못했습니다.');
      loadEditorToolRail();
      return;
    }
    if(surface==='image-editor'){
      loadEnhancement('imageEditorWorkflowV2Script','/js/image-editor/workflow-v2.js?v=20260828-1',()=>Boolean(window.__imageEditorWorkflowV2),'이미지 편집 화면 개선 기능을 불러오지 못했습니다.');
      loadEditorToolRail();
    }
  }

  let palette=null;
  let paletteInput=null;
  let paletteItems=[];
  let activeIndex=0;

  function renderPalette(query=''){
    if(!palette)return;
    const list=palette.querySelector('.ps-command-list');
    const normalized=String(query||'').trim().toLowerCase();
    const filtered=TOOLS.filter(item=>`${item.name} ${item.description}`.toLowerCase().includes(normalized));
    list.innerHTML='';
    paletteItems=[];
    activeIndex=0;
    if(!filtered.length){
      const empty=document.createElement('div');
      empty.className='ps-command-empty';
      empty.textContent='일치하는 프로그램이 없습니다.';
      list.appendChild(empty);
      return;
    }
    filtered.forEach((item,index)=>{
      const button=document.createElement('button');
      button.type='button';
      button.className='ps-command-item'+(index===0?' active':'');
      button.innerHTML=`<span class="ps-command-icon" aria-hidden="true">${item.icon}</span><span class="ps-command-copy"><strong>${item.name}</strong><span>${item.description}</span></span><span class="ps-command-arrow" aria-hidden="true">→</span>`;
      button.addEventListener('click',()=>location.href=item.url);
      list.appendChild(button);
      paletteItems.push(button);
    });
  }

  function syncPaletteActive(){
    paletteItems.forEach((item,index)=>item.classList.toggle('active',index===activeIndex));
    paletteItems[activeIndex]?.scrollIntoView({block:'nearest'});
  }

  function closePalette(){
    if(!palette)return;
    palette.classList.remove('open');
    document.body.classList.remove('ps-command-open');
  }

  function openPalette(){
    ensurePalette();
    palette.classList.add('open');
    document.body.classList.add('ps-command-open');
    paletteInput.value='';
    renderPalette('');
    requestAnimationFrame(()=>paletteInput.focus());
  }

  function ensurePalette(){
    if(palette)return palette;
    palette=document.createElement('div');
    palette.className='ps-command-backdrop';
    palette.id='psCommandPalette';
    palette.setAttribute('role','dialog');
    palette.setAttribute('aria-modal','true');
    palette.setAttribute('aria-label','프로그램 빠른 실행');
    palette.innerHTML='<div class="ps-command-dialog"><div class="ps-command-head"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><circle cx="11" cy="11" r="7"></circle><path d="m20 20-3.5-3.5"></path></svg><input class="ps-command-input" aria-label="프로그램 검색" placeholder="프로그램 이름이나 작업을 검색하세요"><button class="ps-command-close" type="button" aria-label="닫기">×</button></div><div class="ps-command-list"></div></div>';
    document.body.appendChild(palette);
    paletteInput=palette.querySelector('.ps-command-input');
    paletteInput.addEventListener('input',()=>renderPalette(paletteInput.value));
    paletteInput.addEventListener('keydown',event=>{
      if(event.key==='ArrowDown'&&paletteItems.length){event.preventDefault();activeIndex=(activeIndex+1)%paletteItems.length;syncPaletteActive();}
      else if(event.key==='ArrowUp'&&paletteItems.length){event.preventDefault();activeIndex=(activeIndex-1+paletteItems.length)%paletteItems.length;syncPaletteActive();}
      else if(event.key==='Enter'&&paletteItems.length){event.preventDefault();paletteItems[activeIndex].click();}
      else if(event.key==='Escape'){event.preventDefault();closePalette();}
    });
    palette.querySelector('.ps-command-close').addEventListener('click',closePalette);
    palette.addEventListener('click',event=>{if(event.target===palette)closePalette();});
    renderPalette('');
    return palette;
  }

  function isEditableTarget(target){
    if(!(target instanceof Element))return false;
    return Boolean(target.closest('input,textarea,select,[contenteditable="true"],[contenteditable=""]'));
  }

  function mountCommandTrigger(){
    if(surface!=='home')return;
    const host=document.querySelector('.nav-right');
    if(!host||host.querySelector('.ps-command-trigger'))return;
    const button=document.createElement('button');
    button.type='button';
    button.className='ps-command-trigger';
    button.innerHTML='<span aria-hidden="true">⌕</span><span>빠른 실행</span><kbd>Ctrl K</kbd>';
    button.setAttribute('aria-label','프로그램 빠른 실행 열기');
    button.addEventListener('click',openPalette);
    host.insertBefore(button,host.firstChild);
  }

  function mountGlobalKeys(){
    document.addEventListener('keydown',event=>{
      if((event.ctrlKey||event.metaKey)&&String(event.key).toLowerCase()==='k'){
        if(surface!=='home'&&isEditableTarget(event.target))return;
        event.preventDefault();
        if(palette?.classList.contains('open'))closePalette();else openPalette();
      }else if(event.key==='Escape'&&palette?.classList.contains('open'))closePalette();
    });
  }

  function improveExternalStateLabels(){
    document.querySelectorAll('button,a').forEach(node=>{
      const text=(node.textContent||'').trim();
      if(!node.title&&/로그아웃/.test(text))node.title='현재 계정에서 로그아웃';
      if(!node.title&&/새로고침/.test(text))node.title='최신 상태 다시 불러오기';
    });
  }

  function actionKind(node){
    const text=(node.textContent||'').replace(/\s+/g,' ').trim();
    const classes=node.classList;
    if(classes.contains('danger')||classes.contains('badbtn')||classes.contains('warnbtn')||/삭제|이용 중지|초기화/.test(text))return 'danger';
    if(classes.contains('primary')||classes.contains('btn-primary')||classes.contains('submit-btn')||classes.contains('tm-run-btn')||/저장|다운로드|실행|시작하기/.test(text))return 'primary';
    return 'secondary';
  }

  function enhanceControl(node){
    if(!(node instanceof Element))return;
    const controls=node.matches('button,a')?[node]:[...node.querySelectorAll('button,a')];
    controls.forEach(control=>{
      if(!control.dataset.psAction)control.dataset.psAction=actionKind(control);
      const text=(control.textContent||'').trim();
      if(control.tagName==='BUTTON'&&!control.getAttribute('aria-label')){
        const label=text==='×'?'닫기':text==='↻'?'새로고침':text==='☰'?'메뉴 열기':'';
        if(label)control.setAttribute('aria-label',label);
      }
    });
  }

  function mountSkipLink(){
    if(['auth','approval'].includes(surface)||document.querySelector('.ps-global-skip-link'))return;
    const target=document.querySelector('main,.content,.workspace,.editor-main');
    if(!target)return;
    target.id=target.id||'programStudioMain';
    if(!target.hasAttribute('tabindex'))target.tabIndex=-1;
    const link=document.createElement('a');
    link.className='ps-global-skip-link';
    link.href=`#${target.id}`;
    link.textContent='본문으로 바로가기';
    document.body.insertBefore(link,document.body.firstChild);
  }

  function observeNewControls(){
    if(!document.body||document.body.dataset.psControlObserver==='ready')return;
    document.body.dataset.psControlObserver='ready';
    let queued=[];
    let scheduled=false;
    const flush=()=>{
      scheduled=false;
      const nodes=queued;
      queued=[];
      nodes.forEach(enhanceControl);
    };
    new MutationObserver(records=>{
      records.forEach(record=>record.addedNodes.forEach(node=>{if(node.nodeType===1)queued.push(node)}));
      if(queued.length&&!scheduled){scheduled=true;requestAnimationFrame(flush)}
    }).observe(document.body,{childList:true,subtree:true});
  }

  onReady(()=>{
    loadSurfaceEnhancements();
    mountSidebarToggle(0);
    mountCommandTrigger();
    mountGlobalKeys();
    improveExternalStateLabels();
    enhanceControl(document.body);
    mountSkipLink();
    observeNewControls();
  });

  window.ProgramStudioUI={version:'2026.09.01.020',surface,designSystem:'unified-v3',openPalette,closePalette};
})();
