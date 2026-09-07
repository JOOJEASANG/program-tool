// Curate PDF Utility to essential workflows and normalize shared upload-card layout.
(function(){
  'use strict';
  if(window.__programStudioPdfUtilityCuratedCoreV1)return;
  window.__programStudioPdfUtilityCuratedCoreV1=true;

  const GROUPS=[
    {
      id:'inspect',
      label:'PDF 검사 · 최적화',
      desc:'파일 검사 · 압축 · 안전 수정',
      tools:['PDF 프리플라이트','PDF 압축','안전 자동 수정']
    },
    {
      id:'pages',
      label:'페이지 · 문서',
      desc:'합치기 · 나누기 · 정리 · 회전',
      tools:['PDF 합치기','페이지 추출·나누기','시각적 페이지 정리','빈 페이지 자동 제거','전체 페이지 회전','페이지 순서 역순','여백·크롭·배경']
    },
    {
      id:'convert',
      label:'변환 · OCR',
      desc:'이미지 변환 · OCR · 텍스트 추출',
      tools:['이미지 → PDF','PDF 이미지 변환','OCR 검색 가능한 PDF','본문 텍스트 추출 · TXT']
    },
    {
      id:'security',
      label:'보안 · 정리',
      desc:'암호 · 개인정보 · 폼 고정',
      tools:['AES-256 암호 설정','암호 해제','메타데이터 정리','폼 평면화']
    }
  ];
  const ALIASES=new Map([
    ['PDF 프리플라이트','PDF 파일 검사'],
    ['PDF 이미지 변환','PDF → 이미지'],
    ['OCR 검색 가능한 PDF','OCR · 검색 가능한 PDF'],
    ['AES-256 암호 설정','PDF 암호 설정 · AES-256']
  ]);
  const $=id=>document.getElementById(id);

  function installStyle(){
    if($('pdfUtilityCuratedCoreStyle'))return;
    const style=document.createElement('style');
    style.id='pdfUtilityCuratedCoreStyle';
    style.textContent=`
      /* A label is inline by default. Force one solid upload box so dashed borders never fragment. */
      .pdfu-local-controls .drop,
      .pdfu-shared-advanced-stage #local-tools .drop{
        display:flex!important;
        width:100%!important;
        min-height:126px!important;
        flex-direction:column!important;
        align-items:center!important;
        justify-content:center!important;
        gap:4px!important;
        margin:15px 0 0!important;
        padding:22px 16px!important;
        border:2px dashed #bfd2e5!important;
        border-radius:14px!important;
        background:#f8fbff!important;
        box-sizing:border-box!important;
        text-align:center!important;
        line-height:1.45!important;
      }
      .pdfu-local-controls .drop:hover,
      .pdfu-shared-advanced-stage #local-tools .drop:hover{border-color:#60a5fa!important;background:#eff6ff!important}
      .pdfu-local-controls .local-head,
      .pdfu-shared-advanced-stage #local-tools .local-head{
        display:flex!important;
        grid-template-columns:none!important;
        align-items:flex-start!important;
        gap:11px!important;
        flex-wrap:wrap!important;
      }
      .pdfu-local-controls .local-head-icon,
      .pdfu-shared-advanced-stage #local-tools .local-head-icon{flex:0 0 46px!important}
      .pdfu-local-controls .local-head>div:nth-child(2),
      .pdfu-shared-advanced-stage #local-tools .local-head>div:nth-child(2){flex:1 1 210px!important;min-width:0!important}
      .pdfu-local-controls .local-badge,
      .pdfu-shared-advanced-stage #local-tools .local-badge{
        grid-column:auto!important;
        flex:0 0 auto!important;
        align-self:flex-start!important;
        justify-self:auto!important;
        margin:0 0 0 auto!important;
        position:static!important;
        white-space:nowrap!important;
      }
      .pdfu-local-controls #localFile,
      .pdfu-shared-advanced-stage #local-tools #localFile{display:none!important}
      .pdfu-local-controls .file-note,
      .pdfu-shared-advanced-stage #local-tools .file-note{width:100%!important;box-sizing:border-box!important}
      .pdfadv-file,.pdfocr-file,.pdfud-file{box-sizing:border-box!important}
      .pdfu-menu-group[data-pdfu-core-group="inspect"] .pdfu-menu-group-head strong{color:#0f4c81}
      .pdfu-menu-item[data-pdfu-core-source="PDF 프리플라이트"]{background:#f0f7ff}
      .pdfu-menu-item[data-pdfu-core-source="PDF 프리플라이트"].active{background:#e4efff}
      .pdfu-side-foot .pdfu-core-count{display:inline-flex;margin-left:4px;border-radius:999px;padding:2px 6px;background:#e8f1ff;color:#1d4ed8;font-weight:950}
      @media(max-width:620px){
        .pdfu-local-controls .local-badge,.pdfu-shared-advanced-stage #local-tools .local-badge{margin-left:57px!important}
        .pdfu-local-controls .drop,.pdfu-shared-advanced-stage #local-tools .drop{min-height:112px!important;padding:18px 12px!important}
      }
    `;
    document.head.appendChild(style);
  }

  function originalName(button){
    return button?.dataset.pdfuCoreSource||button?.querySelector('.pdfu-menu-name')?.textContent?.trim()||'';
  }

  function applyAlias(button,sourceName){
    const alias=ALIASES.get(sourceName);
    if(!alias)return;
    const name=button.querySelector('.pdfu-menu-name');
    if(name)name.textContent=alias;
    const oldSearch=String(button.dataset.pdfuSearch||'');
    button.dataset.pdfuSearch=(oldSearch+' '+alias+' pdf 검사 preflight').toLowerCase();
    const syncAlias=()=>{
      if(!button.classList.contains('active'))return;
      const title=$('pdfUtilityStageTitle');
      const current=title?.textContent?.trim()||'';
      if(title&&(current===sourceName||(sourceName==='PDF 프리플라이트'&&current==='PDF 기능')))title.textContent=alias;
      const panelTitle=document.querySelector('#pdfUtilityStageBody .pdfud-panel h3');
      if(panelTitle&&panelTitle.textContent.trim()===sourceName)panelTitle.textContent=alias;
    };
    button.addEventListener('click',()=>{
      setTimeout(syncAlias,0);
      setTimeout(syncAlias,80);
    });
  }

  function buildGroup(group,buttonMap){
    const section=document.createElement('section');
    section.className='pdfu-menu-group';
    section.dataset.pdfuGroup=group.id;
    section.dataset.pdfuCoreGroup=group.id;
    const head=document.createElement('div');
    head.className='pdfu-menu-group-head';
    head.innerHTML=`<strong>${group.label}</strong><span>${group.desc}</span>`;
    section.appendChild(head);
    let count=0;
    group.tools.forEach(sourceName=>{
      const button=buttonMap.get(sourceName);
      if(!button)return;
      button.dataset.pdfuCoreSource=sourceName;
      button.dataset.pdfuCore='1';
      applyAlias(button,sourceName);
      section.appendChild(button);
      count+=1;
    });
    return count?section:null;
  }

  function curate(){
    const menu=$('pdfUtilityMenu');
    if(!menu||menu.dataset.pdfuCuratedCore==='1')return Boolean(menu);
    const buttons=[...menu.querySelectorAll('[data-pdfu-tool]')];
    if(!buttons.length)return false;
    const buttonMap=new Map();
    buttons.forEach(button=>{
      const name=originalName(button);
      if(name&&!buttonMap.has(name))buttonMap.set(name,button);
    });

    const fragment=document.createDocumentFragment();
    let visibleCount=0;
    GROUPS.forEach(group=>{
      const section=buildGroup(group,buttonMap);
      if(section){visibleCount+=section.querySelectorAll('[data-pdfu-tool]').length;fragment.appendChild(section);}
    });
    menu.replaceChildren(fragment);
    menu.dataset.pdfuCuratedCore='1';

    const search=$('pdfUtilityMenuSearch');
    if(search)search.placeholder='기능 검색 · 예: 검사, 압축, OCR, 암호';
    const foot=document.querySelector('.pdfu-side-foot');
    if(foot)foot.innerHTML=`<b>핵심 PDF 유틸리티</b><span class="pdfu-core-count">${visibleCount}개</span><br>N-UP·소책자·출력 편집은 PDF 편집, 재단·안전영역 확인은 인쇄물 사전 검토에서 사용합니다.`;

    document.documentElement.dataset.pdfUtilityCuratedCore='ready';
    document.documentElement.dataset.pdfUtilityCoreToolCount=String(visibleCount);
    window.ProgramStudioPdfUtilityCuratedCore=Object.freeze({
      groups:GROUPS.map(group=>({id:group.id,label:group.label,tools:[...group.tools]})),
      aliases:Object.fromEntries(ALIASES),
      count:visibleCount,
      stage:'pdf-utility-curated-core-v1'
    });
    return true;
  }

  function boot(){
    installStyle();
    if(curate())return;
    let tries=0;
    const timer=setInterval(()=>{
      tries+=1;
      if(curate()||tries>=80)clearInterval(timer);
    },25);
  }

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();
