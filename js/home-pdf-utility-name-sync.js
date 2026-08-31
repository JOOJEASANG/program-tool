// Normalize legacy managed-catalog names to the current PDF inspection + utility label.
(function(){
  'use strict';
  if(window.__homePdfUtilityNameSyncV2)return;
  window.__homePdfUtilityNameSyncV2=true;

  const path=location.pathname.replace(/\/+$/,'')||'/';
  if(path!=='/'&&path!=='/index.html')return;

  const CANONICAL_NAME='PDF 검사 · 유틸리티';
  const LEGACY_NAMES=new Set([
    'PDF 인쇄 검수','PDF 검사','PDF 인쇄 검수기','PDF 검사기','PDF유틸리티','PDF 올인원'
  ]);

  function isPdfUtility(program){
    const name=String(program?.name||'').trim();
    const url=String(program?.url||'').toLowerCase();
    return name===CANONICAL_NAME||LEGACY_NAMES.has(name)||/(?:^|\/)pdf-preflight\/?(?:index\.html)?(?:$|[?#])/.test(url);
  }

  function normalizeProgram(program){
    if(!program||!isPdfUtility(program))return false;
    const next={
      name:CANONICAL_NAME,
      icon:'🔍',
      desc:'PDF 인쇄 전 검사, 일괄 검수, 합치기, 배경색 제거, 용량 줄이기, 복구와 암호 작업을 한 곳에서 처리합니다.',
      tags:['PDF 검사','PDF 유틸리티','PDF 합치기','배경 제거','용량 줄이기','PDF 복구','암호']
    };
    const changed=program.name!==next.name||program.icon!==next.icon||program.desc!==next.desc||JSON.stringify(program.tags||[])!==JSON.stringify(next.tags);
    if(!changed)return false;
    Object.assign(program,next);
    return true;
  }

  function normalizeHome(){
    if(typeof CATEGORIES==='undefined')return false;
    let changed=false;
    Object.values(CATEGORIES).forEach(category=>{
      const programs=Array.isArray(category?.programs)?category.programs:[];
      programs.forEach(program=>{changed=normalizeProgram(program)||changed;});
    });
    if(changed&&typeof switchCategory==='function'&&typeof active==='string'&&CATEGORIES[active])switchCategory(active,false);
    document.documentElement.dataset.pdfUtilityHomeName='canonical-v2';
    return true;
  }

  function install(){
    let attempts=0;
    const tryInstall=()=>{
      attempts+=1;
      if(normalizeHome()||attempts>=30)return;
      setTimeout(tryInstall,80);
    };
    tryInstall();
  }

  window.addEventListener('program-catalog-applied',()=>setTimeout(normalizeHome,0));
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install,{once:true});
  else install();
})();