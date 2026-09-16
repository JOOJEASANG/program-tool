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
    if(path.includes('/print-checker'))return 'print-checker';
    return 'general';
  })();
  const simpleRoute=(()=>{
    if(path==='/print-checker'||path.endsWith('/print-checker/index.html'))return 'print-checker';
    if(path==='/smart-print-layout'||path.endsWith('/smart-print-layout/index.html'))return 'smart-print-layout';
    if(path==='/pdf-editor-advanced'||path.endsWith('/pdf-editor-advanced/index.html'))return 'pdf-editor-advanced';
    if(path==='/pdf-editor'||path.endsWith('/pdf-editor/index.html')||path.endsWith('/tools/pdf-editor.html'))return 'pdf-editor';
    if(path==='/pdf-preflight'||path.endsWith('/pdf-preflight/index.html'))return 'pdf-preflight';
    return '';
  })();

  document.documentElement.classList.add('ps-ui-v2','ps-ui-v3');
  document.documentElement.dataset.programSurface=surface;
  document.documentElement.dataset.programDesignSystem='unified-v3';
  if(simpleRoute)document.documentElement.dataset.simpleProgramUx=simpleRoute;

  const TOOLS=[
    {name:'인쇄물 사전 검토',description:'표지 · 전단 · 리플렛 · 초대장 인쇄 규격 확인',icon:'✓',url:'/print-checker/'},
    {name:'PDF 편집기',description:'병합 · 페이지 편집 · N-up · 소책자',icon:'📄',url:'/pdf-editor/'},
    {name:'PDF 검사 · 유틸리티',description:'인쇄 전 검사 · 보안 · 합치기 · 복구',icon:'🔍',url:'/pdf-preflight/'}
  ];

  const SIMPLE_HELP=Object.freeze({
    'print-checker':{
      name:'인쇄물 사전 검토',
      steps:[
        ['인쇄물 종류 선택','표지·전단·리플렛 등 확인하려는 종류를 고릅니다.'],
        ['완성 크기 입력','인쇄 후 최종 크기와 화면에 표시되는 필수 정보만 입력합니다.'],
        ['파일 올리기','최종 PDF 또는 이미지를 끌어놓거나 클릭해 올립니다.'],
        ['파일 확인하기','안내선과 확인 결과를 보고 필요한 부분만 수정합니다.']
      ],
      tip:'처음에는 기본값 그대로 확인하세요. 파일이 안내선과 어긋날 때만 위치나 크기를 조절하면 됩니다.'
    },
    'smart-print-layout':{
      name:'스마트 인쇄배치',
      steps:[
        ['파일 올리기','배치할 PDF 또는 이미지를 한 번에 올립니다.'],
        ['인쇄할 용지 선택','A4·A3 등 실제 사용할 용지를 고르고 최종 완성 크기를 입력합니다.'],
        ['단면·양면 확인','기본은 자동으로 두고 실제 인쇄 방식이 다를 때만 바꿉니다.'],
        ['출력 PDF 만들기','미리보기를 확인한 뒤 바로 출력용 PDF를 만듭니다.']
      ],
      tip:'복잡한 설정부터 바꾸지 않아도 됩니다. 파일, 용지, 완성 크기만 먼저 맞추면 자동배치가 시작됩니다.'
    },
    'pdf-editor':{
      name:'PDF 배치',
      steps:[
        ['PDF 올리기','작업할 PDF를 올립니다. 여러 파일도 차례대로 추가할 수 있습니다.'],
        ['한 면에 넣을 페이지 수 선택','1장·2장·4장처럼 원하는 개수만 고르면 배치가 자동으로 바뀝니다.'],
        ['용지와 순서 확인','필요할 때만 용지 크기나 페이지 채우는 순서를 바꿉니다.'],
        ['결과 저장','미리보기를 적용한 뒤 출력 PDF를 저장합니다.']
      ],
      tip:'일반 작업은 기본 설정으로 먼저 결과를 확인하고, 소책자·간지·머리말 같은 기능은 필요할 때만 여세요.'
    },
    'pdf-editor-advanced':{
      name:'PDF 편집',
      steps:[
        ['PDF 올리기','편집할 PDF를 올립니다.'],
        ['페이지 선택','왼쪽 목록에서 손볼 페이지를 선택합니다.'],
        ['필요한 것만 수정','크기, 위치, 회전, 가장자리 잘라내기 중 필요한 기능만 사용합니다.'],
        ['편집한 PDF 저장','미리보기를 확인하고 완성 파일을 저장합니다.']
      ],
      tip:'한 번에 여러 설정을 바꾸기보다 한 페이지씩 필요한 부분만 수정하면 실수를 줄일 수 있습니다.'
    },
    'pdf-preflight':{
      name:'PDF 도구 모음',
      steps:[
        ['PDF 올리기','확인하거나 암호를 설정할 PDF를 한 번만 올립니다.'],
        ['할 일 선택','인쇄 전 확인, 암호 설정, 암호 해제 중 원하는 작업을 누릅니다.'],
        ['결과 확인','확인 결과를 읽거나 처리된 PDF를 바로 내려받습니다.']
      ],
      tip:'인쇄 전 확인 결과는 먼저 “정상 / 확인 필요 / 문제”만 보고, 필요한 항목만 자세히 확인하면 됩니다.'
    }
  });

  const SIMPLE_COPY=Object.freeze({
    'print-checker':new Map([
      ['STEP 1','1단계'],
      ['제품 유형 선택','인쇄물 종류'],
      ['STEP 2','2단계'],
      ['사양 입력','완성 크기와 제작 정보'],
      ['STEP 3 · 선택','3단계'],
      ['완성 파일 대조','파일 올리기'],
      ['미리보기 조절','화면에서 위치 맞추기'],
      ['파일에 도련(bleed) 포함','파일 가장자리에 잘림 여분(도련)이 있음'],
      ['검토 실행','파일 확인하기'],
      ['AUTO PREFLIGHT','자동 확인'],
      ['자동 내용·인쇄 검사','자동 인쇄 확인'],
      ['PDF 문자의 실제 위치와 감지 가능한 색상 명령, 이미지 유효 DPI를 자동 대조합니다.','글자 위치, 색상, 이미지 선명도를 자동으로 확인합니다.'],
      ['STEP 4 · 검토 결과','4단계 · 확인 결과']
    ]),
    'smart-print-layout':new Map([
      ['STEP 1','1단계'],
      ['STEP 2','2단계'],
      ['STEP 3','3단계'],
      ['STEP 4','4단계'],
      ['출력 용지','인쇄할 용지'],
      ['재단크기 입력/비교','완성 크기'],
      ['재단 가로 mm · 필수','완성 가로 (mm)'],
      ['재단 세로 mm · 필수','완성 세로 (mm)'],
      ['재단 가로·세로는 필수입력입니다. 입력한 실제 재단크기를 미리보기에 점선으로 표시해 업로드 원본과 비교하며, ‘재단표시 추가’를 선택하면 완성 PDF도 이 크기를 기준으로 재단표시를 생성합니다.','자른 뒤 최종 크기를 입력하세요. 원본 크기와 비교하고, 필요하면 PDF에 자르는 위치도 표시할 수 있습니다.'],
      ['앞면 · 뒷면','단면 · 양면'],
      ['양면 방식','인쇄 면'],
      ['자동 · 2페이지 PDF가 있으면 양면','자동 (2페이지 파일은 양면)'],
      ['양면 강제','항상 양면'],
      ['용지 뒤집기','종이를 넘기는 방향'],
      ['긴쪽 넘김','긴쪽으로 넘김'],
      ['짧은쪽 넘김','짧은쪽으로 넘김'],
      ['입력한 재단크기로 완성 PDF에 재단표시 추가','PDF에 자르는 위치 표시 추가'],
      ['AUTO LAYOUT PREVIEW','자동 배치 미리보기']
    ]),
    'pdf-editor':new Map([
      ['📝 PDF 문서 편집기','PDF 배치'],
      ['PDF 문서 편집기','PDF 배치'],
      ['PDF 업로드 · 페이지 편집 · 간지 삽입 · 머리말/꼬리말 · 워터마크 · N-up 인쇄','PDF를 올리고 페이지 순서와 인쇄 배치를 정한 뒤 결과 PDF를 만듭니다.'],
      ['파일 업로드','PDF 파일 올리기'],
      ['N-up 배치','한 장에 여러 페이지'],
      ['기본 N-up (페이지당 슬라이드 수)','용지 한 면에 넣을 페이지 수'],
      ['슬라이드 순서','페이지 채우는 순서'],
      ['가로 우선','왼쪽 → 오른쪽'],
      ['세로 우선','위 → 아래'],
      ['미리보기 새로고침','미리보기 적용'],
      ['PDF 저장','출력 PDF 저장']
    ]),
    'pdf-editor-advanced':new Map([
      ['선택 페이지 편집','선택한 페이지'],
      ['실행취소','취소'],
      ['다시실행','다시 적용'],
      ['확대 · 축소','크기 조절'],
      ['좌 · 우 이동','좌우 이동'],
      ['상 · 하 이동','위아래 이동'],
      ['잘라내기 (%)','가장자리 잘라내기 (%)'],
      ['페이지 보정 초기화','이 페이지 원래대로'],
      ['양면 마주보기 (짝수 페이지 좌우 반전)','양면 문서 여백 맞춤'],
      ['편집 PDF 다운로드','편집한 PDF 저장']
    ]),
    'pdf-preflight':new Map([
      ['PDF CHECK & SECURITY','PDF 확인 · 보안'],
      ['PDF 검사','PDF 확인'],
      ['STEP 1','1단계'],
      ['STEP 2','2단계'],
      ['PDF 파일 선택','PDF 파일 올리기'],
      ['작업 선택','무엇을 할까요?'],
      ['점검','확인'],
      ['문서 검수','인쇄 전 확인'],
      ['해상도·폰트·색상·페이지 상태를 확인합니다.','흐린 이미지, 글꼴, 색상, 페이지 문제를 확인합니다.'],
      ['자동 시도','빠른 해제'],
      ['화면 전체 초기화','처음부터 다시'],
      ['PDF 구조 분석 중...','파일 확인 중...'],
      ['해상도 검사 중...','이미지 선명도 확인 중...'],
      ['폰트 확인 중...','글꼴 확인 중...'],
      ['색상 모드 검사 중...','색상 확인 중...'],
      ['페이지 규격 검사 중...','페이지 크기 확인 중...'],
      ['검수 완료','확인 완료'],
      ['검수 중...','확인 중...']
    ])
  });

  const TERM_HINTS=Object.freeze({
    '파일 가장자리에 잘림 여분(도련)이 있음':'도련은 잘라낼 때 흰 틈이 생기지 않도록 완성 크기 밖으로 배경을 더 넣는 여분입니다.',
    '한 장에 여러 페이지':'한 장의 용지에 여러 PDF 페이지를 함께 배치하는 방식(N-up)입니다.',
    '완성 크기':'인쇄 후 잘라냈을 때 실제로 남는 최종 크기입니다.',
    'PDF에 자르는 위치 표시 추가':'완성 PDF에 재단할 위치를 알려주는 선을 추가합니다.'
  });

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

  function loadEnhancement(id,src,ready,message){
    if(document.getElementById(id)||ready())return;
    const script=document.createElement('script');
    script.id=id;
    script.src=src;
    script.async=false;
    script.addEventListener('error',()=>toast(message));
    document.head.appendChild(script);
  }

  function loadSurfaceEnhancements(){
    if(['auth','approval','legal'].includes(surface)){
      loadEnhancement('programStudioPhase6Script','/js/surface-polish-v3.js?v=20260828-1',()=>Boolean(window.__programStudioPhase6),'화면 접근성 개선 기능을 불러오지 못했습니다.');
    }
    if(surface==='pdf-editor'||surface==='pdf-preflight'||surface==='print-checker'||surface==='home')return;
    if(surface==='admin'){
      loadEnhancement('adminWorkflowV2Script','/js/admin-workflow-v2.js?v=20260916-1',()=>Boolean(window.__adminWorkflowApprovedOnlyV1),'관리자 편의 기능을 불러오지 못했습니다.');
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

  function installSimpleHelpStyles(){
    if(!simpleRoute||document.getElementById('psSimpleHelpStyles'))return;
    const style=document.createElement('style');
    style.id='psSimpleHelpStyles';
    style.textContent=`
      .ps-simple-help-trigger{position:fixed;right:18px;bottom:18px;z-index:880;display:inline-flex;align-items:center;gap:6px;min-height:38px;padding:8px 13px;border:1px solid #cbd5e1;border-radius:999px;background:rgba(255,255,255,.96);color:#334155;font:850 12px Pretendard,"Noto Sans KR",sans-serif;box-shadow:0 8px 24px rgba(15,23,42,.13);cursor:pointer;backdrop-filter:blur(8px)}
      .ps-simple-help-trigger:hover{background:#f8fafc;border-color:#94a3b8;color:#12396d}.ps-simple-help-trigger .q{display:grid;place-items:center;width:19px;height:19px;border-radius:50%;background:#12396d;color:#fff;font-size:11px;font-weight:950}
      .ps-simple-help-backdrop{display:none;position:fixed;inset:0;z-index:5000;align-items:center;justify-content:center;padding:18px;background:rgba(15,23,42,.58);backdrop-filter:blur(5px)}.ps-simple-help-backdrop.open{display:flex}
      .ps-simple-help-dialog{width:min(520px,100%);max-height:min(86vh,720px);overflow:auto;border:1px solid #dbe4ee;border-radius:20px;background:#fff;box-shadow:0 28px 80px rgba(15,23,42,.3)}
      .ps-simple-help-head{display:flex;align-items:flex-start;gap:12px;padding:22px 22px 15px;border-bottom:1px solid #edf1f5}.ps-simple-help-head-copy{flex:1;min-width:0}.ps-simple-help-kicker{font-size:10px;font-weight:950;color:#1d6f91;margin-bottom:5px}.ps-simple-help-title{font-size:19px;font-weight:950;color:#0f172a;letter-spacing:-.35px}.ps-simple-help-close{width:34px;height:34px;border:1px solid #e2e8f0;border-radius:10px;background:#fff;color:#475569;font-size:19px;cursor:pointer}
      .ps-simple-help-body{padding:18px 22px 22px}.ps-simple-help-lead{margin:0 0 15px;font-size:12px;line-height:1.6;color:#64748b}.ps-simple-help-steps{display:grid;gap:9px}.ps-simple-help-step{display:grid;grid-template-columns:28px minmax(0,1fr);gap:10px;align-items:start;padding:11px 12px;border:1px solid #e8eef5;border-radius:12px;background:#fbfdff}.ps-simple-help-num{display:grid;place-items:center;width:26px;height:26px;border-radius:8px;background:#e8f3fb;color:#12577a;font-size:11px;font-weight:950}.ps-simple-help-step strong{display:block;margin:1px 0 3px;font-size:13px;color:#1e293b}.ps-simple-help-step span{display:block;font-size:11px;line-height:1.55;color:#64748b}.ps-simple-help-tip{margin-top:14px;padding:11px 12px;border-left:3px solid #1d9bb2;background:#f0f9ff;color:#475569;font-size:11px;line-height:1.6}
      @media(max-width:620px){.ps-simple-help-trigger{right:12px;bottom:12px}.ps-simple-help-backdrop{align-items:flex-end;padding:8px}.ps-simple-help-dialog{max-height:91vh;border-radius:20px 20px 12px 12px}.ps-simple-help-head{padding:19px 18px 13px}.ps-simple-help-body{padding:16px 18px 20px}}
    `;
    document.head.appendChild(style);
  }

  let simpleHelpDialog=null;
  function closeSimpleHelp(){
    if(!simpleHelpDialog)return;
    simpleHelpDialog.classList.remove('open');
    document.body.classList.remove('ps-simple-help-open');
  }
  function openSimpleHelp(){
    ensureSimpleHelp();
    simpleHelpDialog.classList.add('open');
    document.body.classList.add('ps-simple-help-open');
    requestAnimationFrame(()=>simpleHelpDialog.querySelector('.ps-simple-help-close')?.focus());
  }
  function ensureSimpleHelp(){
    if(!simpleRoute)return null;
    if(simpleHelpDialog)return simpleHelpDialog;
    const config=SIMPLE_HELP[simpleRoute];
    if(!config)return null;
    installSimpleHelpStyles();
    const backdrop=document.createElement('div');
    backdrop.id='psSimpleHelp';
    backdrop.className='ps-simple-help-backdrop';
    backdrop.setAttribute('role','dialog');
    backdrop.setAttribute('aria-modal','true');
    backdrop.setAttribute('aria-label',`${config.name} 빠른 사용법`);
    const steps=config.steps.map((step,index)=>`<div class="ps-simple-help-step"><div class="ps-simple-help-num">${index+1}</div><div><strong>${step[0]}</strong><span>${step[1]}</span></div></div>`).join('');
    backdrop.innerHTML=`<div class="ps-simple-help-dialog"><div class="ps-simple-help-head"><div class="ps-simple-help-head-copy"><div class="ps-simple-help-kicker">30초 사용법</div><div class="ps-simple-help-title">${config.name}</div></div><button class="ps-simple-help-close" type="button" aria-label="사용법 닫기">×</button></div><div class="ps-simple-help-body"><p class="ps-simple-help-lead">아래 순서대로 하면 됩니다. 기본 설정으로 먼저 결과를 만든 뒤 필요한 항목만 바꾸세요.</p><div class="ps-simple-help-steps">${steps}</div><div class="ps-simple-help-tip"><strong>간단 팁</strong><br>${config.tip}</div></div></div>`;
    document.body.appendChild(backdrop);
    backdrop.querySelector('.ps-simple-help-close').addEventListener('click',closeSimpleHelp);
    backdrop.addEventListener('click',event=>{if(event.target===backdrop)closeSimpleHelp();});
    simpleHelpDialog=backdrop;
    return backdrop;
  }
  function mountSimpleHelpTrigger(){
    if(!simpleRoute||document.getElementById('psSimpleHelpTrigger'))return;
    ensureSimpleHelp();
    const button=document.createElement('button');
    button.id='psSimpleHelpTrigger';
    button.type='button';
    button.className='ps-simple-help-trigger';
    button.innerHTML='<span class="q" aria-hidden="true">?</span><span>사용법</span>';
    button.setAttribute('aria-label','빠른 사용법 보기');
    button.addEventListener('click',openSimpleHelp);
    document.body.appendChild(button);
  }

  function simpleReplacement(text){
    if(!simpleRoute||!text)return '';
    const map=SIMPLE_COPY[simpleRoute];
    if(map?.has(text))return map.get(text);
    if(simpleRoute==='pdf-preflight'){
      let match=text.match(/^통과\s+(\d+)\s+·\s+경고\s+(\d+)\s+·\s+불량\s+(\d+)$/);
      if(match)return `정상 ${match[1]} · 확인 필요 ${match[2]} · 문제 ${match[3]}`;
      match=text.match(/^검수 완료\s*·\s*(.+)$/);
      if(match)return `확인 완료 · ${match[1]}`;
      if(text==='PDF 문서 검수를 시작했습니다.')return 'PDF 확인을 시작했습니다.';
    }
    return '';
  }
  function simplifyTextNode(node){
    if(!simpleRoute||!node||node.nodeType!==Node.TEXT_NODE)return;
    const parent=node.parentElement;
    if(!parent||parent.closest('script,style,noscript,code,pre'))return;
    const raw=node.nodeValue||'';
    const trimmed=raw.trim();
    if(!trimmed)return;
    const replacement=simpleReplacement(trimmed);
    if(!replacement||replacement===trimmed)return;
    const leading=raw.match(/^\s*/)?.[0]||'';
    const trailing=raw.match(/\s*$/)?.[0]||'';
    node.nodeValue=leading+replacement+trailing;
    const hint=TERM_HINTS[replacement];
    if(hint&&!parent.title)parent.title=hint;
  }
  function simplifyProgramCopy(node){
    if(!simpleRoute||!node)return;
    if(node.nodeType===Node.TEXT_NODE){simplifyTextNode(node);return;}
    if(!(node instanceof Element))return;
    if(node.matches('script,style,noscript,code,pre'))return;
    const walker=document.createTreeWalker(node,NodeFilter.SHOW_TEXT);
    const textNodes=[];
    while(walker.nextNode())textNodes.push(walker.currentNode);
    textNodes.forEach(simplifyTextNode);
  }

  function mountGlobalKeys(){
    document.addEventListener('keydown',event=>{
      if((event.ctrlKey||event.metaKey)&&String(event.key).toLowerCase()==='k'){
        if(surface!=='home'&&isEditableTarget(event.target))return;
        event.preventDefault();
        if(palette?.classList.contains('open'))closePalette();else openPalette();
      }else if(event.key==='Escape'&&simpleHelpDialog?.classList.contains('open')){
        event.preventDefault();closeSimpleHelp();
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
      nodes.forEach(node=>{
        if(node.nodeType===Node.ELEMENT_NODE)enhanceControl(node);
        simplifyProgramCopy(node);
      });
    };
    new MutationObserver(records=>{
      records.forEach(record=>{
        if(record.type==='characterData')queued.push(record.target);
        record.addedNodes.forEach(node=>queued.push(node));
      });
      if(queued.length&&!scheduled){scheduled=true;requestAnimationFrame(flush)}
    }).observe(document.body,{childList:true,subtree:true,characterData:true});
  }

  onReady(()=>{
    loadSurfaceEnhancements();
    mountCommandTrigger();
    mountGlobalKeys();
    improveExternalStateLabels();
    simplifyProgramCopy(document.body);
    enhanceControl(document.body);
    mountSimpleHelpTrigger();
    mountSkipLink();
    observeNewControls();
  });

  window.ProgramStudioUI={version:'2026.09.16.001',surface,simpleRoute,designSystem:'unified-v3',openPalette,closePalette,openSimpleHelp,closeSimpleHelp,stage:'simple-program-ux-v1'};
})();
