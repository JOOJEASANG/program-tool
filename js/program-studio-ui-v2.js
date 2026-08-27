(function(){
  'use strict';
  if(window.__programStudioUiV2)return;
  window.__programStudioUiV2=true;

  const path=(location.pathname||'/').replace(/\/+$/,'')||'/';
  const surface=(()=>{
    if(path==='/'||path.endsWith('/index.html'))return 'home';
    if(path.endsWith('/login')||path.endsWith('/login.html'))return 'auth';
    if(path.endsWith('/admin')||path.endsWith('/admin.html'))return 'admin';
    if(path.endsWith('/approval-waiting')||path.endsWith('/approval-waiting.html'))return 'approval';
    if(path.includes('/pdf-editor'))return 'pdf-editor';
    if(path.includes('/pdf-preflight'))return 'pdf-preflight';
    if(path.includes('/design-editor/general'))return 'design-editor';
    if(path.includes('/design-editor'))return 'design-shell';
    if(path.includes('/document-editor'))return 'document-editor';
    if(path.includes('/image-editor'))return 'image-editor';
    return 'general';
  })();

  document.documentElement.classList.add('ps-ui-v2');
  document.documentElement.dataset.programSurface=surface;

  const TOOLS=[
    {name:'PDF 편집기',description:'병합 · 페이지 편집 · N-up · 소책자',icon:'📄',url:'/pdf-editor/'},
    {name:'PDF 인쇄 검수',description:'문서 상태 · 보안 · 출력 위험 점검',icon:'🔍',url:'/pdf-preflight/'},
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
    if(surface==='pdf-editor')return document.querySelector('aside');
    if(['design-editor','document-editor','image-editor'].includes(surface))return document.querySelector('.sidebar');
    return null;
  }

  function mountSidebarToggle(){
    const target=sidebarTarget();
    if(!target)return;
    const host=document.querySelector('.top-nav,.app-header');
    if(!host||host.querySelector('.ps-sidebar-toggle'))return;
    const key=`program-studio:sidebar:${surface}`;
    const saved=localStorage.getItem(key)==='collapsed';
    if(saved)document.documentElement.classList.add('ps-sidebar-collapsed');

    const button=document.createElement('button');
    button.type='button';
    button.className='ps-sidebar-toggle';
    button.innerHTML='<span aria-hidden="true">☰</span><span class="ps-toggle-label">작업 패널</span>';
    button.title='왼쪽 작업 패널 접기/펼치기';

    const sync=()=>{
      const collapsed=document.documentElement.classList.contains('ps-sidebar-collapsed');
      button.setAttribute('aria-expanded',String(!collapsed));
      button.setAttribute('aria-label',collapsed?'작업 패널 펼치기':'작업 패널 접기');
      target.setAttribute('aria-hidden',String(collapsed));
    };
    sync();

    button.addEventListener('click',()=>{
      const collapsed=document.documentElement.classList.toggle('ps-sidebar-collapsed');
      localStorage.setItem(key,collapsed?'collapsed':'expanded');
      sync();
      toast(collapsed?'작업 패널을 접었습니다.':'작업 패널을 펼쳤습니다.');
      window.dispatchEvent(new Event('resize'));
    });

    const anchor=host.querySelector('.nav-user,.header-actions');
    if(anchor)host.insertBefore(button,anchor);
    else host.appendChild(button);
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
        event.preventDefault();
        if(palette?.classList.contains('open'))closePalette();else openPalette();
      }else if(event.key==='Escape'&&palette?.classList.contains('open')){
        closePalette();
      }
    });
  }

  function improveExternalStateLabels(){
    document.querySelectorAll('button,a').forEach(node=>{
      const text=(node.textContent||'').trim();
      if(!node.title&&/로그아웃/.test(text))node.title='현재 계정에서 로그아웃';
      if(!node.title&&/새로고침/.test(text))node.title='최신 상태 다시 불러오기';
    });
  }

  onReady(()=>{
    mountSidebarToggle();
    mountCommandTrigger();
    mountGlobalKeys();
    improveExternalStateLabels();
  });

  window.ProgramStudioUI={version:'2026.08.28.001',surface,openPalette,closePalette};
})();
