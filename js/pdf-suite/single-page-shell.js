// Present the PDF suite as one utility workspace while keeping print review, N-UP and booklet as separate programs.
(function(){
  'use strict';
  if(window.__programStudioPdfUtilityShellV2)return;
  window.__programStudioPdfUtilityShellV2=true;

  const GROUPS={
    basic:{label:'기본 작업',desc:'합치기 · 페이지 정리 · 회전',categories:['pages']},
    convert:{label:'변환 · OCR',desc:'PDF ↔ 이미지 · OCR · 추출',categories:['convert','scan']},
    edit:{label:'편집 · 보안',desc:'일반 편집 · 암호 · 개인정보',categories:['edit','security']},
    optimize:{label:'최적화 · 검사',desc:'압축 · 호환성 · 문서 진단',categories:['optimize','print','analyze']}
  };
  const EMBEDS={
    preflight:{src:'/pdf-preflight/?embed=1&from=pdf-utility',label:'검사 · 변환 · 보안'},
    editor:{src:'/pdf-editor/?embed=1&from=pdf-utility',label:'일반 PDF 편집'}
  };
  const SEPARATE_TOOL_NAMES=new Set([
    'N-up 다면 배치',
    '소책자·중철 배치',
    '책자 출력 배치',
    '인쇄물 사전 검토'
  ]);

  let activeGroup='basic';
  let embeddedKind=null;
  const $=id=>document.getElementById(id);

  function installStyle(){
    if($('pdfUtilityShellStyle'))return;
    const style=document.createElement('style');
    style.id='pdfUtilityShellStyle';
    style.textContent=`
      .pdfws-legacy-hidden{display:none!important}
      .pdfws-nav{position:sticky;top:72px;z-index:38;margin:18px 0 18px;padding:10px;background:rgba(255,255,255,.96);backdrop-filter:blur(12px);border:1px solid #dce5ef;border-radius:17px;box-shadow:0 10px 28px rgba(15,23,42,.08)}
      .pdfws-groups{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:7px}.pdfws-group{border:1px solid #dce5ef;background:#f8fafc;border-radius:12px;padding:10px 12px;cursor:pointer;text-align:left;color:#334155;transition:.15s}.pdfws-group:hover{border-color:#93c5fd;background:#eff6ff}.pdfws-group.active{border-color:#2563eb;background:#1d4ed8;color:#fff;box-shadow:0 7px 18px rgba(37,99,235,.18)}.pdfws-group strong{display:block;font-size:11px;font-weight:950}.pdfws-group small{display:block;margin-top:2px;font-size:8px;line-height:1.35;color:#64748b}.pdfws-group.active small{color:rgba(255,255,255,.76)}
      .pdfws-view-note{margin:-4px 0 14px;color:#64748b;font-size:10px;font-weight:750}.pdfws-view-note strong{color:#0f2f59}
      .pdfws-embed{display:none;margin:0 0 26px;background:#fff;border:1px solid #bfdbfe;border-radius:19px;overflow:hidden;box-shadow:0 14px 36px rgba(15,47,89,.1)}.pdfws-embed.open{display:block}.pdfws-embed-head{display:flex;align-items:center;gap:10px;padding:12px 14px;background:#eff6ff;border-bottom:1px solid #dbeafe}.pdfws-embed-copy{min-width:0;flex:1}.pdfws-embed-copy strong{display:block;color:#0f2f59;font-size:13px;font-weight:950;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.pdfws-embed-copy span{display:block;margin-top:2px;color:#64748b;font-size:9px}.pdfws-embed-close{border:1px solid #bfdbfe;background:#fff;color:#1d4ed8;border-radius:9px;padding:8px 10px;font-size:10px;font-weight:950;cursor:pointer}.pdfws-frame{display:none;width:100%;height:calc(100vh - 180px);min-height:620px;border:0;background:#f8fafc}.pdfws-frame.active{display:block}
      .pdfu-expert{display:none!important}
      html[data-pdf-workspace-view="embedded"] .toolbar,html[data-pdf-workspace-view="embedded"] #pdf-primary-workspace,html[data-pdf-workspace-view="embedded"] #local-tools,html[data-pdf-workspace-view="embedded"] .roadmap,html[data-pdf-workspace-view="embedded"] .section{display:none!important}
      @media(max-width:900px){.pdfws-nav{top:68px;overflow-x:auto}.pdfws-groups{min-width:650px}.pdfws-frame{height:calc(100vh - 150px);min-height:560px}}
      @media(max-width:620px){.pdfws-nav{margin-left:-4px;margin-right:-4px;padding:7px}.pdfws-groups{min-width:570px}.pdfws-group{padding:9px 10px}.pdfws-frame{min-height:520px}.pdfws-embed-head{align-items:flex-start;flex-wrap:wrap}.pdfws-embed-close{margin-left:auto}}
    `;
    document.head.appendChild(style);
  }

  function removeSeparatedTools(){
    document.querySelectorAll('.tool').forEach(tool=>{
      const name=tool.querySelector('.tool-name')?.textContent?.trim()||'';
      if(SEPARATE_TOOL_NAMES.has(name))tool.remove();
    });
  }

  function transformHeader(){
    document.title='PDF 유틸리티 · Program Studio';
    const topTitle=document.querySelector('.top-title');
    if(topTitle)topTitle.innerHTML='PDF 유틸리티 <span class="top-sub">PDF UTILITY</span>';
    document.querySelectorAll('.top-link').forEach(link=>{
      const href=link.getAttribute('href')||'';
      if(href.includes('pdf-preflight')||href.includes('pdf-editor'))link.classList.add('pdfws-legacy-hidden');
    });

    const badge=document.querySelector('.hero-badge');
    const heading=document.querySelector('.hero h1');
    const copy=document.querySelector('.hero p');
    if(badge)badge.textContent='🧰 PDF UTILITY';
    if(heading)heading.textContent='PDF 유틸리티';
    if(copy){
      copy.dataset.pdfUnifiedCopy='1';
      copy.textContent='합치기·분할·회전·변환·OCR·압축·암호·검사 등 일반 PDF 작업을 한곳에서 처리합니다. 인쇄물 사전검토, N-UP 배치, 소책자 배치는 각각 전용 프로그램으로 분리되어 있습니다.';
    }
    const meta=document.querySelector('.hero-meta');
    if(meta)meta.innerHTML='<span>PDF 일반 작업 통합</span><span>기본 작업 로컬 처리</span><span>N-UP 별도</span><span>소책자 별도</span>';
    document.querySelector('.quick')?.classList.add('pdfws-legacy-hidden');
  }

  function navMarkup(){
    const buttons=Object.entries(GROUPS).map(([key,group])=>`<button type="button" class="pdfws-group${key==='basic'?' active':''}" data-pdf-workspace-group="${key}"><strong>${group.label}</strong><small>${group.desc}</small></button>`).join('');
    return `<div class="pdfws-groups" role="tablist" aria-label="PDF 유틸리티 기능 그룹">${buttons}</div>`;
  }

  function installNavigation(){
    if($('pdfWorkspaceNav'))return;
    const hero=document.querySelector('.hero');
    if(!hero)return;
    const nav=document.createElement('section');
    nav.id='pdfWorkspaceNav';
    nav.className='pdfws-nav';
    nav.innerHTML=navMarkup();
    hero.insertAdjacentElement('afterend',nav);

    const note=document.createElement('div');
    note.id='pdfWorkspaceViewNote';
    note.className='pdfws-view-note';
    nav.insertAdjacentElement('afterend',note);

    nav.querySelectorAll('[data-pdf-workspace-group]').forEach(button=>button.addEventListener('click',()=>setGroup(button.dataset.pdfWorkspaceGroup)));
  }

  function installEmbeddedPanel(){
    if($('pdfWorkspaceEmbedded'))return;
    const note=$('pdfWorkspaceViewNote');
    if(!note)return;
    const panel=document.createElement('section');
    panel.id='pdfWorkspaceEmbedded';
    panel.className='pdfws-embed';
    panel.setAttribute('aria-label','PDF 유틸리티 작업 화면');
    panel.innerHTML=`<div class="pdfws-embed-head"><div class="pdfws-embed-copy"><strong id="pdfWorkspaceEmbeddedTitle">PDF 유틸리티 작업</strong><span>현재 PDF 유틸리티 안에서 실행 중입니다. 기능 목록으로 돌아와 다른 작업을 이어서 사용할 수 있습니다.</span></div><button class="pdfws-embed-close" id="pdfWorkspaceEmbeddedClose" type="button">← 기능 목록</button></div><iframe class="pdfws-frame" id="pdfWorkspaceFramePreflight" title="PDF 검사·변환 작업"></iframe><iframe class="pdfws-frame" id="pdfWorkspaceFrameEditor" title="PDF 일반 편집 작업"></iframe>`;
    note.insertAdjacentElement('afterend',panel);
    $('pdfWorkspaceEmbeddedClose')?.addEventListener('click',()=>closeEmbedded(true));
  }

  function categoryVisible(category,group){
    return Boolean(GROUPS[group]?.categories.includes(category));
  }

  function setGroup(group,{scroll=true}={}){
    const next=GROUPS[group]?group:'basic';
    activeGroup=next;
    if(embeddedKind)closeEmbedded(false);
    document.querySelectorAll('[data-pdf-workspace-group]').forEach(button=>button.classList.toggle('active',button.dataset.pdfWorkspaceGroup===next));
    document.querySelectorAll('.section[data-category]').forEach(section=>{
      section.style.display=categoryVisible(section.dataset.category,next)?'':'none';
    });
    const primary=$('pdf-primary-workspace');
    if(primary)primary.style.display=next==='basic'?'':'none';
    const local=$('local-tools');
    if(local)local.style.display=next==='basic'?'':'none';
    const roadmap=document.querySelector('.roadmap');
    if(roadmap)roadmap.style.display=next==='optimize'?'':'none';
    const toolbar=document.querySelector('.toolbar');
    if(toolbar)toolbar.style.display='';
    const note=$('pdfWorkspaceViewNote');
    if(note)note.innerHTML=`<strong>${GROUPS[next].label}</strong> · ${GROUPS[next].desc}`;
    document.documentElement.dataset.pdfWorkspaceView=`group-${next}`;
    document.documentElement.dataset.pdfWorkspaceGroup=next;
    if(scroll)$('pdfWorkspaceNav')?.scrollIntoView({behavior:'smooth',block:'start'});
  }

  function embedFrame(kind){return kind==='editor'?$('pdfWorkspaceFrameEditor'):$('pdfWorkspaceFramePreflight');}

  function ensureFrame(kind,toolName){
    const config=EMBEDS[kind];
    const frame=embedFrame(kind);
    if(!config||!frame)return null;
    if(!frame.dataset.loaded){
      frame.src=`${config.src}&tool=${encodeURIComponent(toolName||'')}`;
      frame.dataset.loaded='1';
    }else{
      try{frame.contentWindow?.postMessage({type:'program-pdf-workspace-focus',tool:toolName||''},location.origin);}catch(_){ }
    }
    return frame;
  }

  function openEmbedded(kind,toolName='PDF 작업'){
    const config=EMBEDS[kind];
    if(!config)return;
    embeddedKind=kind;
    const panel=$('pdfWorkspaceEmbedded');
    const title=$('pdfWorkspaceEmbeddedTitle');
    const frame=ensureFrame(kind,toolName);
    if(!panel||!frame)return;
    if(title)title.textContent=`${toolName} · ${config.label}`;
    panel.classList.add('open');
    document.querySelectorAll('.pdfws-frame').forEach(node=>node.classList.toggle('active',node===frame));
    document.documentElement.dataset.pdfWorkspaceView='embedded';
    document.documentElement.dataset.pdfWorkspaceEmbedded=kind;
    panel.scrollIntoView({behavior:'smooth',block:'start'});
  }

  function closeEmbedded(scroll=false){
    embeddedKind=null;
    $('pdfWorkspaceEmbedded')?.classList.remove('open');
    document.querySelectorAll('.pdfws-frame').forEach(node=>node.classList.remove('active'));
    delete document.documentElement.dataset.pdfWorkspaceEmbedded;
    setGroup(activeGroup,{scroll});
  }

  function interceptSpecialistLinks(){
    document.addEventListener('click',event=>{
      const link=event.target.closest?.('a.tool.available');
      if(!link)return;
      const href=link.getAttribute('href')||'';
      let kind=null;
      if(href.includes('pdf-preflight'))kind='preflight';
      if(href.includes('pdf-editor'))kind='editor';
      if(!kind)return;
      event.preventDefault();
      event.stopImmediatePropagation();
      const name=link.querySelector('.tool-name')?.textContent?.trim()||'PDF 작업';
      if(SEPARATE_TOOL_NAMES.has(name))return;
      openEmbedded(kind,name);
    },true);
  }

  function install(){
    installStyle();
    removeSeparatedTools();
    transformHeader();
    installNavigation();
    installEmbeddedPanel();
    interceptSpecialistLinks();
    setGroup('basic',{scroll:false});
    document.documentElement.dataset.pdfWorkspaceSinglePage='ready';
    document.documentElement.dataset.pdfUtility='ready';
  }

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install,{once:true});
  else install();

  window.ProgramStudioPdfSinglePageWorkspace=Object.freeze({
    groups:GROUPS,
    separatedTools:[...SEPARATE_TOOL_NAMES],
    setGroup,
    openEmbedded,
    closeEmbedded,
    get activeGroup(){return activeGroup;},
    get embeddedKind(){return embeddedKind;},
    stage:'pdf-utility-workspace-v2'
  });
})();