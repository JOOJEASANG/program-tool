// Program Studio home quick workspace.
(function(){
  'use strict';
  if(window.__homeDashboardV2)return;
  window.__homeDashboardV2=true;

  const path=(location.pathname||'/').replace(/\/+$/,'')||'/';
  if(!(path==='/'||path==='/index.html'))return;

  const FAVORITES_KEY='program-studio:home:favorites-v2';
  const RECENT_KEY='program-studio:home:recent-v2';
  const TOOLS=[
    {id:'pdf-editor',name:'PDF 편집기',desc:'페이지 편집 · N-up · 소책자 · 출력',icon:'📄',url:'/pdf-editor/',keywords:'pdf 인쇄 병합 배치 소책자'},
    {id:'pdf-preflight',name:'PDF 인쇄 검수',desc:'문서 상태 · 암호 · 출력 위험 점검',icon:'🔍',url:'/pdf-preflight/',keywords:'pdf 검사 검수 보안 암호'},
    {id:'design-editor',name:'디자인 편집기',desc:'표지 · 포스터 · 전단 · 인쇄 디자인',icon:'✦',url:'/design-editor/',keywords:'디자인 포스터 표지 전단 인쇄'},
    {id:'document-editor',name:'문서 편집기',desc:'A4 문서 · 표 · 이미지 · PDF 출력',icon:'📝',url:'/document-editor/',keywords:'문서 a4 표 이미지 pdf'},
    {id:'image-editor',name:'이미지 편집기',desc:'자르기 · 크기 · 배경 제거 · 저장',icon:'🖼️',url:'/image-editor/',keywords:'이미지 사진 자르기 배경 크기'}
  ];

  const safeRead=(key,fallback=[])=>{try{const value=JSON.parse(localStorage.getItem(key)||'null');return Array.isArray(value)?value:fallback}catch(_){return fallback}};
  const safeWrite=(key,value)=>{try{localStorage.setItem(key,JSON.stringify(value))}catch(_){}};
  let query='';

  function installStyles(){
    if(document.getElementById('homeDashboardV2Styles'))return;
    const style=document.createElement('style');style.id='homeDashboardV2Styles';style.textContent=`
      .ps-home-workspace{max-width:1320px;margin:0 auto;padding:34px 24px 6px}.ps-home-workspace-card{border:1px solid #dde6f0;border-radius:22px;background:linear-gradient(180deg,#fbfdff,#f7fafe);padding:20px;box-shadow:0 10px 28px rgba(15,39,72,.06)}.ps-home-workspace-head{display:flex;align-items:flex-end;gap:16px}.ps-home-workspace-copy{flex:1;min-width:0}.ps-home-workspace-kicker{font-size:11px;letter-spacing:.1em;font-weight:900;color:#1769e0}.ps-home-workspace-title{margin-top:4px;font-size:23px;font-weight:950;letter-spacing:-.5px;color:#172b45}.ps-home-workspace-note{margin-top:5px;font-size:12px;line-height:1.5;color:#6b788a}.ps-home-search{width:min(390px,42vw);min-height:42px;border:1px solid #ccd9e6;border-radius:12px;background:#fff;padding:0 13px;font:750 13px Pretendard,"Noto Sans KR",sans-serif;color:#172033;outline:none}.ps-home-search:focus{border-color:#1769e0;box-shadow:0 0 0 3px rgba(23,105,224,.12)}
      .ps-home-tool-grid{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:9px;margin-top:16px}.ps-home-tool{position:relative;min-width:0;border:1px solid #dfe7ef;border-radius:14px;background:#fff;transition:.16s}.ps-home-tool:hover{transform:translateY(-2px);border-color:#b5c9dd;box-shadow:0 8px 20px rgba(15,39,72,.08)}.ps-home-tool-link{display:block;min-height:128px;padding:14px 38px 14px 13px;text-decoration:none;color:inherit}.ps-home-tool-icon{font-size:23px}.ps-home-tool-name{margin-top:9px;font-size:13px;font-weight:950;color:#20344d}.ps-home-tool-desc{margin-top:5px;font-size:10.5px;line-height:1.45;color:#718096}.ps-home-favorite{position:absolute;right:8px;top:8px;width:30px;height:30px;border:0;border-radius:9px;background:#f3f6f9;color:#8997a8;font-size:17px;cursor:pointer}.ps-home-favorite[aria-pressed="true"]{background:#fff4cf;color:#aa7100}.ps-home-tool.hidden-by-search{display:none}.ps-home-empty{display:none;margin-top:15px;padding:18px;text-align:center;border:1px dashed #ccd9e6;border-radius:13px;color:#718096;font-size:12px}.ps-home-empty.show{display:block}
      .ps-home-meta-row{display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-top:13px}.ps-home-meta-label{font-size:10px;font-weight:900;color:#667085}.ps-home-chip{border:1px solid #d7e1ec;border-radius:999px;background:#fff;color:#44546a;padding:6px 9px;font-size:10px;font-weight:850;cursor:pointer;text-decoration:none}.ps-home-chip:hover{border-color:#9fb6cb;color:#12396d}.ps-home-clear{border:0;background:transparent;color:#8492a5;font-size:10px;font-weight:850;cursor:pointer;padding:5px}
      @media(max-width:1050px){.ps-home-tool-grid{grid-template-columns:repeat(3,minmax(0,1fr))}}@media(max-width:760px){.ps-home-workspace{padding:22px 4% 2px}.ps-home-workspace-head{display:block}.ps-home-search{width:100%;margin-top:13px}.ps-home-tool-grid{grid-template-columns:repeat(2,minmax(0,1fr))}}@media(max-width:460px){.ps-home-tool-grid{grid-template-columns:1fr}.ps-home-tool-link{min-height:108px}}
    `;document.head.appendChild(style);
  }

  function favoriteIds(){return safeRead(FAVORITES_KEY).filter(id=>TOOLS.some(tool=>tool.id===id));}
  function recentIds(){return safeRead(RECENT_KEY).filter(id=>TOOLS.some(tool=>tool.id===id)).slice(0,4);}
  function markRecent(id){const next=[id,...recentIds().filter(item=>item!==id)].slice(0,4);safeWrite(RECENT_KEY,next);}
  function toggleFavorite(id){const current=favoriteIds();const next=current.includes(id)?current.filter(item=>item!==id):[...current,id];safeWrite(FAVORITES_KEY,next);render();}

  function metaRow(container,label,ids,allowClear=false){
    if(!ids.length)return;
    const row=document.createElement('div');row.className='ps-home-meta-row';
    const title=document.createElement('span');title.className='ps-home-meta-label';title.textContent=label;row.appendChild(title);
    ids.forEach(id=>{const tool=TOOLS.find(item=>item.id===id);if(!tool)return;const link=document.createElement('a');link.className='ps-home-chip';link.href=tool.url;link.textContent=tool.name;link.addEventListener('click',()=>markRecent(id));row.appendChild(link);});
    if(allowClear){const clear=document.createElement('button');clear.type='button';clear.className='ps-home-clear';clear.textContent='기록 지우기';clear.addEventListener('click',()=>{safeWrite(RECENT_KEY,[]);render()});row.appendChild(clear);}
    container.appendChild(row);
  }

  function toolCard(tool,favorites){
    const shell=document.createElement('article');shell.className='ps-home-tool';shell.dataset.toolId=tool.id;
    const haystack=`${tool.name} ${tool.desc} ${tool.keywords}`.toLowerCase();shell.classList.toggle('hidden-by-search',Boolean(query)&&!haystack.includes(query));
    const link=document.createElement('a');link.className='ps-home-tool-link';link.href=tool.url;link.innerHTML=`<div class="ps-home-tool-icon" aria-hidden="true">${tool.icon}</div><div class="ps-home-tool-name"></div><div class="ps-home-tool-desc"></div>`;link.querySelector('.ps-home-tool-name').textContent=tool.name;link.querySelector('.ps-home-tool-desc').textContent=tool.desc;link.addEventListener('click',()=>markRecent(tool.id));
    const favorite=document.createElement('button');favorite.type='button';favorite.className='ps-home-favorite';favorite.setAttribute('aria-label',`${tool.name} 즐겨찾기`);favorite.setAttribute('aria-pressed',String(favorites.includes(tool.id)));favorite.textContent=favorites.includes(tool.id)?'★':'☆';favorite.addEventListener('click',()=>toggleFavorite(tool.id));
    shell.append(link,favorite);return shell;
  }

  function render(){
    const root=document.getElementById('homeDashboardV2');if(!root)return;
    const grid=root.querySelector('.ps-home-tool-grid'),meta=root.querySelector('.ps-home-meta');if(!grid||!meta)return;
    const favorites=favoriteIds();grid.replaceChildren(...TOOLS.map(tool=>toolCard(tool,favorites)));
    const visible=[...grid.children].filter(node=>!node.classList.contains('hidden-by-search')).length;
    root.querySelector('.ps-home-empty')?.classList.toggle('show',visible===0);
    meta.replaceChildren();metaRow(meta,'즐겨찾기',favorites);metaRow(meta,'최근 사용',recentIds(),true);
  }

  function install(){
    installStyles();if(document.getElementById('homeDashboardV2'))return;
    const programs=document.getElementById('programs');if(!programs)return;
    const section=document.createElement('section');section.id='homeDashboardV2';section.className='ps-home-workspace';section.setAttribute('aria-label','빠른 작업');section.innerHTML=`<div class="ps-home-workspace-card"><div class="ps-home-workspace-head"><div class="ps-home-workspace-copy"><div class="ps-home-workspace-kicker">QUICK WORKSPACE</div><div class="ps-home-workspace-title">바로 작업 시작</div><div class="ps-home-workspace-note">현재 사용할 수 있는 핵심 도구를 검색하거나 즐겨찾기에서 바로 실행하세요.</div></div><input class="ps-home-search" type="search" placeholder="PDF, 디자인, 문서, 이미지 검색" aria-label="사용 가능한 프로그램 검색"></div><div class="ps-home-tool-grid"></div><div class="ps-home-empty">검색 조건에 맞는 프로그램이 없습니다.</div><div class="ps-home-meta"></div></div>`;
    programs.parentNode.insertBefore(section,programs);
    const input=section.querySelector('.ps-home-search');input.addEventListener('input',()=>{query=input.value.trim().toLowerCase();render()});
    document.addEventListener('keydown',event=>{if(event.key==='/'&&!event.ctrlKey&&!event.metaKey&&!event.altKey&&!event.target.closest?.('input,textarea,select,[contenteditable="true"]')){event.preventDefault();input.focus();}});
    render();
    window.HomeDashboardV2={render,markRecent,stage:'home-quick-workspace-v2'};
  }

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install,{once:true});else install();
})();