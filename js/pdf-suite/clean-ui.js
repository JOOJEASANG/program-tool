// Canonical final presentation layer for PDF Utility.
// Keeps the existing processing engines, but exposes only the clean 16-tool workspace.
(function(){
  'use strict';
  if(window.__programStudioPdfUtilityCleanUiV1)return;
  window.__programStudioPdfUtilityCleanUiV1=true;

  // Compatibility readiness flags retained for older smoke contracts/loaders.
  window.__programStudioPdfUtilityCenteredFixesV5=true;
  window.__programStudioPdfUtilityCenteredFixesV4=true;
  window.__programStudioPdfUtilityCenteredFixesV3=true;
  window.__programStudioPdfUtilityCenteredFixesV2=true;
  window.__programStudioPdfUtilityCenteredFixesV1=true;

  const $=id=>document.getElementById(id);
  const QUICK=[
    {source:'PDF 합치기',name:'PDF 합치기',icon:'＋',desc:'여러 PDF를 순서대로 하나로 결합'},
    {source:'PDF 프리플라이트',name:'PDF 파일 검사',icon:'✓',desc:'인쇄 전 구조와 주요 위험 요소 확인'},
    {source:'PDF 압축',name:'PDF 압축',icon:'⇣',desc:'용도에 맞게 PDF 파일 용량 줄이기'},
    {source:'AES-256 암호 설정',name:'PDF 암호 설정',icon:'KEY',desc:'AES-256 열기 비밀번호 적용'}
  ];
  const CATEGORY_COPY={
    pages:'합치기 · 추출 · 페이지 정리 · 회전',
    convert:'이미지 변환 · OCR · 텍스트 추출',
    security:'배경/여백 · 페이지 정리 · 암호',
    inspect:'검사 · 압축 · 인쇄 문제 수정'
  };

  function installStyle(){
    if($('pdfUtilityCleanUiStyle'))return;
    const style=document.createElement('style');
    style.id='pdfUtilityCleanUiStyle';
    style.textContent=`
      html[data-pdf-utility-layout="centered"] body{background:#f3f6f9!important}
      html[data-pdf-utility-layout="centered"] .wrap{background:#f3f6f9!important}
      .pdfuc-home{padding:34px clamp(18px,3.4vw,54px) 58px!important;background:#f3f6f9!important}
      .pdfuc-inner{width:min(1480px,100%)!important;margin:0 auto!important}
      .pdfuc-head{max-width:none!important;margin:0 0 26px!important;text-align:left!important}
      .pdfuc-kicker{font-size:9px!important;letter-spacing:1.1px!important;color:#2563eb!important}
      .pdfuc-head h1{margin-top:4px!important;font-size:clamp(30px,3vw,40px)!important;letter-spacing:-1.1px!important;color:#102a4c!important}
      .pdfuc-head p{max-width:760px!important;margin-top:7px!important;font-size:13px!important;line-height:1.65!important;color:#64748b!important}
      .pdfuc-head p br{display:none!important}.pdfuc-head p b{color:#334155!important}

      .pdf-clean-quick{margin:0 0 26px}.pdf-clean-section-head{display:flex;align-items:flex-end;justify-content:space-between;gap:12px;margin-bottom:11px}.pdf-clean-section-head strong{font-size:17px;color:#172033}.pdf-clean-section-head span{font-size:10px;color:#94a3b8}
      .pdf-clean-quick-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:12px}
      .pdf-clean-quick-card{display:grid;grid-template-columns:44px minmax(0,1fr) 18px;align-items:center;gap:11px;min-height:88px;padding:15px 16px;border:1px solid #dce5ef;border-radius:16px;background:#fff;text-align:left;cursor:pointer;box-shadow:0 5px 16px rgba(15,23,42,.035);transition:border-color .15s ease,transform .15s ease,box-shadow .15s ease}
      .pdf-clean-quick-card:hover{transform:translateY(-1px);border-color:#a9c5ea;box-shadow:0 10px 24px rgba(37,99,235,.08)}
      .pdf-clean-quick-icon{display:grid;place-items:center;width:44px;height:44px;border-radius:12px;background:#eef5ff;color:#1d4ed8;font-size:16px;font-weight:950}.pdf-clean-quick-copy{min-width:0}.pdf-clean-quick-copy strong{display:block;font-size:13px;color:#172033}.pdf-clean-quick-copy span{display:block;margin-top:3px;font-size:10px;line-height:1.45;color:#7a8798}.pdf-clean-quick-arrow{font-size:16px;color:#a0aec0}

      .pdfuc-section-title{align-items:flex-end!important;margin:0 0 12px!important}.pdfuc-section-title strong{font-size:17px!important;color:#172033!important}.pdfuc-section-title span{font-size:10px!important;color:#94a3b8!important}
      .pdfuc-categories{grid-template-columns:repeat(4,minmax(0,1fr))!important;gap:12px!important;align-items:stretch!important}
      .pdfuc-category{display:flex!important;min-width:0!important;flex-direction:column!important;padding:16px!important;border:1px solid #dce5ef!important;border-radius:18px!important;background:#fff!important;box-shadow:0 5px 16px rgba(15,23,42,.035)!important}
      .pdfuc-cat-head{min-height:106px!important;margin:0 0 9px!important;padding:4px 4px 14px!important;border-bottom:1px solid #edf2f7!important}.pdfuc-cat-icon{width:46px!important;height:46px!important;margin-bottom:10px!important;border-radius:12px!important;font-size:23px!important}.pdfuc-cat-head strong{font-size:16px!important;color:#172033!important}.pdfuc-cat-head>span:not(.pdfuc-cat-icon){margin-top:4px!important;font-size:10px!important;line-height:1.45!important;color:#8290a3!important}
      .pdfuc-cat-tools{flex:1!important}.pdfuc-category .pdfu-menu-group{margin:0!important}.pdfuc-category .pdfu-menu-group-head{display:none!important}
      .pdfuc-category .pdfu-menu-item{grid-template-columns:34px minmax(0,1fr)!important;gap:9px!important;min-height:57px!important;margin:2px 0!important;padding:10px 9px!important;border:1px solid transparent!important;border-radius:11px!important;background:#fff!important;color:#334155!important}
      .pdfuc-category .pdfu-menu-item:hover{border-color:#d8e6f7!important;background:#f8fbff!important}.pdfuc-category .pdfu-menu-item.active{border-color:#b9d2f2!important;background:#eef5ff!important;box-shadow:none!important}.pdfuc-category .pdfu-menu-icon{font-size:18px!important}.pdfuc-category .pdfu-menu-name{font-size:12px!important;line-height:1.4!important;font-weight:900!important;white-space:normal!important}.pdfuc-category .pdfu-menu-badge{display:none!important}
      .pdfuc-footnote{margin-top:18px!important;font-size:9px!important;color:#94a3b8!important}

      .pdfuc-modal{padding:16px!important;background:rgba(15,23,42,.66)!important;backdrop-filter:blur(7px)!important;align-items:stretch!important}
      .pdfuc-modal .pdfuc-dialog{width:min(1500px,calc(100vw - 32px))!important;height:min(960px,calc(100vh - 32px))!important;margin:auto!important;border-radius:22px!important;background:#eef3f7!important;box-shadow:0 36px 110px rgba(15,23,42,.4)!important}
      .pdfuc-modal-top{height:60px!important;flex:0 0 60px!important;padding:0 16px 0 20px!important}.pdfuc-modal-top strong{font-size:16px!important}.pdfuc-modal-file{font-size:10px!important}.pdfuc-modal-close{width:38px!important;height:38px!important;border-radius:10px!important}
      .pdfuc-dialog>.pdfu-stage{min-height:0!important}.pdfuc-dialog .pdfu-stage-head{flex:0 0 70px!important}.pdfuc-dialog .pdfu-stage-body{min-height:0!important;padding:22px!important;overflow:auto!important}

      .pdfuc-dialog .pdfud-card{min-height:100%!important;padding:0!important;border:0!important;background:transparent!important;box-shadow:none!important}
      .pdfuc-dialog .pdfud-grid{grid-template-columns:minmax(410px,.95fr) minmax(0,1.05fr)!important;gap:18px!important;align-items:stretch!important;min-height:100%!important}
      .pdfuc-dialog .pdfud-panel{display:flex!important;min-height:100%!important;flex-direction:column!important;padding:22px!important;border:1px solid #dce5ef!important;border-radius:17px!important;background:#fff!important}
      .pdfuc-dialog .pdfud-panel h3{font-size:16px!important}.pdfuc-dialog .pdfud-copy{font-size:11px!important;line-height:1.6!important}
      .pdfuc-dialog .pdfud-file{display:flex!important;min-height:300px!important;flex-direction:column!important;align-items:center!important;justify-content:center!important;padding:30px 22px!important;border-width:2px!important;border-radius:16px!important;font-size:14px!important;line-height:1.65!important;background:#fbfdff!important}
      .pdfuc-dialog .pdfud-selected{min-height:20px!important;margin-top:10px!important;font-size:10px!important}.pdfuc-dialog .pdfud-run{min-height:46px!important;font-size:11px!important}.pdfuc-dialog .pdfud-status.show{display:flex!important;min-height:68px!important;align-items:center!important;padding:12px 14px!important;font-size:10px!important}.pdfuc-dialog .pdfud-result{min-height:100%!important}.pdfuc-dialog .pdfud-empty{flex:1!important;min-height:410px!important;font-size:11px!important;line-height:1.65!important}

      .pdfuc-dialog .pdfu-local-workgrid{grid-template-columns:minmax(410px,.95fr) minmax(0,1.05fr)!important;gap:18px!important;min-height:calc(100vh - 230px)!important}.pdfuc-dialog .pdfu-local-controls,.pdfuc-dialog .pdfu-local-result{padding:22px!important;border-radius:17px!important;background:#fff!important}.pdfuc-dialog .pdfu-local-controls .drop{display:flex!important;min-height:280px!important;align-items:center!important;justify-content:center!important;padding:28px 20px!important;border-width:2px!important}.pdfuc-dialog .pdfu-local-controls .drop strong{font-size:13px!important}.pdfuc-dialog .pdfu-local-controls .drop span{font-size:10px!important}.pdfuc-dialog .pdfu-local-result-slot{min-height:410px!important}
      .pdfuc-dialog .pdfu-stage-body.pdfu-shared-advanced-stage{grid-template-columns:minmax(390px,450px) minmax(0,1fr)!important;gap:18px!important}

      .pdfuc-dialog .pdfuc-server-card{width:100%!important;min-height:100%!important;display:flex!important;flex-direction:column!important;padding:24px!important;border-radius:17px!important;background:#fff!important}.pdfuc-dialog .pdfuc-server-intro{font-size:11px!important}.pdfuc-dialog .pdfuc-tool-upload{display:flex!important;min-height:300px!important;flex-direction:column!important;align-items:center!important;justify-content:center!important;padding:30px 22px!important;border-width:2px!important;border-radius:16px!important;background:#fbfdff!important}.pdfuc-dialog .pdfuc-server-files{min-height:76px!important}.pdfuc-dialog .pdfuc-server-run{min-height:46px!important;font-size:11px!important}.pdfuc-dialog .pdfuc-server-progress.show,.pdfuc-dialog .pdfuc-server-result.show{min-height:80px!important}

      @media(max-width:1180px){.pdf-clean-quick-grid{grid-template-columns:repeat(2,minmax(0,1fr))}.pdfuc-categories{grid-template-columns:repeat(2,minmax(0,1fr))!important}.pdfuc-dialog .pdfud-grid,.pdfuc-dialog .pdfu-local-workgrid{grid-template-columns:minmax(340px,.9fr) minmax(0,1.1fr)!important}}
      @media(max-width:900px){.pdfuc-dialog .pdfud-grid,.pdfuc-dialog .pdfu-local-workgrid,.pdfuc-dialog .pdfu-stage-body.pdfu-shared-advanced-stage{grid-template-columns:1fr!important}.pdfuc-dialog .pdfud-file,.pdfuc-dialog .pdfu-local-controls .drop,.pdfuc-dialog .pdfuc-tool-upload{min-height:220px!important}.pdfuc-dialog .pdfud-empty,.pdfuc-dialog .pdfu-local-result-slot{min-height:290px!important}}
      @media(max-width:700px){.pdfuc-home{padding:24px 12px 42px!important}.pdfuc-head h1{font-size:29px!important}.pdfuc-head p{font-size:12px!important}.pdf-clean-section-head span,.pdfuc-section-title span{display:none!important}.pdf-clean-quick-grid,.pdfuc-categories{grid-template-columns:1fr!important}.pdf-clean-quick-card{min-height:78px;padding:12px 13px}.pdfuc-cat-head{min-height:auto!important}.pdfuc-modal{padding:6px!important}.pdfuc-modal .pdfuc-dialog{width:calc(100vw - 12px)!important;height:calc(100vh - 12px)!important;border-radius:15px!important}.pdfuc-dialog .pdfu-stage-body{padding:12px!important}.pdfuc-dialog .pdfud-panel,.pdfuc-dialog .pdfu-local-controls,.pdfuc-dialog .pdfu-local-result,.pdfuc-dialog .pdfuc-server-card{padding:15px!important}.pdfuc-dialog .pdfud-file,.pdfuc-dialog .pdfu-local-controls .drop,.pdfuc-dialog .pdfuc-tool-upload{min-height:180px!important}.pdfuc-dialog .pdfud-empty,.pdfuc-dialog .pdfu-local-result-slot{min-height:220px!important}}
    `;
    document.head.appendChild(style);
  }

  function sourceName(button){
    return button?.dataset.pdfuCoreSource||button?.querySelector('.pdfu-menu-name')?.textContent?.trim()||'';
  }

  function findButton(source){
    return [...document.querySelectorAll('[data-pdfu-tool]')].find(button=>sourceName(button)===source)||null;
  }

  function quickCard(item){
    const button=document.createElement('button');
    button.type='button';
    button.className='pdf-clean-quick-card';
    button.dataset.pdfCleanQuick=item.source;
    button.innerHTML=`<span class="pdf-clean-quick-icon">${item.icon}</span><span class="pdf-clean-quick-copy"><strong>${item.name}</strong><span>${item.desc}</span></span><span class="pdf-clean-quick-arrow" aria-hidden="true">›</span>`;
    button.addEventListener('click',()=>{
      const target=findButton(item.source);
      if(target)target.click();
    });
    return button;
  }

  function mountQuick(){
    const inner=$('pdfUtilityCenteredInner');
    const categories=$('pdfUtilityCenteredCategories');
    if(!inner||!categories||$('pdfUtilityCleanQuick'))return Boolean(inner&&categories);
    const section=document.createElement('section');
    section.id='pdfUtilityCleanQuick';
    section.className='pdf-clean-quick';
    section.innerHTML='<div class="pdf-clean-section-head"><strong>자주 쓰는 작업</strong><span>가장 많이 쓰는 기능을 바로 엽니다.</span></div><div class="pdf-clean-quick-grid"></div>';
    const grid=section.querySelector('.pdf-clean-quick-grid');
    QUICK.forEach(item=>grid.appendChild(quickCard(item)));
    const title=inner.querySelector('.pdfuc-section-title');
    inner.insertBefore(section,title||categories);
    return true;
  }

  function syncCategoryCopy(){
    const root=$('pdfUtilityCenteredCategories');
    if(!root)return false;
    Object.entries(CATEGORY_COPY).forEach(([category,text])=>{
      const copy=root.querySelector(`.pdfuc-category[data-category="${category}"] .pdfuc-cat-head>span:not(.pdfuc-cat-icon)`);
      if(copy)copy.textContent=text;
    });
    return true;
  }

  function syncHeader(){
    const head=document.querySelector('.pdfuc-head');
    if(!head)return false;
    const title=head.querySelector('h1');
    const copy=head.querySelector('p');
    if(title)title.textContent='PDF 유틸리티';
    if(copy)copy.innerHTML='<b>필요한 기능을 선택하고 파일을 올리면 됩니다.</b> 합치기·추출·회전·변환·OCR·압축·암호·검사를 한곳에서 처리합니다.';
    return true;
  }

  function syncRotate270(){
    const panel=document.querySelector('#pdfUtilityStageBody #local-tools[data-local-focus="rotate"]');
    if(!panel)return;
    const button=panel.querySelector('[data-local-run="rotate270"]');
    if(button)button.style.display='block';
  }

  function apply(){
    installStyle();
    const ready=syncHeader()&&syncCategoryCopy();
    mountQuick();
    syncRotate270();
    if(ready){
      document.documentElement.dataset.pdfUtilityCleanUi='ready-v1';
      document.documentElement.dataset.pdfUtilityCenteredRefinements='tool-first-v4-large-layout';
      document.documentElement.dataset.pdfUtilityCorePresentation='clean-16-tools';
    }
    return ready;
  }

  function install(){
    installStyle();
    let attempts=0;
    const timer=setInterval(()=>{
      attempts+=1;
      if(apply()||attempts>=160)clearInterval(timer);
    },25);
    apply();
    const observer=new MutationObserver(()=>{mountQuick();syncRotate270();});
    observer.observe(document.documentElement,{subtree:true,childList:true,attributes:true,attributeFilter:['class','data-local-focus']});
  }

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install,{once:true});else install();
  window.ProgramStudioPdfUtilityCleanUi=Object.freeze({stage:'pdf-utility-clean-ui-v1',apply,mountQuick});
  window.ProgramStudioPdfUtilityCenteredFixes=Object.freeze({stage:'pdf-utility-centered-fixes-v5'});
})();
