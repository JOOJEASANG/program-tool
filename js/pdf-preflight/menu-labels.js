// Plain-language menu labels for the PDF utility workspace.
(function(){
  'use strict';
  if(window.__pdfUtilityPlainMenuLabelsV1)return;
  window.__pdfUtilityPlainMenuLabelsV1=true;

  const path=(location.pathname||'/').replace(/\/+$/,'')||'/';
  if(!(path==='/pdf-preflight'||path==='/pdf-preflight/index.html'||path.endsWith('/pdf-preflight/index.html')||path.endsWith('/tools/pdf-Checker.html')||path.endsWith('/tools/preflight.html')))return;

  const LABELS=Object.freeze({
    checkBtn:'PDF 한꺼번에 검사',
    pdfUtilityMergeBtn:'PDF 여러 개 합치기',
    pdfUtilityBackgroundBtn:'PDF 배경 지우기',
    pdfUtilityCompressBtn:'PDF 용량 줄이기',
    pdfUtilityRepairBtn:'PDF 오류 복구',
    encryptBtn:'PDF 비밀번호 걸기',
    decryptBtn:'PDF 비밀번호 풀기',
    pdfAllInOneExtractBtn:'필요한 페이지만 저장',
    pdfAllInOneBlankBtn:'빈 페이지 지우기',
    pdfUtilityExtractBtn:'필요한 페이지만 저장',
    pdfUtilityOrganizeBtn:'페이지 삭제·순서 바꾸기',
    pdfUtilityVisualOrganizeBtn:'페이지 보며 정리하기',
    pdfUtilityImageConverterCard:'PDF·이미지 서로 바꾸기',
    pdfLargeOutputTilingCard:'큰 문서 나눠 인쇄하기'
  });

  const TEXT_LABELS=new Map([
    ['문서 검수','PDF 한꺼번에 검사'],
    ['인쇄 전 검사','PDF 한꺼번에 검사'],
    ['최대 10개 일괄 검수','PDF 한꺼번에 검사'],
    ['PDF 합치기','PDF 여러 개 합치기'],
    ['배경색 제거','PDF 배경 지우기'],
    ['PDF 복구·정상화','PDF 오류 복구'],
    ['선택 파일 암호 설정','PDF 비밀번호 걸기'],
    ['암호 설정','PDF 비밀번호 걸기'],
    ['선택 파일 암호 해제','PDF 비밀번호 풀기'],
    ['암호 해제','PDF 비밀번호 풀기'],
    ['페이지 추출·나누기','필요한 페이지만 저장'],
    ['페이지 추출','필요한 페이지만 저장'],
    ['빈 페이지 자동 제거','빈 페이지 지우기'],
    ['페이지 삭제 · 재정렬','페이지 삭제·순서 바꾸기'],
    ['썸네일 페이지 정리','페이지 보며 정리하기'],
    ['PDF ↔ 이미지 변환','PDF·이미지 서로 바꾸기'],
    ['대형 분할 출력','큰 문서 나눠 인쇄하기']
  ]);

  function installStyles(){
    if(document.getElementById('pdfUtilityPlainMenuLabelStyles'))return;
    const style=document.createElement('style');
    style.id='pdfUtilityPlainMenuLabelStyles';
    style.textContent=`
      .action-btn .action-name[data-pdf-plain-menu-label]{display:block!important;font-size:0!important;line-height:1.32!important;min-height:17px;word-break:keep-all}
      .action-btn .action-name[data-pdf-plain-menu-label]::after{content:attr(data-pdf-plain-menu-label);font-size:13px!important;line-height:1.32!important;font-weight:950!important;letter-spacing:-.18px;color:#0f172a;word-break:keep-all}
      .pdf-preflight-left-tools .action-name[data-pdf-plain-menu-label]::after{font-size:13px!important}
      .pdf-preflight-left-tools .pdfuw-section-title{font-size:13px!important;line-height:1.35!important}
      .pdf-preflight-left-tools>.panel-head .panel-title{font-size:17px!important}
      @media(max-width:520px){.action-btn .action-name[data-pdf-plain-menu-label]::after{font-size:13px!important}}
    `;
    document.head.appendChild(style);
  }

  function labelFor(button,nameNode){
    return LABELS[button.id]||TEXT_LABELS.get((nameNode.textContent||'').trim())||'';
  }

  function applyButton(button){
    if(!(button instanceof HTMLElement))return;
    const name=button.querySelector('.action-name');
    if(!name)return;
    const label=labelFor(button,name);
    if(!label)return;
    if(name.dataset.pdfPlainMenuLabel!==label)name.dataset.pdfPlainMenuLabel=label;
    const desc=(button.querySelector('.action-desc')?.textContent||'').trim();
    const aria=desc?`${label}. ${desc}`:label;
    if(button.getAttribute('aria-label')!==aria)button.setAttribute('aria-label',aria);
  }

  function setText(selector,value){
    const node=document.querySelector(selector);
    if(node&&node.textContent!==value)node.textContent=value;
  }

  function applyGroupCopy(){
    setText('#pdfPreflightLeftTools > .panel-head .panel-title','PDF 작업 메뉴');
    setText('#pdfPreflightLeftTools > .panel-head .panel-desc','원하는 작업을 선택하세요. 여러 파일 작업과 한 파일 작업으로 나누어 표시합니다.');
    setText('#pdfUtilityWideBatchSection .pdfuw-section-kicker','여러 파일');
    setText('#pdfUtilityWideBatchSection .pdfuw-section-title','여러 PDF 한꺼번에 작업');
    setText('#pdfUtilityWideBatchSection .pdfuw-section-desc','등록한 PDF 전체에 적용되는 작업입니다.');
    setText('#pdfUtilityWideSingleSection .pdfuw-section-kicker','한 파일');
    setText('#pdfUtilityWideSingleSection .pdfuw-section-title','선택한 PDF 한 개 작업');
    setText('#pdfUtilityWideSingleSection .pdfuw-section-desc','파일 목록에서 선택한 PDF 한 개에만 적용됩니다.');
  }

  function apply(){
    installStyles();
    document.querySelectorAll('.action-btn').forEach(applyButton);
    applyGroupCopy();
    document.documentElement.dataset.pdfUtilityPlainMenuLabels='1';
  }

  let queued=false;
  function queueApply(){
    if(queued)return;
    queued=true;
    queueMicrotask(()=>{queued=false;apply();});
  }

  function boot(){
    apply();
    const root=document.getElementById('pdfPreflightLeftTools')||document.body;
    if(root){
      const observer=new MutationObserver(queueApply);
      observer.observe(root,{childList:true,subtree:true,characterData:true});
    }
    [80,220,500,1000,1800,3000].forEach(delay=>setTimeout(apply,delay));
    window.PdfUtilityPlainMenuLabels={apply,labels:LABELS,stage:'plain-language-menu-v1'};
  }

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});
  else boot();
})();
