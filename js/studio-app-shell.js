(function(){
  'use strict';
  if(window.__programStudioModularAppShellV1)return;
  window.__programStudioModularAppShellV1=true;

  const APPS=Object.freeze({
    cover:{title:'표지 제작',category:'DESIGN · COVER',description:'앞표지·뒤표지·책등과 인쇄 안전영역을 한 작업에서 관리합니다.',target:'/design-editor/general?embed=1&mode=cover&preset=cover-a4&app=cover',legacy:'/design-editor/?mode=cover'},
    poster:{title:'포스터 제작',category:'DESIGN · POSTER',description:'포스터 규격과 출력 품질을 중심으로 필요한 편집 도구만 제공합니다.',target:'/design-editor/general?embed=1&mode=poster&preset=poster-a4&paper=a4&orientation=portrait&w=210&h=297&app=poster',legacy:'/design-editor/?mode=poster'},
    flyer:{title:'전단지 제작',category:'DESIGN · FLYER',description:'전단지 레이아웃, 텍스트 위계, 이미지와 출력 설정에 집중한 작업실입니다.',target:'/design-editor/general?embed=1&mode=flyer&preset=flyer-a4&paper=a4&orientation=portrait&w=210&h=297&app=flyer',legacy:'/design-editor/?mode=flyer'},
    invitation:{title:'초대장 제작',category:'DESIGN · INVITATION',description:'접지 위치와 앞뒤 면을 확인하며 초대장을 제작합니다.',target:'/design-editor/general?embed=1&mode=invitation&preset=invitation-a4&paper=a4&orientation=landscape&w=297&h=210&app=invitation',legacy:'/design-editor/?mode=invitation'},
    notice:{title:'안내장 제작',category:'DESIGN · NOTICE',description:'안내 문구와 정보 구조를 빠르게 정돈하고 인쇄 규격에 맞춰 출력합니다.',target:'/design-editor/general?embed=1&mode=invitation&preset=invitation-a4&paper=a4&orientation=landscape&w=297&h=210&app=invitation&surface=notice',legacy:'/design-editor/?mode=invitation'},
    leaflet:{title:'리플렛 제작',category:'DESIGN · LEAFLET',description:'4P~12P 접지 구조, 패널 폭, 앞뒤 면과 접지 안전영역을 함께 관리합니다.',target:'/design-editor/general?embed=1&mode=leaflet3&preset=leaflet-3-roll&paper=a4&orientation=landscape&w=297&h=210&fold=leaflet-3-roll&app=leaflet',legacy:'/design-editor/?mode=leaflet3'},
    'pdf-layout':{title:'PDF 배치',category:'PDF · N-UP',description:'여러 PDF 페이지를 정리하고 N-up, 용지, 여백과 순서를 설정해 출력용 PDF를 만듭니다.',target:'/pdf-editor/?embed=1&app=layout',legacy:'/pdf-editor/'},
    booklet:{title:'소책자 제작',category:'PDF · BOOKLET',description:'소책자 페이지 순서와 양면 인쇄 흐름을 중심으로 필요한 설정만 제공합니다.',target:'/pdf-editor/?embed=1&app=booklet',legacy:'/pdf-editor/'}
  });

  const byId=id=>document.getElementById(id);
  const path=location.pathname.replace(/\/+$/,'');
  const key=(path.split('/').filter(Boolean).pop()||'').toLowerCase();
  const app=APPS[key]||null;
  const frame=byId('appFrame');
  const loading=byId('workspaceLoading');
  const error=byId('workspaceError');
  const engineChip=document.querySelector('.engine-chip');
  let timer=0;

  function setText(id,value){const node=byId(id);if(node)node.textContent=value;}
  function fail(message){
    clearTimeout(timer);
    if(loading)loading.classList.add('hide');
    if(error){error.hidden=false;const p=error.querySelector('p');if(p&&message)p.textContent=message;}
    engineChip?.classList.add('loading');setText('engineLabel','연결 확인 필요');
  }
  function ready(){
    clearTimeout(timer);
    error&&(error.hidden=true);
    loading?.classList.add('hide');
    engineChip?.classList.remove('loading');
    setText('engineLabel','공통 엔진 연결됨');
    document.documentElement.dataset.modularAppReady='true';
  }
  function load(){
    if(!app){fail('지원하지 않는 프로그램 주소입니다.');return;}
    document.title=`${app.title} · Program Studio`;
    setText('appTitle',app.title);setText('appCategory',app.category);setText('appDescription',app.description);
    const legacy=byId('legacyLink');if(legacy){legacy.href=app.legacy;legacy.hidden=false;}
    engineChip?.classList.add('loading');setText('engineLabel','공통 엔진 연결 중');
    loading?.classList.remove('hide');error&&(error.hidden=true);
    frame.src=app.target;
    clearTimeout(timer);timer=setTimeout(()=>fail('작업 엔진 응답이 늦습니다. 새로고침 후 다시 시도해 주세요.'),18000);
  }

  frame?.addEventListener('load',()=>{
    try{
      const doc=frame.contentDocument;
      if(!doc){fail();return;}
      const check=()=>{
        try{
          const html=doc.documentElement;
          if(html?.dataset?.appReady==='true'||html?.dataset?.designShellRuntime==='1'||frame.contentWindow?.DesignEditorApp||frame.contentWindow?.PdfEditorCoreRuntime){ready();return;}
        }catch(_){}
        setTimeout(ready,650);
      };
      check();
    }catch(_){ready();}
  });
  frame?.addEventListener('error',()=>fail());
  byId('retryBtn')?.addEventListener('click',load);
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',load,{once:true});else load();

  window.ProgramStudioModularAppShell={apps:APPS,appKey:key,reload:load,stage:'modular-app-shell-v1'};
})();
