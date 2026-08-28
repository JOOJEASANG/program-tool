// Compact Adobe-style editor tool rail for Program Studio.
// Keeps the existing guided workflow APIs and filters sidebar cards by the active step.
(function(){
  'use strict';
  if(window.__programStudioEditorToolRailV1)return;
  window.__programStudioEditorToolRailV1=true;

  const surface=document.documentElement.dataset.programSurface||'';
  const SUPPORTED=['pdf-editor','design-editor','document-editor','image-editor'];
  if(!SUPPORTED.includes(surface))return;

  const ICONS={
    file:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 3.5h8l4 4V20H6z"/><path d="M14 3.5V8h4"/><path d="M9 12h6M9 15.5h6"/></svg>',
    layout:'<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="4" y="4" width="7" height="7" rx="1"/><rect x="13" y="4" width="7" height="7" rx="1"/><rect x="4" y="13" width="7" height="7" rx="1"/><rect x="13" y="13" width="7" height="7" rx="1"/></svg>',
    finish:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h10M18 7h2M4 17h2M10 17h10M14 4v6M8 14v6"/></svg>',
    output:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 4v10"/><path d="m8 10 4 4 4-4"/><path d="M5 19h14"/></svg>',
    compose:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 5h14v14H5z"/><path d="M9 9h6M12 6v6"/></svg>',
    edit:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 18.5 5 14l9.5-9.5a2 2 0 0 1 2.8 0l2.2 2.2a2 2 0 0 1 0 2.8L10 19z"/><path d="m13 6 5 5"/></svg>',
    arrange:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 5v14M9 8h10M9 12h7M9 16h10"/></svg>',
    start:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 3.5h9l3 3V20H6z"/><path d="M9 10h6M9 14h6"/></svg>',
    write:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 19h4L19 9l-4-4L5 15z"/><path d="m13.5 6.5 4 4"/></svg>',
    review:'<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="10.5" cy="10.5" r="5.5"/><path d="m15 15 4.5 4.5"/><path d="m8.5 10.5 1.4 1.4 2.7-3"/></svg>',
    open:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3.5 7.5h6l2-2h9v13h-17z"/><path d="M3.5 10h17"/></svg>',
    all:'<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="6" cy="6" r="1.4"/><circle cx="12" cy="6" r="1.4"/><circle cx="18" cy="6" r="1.4"/><circle cx="6" cy="12" r="1.4"/><circle cx="12" cy="12" r="1.4"/><circle cx="18" cy="12" r="1.4"/><circle cx="6" cy="18" r="1.4"/><circle cx="12" cy="18" r="1.4"/><circle cx="18" cy="18" r="1.4"/></svg>'
  };

  const CONFIGS={
    'pdf-editor':{
      sidebar:()=>document.querySelector('.app > aside'),
      workflow:'#pdfEditorWorkflowV2',
      api:()=>window.PdfEditorWorkflowV2,
      workflowActive:()=>document.querySelector('#pdfEditorWorkflowV2 .pdf-workflow-step.active')?.dataset?.step||'file',
      steps:[
        {id:'file',label:'파일',hint:'PDF 불러오기',icon:'file'},
        {id:'layout',label:'페이지·배치',hint:'순서·N-up·용지',icon:'layout'},
        {id:'finish',label:'꾸미기',hint:'워터마크·머리말·번호',icon:'finish'},
        {id:'output',label:'출력',hint:'미리보기·PDF 저장',icon:'output'}
      ]
    },
    'design-editor':{
      sidebar:()=>document.querySelector('.sidebar'),
      workflow:'#designEditorWorkflowV2',
      api:()=>window.DesignEditorWorkflowV2,
      workflowActive:()=>document.querySelector('#designEditorWorkflowV2 .design-workflow-step.active')?.dataset?.designStep||'compose',
      steps:[
        {id:'compose',label:'구성',hint:'글씨·사진·도형 추가',icon:'compose'},
        {id:'edit',label:'편집',hint:'선택 요소 속성',icon:'edit'},
        {id:'arrange',label:'정리',hint:'정렬·간격·레이어',icon:'arrange'},
        {id:'output',label:'출력',hint:'검사·PNG·PDF',icon:'output'}
      ]
    },
    'document-editor':{
      sidebar:()=>document.querySelector('.workspace > .sidebar,.sidebar'),
      workflow:'#documentEditorWorkflowV2',
      api:()=>window.DocumentEditorWorkflowV2,
      workflowActive:()=>document.querySelector('#documentEditorWorkflowV2 .document-workflow-step.active')?.dataset?.documentStep||'start',
      steps:[
        {id:'start',label:'시작',hint:'양식·페이지 설정',icon:'start'},
        {id:'write',label:'작성',hint:'본문·표·이미지',icon:'write'},
        {id:'review',label:'검토',hint:'개요·찾기·메모',icon:'review'},
        {id:'output',label:'출력',hint:'저장·인쇄·PDF',icon:'output'}
      ]
    },
    'image-editor':{
      sidebar:()=>document.querySelector('.workspace > .sidebar,.sidebar'),
      workflow:'#imageEditorWorkflowV2',
      api:()=>window.ImageEditorWorkflowV2,
      workflowActive:()=>document.querySelector('#imageEditorWorkflowV2 .image-workflow-step.active')?.dataset?.imageStep||'open',
      steps:[
        {id:'open',label:'불러오기',hint:'파일·붙여넣기',icon:'open'},
        {id:'layout',label:'자르기·크기',hint:'자르기·회전·크기',icon:'layout'},
        {id:'finish',label:'보정·배경',hint:'색감·배경 제거',icon:'finish'},
        {id:'output',label:'저장',hint:'형식·품질·내보내기',icon:'output'}
      ]
    }
  };

  const config=CONFIGS[surface];
  if(!config)return;

  let sidebar=null;
  let shell=null;
  let rail=null;
  let panel=null;
  let panelTitle=null;
  let panelHint=null;
  let activeStep='';
  let sidebarObserver=null;
  let panelObserver=null;
  let workflowObserver=null;
  let htmlObserver=null;

  function installStyles(){
    if(document.getElementById('programStudioEditorToolRailV1Styles'))return;
    const style=document.createElement('style');
    style.id='programStudioEditorToolRailV1Styles';
    style.textContent=`
      .ps-tool-rail-mounted{padding:0!important;overflow:hidden!important;}
      .ps-tool-sidebar-shell{display:grid;grid-template-columns:58px minmax(0,1fr);height:100%;min-height:0;background:#fff;}
      .ps-tool-rail{min-width:0;background:linear-gradient(180deg,#f6f8fb,#eef2f6);border-right:1px solid #dce4ed;padding:8px 6px;display:flex;flex-direction:column;align-items:center;gap:5px;overflow:visible;z-index:30;}
      .ps-tool-rail-button{position:relative;width:44px;height:44px;flex:0 0 44px;border:1px solid transparent;border-radius:10px;background:transparent;color:#526174;display:grid;place-items:center;cursor:pointer;}
      .ps-tool-rail-button:hover{background:#fff;border-color:#d8e1eb;color:#173b66;box-shadow:0 3px 10px rgba(15,39,72,.07);}
      .ps-tool-rail-button.active{background:#eaf2ff;border-color:#bfd2eb;color:#1769e0;box-shadow:inset 3px 0 0 #1769e0;}
      .ps-tool-rail-button svg{width:21px;height:21px;fill:none;stroke:currentColor;stroke-width:1.8;stroke-linecap:round;stroke-linejoin:round;}
      .ps-tool-rail-button[data-ps-tool-step="all"]{margin-top:auto;}
      .ps-tool-rail-label{position:absolute;left:50px;top:50%;z-index:90;transform:translate(5px,-50%);opacity:0;pointer-events:none;white-space:nowrap;border:1px solid #d8e1eb;border-radius:8px;background:#102a46;color:#fff;padding:6px 8px;font-size:10px;font-weight:850;box-shadow:0 8px 20px rgba(15,39,72,.18);transition:.14s ease;}
      .ps-tool-rail-button:hover .ps-tool-rail-label,.ps-tool-rail-button:focus-visible .ps-tool-rail-label{opacity:1;transform:translate(0,-50%);}
      .ps-tool-panel{min-width:0;min-height:0;overflow-y:auto;padding:11px 12px 14px;background:#fff;}
      .ps-tool-panel-head{position:sticky;top:-11px;z-index:20;display:flex;align-items:center;gap:8px;margin:-1px -2px 10px;padding:10px 4px 9px;background:rgba(255,255,255,.96);border-bottom:1px solid #edf1f5;backdrop-filter:blur(8px);}
      .ps-tool-panel-copy{flex:1;min-width:0}.ps-tool-panel-title{font-size:12px;font-weight:950;color:#203a59}.ps-tool-panel-hint{margin-top:2px;font-size:9px;line-height:1.35;color:#7a8798;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
      .ps-tool-panel-action{min-height:31px;border:1px solid #d6e0ea;border-radius:8px;background:#fff;color:#506176;padding:0 8px;font-size:8.5px;font-weight:900;cursor:pointer;}
      .ps-tool-panel-action[aria-pressed="true"]{border-color:#9bbce0;background:#eef6ff;color:#155b99;}
      .ps-tool-source,.ps-tool-context-hidden{display:none!important;}
      .ps-tool-panel>[hidden]{display:none!important;}
      html[data-program-surface="pdf-editor"] .ps-tool-panel>.sec.pdf-step-section{margin-top:7px;}
      html[data-program-surface="pdf-editor"] .ps-tool-panel>.sec.pdf-output-dock-v2{margin-left:0;margin-right:0;}
      html[data-program-surface="design-editor"] .ps-tool-panel>.side-card,
      html[data-program-surface="document-editor"] .ps-tool-panel>.panel-card,
      html[data-program-surface="image-editor"] .ps-tool-panel>.tool-card{margin-left:0;margin-right:0;}
      @media(max-width:980px){
        .ps-tool-rail-mounted{overflow:visible!important;}
        .ps-tool-sidebar-shell{display:block;height:auto;min-height:0;}
        .ps-tool-rail{position:sticky;top:0;z-index:60;width:100%;height:56px;min-height:56px;display:flex;flex-direction:row;justify-content:flex-start;gap:4px;padding:6px 8px;border-right:0;border-bottom:1px solid #dce4ed;overflow-x:auto;overflow-y:hidden;}
        .ps-tool-rail-button{width:42px;height:42px;flex-basis:42px;}
        .ps-tool-rail-button[data-ps-tool-step="all"]{margin-top:0;margin-left:auto;}
        .ps-tool-rail-label{display:none;}
        .ps-tool-panel{overflow:visible;padding:10px;}
        .ps-tool-panel-head{top:56px;margin-top:0;}
      }
    `;
    document.head.appendChild(style);
  }

  function normalizedText(node){
    return String(node?.textContent||'').replace(/\s+/g,' ').trim();
  }

  function cardTitle(node){
    const title=node.querySelector?.('.panel-title,.tool-title,.side-label,.sec-title,.document-title,.design-tool-title,summary,h3,h2');
    return normalizedText(title||node);
  }

  function mark(node,step){
    if(!(node instanceof HTMLElement))return;
    if(step==='source')node.classList.add('ps-tool-source');
    else if(step==='hidden-context')node.classList.add('ps-tool-context-hidden');
    else if(step==='always')node.dataset.psToolAlways='1';
    else if(step)node.dataset.psToolStep=step;
  }

  function classifyPdf(node){
    if(node.id==='pdfEditorWorkflowV2')return'source';
    if(node.id==='pdfEditorWorkflowErrorV2')return'always';
    if(node.matches?.('h1,.sub'))return'hidden-context';
    if(node.matches?.('.sec[data-pdf-step]'))return node.dataset.pdfStep||'all';
    if(node.id==='thumbSection')return'layout';
    return'all';
  }

  function classifyDocument(node){
    if(node.id==='documentEditorWorkflowV2')return'source';
    if(node.id==='documentWorkflowStatusV2')return'always';
    if(node.id==='documentWorkflowOutputV2')return'output';
    if(node.classList?.contains('usability-card'))return'start';
    if(node.classList?.contains('outline-card')||node.classList?.contains('comment-card'))return'review';
    const title=cardTitle(node);
    if(/페이지 설정|빠른 시작|화면/.test(title))return'start';
    if(/표 삽입|표 · 링크|표·링크|이미지 삽입/.test(title))return'write';
    if(/찾기|바꾸기|문서 개요|문서 메모/.test(title))return'review';
    if(/페이지 · 인쇄|인쇄 설정|문서 파일|문서 저장|PDF로 저장|저장 · PDF/.test(title))return'output';
    return'all';
  }

  function classifyImage(node){
    if(node.id==='imageEditorWorkflowV2')return'source';
    if(node.id==='imageWorkflowStatusV2')return'always';
    if(node.dataset?.imageStep)return node.dataset.imageStep;
    const title=cardTitle(node);
    if(title==='이미지'||/불러오기/.test(title))return'open';
    if(/자르기|회전|크기 조절/.test(title))return'layout';
    if(/기본 보정|배경 제거/.test(title))return'finish';
    if(/저장 설정|저장/.test(title))return'output';
    return'all';
  }

  function classifyDesign(node){
    if(node.id==='designEditorWorkflowV2')return'source';
    if(node.id==='designWorkflowStatusV2')return'always';
    if(node.querySelector?.('.document-head'))return'always';
    if(node.id==='inspector')return'edit';
    if(node.id==='designOutputTools'||/Output|Print|Final/i.test(node.id||''))return'output';
    if(/SmartLayout|Advanced|Align|Snap|Layer/i.test(node.id||''))return'arrange';
    if(/QuickDesign|Component|Recipe|Template|Image|Shape|Text/i.test(node.id||''))return'compose';
    const title=cardTitle(node);
    if(/내용 추가|추가|템플릿|구성|사진|이미지|도형/.test(title))return'compose';
    if(/레이어|정렬|간격|회전|배치|스냅|정리/.test(title))return'arrange';
    if(/출력|인쇄|PNG|PDF|내보내기|저장 파일/.test(title))return'output';
    if(/편집|속성|글꼴|타이포|스타일|테두리|색상/.test(title))return'edit';
    return'all';
  }

  function classify(node){
    if(node.classList?.contains('ps-tool-panel-head'))return'always';
    if(surface==='pdf-editor')return classifyPdf(node);
    if(surface==='document-editor')return classifyDocument(node);
    if(surface==='image-editor')return classifyImage(node);
    return classifyDesign(node);
  }

  function classifyNode(node){
    if(!(node instanceof HTMLElement))return;
    if(node.dataset.psToolAlways||node.dataset.psToolStep||node.classList.contains('ps-tool-source')||node.classList.contains('ps-tool-context-hidden'))return;
    mark(node,classify(node));
  }

  function classifyAll(){
    [...panel.children].forEach(classifyNode);
  }

  function stepMeta(step){
    if(step==='all')return{id:'all',label:'전체 도구',hint:'모든 세부 도구를 한 번에 표시',icon:'all'};
    return config.steps.find(item=>item.id===step)||config.steps[0];
  }

  function syncPdfAction(){
    const button=document.getElementById('psToolRailAdvanced');
    if(!button)return;
    const enabled=document.documentElement.dataset.pdfAdvanced==='1';
    button.setAttribute('aria-pressed',String(enabled));
    button.textContent=enabled?'고급 닫기':'고급 설정';
    button.hidden=!(activeStep==='finish'||activeStep==='all');
  }

  function updateHeader(step){
    const meta=stepMeta(step);
    if(panelTitle)panelTitle.textContent=meta.label;
    if(panelHint)panelHint.textContent=meta.hint;
    syncPdfAction();
  }

  function applyFilter(step,{scroll=true}={}){
    activeStep=stepMeta(step).id;
    let visibleMatches=0;
    [...panel.children].forEach(node=>{
      if(!(node instanceof HTMLElement))return;
      if(node.classList.contains('ps-tool-source')||node.classList.contains('ps-tool-context-hidden')){
        node.hidden=true;
        return;
      }
      if(node.dataset.psToolAlways==='1'){
        node.hidden=false;
        return;
      }
      const owner=node.dataset.psToolStep||'all';
      const visible=activeStep==='all'||owner===activeStep;
      node.hidden=!visible;
      if(visible&&owner===activeStep)visibleMatches+=1;
    });
    if(activeStep!=='all'&&visibleMatches===0){
      activeStep='all';
      [...panel.children].forEach(node=>{
        if(!(node instanceof HTMLElement))return;
        node.hidden=node.classList.contains('ps-tool-source')||node.classList.contains('ps-tool-context-hidden');
      });
    }
    rail?.querySelectorAll('[data-ps-tool-step]').forEach(button=>{
      const selected=button.dataset.psToolStep===activeStep;
      button.classList.toggle('active',selected);
      button.setAttribute('aria-pressed',String(selected));
    });
    updateHeader(activeStep);
    document.documentElement.dataset.editorToolStep=activeStep;
    if(scroll)panel?.scrollTo?.({top:0,behavior:'smooth'});
  }

  function selectStep(step,userInitiated=true){
    const next=stepMeta(step).id;
    if(next!=='all'){
      try{config.api()?.activateStep?.(next,false);}catch(error){console.warn('[tool-rail] workflow sync failed',error);}
    }
    applyFilter(next,{scroll:userInitiated});
  }

  function createRailButton(meta){
    const button=document.createElement('button');
    button.type='button';
    button.className='ps-tool-rail-button';
    button.dataset.psToolStep=meta.id;
    button.setAttribute('aria-label',`${meta.label} 도구`);
    button.setAttribute('aria-pressed','false');
    button.title=`${meta.label} · ${meta.hint}`;
    button.innerHTML=`${ICONS[meta.icon]||ICONS.all}<span class="ps-tool-rail-label">${meta.label}</span>`;
    button.addEventListener('click',()=>selectStep(meta.id,true));
    return button;
  }

  function buildShell(){
    shell=document.createElement('div');
    shell.className='ps-tool-sidebar-shell';
    rail=document.createElement('nav');
    rail.className='ps-tool-rail';
    rail.setAttribute('aria-label','편집 도구 그룹');
    panel=document.createElement('div');
    panel.className='ps-tool-panel';

    const keepDirect=[...sidebar.children].filter(node=>node.matches?.('.program-local-actions'));
    const movable=[...sidebar.childNodes].filter(node=>!keepDirect.includes(node));
    movable.forEach(node=>panel.appendChild(node));

    const head=document.createElement('div');
    head.className='ps-tool-panel-head';
    head.dataset.psToolAlways='1';
    head.innerHTML='<div class="ps-tool-panel-copy"><div class="ps-tool-panel-title"></div><div class="ps-tool-panel-hint"></div></div><div class="ps-tool-panel-actions"></div>';
    panel.insertBefore(head,panel.firstChild);
    panelTitle=head.querySelector('.ps-tool-panel-title');
    panelHint=head.querySelector('.ps-tool-panel-hint');

    config.steps.forEach(meta=>rail.appendChild(createRailButton(meta)));
    rail.appendChild(createRailButton({id:'all',label:'전체 도구',hint:'모든 세부 도구 보기',icon:'all'}));

    if(surface==='pdf-editor'){
      const advanced=document.createElement('button');
      advanced.id='psToolRailAdvanced';
      advanced.type='button';
      advanced.className='ps-tool-panel-action';
      advanced.textContent='고급 설정';
      advanced.addEventListener('click',()=>{
        const enabled=document.documentElement.dataset.pdfAdvanced==='1';
        config.api()?.setAdvanced?.(!enabled,true);
        syncPdfAction();
      });
      head.querySelector('.ps-tool-panel-actions').appendChild(advanced);
    }

    shell.append(rail,panel);
    sidebar.appendChild(shell);
    sidebar.classList.add('ps-tool-rail-mounted');
  }

  function watchNewChildren(){
    sidebarObserver=new MutationObserver(records=>{
      let moved=false;
      records.forEach(record=>record.addedNodes.forEach(node=>{
        if(!(node instanceof HTMLElement)||node===shell||node.matches('.program-local-actions'))return;
        if(node.parentElement===sidebar){panel.appendChild(node);moved=true;}
      }));
      if(moved){classifyAll();applyFilter(activeStep,{scroll:false});}
    });
    sidebarObserver.observe(sidebar,{childList:true});

    panelObserver=new MutationObserver(records=>{
      let changed=false;
      records.forEach(record=>record.addedNodes.forEach(node=>{
        if(node instanceof HTMLElement){classifyNode(node);changed=true;}
      }));
      if(changed)applyFilter(activeStep,{scroll:false});
    });
    panelObserver.observe(panel,{childList:true});

    const workflow=document.querySelector(config.workflow);
    if(workflow){
      workflowObserver=new MutationObserver(()=>{
        if(activeStep==='all')return;
        const workflowStep=config.workflowActive();
        if(workflowStep&&workflowStep!==activeStep)applyFilter(workflowStep,{scroll:false});
      });
      workflowObserver.observe(workflow,{subtree:true,attributes:true,attributeFilter:['class','aria-current']});
    }
    if(surface==='pdf-editor'){
      htmlObserver=new MutationObserver(syncPdfAction);
      htmlObserver.observe(document.documentElement,{attributes:true,attributeFilter:['data-pdf-advanced']});
    }
  }

  function install(attempt=0){
    sidebar=config.sidebar();
    const workflow=document.querySelector(config.workflow);
    const api=config.api();
    if(!sidebar||!workflow||!api){
      if(attempt<30)setTimeout(()=>install(attempt+1),80+Math.min(attempt,12)*35);
      return;
    }
    if(sidebar.classList.contains('ps-tool-rail-mounted'))return;
    installStyles();
    buildShell();
    workflow.classList.add('ps-tool-source');
    classifyAll();
    const initial=config.workflowActive()||config.steps[0].id;
    applyFilter(initial,{scroll:false});
    watchNewChildren();
    window.ProgramStudioEditorToolRail={
      surface,
      select:step=>selectStep(step,true),
      showAll:()=>selectStep('all',true),
      get activeStep(){return activeStep;},
      stage:'compact-editor-tool-rail-v1'
    };
  }

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>install(),{once:true});
  else install();
})();