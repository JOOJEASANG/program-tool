// Stabilize PDF Utility right-stage layouts and recover local/advanced tool transitions.
(function(){
  'use strict';
  if(window.__programStudioPdfUtilityWorkspaceStabilityV1)return;
  window.__programStudioPdfUtilityWorkspaceStabilityV1=true;

  const $=id=>document.getElementById(id);
  const SHARED_ADVANCED=new Map([
    ['첨부파일 추출',{action:'attachments',overlay:'pdfAdvancedAttachments'}],
    ['접근성·태그 기본 검사',{action:'accessibility',overlay:'pdfAdvancedAccessibility'}],
    ['책갈피·페이지 라벨 분석',{action:'outline',overlay:'pdfAdvancedOutline'}]
  ]);
  const INLINE_ADVANCED=new Map([
    ['PDF 버전 비교',{action:'compare',overlay:'pdfAdvancedCompare'}],
    ['영구 마스킹·Redaction',{action:'redact',overlay:'pdfAdvancedRedact'}]
  ]);
  const OCR_TOOLS=new Map([
    ['한국어·영어 OCR 문자 인식','txt'],
    ['OCR 검색 가능한 PDF','pdf']
  ]);
  let auditSerial=0;

  function installStyle(){
    if($('pdfUtilityWorkspaceStabilityStyle'))return;
    const style=document.createElement('style');
    style.id='pdfUtilityWorkspaceStabilityStyle';
    style.textContent=`
      .pdfu-stage-body #local-tools.pdfu-local-focus{padding:0!important;border:0!important;background:transparent!important;box-shadow:none!important;border-radius:0!important}
      .pdfu-local-workgrid{display:grid;grid-template-columns:minmax(300px,410px) minmax(0,1fr);gap:16px;align-items:stretch;width:100%;min-height:min(540px,calc(100vh - 178px))}
      .pdfu-local-controls,.pdfu-local-result{min-width:0;background:#fff;border:1px solid #dce5ef;border-radius:16px;padding:18px;box-shadow:0 8px 24px rgba(15,23,42,.045)}
      .pdfu-local-controls{align-self:start}.pdfu-local-controls .local-head{display:grid;grid-template-columns:46px minmax(0,1fr);gap:11px;align-items:start}.pdfu-local-controls .local-head-icon{width:46px;height:46px;flex:0 0 46px;font-size:22px}.pdfu-local-controls .local-head>div:nth-child(2){min-width:0}.pdfu-local-controls .local-head h2{font-size:16px;line-height:1.3}.pdfu-local-controls .local-head p{font-size:10px;line-height:1.55;margin-top:5px}.pdfu-local-controls .local-badge{grid-column:1/-1;justify-self:start;margin:1px 0 0;padding:5px 8px;font-size:8px}
      .pdfu-local-controls .drop{margin-top:15px!important;padding:22px 14px!important;border-radius:13px!important;background:#fbfdff!important}.pdfu-local-controls .drop strong{font-size:12px}.pdfu-local-controls .drop span{font-size:9px;line-height:1.5}.pdfu-local-controls .file-note{margin-top:9px!important}
      .pdfu-local-controls .local-actions{grid-template-columns:repeat(2,minmax(0,1fr))!important;gap:8px!important;margin-top:11px!important;justify-content:stretch!important}.pdfu-local-controls .local-btn{width:100%;min-height:42px;padding:10px 8px!important;border-radius:10px!important;font-size:10px!important}
      .pdfu-local-result{display:flex;flex-direction:column;min-height:100%}.pdfu-local-result-head{display:flex;align-items:center;justify-content:space-between;gap:10px;padding-bottom:11px;border-bottom:1px solid #edf2f7}.pdfu-local-result-head strong{font-size:13px;color:#0f2f59}.pdfu-local-result-head span{font-size:8px;font-weight:850;color:#94a3b8}.pdfu-local-result-slot{flex:1;min-height:285px;padding-top:12px}.pdfu-local-result-slot:empty{display:grid;place-items:center}.pdfu-local-result-slot:empty::before{content:'파일을 선택하면 작업 옵션과 결과가 이 영역에 표시됩니다.';max-width:320px;text-align:center;color:#94a3b8;font-size:10px;line-height:1.65}.pdfu-local-result .local-status{margin-top:10px!important;border:1px solid #dbeafe;background:#eff6ff;border-radius:9px;padding:9px 10px;min-height:36px;line-height:1.5}.pdfu-local-result .local-status:empty{display:none}.pdfu-local-result .local-status.ok{border-color:#bbf7d0;background:#f0fdf4}.pdfu-local-result .local-status.err{border-color:#fecaca;background:#fef2f2}.pdfu-local-result .meta-box{margin-top:10px!important}
      .pdfu-stage-body.pdfu-shared-advanced-stage{display:grid;grid-template-columns:minmax(285px,370px) minmax(0,1fr);gap:16px;align-items:start}.pdfu-shared-advanced-stage>#local-tools{min-width:0}.pdfu-shared-advanced-stage>#local-tools .pdfu-local-workgrid{display:block;min-height:0}.pdfu-shared-advanced-stage>#local-tools .pdfu-local-result{display:none}.pdfu-shared-advanced-stage>#local-tools .pdfu-local-controls{padding:16px}.pdfu-shared-advanced-stage>.pdfadv-overlay{min-width:0}
      .pdfadv-overlay.pdfu-stable-inline,.pdfocr-overlay.pdfu-stable-inline{position:relative!important;inset:auto!important;z-index:auto!important;display:block!important;width:100%!important;min-height:0!important;padding:0!important;background:transparent!important;backdrop-filter:none!important;align-items:stretch!important;justify-content:stretch!important}.pdfadv-overlay.pdfu-stable-inline .pdfadv-dialog,.pdfocr-overlay.pdfu-stable-inline .pdfocr-dialog{width:100%!important;max-width:none!important;max-height:none!important;margin:0!important;border:0!important;border-radius:12px!important;box-shadow:none!important;padding:14px!important}.pdfadv-overlay.pdfu-stable-inline:not(.open),.pdfocr-overlay.pdfu-stable-inline:not(.open){display:none!important}
      .pdfu-stage-body>.pdfadv-overlay.pdfu-stable-inline,.pdfu-stage-body>.pdfocr-overlay.pdfu-stable-inline{background:#fff!important;border:1px solid #dce5ef!important;border-radius:16px!important;padding:8px!important;box-shadow:0 8px 24px rgba(15,23,42,.045)!important}
      .pdfu-stage-recovery{background:#fff;border:1px solid #fecaca;border-radius:16px;padding:28px;min-height:320px;display:grid;place-items:center;text-align:center;color:#64748b}.pdfu-stage-recovery strong{display:block;font-size:16px;color:#991b1b;margin-bottom:7px}.pdfu-stage-recovery p{font-size:10px;line-height:1.65;max-width:480px}.pdfu-stage-recovery button{margin-top:14px;border:0;border-radius:9px;background:#0f2f59;color:#fff;padding:9px 13px;font-size:10px;font-weight:900;cursor:pointer}
      @media(max-width:1040px){.pdfu-local-workgrid{grid-template-columns:minmax(270px,360px) minmax(0,1fr)}.pdfu-stage-body.pdfu-shared-advanced-stage{grid-template-columns:minmax(270px,340px) minmax(0,1fr)}}
      @media(max-width:780px){.pdfu-local-workgrid{grid-template-columns:1fr;min-height:0}.pdfu-local-result{min-height:360px}.pdfu-local-controls .local-actions{grid-template-columns:repeat(2,minmax(0,1fr))!important}.pdfu-stage-body.pdfu-shared-advanced-stage{grid-template-columns:1fr}.pdfu-shared-advanced-stage>#local-tools .pdfu-local-result{display:none}}
      @media(max-width:480px){.pdfu-local-controls,.pdfu-local-result{padding:13px}.pdfu-local-controls .local-actions{grid-template-columns:1fr!important}}
    `;
    document.head.appendChild(style);
  }

  function currentName(){
    return document.querySelector('[data-pdfu-tool].active .pdfu-menu-name')?.textContent?.trim()||window.ProgramStudioPdfSinglePageWorkspace?.currentTool||'';
  }

  function stage(){return $('pdfUtilityStageBody');}
  function clearStageMode(){stage()?.classList.remove('pdfu-shared-advanced-stage');}

  function ensureLocalStructure(panel=$('local-tools')){
    if(!panel)return null;
    if(panel.dataset.pdfuStableLayout==='1')return panel;
    const head=panel.querySelector('.local-head');
    const drop=panel.querySelector('#localDrop');
    const input=panel.querySelector('#localFile');
    const note=panel.querySelector('#localFileNote');
    const actions=panel.querySelector('.local-actions');
    const status=panel.querySelector('#localStatus');
    const metadata=panel.querySelector('#localMetadata');
    if(!head||!drop||!actions||!status)return panel;

    const grid=document.createElement('div');grid.className='pdfu-local-workgrid';
    const controls=document.createElement('section');controls.className='pdfu-local-controls';
    const result=document.createElement('section');result.className='pdfu-local-result';
    const resultHead=document.createElement('div');resultHead.className='pdfu-local-result-head';resultHead.innerHTML='<strong>작업 · 결과</strong><span>브라우저 로컬 처리</span>';
    const slot=document.createElement('div');slot.className='pdfu-local-result-slot';
    [head,drop,input,note,actions].filter(Boolean).forEach(node=>controls.appendChild(node));
    result.append(resultHead,slot,status);if(metadata)result.appendChild(metadata);
    grid.append(controls,result);panel.replaceChildren(grid);panel.dataset.pdfuStableLayout='1';
    return panel;
  }

  function sharedSpec(name=currentName()){return SHARED_ADVANCED.get(name)||null;}
  function inlineSpec(name=currentName()){return INLINE_ADVANCED.get(name)||null;}

  function closeInlineOverlays(){
    clearStageMode();
    document.querySelectorAll('.pdfadv-overlay.open,.pdfocr-overlay.open').forEach(overlay=>{
      overlay.classList.remove('open','pdfu-inline-overlay','pdfu-stable-inline');
      if(overlay.parentElement!==document.body)document.body.appendChild(overlay);
    });
    document.body.style.overflow='';
    document.documentElement.dataset.pdfUtilityOverlayReset='done';
  }

  function wrapDirectBridge(){
    const bridge=window.ProgramStudioPdfUtilityDirectBridge;
    if(!bridge||bridge.__workspaceStabilityWrapped)return;
    const wrapped=Object.freeze({
      __workspaceStabilityWrapped:true,
      activate(tool){closeInlineOverlays();return bridge.activate?.(tool)===true;},
      handles:name=>bridge.handles?.(name),
      requiresAuth:name=>bridge.requiresAuth?.(name),
      reset(){closeInlineOverlays();return bridge.reset?.();},
      typeFor:name=>bridge.typeFor?.(name),
      stage:'pdf-utility-direct-tools-stable-v1'
    });
    window.ProgramStudioPdfUtilityDirectBridge=wrapped;
    document.documentElement.dataset.pdfUtilityDirectReset='stable';
  }

  function normalizeOverlay(overlay,name=currentName()){
    const targetStage=stage();if(!targetStage||!overlay?.classList.contains('open'))return false;
    overlay.classList.add('pdfu-inline-overlay','pdfu-stable-inline');
    const shared=SHARED_ADVANCED.has(name);
    targetStage.classList.toggle('pdfu-shared-advanced-stage',shared);
    if(shared){
      ensureLocalStructure(targetStage.querySelector('#local-tools')||$('local-tools'));
      if(overlay.parentElement!==targetStage)targetStage.appendChild(overlay);
    }else if(overlay.parentElement!==targetStage){
      targetStage.replaceChildren(overlay);
    }
    document.body.style.overflow='';
    document.documentElement.dataset.pdfUtilityInlineOverlay=name||'ready';
    return true;
  }

  function normalizeOpenOverlays(name=currentName()){
    document.querySelectorAll('.pdfadv-overlay.open,.pdfocr-overlay.open').forEach(overlay=>normalizeOverlay(overlay,name));
    if(document.body.style.overflow==='hidden'&&stage()?.querySelector('.pdfadv-overlay.open,.pdfocr-overlay.open'))document.body.style.overflow='';
  }

  function recoverAdvanced(name){
    const spec=sharedSpec(name)||inlineSpec(name);if(!spec)return false;
    const overlay=$(spec.overlay);if(overlay?.classList.contains('open'))return normalizeOverlay(overlay,name);
    const api=window.ProgramStudioPdfSuiteAdvanced;
    if(!api?.launch)return false;
    api.launch(spec.action);setTimeout(()=>normalizeOpenOverlays(name),0);return true;
  }

  function recoverOcr(name){
    const mode=OCR_TOOLS.get(name);if(!mode)return false;
    const overlay=$('pdfSuiteOcrModal');if(overlay?.classList.contains('open'))return normalizeOverlay(overlay,name);
    const api=window.ProgramStudioPdfSuiteOcr;
    if(!api?.open)return false;
    api.open(mode);setTimeout(()=>normalizeOpenOverlays(name),0);return true;
  }

  function stageHasContent(){
    const targetStage=stage();if(!targetStage)return false;
    return [...targetStage.children].some(node=>{
      const style=getComputedStyle(node);return style.display!=='none'&&style.visibility!=='hidden'&&(node.getBoundingClientRect().height>1||node.textContent.trim());
    });
  }

  function recoveryCard(name){
    const targetStage=stage();if(!targetStage)return;
    clearStageMode();
    targetStage.innerHTML=`<section class="pdfu-stage-recovery"><div><strong>${String(name||'PDF 기능')} 화면을 불러오지 못했습니다.</strong><p>기능 초기화가 지연되었습니다. 아래 버튼으로 해당 메뉴를 다시 연결할 수 있습니다.</p><button type="button" data-pdfu-retry>다시 연결</button></div></section>`;
    targetStage.querySelector('[data-pdfu-retry]')?.addEventListener('click',()=>window.ProgramStudioPdfSinglePageWorkspace?.selectTool?.(name));
    document.documentElement.dataset.pdfUtilityStageRecovery=name||'unknown';
  }

  function auditSelection(name,serial){
    if(serial!==auditSerial)return;
    const targetStage=stage();if(!targetStage)return;
    const local=targetStage.querySelector('#local-tools');if(local)ensureLocalStructure(local);
    normalizeOpenOverlays(name);

    const advanced=sharedSpec(name)||inlineSpec(name);
    if(advanced&&!$(advanced.overlay)?.classList.contains('open'))recoverAdvanced(name);
    if(OCR_TOOLS.has(name)&&!$('pdfSuiteOcrModal')?.classList.contains('open'))recoverOcr(name);

    setTimeout(()=>{
      if(serial!==auditSerial)return;
      const localNow=targetStage.querySelector('#local-tools');if(localNow)ensureLocalStructure(localNow);
      normalizeOpenOverlays(name);
      if(!stageHasContent()){
        const retried=targetStage.dataset.pdfuAuditRetried===name;
        if(!retried){targetStage.dataset.pdfuAuditRetried=name;window.ProgramStudioPdfSinglePageWorkspace?.selectTool?.(name);setTimeout(()=>auditSelection(name,serial),80);}
        else recoveryCard(name);
      }else{
        delete targetStage.dataset.pdfuAuditRetried;
        document.documentElement.dataset.pdfUtilityMenuAudit='ok';
        document.documentElement.dataset.pdfUtilityMenuAuditLast=name||'unknown';
      }
    },120);
  }

  function onMenuClick(event){
    const button=event.target.closest?.('[data-pdfu-tool]');if(!button)return;
    const name=button.querySelector('.pdfu-menu-name')?.textContent?.trim()||'';
    clearStageMode();
    const serial=++auditSerial;
    setTimeout(()=>auditSelection(name,serial),0);
  }

  function observe(){
    const observer=new MutationObserver(()=>{
      const name=currentName();
      const local=stage()?.querySelector('#local-tools');if(local)ensureLocalStructure(local);
      normalizeOpenOverlays(name);
    });
    observer.observe(document.body,{subtree:true,childList:true,attributes:true,attributeFilter:['class']});
  }

  function install(){
    installStyle();ensureLocalStructure();wrapDirectBridge();
    document.addEventListener('click',onMenuClick,false);
    observe();
    setTimeout(()=>{const local=stage()?.querySelector('#local-tools');if(local)ensureLocalStructure(local);normalizeOpenOverlays();},0);
    document.documentElement.dataset.pdfUtilityWorkspaceStability='ready';
  }

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install,{once:true});else install();
  window.ProgramStudioPdfUtilityWorkspaceStability=Object.freeze({ensureLocalStructure,normalizeOpenOverlays,closeInlineOverlays,recoverAdvanced,recoverOcr,stage:'pdf-utility-workspace-stability-v1'});
})();